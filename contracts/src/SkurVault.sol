// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SkurTypes.sol";
import {ISkurVault} from "./ISkurVault.sol";
import {SkurRisk} from "./SkurRisk.sol";
import {SkurPolicyLib} from "./SkurPolicyLib.sol";

/// @title SkurVault
/// @notice Self-custodial treasury vault with deterministic transaction-risk controls.
/// @dev A valid signature proves authorization; it does not prove that a transaction is safe.
///      Every control here is enforced onchain. No Skur server is in the execution path.
///
///      Planes:
///        - Treasury plane  (OWNER | APPROVER | EXECUTOR): propose, approve, execute transfers.
///        - Governance plane (OWNER): policy, limits, membership, recipient trust, mode relaxation.
///        - Guardian plane  (GUARDIAN): freeze, veto, confirm critical actions, recovery. Never withdraws.
///
///      Deployed behind EIP-1167 minimal proxies by SkurFactory; logic is immutable (no upgrade path in V1).
contract SkurVault is ISkurVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------ storage
    bool private _initialized;
    Mode public mode;
    uint32 public policyVersion;
    Policy private _policy;

    uint256 public proposalCount;
    uint256 public pendingCount; // aggregate for invariants (never derived by iterating a mapping)
    uint256 public executedCount;

    address[] private _members;
    mapping(address => uint8) public rolesOf;
    mapping(address => uint256) private _memberIndexPlusOne;
    uint8 public ownerCount;
    uint8 public approverCount;
    uint8 public executorCount;
    uint8 public guardianCount;

    address[] private _assets;
    mapping(address => bool) private _assetListed;
    mapping(address => AssetLimits) private _assetLimits;
    mapping(address => Recipient) private _recipients;
    mapping(address => Velocity) private _velocity;
    mapping(address => uint256) public totalOutflow; // lifetime executed outflow per asset
    mapping(address => uint256) public totalDeposited; // deposits seen through receive()/depositERC20

    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => address[]) private _approvers;
    mapping(uint256 => address[]) private _guardianConfirmers;
    mapping(uint256 => mapping(address => bool)) public hasApproved;

    uint64 private constant DAY = 1 days;

    constructor() {
        // The implementation itself is never a vault; only clones are initialized.
        _initialized = true;
    }

    // ------------------------------------------------------------------ initialization
    function initialize(
        address[] calldata members,
        uint8[] calldata roles,
        Policy calldata policy,
        address[] calldata assets,
        AssetLimits[] calldata limits
    ) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;
        if (members.length != roles.length || assets.length != limits.length) revert InvalidProposal("length");
        for (uint256 i = 0; i < members.length; i++) {
            if (rolesOf[members[i]] != 0) revert MemberExists();
            if (roles[i] == 0) revert InvalidRoles();
            _setMember(members[i], roles[i]);
        }
        for (uint256 i = 0; i < assets.length; i++) {
            _setAssetLimits(assets[i], limits[i]);
        }
        _activatePolicy(policy);
        emit VaultInitialized(policyVersion, members.length);
    }

    // ------------------------------------------------------------------ deposits
    receive() external payable {
        totalDeposited[address(0)] += msg.value;
        emit Deposit(msg.sender, address(0), msg.value);
    }

    function depositERC20(address asset, uint256 amount) external {
        if (asset == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountZero();
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited[asset] += amount;
        emit Deposit(msg.sender, asset, amount);
    }

    // ------------------------------------------------------------------ views
    function getPolicy() external view returns (Policy memory) {
        return _policy;
    }

    function getAssetLimits(address asset) external view returns (AssetLimits memory) {
        return _assetLimits[asset];
    }

    function getAssets() external view returns (address[] memory) {
        return _assets;
    }

    function getRecipient(address r) external view returns (Recipient memory) {
        return _recipients[r];
    }

    function getMembers() external view returns (address[] memory addrs, uint8[] memory roles) {
        addrs = _members;
        roles = new uint8[](addrs.length);
        for (uint256 i = 0; i < addrs.length; i++) {
            roles[i] = rolesOf[addrs[i]];
        }
    }

    function getProposal(uint256 id) external view returns (Proposal memory) {
        return _proposals[id];
    }

    function getApprovers(uint256 id) external view returns (address[] memory) {
        return _approvers[id];
    }

    function getGuardianConfirmers(uint256 id) external view returns (address[] memory) {
        return _guardianConfirmers[id];
    }

    /// @notice Approvals and guardian confirmations that still count (removed signers are excluded).
    function liveApprovals(uint256 id) public view returns (uint256 approvals, uint256 guardians) {
        Proposal storage p = _proposals[id];
        approvals = _countLive(_approvers[id], p.kind == Kind.TRANSFER ? ROLE_APPROVER : ROLE_OWNER);
        guardians = _countLive(_guardianConfirmers[id], ROLE_GUARDIAN);
    }

    function isVetoable(uint256 id) public view returns (bool) {
        Proposal storage p = _proposals[id];
        if (p.status != Status.PENDING) return false;
        if (p.securityReducing) return true;
        if (p.kind != Kind.TRANSFER) return false;
        if (p.tier == Tier.CRITICAL) return true;
        if (p.riskReasons & REASON_RECIPIENT_PROBATION != 0) return true;
        return mode != Mode.NORMAL;
    }

    /// @notice Current velocity accounting for an asset, with window rolls applied virtually.
    function velocityOf(address asset)
        external
        view
        returns (uint256 daySpent, uint256 dailyMax, uint256 envelopeSpent, uint256 envelope, uint64 envelopeResetsAt)
    {
        Velocity storage v = _velocity[asset];
        (, dailyMax) = _effectiveCaps(_assetLimits[asset]);
        daySpent = block.timestamp >= v.dayStart + DAY ? 0 : v.daySpent;
        if (_policy.envelopeBps != 0) {
            if (block.timestamp >= v.envelopeStart + _policy.envelopeWindow) {
                envelopeSpent = 0;
                envelope = (_balance(asset) * _policy.envelopeBps) / BPS;
                envelopeResetsAt = 0;
            } else {
                envelopeSpent = v.envelopeSpent;
                envelope = (v.envelopeBase * _policy.envelopeBps) / BPS;
                envelopeResetsAt = v.envelopeStart + _policy.envelopeWindow;
            }
        }
    }

    /// @notice The deterministic risk preview the interface shows before a signature is requested.
    function previewTransfer(address asset, address to, uint256 amount) public view returns (RiskResult memory r) {
        AssetLimits memory l = _assetLimits[asset];
        if (!l.approved) revert AssetNotApproved(asset);
        Recipient memory rec = _recipients[to];
        if (rec.trust == Trust.BLOCKED) revert RecipientBlocked(to);
        (, uint256 dailyMax) = _effectiveCaps(l);
        Velocity storage v = _velocity[asset];
        SkurRisk.Input memory i = SkurRisk.Input({
            amount: amount,
            assetBalance: _balance(asset),
            lowMax: l.lowMax,
            highMax: l.highMax,
            dailyMax: dailyMax,
            daySpent: block.timestamp >= v.dayStart + DAY ? 0 : v.daySpent,
            trust: rec.trust,
            inProbation: rec.trust == Trust.NEW && block.timestamp < rec.activatesAt,
            mode: mode,
            highExposureBps: _policy.highExposureBps,
            criticalExposureBps: _policy.criticalExposureBps
        });
        (r.tier, r.reasons, r.exposureBps) = SkurRisk.classify(i);
        (r.requiredApprovals, r.requiredGuardians, r.delay) = SkurRisk.requirements(_policy, r.tier);
    }

    // ------------------------------------------------------------------ treasury plane
    /// @notice Propose an outgoing transfer of native KASH (asset = address(0)) or an approved ERC-20.
    function proposeTransfer(address asset, address to, uint256 amount, string calldata memo)
        external
        returns (uint256 id)
    {
        _requireRole(ROLE_OWNER | ROLE_APPROVER);
        if (mode == Mode.LOCKDOWN) revert VaultLocked();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountZero();

        RiskResult memory r = previewTransfer(asset, to, amount);
        AssetLimits memory l = _assetLimits[asset];
        _checkStaticLimits(l, amount, r.exposureBps);

        Recipient storage rec = _recipients[to];
        if (rec.trust == Trust.UNKNOWN) _registerRecipient(to);

        uint64 executableAfter = uint64(block.timestamp) + r.delay;
        // Invariant 9: a recipient in probation cannot receive funds before its activation time.
        if (rec.trust == Trust.NEW && rec.activatesAt > executableAfter) executableAfter = rec.activatesAt;

        id = _create(Kind.TRANSFER, to, amount, "", false);
        Proposal storage p = _proposals[id];
        p.tier = r.tier;
        p.riskReasons = r.reasons;
        p.requiredApprovals = r.requiredApprovals;
        p.requiredGuardians = r.requiredGuardians;
        p.asset = asset;
        p.executableAfter = executableAfter;
        _emitCreated(id, p, memo);
    }

    /// @notice Pre-register a recipient so its activation delay starts before the first payment is proposed.
    function registerRecipient(address r) external {
        _requireRole(ROLE_OWNER | ROLE_APPROVER);
        if (r == address(0)) revert ZeroAddress();
        if (_recipients[r].trust != Trust.UNKNOWN) revert InvalidProposal("already registered");
        _registerRecipient(r);
    }

    // ------------------------------------------------------------------ governance plane
    function proposePolicy(Policy calldata next) external returns (uint256 id) {
        _requireRole(ROLE_OWNER);
        SkurPolicyLib.validatePolicy(next);
        bool reducing = SkurPolicyLib.policyReduces(_policy, next);
        id = _createGovernance(
            Kind.POLICY_UPDATE, address(0), 0, abi.encode(next), reducing, 0, _governanceDelay(reducing)
        );
    }

    function proposeAssetLimits(address asset, AssetLimits calldata next) external returns (uint256 id) {
        _requireRole(ROLE_OWNER);
        SkurPolicyLib.validateLimits(next);
        bool reducing = SkurPolicyLib.limitsReduce(_assetLimits[asset], next);
        id = _createGovernance(Kind.ASSET_LIMITS, asset, 0, abi.encode(next), reducing, 0, _governanceDelay(reducing));
    }

    /// @notice Set a member's role bitmask (0 removes the member). Adding authority is security-reducing.
    function proposeMember(address member, uint8 roles) external returns (uint256 id) {
        _requireRole(ROLE_OWNER);
        if (member == address(0)) revert ZeroAddress();
        _validateRoles(roles);
        uint8 prev = rolesOf[member];
        if (prev == roles) revert InvalidProposal("no change");
        bool reducing = _memberChangeReduces(prev, roles);
        id = _createGovernance(Kind.MEMBER_SET, member, roles, "", reducing, 0, _governanceDelay(reducing));
    }

    function proposeRecipientTrust(address recipient, Trust trust) external returns (uint256 id) {
        _requireRole(ROLE_OWNER);
        if (recipient == address(0)) revert ZeroAddress();
        if (trust == Trust.UNKNOWN) revert InvalidProposal("use NEW to re-probate");
        Trust prev = _recipients[recipient].trust;
        bool reducing = _trustReduces(prev, trust);
        id = _createGovernance(
            Kind.RECIPIENT_TRUST, recipient, uint8(trust), "", reducing, 0, _governanceDelay(reducing)
        );
    }

    /// @notice Leaving Lockdown or Elevated. Requires owner threshold + guardian confirmations, and a delay out of Lockdown.
    function proposeModeRelax(Mode target) external returns (uint256 id) {
        _requireRole(ROLE_OWNER);
        if (uint8(target) >= uint8(mode)) revert ModeNotRelaxation();
        // Leaving Lockdown must be a stronger process than entering it: owner threshold, guardian
        // confirmations and the policy-change timelock. Relaxing Elevated -> Normal skips only the timelock.
        uint32 delay = mode == Mode.LOCKDOWN ? _policy.policyChangeDelay : 0;
        id = _createGovernance(Kind.MODE_RELAX, address(0), uint8(target), "", true, _policy.guardianThreshold, delay);
    }

    // ------------------------------------------------------------------ guardian plane
    /// @notice Guardians propose replacing a lost or compromised signer. Delayed; owners can cancel during the delay.
    function proposeRecovery(address oldSigner, address newSigner) external returns (uint256 id) {
        _requireRole(ROLE_GUARDIAN);
        if (newSigner == address(0)) revert ZeroAddress();
        if (rolesOf[oldSigner] == 0) revert NotMember();
        if (rolesOf[newSigner] != 0) revert MemberExists();
        if (_policy.guardianThreshold == 0) revert ThresholdUnsatisfiable("guardianThreshold");
        id = _create(Kind.RECOVERY, oldSigner, 0, abi.encode(newSigner), false);
        Proposal storage p = _proposals[id];
        p.requiredApprovals = 0;
        p.requiredGuardians = _policy.guardianThreshold;
        p.executableAfter = uint64(block.timestamp) + _policy.recoveryDelay;
        _emitCreated(id, p, "recovery");
    }

    /// @notice Owners and guardians can move the vault to a stricter mode immediately.
    function raiseMode(Mode target, bytes32 reason) external {
        _requireRole(ROLE_OWNER | ROLE_GUARDIAN);
        if (uint8(target) <= uint8(mode)) revert ModeNotStricter();
        _setMode(target, reason);
    }

    /// @notice A single guardian can cancel any vetoable proposal at any time before execution.
    function veto(uint256 id, bytes32 reason) external {
        _requireRole(ROLE_GUARDIAN);
        Proposal storage p = _pending(id);
        if (!isVetoable(id)) revert NotVetoable();
        p.status = Status.VETOED;
        pendingCount--;
        emit ProposalVetoed(id, msg.sender, reason);
    }

    // ------------------------------------------------------------------ lifecycle
    /// @notice Approve (treasury or governance) or confirm (guardian) a pending proposal.
    function approve(uint256 id) external {
        Proposal storage p = _pending(id);
        uint8 r = rolesOf[msg.sender];
        if (r & ROLE_GUARDIAN != 0) {
            if (p.requiredGuardians == 0) revert InvalidProposal("guardian confirmation not required");
            if (hasApproved[id][msg.sender]) revert AlreadyApproved();
            hasApproved[id][msg.sender] = true;
            _guardianConfirmers[id].push(msg.sender);
            emit ProposalGuardianConfirmed(id, msg.sender, _guardianConfirmers[id].length);
            return;
        }
        if (p.kind == Kind.RECOVERY) revert NotAuthorized(ROLE_GUARDIAN);
        uint8 need = p.kind == Kind.TRANSFER ? ROLE_APPROVER : ROLE_OWNER;
        if (r & need == 0) revert NotAuthorized(need);
        // Invariant 8: one live approval per signer per proposal, never replayed.
        if (hasApproved[id][msg.sender]) revert AlreadyApproved();
        hasApproved[id][msg.sender] = true;
        _approvers[id].push(msg.sender);
        emit ProposalApproved(id, msg.sender, _approvers[id].length);
    }

    /// @notice Proposer or any owner may cancel a pending proposal.
    function cancel(uint256 id) external {
        Proposal storage p = _pending(id);
        if (msg.sender != p.proposer && rolesOf[msg.sender] & ROLE_OWNER == 0) revert NotCancellable();
        p.status = Status.CANCELLED;
        pendingCount--;
        emit ProposalCancelled(id, msg.sender);
    }

    /// @notice Anyone may mark an expired pending proposal as cancelled to keep aggregates exact.
    function expire(uint256 id) external {
        Proposal storage p = _proposals[id];
        if (p.status != Status.PENDING) revert NotPending();
        if (block.timestamp <= p.expiresAt) revert InvalidProposal("not expired");
        p.status = Status.CANCELLED;
        pendingCount--;
        emit ProposalCancelled(id, msg.sender);
    }

    /// @notice Execute once every pinned condition holds. Limits are re-checked here (lifecycle step 7).
    function execute(uint256 id) external nonReentrant {
        Proposal storage p = _pending(id);
        Kind kind = p.kind;

        if (kind == Kind.TRANSFER) _requireRole(ROLE_EXECUTOR);
        else if (kind == Kind.RECOVERY) _requireRole(ROLE_OWNER | ROLE_GUARDIAN);
        else _requireRole(ROLE_OWNER | ROLE_EXECUTOR);

        if (block.timestamp < p.executableAfter) revert Timelocked(p.executableAfter);
        // Invariant 3: Lockdown blocks outgoing execution and any security-reducing change. Tightening
        // changes, recovery and the audited exit path (MODE_RELAX) stay available.
        if (mode == Mode.LOCKDOWN && (kind == Kind.TRANSFER || (p.securityReducing && kind != Kind.MODE_RELAX))) {
            revert VaultLocked();
        }

        // Requirements were pinned at creation; a policy tightened since then still applies (never weaker).
        uint256 needApprovals = p.requiredApprovals;
        uint256 needGuardians = p.requiredGuardians;
        if (kind == Kind.TRANSFER && p.policyVersion != policyVersion) {
            (uint8 a, uint8 g,) = SkurRisk.requirements(_policy, p.tier);
            if (a > needApprovals) needApprovals = a;
            if (g > needGuardians) needGuardians = g;
        }
        (uint256 haveApprovals, uint256 haveGuardians) = liveApprovals(id);
        if (haveApprovals < needApprovals) revert InsufficientApprovals(haveApprovals, needApprovals);
        if (haveGuardians < needGuardians) revert InsufficientGuardians(haveGuardians, needGuardians);

        if (kind == Kind.TRANSFER) {
            // May trip the circuit breaker: the vault locks and the proposal stays pending.
            if (!_checkTransfer(p)) return;
        }

        // Effects before interactions (invariants 6 and 12).
        p.status = Status.EXECUTED;
        pendingCount--;
        executedCount++;
        emit ProposalExecuted(id, msg.sender);

        if (kind == Kind.TRANSFER) _settleTransfer(id, p);
        else if (kind == Kind.POLICY_UPDATE) _activatePolicy(abi.decode(p.data, (Policy)));
        else if (kind == Kind.ASSET_LIMITS) _setAssetLimits(p.target, abi.decode(p.data, (AssetLimits)));
        else if (kind == Kind.MEMBER_SET) _applyMember(p.target, uint8(p.amount));
        else if (kind == Kind.RECIPIENT_TRUST) _setTrust(p.target, Trust(uint8(p.amount)));
        else if (kind == Kind.MODE_RELAX) _applyRelax(Mode(uint8(p.amount)));
        else _applyRecovery(id, p);
    }

    // ------------------------------------------------------------------ internal: proposals
    function _create(Kind kind, address target, uint256 amount, bytes memory data, bool reducing)
        private
        returns (uint256 id)
    {
        id = ++proposalCount;
        pendingCount++;
        Proposal storage p = _proposals[id];
        p.kind = kind;
        p.status = Status.PENDING;
        p.proposer = msg.sender;
        p.target = target;
        p.amount = amount;
        p.data = data;
        p.securityReducing = reducing;
        p.policyVersion = policyVersion;
        p.createdAt = uint64(block.timestamp);
        p.expiresAt = uint64(block.timestamp) + _policy.proposalTtl;
    }

    function _createGovernance(
        Kind kind,
        address target,
        uint256 amount,
        bytes memory data,
        bool reducing,
        uint8 guardians,
        uint32 delay
    ) private returns (uint256 id) {
        // Policy-change firewall: Lockdown prevents policy relaxation (MODE_RELAX is the audited exit path).
        if (mode == Mode.LOCKDOWN && reducing && kind != Kind.MODE_RELAX) revert VaultLocked();
        id = _create(kind, target, amount, data, reducing);
        Proposal storage p = _proposals[id];
        p.requiredApprovals = _policy.governanceThreshold;
        p.requiredGuardians = guardians;
        p.executableAfter = uint64(block.timestamp) + delay;
        _emitCreated(id, p, "");
    }

    /// @dev Security-reducing changes never activate immediately (invariant 4).
    function _governanceDelay(bool reducing) private view returns (uint32) {
        return reducing ? _policy.policyChangeDelay : 0;
    }

    function _emitCreated(uint256 id, Proposal storage p, string memory memo) private {
        emit ProposalCreated(
            id,
            p.kind,
            p.proposer,
            p.asset,
            p.target,
            p.amount,
            p.tier,
            p.riskReasons,
            p.requiredApprovals,
            p.requiredGuardians,
            p.executableAfter,
            p.expiresAt,
            p.securityReducing,
            memo
        );
    }

    function _pending(uint256 id) private view returns (Proposal storage p) {
        if (id == 0 || id > proposalCount) revert UnknownProposal();
        p = _proposals[id];
        if (p.status != Status.PENDING) revert NotPending();
        if (block.timestamp > p.expiresAt) revert ProposalExpired();
    }

    function _countLive(address[] storage list, uint8 role) private view returns (uint256 n) {
        uint256 len = list.length;
        for (uint256 i = 0; i < len; i++) {
            if (rolesOf[list[i]] & role != 0) n++;
        }
    }

    // ------------------------------------------------------------------ internal: transfers
    function _checkStaticLimits(AssetLimits memory l, uint256 amount, uint16 exposure) private view {
        (uint256 perTxMax,) = _effectiveCaps(l);
        if (perTxMax != 0 && amount > perTxMax) revert PerTxLimitExceeded(amount, perTxMax);
        if (_policy.hardBlockExposureBps != 0 && exposure > _policy.hardBlockExposureBps) {
            revert ExposureHardBlocked(exposure, _policy.hardBlockExposureBps);
        }
    }

    /// @dev Re-checks every limit at execution time. Returns false (and locks the vault) if the envelope would be breached.
    function _checkTransfer(Proposal storage p) private returns (bool) {
        address asset = p.asset;
        uint256 amount = p.amount;
        AssetLimits memory l = _assetLimits[asset];
        if (!l.approved) revert AssetNotApproved(asset);

        Recipient storage rec = _recipients[p.target];
        if (rec.trust == Trust.BLOCKED) revert RecipientBlocked(p.target);
        if (rec.trust == Trust.NEW && block.timestamp < rec.activatesAt) revert Timelocked(rec.activatesAt);

        uint256 bal = _balance(asset);
        if (amount > bal) revert InsufficientBalance(amount, bal);
        _checkStaticLimits(l, amount, SkurRisk.exposureBps(amount, bal));

        (, uint256 dailyMax) = _effectiveCaps(l);
        Velocity storage v = _velocity[asset];
        if (block.timestamp >= v.dayStart + DAY) {
            v.dayStart = uint64(block.timestamp);
            v.daySpent = 0;
        }
        // Invariant 5: cumulative accounting, so a drain split into many transfers hits the same cap.
        if (dailyMax != 0 && v.daySpent + amount > dailyMax) revert VelocityExceeded(v.daySpent + amount, dailyMax);

        if (_policy.envelopeBps != 0) {
            if (block.timestamp >= v.envelopeStart + _policy.envelopeWindow) {
                v.envelopeStart = uint64(block.timestamp);
                v.envelopeBase = bal;
                v.envelopeSpent = 0;
            }
            uint256 envelope = (v.envelopeBase * _policy.envelopeBps) / BPS;
            if (v.envelopeSpent + amount > envelope) {
                // Treasury circuit breaker: freeze instead of paying. Deposits, guardians and recovery keep working.
                emit CircuitBreakerTripped(asset, amount, v.envelopeSpent, envelope);
                _setMode(Mode.LOCKDOWN, "circuit-breaker");
                return false;
            }
            v.envelopeSpent += amount;
        }
        v.daySpent += amount;
        totalOutflow[asset] += amount;
        rec.paymentCount += 1;
        rec.totalPaid += amount;
        return true;
    }

    function _settleTransfer(uint256 id, Proposal storage p) private {
        emit TransferExecuted(id, p.asset, p.target, p.amount);
        if (p.asset == address(0)) {
            (bool ok,) = payable(p.target).call{value: p.amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(p.asset).safeTransfer(p.target, p.amount);
        }
    }

    function _effectiveCaps(AssetLimits memory l) private view returns (uint256 perTxMax, uint256 dailyMax) {
        perTxMax = l.perTxMax;
        dailyMax = l.dailyMax;
        if (mode == Mode.ELEVATED) {
            // Elevated posture halves the caps. A configured cap is floored at 1 unit so it can never
            // round down to 0, which would mean "unlimited".
            if (perTxMax != 0) perTxMax = perTxMax / 2 == 0 ? 1 : perTxMax / 2;
            if (dailyMax != 0) dailyMax = dailyMax / 2 == 0 ? 1 : dailyMax / 2;
        }
    }

    function _balance(address asset) private view returns (uint256) {
        if (asset == address(0)) return address(this).balance;
        return IERC20(asset).balanceOf(address(this));
    }

    // ------------------------------------------------------------------ internal: governance application
    function _activatePolicy(Policy memory p) private {
        SkurPolicyLib.validatePolicy(p);
        _policy = p;
        policyVersion += 1;
        _validateCounts();
        emit PolicyActivated(policyVersion, uint64(block.timestamp), p);
    }

    function _setAssetLimits(address asset, AssetLimits memory l) private {
        SkurPolicyLib.validateLimits(l);
        if (!_assetListed[asset]) {
            _assetListed[asset] = true;
            _assets.push(asset);
        }
        _assetLimits[asset] = l;
        emit AssetLimitsSet(asset, l);
    }

    function _applyMember(address member, uint8 roles) private {
        _setMember(member, roles);
        _validateCounts();
    }

    function _setMember(address member, uint8 roles) private {
        if (member == address(0)) revert ZeroAddress();
        _validateRoles(roles);
        uint8 prev = rolesOf[member];
        if (prev == 0 && roles != 0) {
            _members.push(member);
            _memberIndexPlusOne[member] = _members.length;
        } else if (prev != 0 && roles == 0) {
            uint256 idx = _memberIndexPlusOne[member] - 1;
            uint256 last = _members.length - 1;
            if (idx != last) {
                address moved = _members[last];
                _members[idx] = moved;
                _memberIndexPlusOne[moved] = idx + 1;
            }
            _members.pop();
            delete _memberIndexPlusOne[member];
        }
        _adjustCount(ROLE_OWNER, prev, roles);
        _adjustCount(ROLE_APPROVER, prev, roles);
        _adjustCount(ROLE_EXECUTOR, prev, roles);
        _adjustCount(ROLE_GUARDIAN, prev, roles);
        rolesOf[member] = roles;
        emit MemberSet(member, prev, roles);
    }

    function _adjustCount(uint8 bit, uint8 prev, uint8 next) private {
        bool had = prev & bit != 0;
        bool has = next & bit != 0;
        if (had == has) return;
        if (bit == ROLE_OWNER) ownerCount = has ? ownerCount + 1 : ownerCount - 1;
        else if (bit == ROLE_APPROVER) approverCount = has ? approverCount + 1 : approverCount - 1;
        else if (bit == ROLE_EXECUTOR) executorCount = has ? executorCount + 1 : executorCount - 1;
        else guardianCount = has ? guardianCount + 1 : guardianCount - 1;
    }

    function _registerRecipient(address r) private {
        Recipient storage rec = _recipients[r];
        rec.trust = Trust.NEW;
        rec.registeredAt = uint64(block.timestamp);
        rec.activatesAt = uint64(block.timestamp) + _policy.recipientActivationDelay;
        emit RecipientRegistered(r, rec.activatesAt);
    }

    function _setTrust(address r, Trust trust) private {
        Recipient storage rec = _recipients[r];
        Trust prev = rec.trust;
        if (prev == Trust.UNKNOWN) {
            rec.registeredAt = uint64(block.timestamp);
        }
        if (trust == Trust.NEW) {
            // (Re-)probation restarts the activation clock.
            rec.activatesAt = uint64(block.timestamp) + _policy.recipientActivationDelay;
        }
        rec.trust = trust;
        emit RecipientTrustSet(r, prev, trust);
    }

    function _applyRelax(Mode target) private {
        if (uint8(target) >= uint8(mode)) revert ModeNotRelaxation();
        _setMode(target, "relax");
    }

    function _applyRecovery(uint256 id, Proposal storage p) private {
        address oldSigner = p.target;
        address newSigner = abi.decode(p.data, (address));
        uint8 roles = rolesOf[oldSigner];
        if (roles == 0) revert NotMember();
        if (rolesOf[newSigner] != 0) revert MemberExists();
        // Invariant 10: identical roles, policy untouched, posture never relaxed.
        _setMember(oldSigner, 0);
        _setMember(newSigner, roles);
        _validateCounts();
        if (mode == Mode.NORMAL) _setMode(Mode.ELEVATED, "recovery");
        emit RecoveryCompleted(id, oldSigner, newSigner, roles);
    }

    function _setMode(Mode target, bytes32 reason) private {
        Mode prev = mode;
        mode = target;
        emit ModeChanged(prev, target, msg.sender, reason);
    }

    // ------------------------------------------------------------------ internal: validation
    function _requireRole(uint8 role) private view {
        if (rolesOf[msg.sender] & role == 0) revert NotAuthorized(role);
    }

    function _validateRoles(uint8 roles) private pure {
        if (roles > 15) revert InvalidRoles();
        // Invariant 2 precondition: guardian authority is never combined with treasury authority.
        if (roles & ROLE_GUARDIAN != 0 && roles & ROLE_TREASURY_MASK != 0) revert InvalidRoles();
    }

    /// @dev Thresholds must remain satisfiable by the current member set (checked after every membership or policy change).
    function _validateCounts() private view {
        if (ownerCount < 1) revert ThresholdUnsatisfiable("no owner");
        if (executorCount < 1) revert ThresholdUnsatisfiable("no executor");
        if (ownerCount < _policy.governanceThreshold) revert ThresholdUnsatisfiable("governanceThreshold");
        if (approverCount < _policy.approvalsCritical) revert ThresholdUnsatisfiable("approvalsCritical");
        if (guardianCount < _policy.guardianThreshold) revert ThresholdUnsatisfiable("guardianThreshold");
    }

    // ------------------------------------------------------------------ internal: security-reducing classification
    function _memberChangeReduces(uint8 prev, uint8 next) private pure returns (bool) {
        if (next & ~prev != 0) return true; // any new authority
        if (prev & ROLE_GUARDIAN != 0 && next & ROLE_GUARDIAN == 0) return true; // weakening the guardian layer
        return false;
    }

    function _trustReduces(Trust prev, Trust next) private pure returns (bool) {
        if (next == Trust.VERIFIED || next == Trust.TRUSTED) return true;
        if (next == Trust.NEW && (prev == Trust.RESTRICTED || prev == Trust.BLOCKED)) return true;
        return false;
    }
}
