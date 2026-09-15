// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SkurBase} from "./SkurBase.t.sol";
import "../src/SkurTypes.sol";
import {SkurVault} from "../src/SkurVault.sol";
import {SkurTestUSD} from "../src/SkurTestUSD.sol";

/// @notice Random actor / random action handler. Reverts are expected and ignored; ghosts record what succeeded.
contract SkurHandler is Test {
    SkurVault public vault;
    SkurTestUSD public usd;

    address[] public actors; // members + strangers
    address[] public guardians;
    address[] public recipients;

    // ghost state
    uint256 public ghostUsdOut;
    uint256 public ghostNativeOut;
    uint256 public ghostNativeIn;
    uint256 public ghostUsdIn;
    uint256 public ghostExecutions;
    bool public violatedTimelock;
    bool public violatedProbation;
    bool public violatedLockdown;
    bool public guardianMovedFunds;
    bool public doubleExecution;
    mapping(uint256 => bool) public executedOnce;

    constructor(SkurVault v, SkurTestUSD u, address[] memory members, address[] memory gs, address[] memory strangers) {
        vault = v;
        usd = u;
        for (uint256 i = 0; i < members.length; i++) {
            actors.push(members[i]);
        }
        for (uint256 i = 0; i < strangers.length; i++) {
            actors.push(strangers[i]);
        }
        guardians = gs;
        recipients.push(makeAddr("r1"));
        recipients.push(makeAddr("r2"));
        recipients.push(makeAddr("r3"));
        recipients.push(strangers[0]);
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 3 days));
    }

    function deposit(uint256 seed, uint256 amount) external {
        amount = bound(amount, 1, 1_000 ether);
        vm.deal(address(this), amount);
        (bool ok,) = address(vault).call{value: amount}("");
        if (ok) ghostNativeIn += amount;
        uint256 u = bound(seed, 1, 100_000 * 1e6);
        usd.mint(address(vault), u);
        ghostUsdIn += u;
    }

    function propose(uint256 seed, uint256 amount, bool native) external {
        address who = _actor(seed);
        address to = recipients[seed % recipients.length];
        amount = native ? bound(amount, 1, 2_000 ether) : bound(amount, 1, 120_000 * 1e6);
        vm.prank(who);
        try vault.proposeTransfer(native ? address(0) : address(usd), to, amount, "fuzz") {} catch {}
    }

    function approve(uint256 seed, uint256 id) external {
        id = bound(id, 1, vault.proposalCount() == 0 ? 1 : vault.proposalCount());
        address who = _actor(seed);
        vm.prank(who);
        try vault.approve(id) {} catch {}
    }

    function execute(uint256 seed, uint256 id) external {
        id = bound(id, 1, vault.proposalCount() == 0 ? 1 : vault.proposalCount());
        address who = _actor(seed);
        Proposal memory p = vault.getProposal(id);
        Mode modeBefore = vault.mode();
        uint256 usdBefore = vault.totalOutflow(address(usd));
        uint256 natBefore = vault.totalOutflow(address(0));
        bool wasExecuted = p.status == Status.EXECUTED;
        bool isGuardian = vault.rolesOf(who) & ROLE_GUARDIAN != 0;

        vm.prank(who);
        try vault.execute(id) {
            Proposal memory post = vault.getProposal(id);
            if (post.status == Status.EXECUTED && !wasExecuted) {
                ghostExecutions++;
                if (executedOnce[id]) doubleExecution = true;
                executedOnce[id] = true;
                if (block.timestamp < p.executableAfter) violatedTimelock = true;
                if (p.kind == Kind.TRANSFER) {
                    Recipient memory rec = vault.getRecipient(p.target);
                    if (rec.trust == Trust.NEW && block.timestamp < rec.activatesAt) violatedProbation = true;
                    if (modeBefore == Mode.LOCKDOWN) violatedLockdown = true;
                    if (p.asset == address(0)) ghostNativeOut += p.amount;
                    else ghostUsdOut += p.amount;
                }
            } else if (wasExecuted) {
                doubleExecution = true;
            }
        } catch {}
        if (
            isGuardian && (vault.totalOutflow(address(usd)) != usdBefore || vault.totalOutflow(address(0)) != natBefore)
        ) {
            guardianMovedFunds = true;
        }
    }

    function veto(uint256 seed, uint256 id) external {
        id = bound(id, 1, vault.proposalCount() == 0 ? 1 : vault.proposalCount());
        vm.prank(guardians[seed % guardians.length]);
        try vault.veto(id, "fuzz") {} catch {}
    }

    function cancel(uint256 seed, uint256 id) external {
        id = bound(id, 1, vault.proposalCount() == 0 ? 1 : vault.proposalCount());
        vm.prank(_actor(seed));
        try vault.cancel(id) {} catch {}
    }

    function raiseMode(uint256 seed, uint8 m) external {
        vm.prank(_actor(seed));
        try vault.raiseMode(Mode(bound(m, 1, 2)), "fuzz") {} catch {}
    }

    function relax(uint256 seed, uint8 m) external {
        address who = _actor(seed);
        vm.prank(who);
        try vault.proposeModeRelax(Mode(bound(m, 0, 1))) {} catch {}
    }

    function registerRecipient(uint256 seed) external {
        vm.prank(_actor(seed));
        try vault.registerRecipient(recipients[seed % recipients.length]) {} catch {}
    }

    function expire(uint256 id) external {
        id = bound(id, 1, vault.proposalCount() == 0 ? 1 : vault.proposalCount());
        try vault.expire(id) {} catch {}
    }
}

