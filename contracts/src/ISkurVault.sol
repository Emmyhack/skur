// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./SkurTypes.sol";

/// @title SkurVault events and errors
/// @notice Split out so tests, the factory and the interface ABI can import them without the implementation.
interface ISkurVault {
    // ---------------------------------------------------------------- events
    event VaultInitialized(uint32 policyVersion, uint256 memberCount);
    event Deposit(address indexed from, address indexed asset, uint256 amount);
    event MemberSet(address indexed member, uint8 previousRoles, uint8 roles);
    event RecipientRegistered(address indexed recipient, uint64 activatesAt);
    event RecipientTrustSet(address indexed recipient, Trust previous, Trust trust);
    event AssetLimitsSet(address indexed asset, AssetLimits limits);
    event PolicyActivated(uint32 indexed version, uint64 activatedAt, Policy policy);
    event ModeChanged(Mode indexed previous, Mode indexed mode, address indexed by, bytes32 reason);
    event CircuitBreakerTripped(address indexed asset, uint256 attempted, uint256 envelopeSpent, uint256 envelope);

    event ProposalCreated(
        uint256 indexed id,
        Kind indexed kind,
        address indexed proposer,
        address asset,
        address target,
        uint256 amount,
        Tier tier,
        uint16 riskReasons,
        uint8 requiredApprovals,
        uint8 requiredGuardians,
        uint64 executableAfter,
        uint64 expiresAt,
        bool securityReducing,
        string memo
    );
    event ProposalApproved(uint256 indexed id, address indexed approver, uint256 approvals);
    event ProposalGuardianConfirmed(uint256 indexed id, address indexed guardian, uint256 confirmations);
    event ProposalExecuted(uint256 indexed id, address indexed executor);
    event ProposalCancelled(uint256 indexed id, address indexed by);
    event ProposalVetoed(uint256 indexed id, address indexed guardian, bytes32 reason);
    event TransferExecuted(uint256 indexed id, address indexed asset, address indexed to, uint256 amount);
    event RecoveryCompleted(uint256 indexed id, address indexed oldSigner, address indexed newSigner, uint8 roles);

    // ---------------------------------------------------------------- errors
    error AlreadyInitialized();
    error NotAuthorized(uint8 requiredRole);
    error ZeroAddress();
    error InvalidPolicy(string reason);
    error InvalidRoles();
    error ThresholdUnsatisfiable(string reason);
    error MemberExists();
    error NotMember();
    error AssetNotApproved(address asset);
    error RecipientBlocked(address recipient);
    error RecipientNotRegistered();
    error AmountZero();
    error PerTxLimitExceeded(uint256 amount, uint256 max);
    error ExposureHardBlocked(uint16 exposureBps, uint16 maxBps);
    error VelocityExceeded(uint256 wouldSpend, uint256 dailyMax);
    error InsufficientBalance(uint256 amount, uint256 balance);
    error VaultLocked();
    error UnknownProposal();
    error NotPending();
    error AlreadyApproved();
    error ProposalExpired();
    error Timelocked(uint64 executableAfter);
    error InsufficientApprovals(uint256 have, uint256 need);
    error InsufficientGuardians(uint256 have, uint256 need);
    error NotVetoable();
    error NotCancellable();
    error ModeNotStricter();
    error ModeNotRelaxation();
    error NativeTransferFailed();
    error InvalidProposal(string reason);
}