contract SkurInvariantTest is SkurBase {
    SkurHandler handler;

    function setUp() public override {
        super.setUp();
        address[] memory members = new address[](6);
        members[0] = alice;
        members[1] = bob;
        members[2] = carol;
        members[3] = exec;
        members[4] = g1;
        members[5] = g2;
        address[] memory gs = new address[](2);
        gs[0] = g1;
        gs[1] = g2;
        address[] memory strangers = new address[](2);
        strangers[0] = stranger;
        strangers[1] = makeAddr("stranger2");
        handler = new SkurHandler(vault, usd, members, gs, strangers);
        targetContract(address(handler));
    }

    /// Invariant 11: balances equal deposits minus recorded outflow, per asset.
    function invariant_nativeAccounting() public view {
        assertEq(address(vault).balance, 10_000 ether + handler.ghostNativeIn() - vault.totalOutflow(address(0)));
        assertEq(vault.totalOutflow(address(0)), handler.ghostNativeOut());
    }

    function invariant_erc20Accounting() public view {
        assertEq(
            usd.balanceOf(address(vault)), 1_000_000 * USD + handler.ghostUsdIn() - vault.totalOutflow(address(usd))
        );
        assertEq(vault.totalOutflow(address(usd)), handler.ghostUsdOut());
    }

    /// Invariant 6: no proposal executes twice.
    function invariant_noDoubleExecution() public view {
        assertFalse(handler.doubleExecution());
        // setUp executed one governance proposal before the handler existed
        assertEq(vault.executedCount(), 1 + handler.ghostExecutions());
    }

    /// Invariant 1: never before the pinned executableAfter.
    function invariant_timelockRespected() public view {
        assertFalse(handler.violatedTimelock());
    }

    /// Invariant 9: never before recipient activation.
    function invariant_probationRespected() public view {
        assertFalse(handler.violatedProbation());
    }

    /// Invariant 3: no outgoing execution in lockdown.
    function invariant_lockdownRespected() public view {
        assertFalse(handler.violatedLockdown());
    }

    /// Invariant 2: guardian calls never move funds.
    function invariant_guardiansNeverMoveFunds() public view {
        assertFalse(handler.guardianMovedFunds());
    }

    /// Invariant 5: the 24h bucket never exceeds the effective cap.
    function invariant_dailyCapNeverExceeded() public view {
        (uint256 spent, uint256 cap,,,) = vault.velocityOf(address(usd));
        if (cap != 0) assertLe(spent, cap);
        (spent, cap,,,) = vault.velocityOf(address(0));
        if (cap != 0) assertLe(spent, cap);
    }

    /// Circuit breaker: envelope spend never exceeds the envelope.
    function invariant_envelopeNeverExceeded() public view {
        (,, uint256 eSpent, uint256 env,) = vault.velocityOf(address(usd));
        assertLe(eSpent, env);
        (,, eSpent, env,) = vault.velocityOf(address(0));
        assertLe(eSpent, env);
    }

    /// Role separation and count bookkeeping.
    function invariant_rolesConsistent() public view {
        (address[] memory m, uint8[] memory r) = vault.getMembers();
        uint256 o;
        uint256 a;
        uint256 e;
        uint256 g;
        for (uint256 i = 0; i < m.length; i++) {
            assertEq(r[i], vault.rolesOf(m[i]));
            assertTrue(r[i] != 0);
            if (r[i] & ROLE_GUARDIAN != 0) assertEq(r[i] & ROLE_TREASURY_MASK, 0);
            if (r[i] & ROLE_OWNER != 0) o++;
            if (r[i] & ROLE_APPROVER != 0) a++;
            if (r[i] & ROLE_EXECUTOR != 0) e++;
            if (r[i] & ROLE_GUARDIAN != 0) g++;
        }
        assertEq(o, vault.ownerCount());
        assertEq(a, vault.approverCount());
        assertEq(e, vault.executorCount());
        assertEq(g, vault.guardianCount());
    }

    /// Aggregate counters match a bounded scan of proposal storage.
    function invariant_pendingCountExact() public view {
        uint256 n = vault.proposalCount();
        uint256 pending;
        uint256 executed;
        for (uint256 i = 1; i <= n; i++) {
            Status s = vault.getProposal(i).status;
            if (s == Status.PENDING) pending++;
            if (s == Status.EXECUTED) executed++;
        }
        assertEq(pending, vault.pendingCount());
        assertEq(executed, vault.executedCount());
    }

    /// Pinned requirements never fall below the policy in force at creation (only tighten later).
    function invariant_executedTransfersHadEnoughLiveApprovals() public view {
        uint256 n = vault.proposalCount();
        for (uint256 i = 1; i <= n; i++) {
            Proposal memory p = vault.getProposal(i);
            if (p.status != Status.EXECUTED || p.kind != Kind.TRANSFER) continue;
            assertGe(vault.getApprovers(i).length, p.requiredApprovals);
            assertGe(vault.getGuardianConfirmers(i).length, p.requiredGuardians);
        }
    }
}
