// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SkurBase} from "./SkurBase.t.sol";
import "../src/SkurTypes.sol";
import {ISkurVault} from "../src/ISkurVault.sol";
import {SkurVault} from "../src/SkurVault.sol";
import {SkurTemplates} from "../script/SkurTemplates.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev ERC-20 that returns nothing from transfer (USDT-style). Invariant 11 must still hold.
contract NoBoolToken {
    string public name = "NoBool";
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 a) external {
        balanceOf[to] += a;
    }

    function transfer(address to, uint256 a) external {
        balanceOf[msg.sender] -= a;
        balanceOf[to] += a;
    }
}

/// @dev Recipient that tries to re-enter execute() while receiving native funds.
contract Reenterer {
    SkurVault immutable vault;
    uint256 public targetId;
    bool public reentered;

    constructor(SkurVault v) {
        vault = v;
    }

    function setTarget(uint256 id) external {
        targetId = id;
    }

    receive() external payable {
        reentered = true;
        vault.execute(targetId);
    }
}

contract SkurVaultTest is SkurBase {
    // ------------------------------------------------------------------ setup & roles
    function test_setupCounts() public view {
        assertEq(vault.ownerCount(), 3);
        assertEq(vault.approverCount(), 3);
        assertEq(vault.executorCount(), 2);
        assertEq(vault.guardianCount(), 2);
        assertEq(vault.policyVersion(), 1);
        assertEq(uint8(vault.mode()), uint8(Mode.NORMAL));
        (address[] memory m, uint8[] memory r) = vault.getMembers();
        assertEq(m.length, 6);
        assertEq(r[4], ROLE_GUARDIAN);
    }

    function test_implementationCannotBeInitialized() public {
        SkurVault impl = SkurVault(payable(factory.implementation()));
        (address[] memory m, uint8[] memory r) = _defaultMembers();
        (address[] memory a, AssetLimits[] memory l) = SkurTemplates.startupAssets(address(usd));
        vm.expectRevert(ISkurVault.AlreadyInitialized.selector);
        impl.initialize(m, r, _defaultPolicy(), a, l);
        vm.expectRevert(ISkurVault.AlreadyInitialized.selector);
        vault.initialize(m, r, _defaultPolicy(), a, l);
    }

    function test_guardianRolesAreExclusive() public {
        vm.prank(alice);
        vm.expectRevert(ISkurVault.InvalidRoles.selector);
        vault.proposeMember(stranger, ROLE_GUARDIAN | ROLE_OWNER);
    }

    // ------------------------------------------------------------------ LOW tier lifecycle
    function test_lowTransferLifecycle() public {
        uint256 before = usd.balanceOf(supplier);
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        Proposal memory p = vault.getProposal(id);
        assertEq(uint8(p.tier), uint8(Tier.LOW));
        assertEq(p.requiredApprovals, 1);
        assertEq(p.requiredGuardians, 0);
        assertEq(p.executableAfter, block.timestamp);
        assertEq(vault.pendingCount(), 1);

        _approveBy(id, bob);
        _executeBy(id, exec);

        assertEq(usd.balanceOf(supplier), before + 1_000 * USD);
        assertEq(vault.totalOutflow(address(usd)), 1_000 * USD);
        assertEq(uint8(vault.getProposal(id).status), uint8(Status.EXECUTED));
        assertEq(vault.pendingCount(), 0);
        assertEq(vault.executedCount(), 2); // setUp executed one governance proposal
        Recipient memory rec = vault.getRecipient(supplier);
        assertEq(rec.paymentCount, 1);
        assertEq(rec.totalPaid, 1_000 * USD);
    }

    function test_nativeTransferLifecycle() public {
        uint256 id = _propose(address(0), supplier, 10 ether);
        _approveBy(id, bob);
        _executeBy(id, exec);
        assertEq(supplier.balance, 10 ether);
        assertEq(vault.totalOutflow(address(0)), 10 ether);
    }

    function test_cannotExecuteTwice() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        _approveBy(id, bob);
        _executeBy(id, exec);
        vm.prank(exec);
        vm.expectRevert(ISkurVault.NotPending.selector);
        vault.execute(id);
    }

    function test_executeRequiresExecutor() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        _approveBy(id, bob);
        vm.prank(bob); // owner + approver, but not executor
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_EXECUTOR));
        vault.execute(id);
    }

    function test_approveRequiresApprover() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        vm.prank(exec);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_APPROVER));
        vault.approve(id);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_APPROVER));
        vault.approve(id);
    }

    function test_duplicateApprovalRejected() public {
        uint256 id = _propose(address(usd), supplier, 10_000 * USD);
        _approveBy(id, bob);
        vm.prank(bob);
        vm.expectRevert(ISkurVault.AlreadyApproved.selector);
        vault.approve(id);
        (uint256 a,) = vault.liveApprovals(id);
        assertEq(a, 1);
    }

    function test_insufficientApprovalsReverts() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        vm.prank(exec);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.InsufficientApprovals.selector, 0, 1));
        vault.execute(id);
    }

    function test_strangerCannotPropose() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_OWNER | ROLE_APPROVER));
        vault.proposeTransfer(address(usd), supplier, 1, "");
    }

    // ------------------------------------------------------------------ invariant 7: removed signers
    function test_removedSignerApprovalStopsCounting() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        _approveBy(id, bob);
        (uint256 live,) = vault.liveApprovals(id);
        assertEq(live, 1);

        // Removing bob is security-tightening: immediate once the governance threshold approves.
        vm.prank(alice);
        uint256 gid = vault.proposeMember(bob, 0);
        assertFalse(vault.getProposal(gid).securityReducing);
        _approveBy(gid, alice);
        _approveBy(gid, carol);
        _executeBy(gid, alice);
        assertEq(vault.rolesOf(bob), 0);

        (live,) = vault.liveApprovals(id);
        assertEq(live, 0);
        vm.prank(exec);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.InsufficientApprovals.selector, 0, 1));
        vault.execute(id);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_APPROVER));
        vault.approve(id);
    }

    // ------------------------------------------------------------------ HIGH / CRITICAL tiers
    function test_highTierNeedsTwoApprovalsAndDelay() public {
        uint256 id = _propose(address(usd), supplier, 10_000 * USD);
        Proposal memory p = vault.getProposal(id);
        assertEq(uint8(p.tier), uint8(Tier.HIGH));
        assertEq(p.requiredApprovals, 2);
        assertEq(p.executableAfter, block.timestamp + 6 hours);

        _approveBy(id, bob);
        _approveBy(id, carol);
        vm.prank(exec);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.Timelocked.selector, p.executableAfter));
        vault.execute(id);

        vm.warp(p.executableAfter);
        _executeBy(id, exec);
        assertEq(usd.balanceOf(supplier), 10_000 * USD);
    }

    function test_criticalTierNeedsGuardianAndIsVetoable() public {
        uint256 id = _propose(address(usd), supplier, 30_000 * USD);
        Proposal memory p = vault.getProposal(id);
        assertEq(uint8(p.tier), uint8(Tier.CRITICAL));
        assertEq(p.requiredApprovals, 2);
        assertEq(p.requiredGuardians, 1);
        assertEq(p.executableAfter, block.timestamp + 24 hours);
        assertTrue(vault.isVetoable(id));

        _approveBy(id, bob);
        _approveBy(id, carol);
        vm.warp(p.executableAfter);
        vm.prank(exec);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.InsufficientGuardians.selector, 0, 1));
        vault.execute(id);

        _approveBy(id, g1);
        _executeBy(id, exec);
        assertEq(usd.balanceOf(supplier), 30_000 * USD);
    }

    function test_guardianVetoDuringWindow() public {
        uint256 id = _propose(address(usd), supplier, 30_000 * USD);
        _approveBy(id, bob);
        _approveBy(id, carol);
        _approveBy(id, g1);
        vm.warp(block.timestamp + 12 hours);
        vm.prank(g2);
        vault.veto(id, "suspicious");
        assertEq(uint8(vault.getProposal(id).status), uint8(Status.VETOED));
        assertEq(vault.pendingCount(), 0);

        vm.warp(block.timestamp + 24 hours);
        vm.prank(exec);
        vm.expectRevert(ISkurVault.NotPending.selector);
        vault.execute(id);
    }

    function test_lowTierNotVetoableInNormalMode() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        assertFalse(vault.isVetoable(id));
        vm.prank(g1);
        vm.expectRevert(ISkurVault.NotVetoable.selector);
        vault.veto(id, "x");
    }

    function test_anyTransferVetoableOutsideNormalMode() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        vm.prank(g1);
        vault.raiseMode(Mode.ELEVATED, "incident");
        assertTrue(vault.isVetoable(id));
        vm.prank(g1);
        vault.veto(id, "incident");
    }

    function test_tightenedPolicyAppliesToPendingProposal() public {
        uint256 id = _propose(address(usd), supplier, 10_000 * USD); // HIGH, needs 2
        _approveBy(id, bob);
        _approveBy(id, carol);

        Policy memory p = _defaultPolicy();
        p.approvalsHigh = 3;
        p.approvalsCritical = 3;
        vm.prank(alice);
        uint256 gid = vault.proposePolicy(p);
        assertFalse(vault.getProposal(gid).securityReducing);
        _approveGovernance(gid);
        _executeBy(gid, alice);
        assertEq(vault.policyVersion(), 2);

        _warpTo(id);
        vm.prank(exec);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.InsufficientApprovals.selector, 2, 3));
        vault.execute(id);
        _approveBy(id, alice);
        _executeBy(id, exec);
    }

    // ------------------------------------------------------------------ invariant 9: recipients
    function test_newRecipientWaitsForActivation() public {
        uint256 id = _propose(address(usd), stranger, 1_000 * USD);
        Proposal memory p = vault.getProposal(id);
        Recipient memory rec = vault.getRecipient(stranger);
        assertEq(uint8(rec.trust), uint8(Trust.NEW));
        assertEq(rec.activatesAt, block.timestamp + 24 hours);
        assertEq(uint8(p.tier), uint8(Tier.HIGH)); // LOW bumped by probation
        assertTrue(p.riskReasons & REASON_RECIPIENT_PROBATION != 0);
        assertEq(p.executableAfter, rec.activatesAt); // forced past delayHigh (6h)
        assertTrue(vault.isVetoable(id));

        _approveBy(id, bob);
        _approveBy(id, carol);
        vm.warp(block.timestamp + 6 hours);
        vm.prank(exec);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.Timelocked.selector, rec.activatesAt));
        vault.execute(id);

        vm.warp(rec.activatesAt);
        _executeBy(id, exec);
        assertEq(usd.balanceOf(stranger), 1_000 * USD);
    }

    function test_activatedRecipientGetsNormalPolicy() public {
        vm.prank(alice);
        vault.registerRecipient(stranger);
        vm.warp(block.timestamp + 24 hours);
        uint256 id = _propose(address(usd), stranger, 1_000 * USD);
        assertEq(uint8(vault.getProposal(id).tier), uint8(Tier.LOW));
    }

    function test_reProbationRestartsClockAndBlocksPending() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        _approveBy(id, bob);
        _setTrust(supplier, Trust.NEW); // tightening: immediate
        Recipient memory rec = vault.getRecipient(supplier);
        assertEq(rec.activatesAt, block.timestamp + 24 hours);
        vm.prank(exec);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.Timelocked.selector, rec.activatesAt));
        vault.execute(id);
    }

    function test_blockedRecipientRefusedAtCreationAndExecution() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        _approveBy(id, bob);
        _setTrust(supplier, Trust.BLOCKED);
        vm.prank(exec);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.RecipientBlocked.selector, supplier));
        vault.execute(id);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.RecipientBlocked.selector, supplier));
        vault.proposeTransfer(address(usd), supplier, 1, "");
    }

    function test_trustedIsSecurityReducingAndDelayed() public {
        vm.prank(alice);
        uint256 id = vault.proposeRecipientTrust(supplier, Trust.TRUSTED);
        Proposal memory p = vault.getProposal(id);
        assertTrue(p.securityReducing);
        assertEq(p.executableAfter, block.timestamp + 24 hours);
        assertTrue(vault.isVetoable(id));
    }

    function test_restrictedRecipientIsCritical() public {
        _setTrust(supplier, Trust.RESTRICTED);
        uint256 id = _propose(address(usd), supplier, 100 * USD);
        assertEq(uint8(vault.getProposal(id).tier), uint8(Tier.CRITICAL));
    }

    // ------------------------------------------------------------------ limits
    function test_perTxLimit() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.PerTxLimitExceeded.selector, 150_000 * USD, 100_000 * USD));
        vault.proposeTransfer(address(usd), supplier, 150_000 * USD, "");
    }

    function test_hardBlockExposure() public {
        // 6,000 of 10,000 KASH = 60% > 50% hard block
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.ExposureHardBlocked.selector, 6000, 5000));
        vault.proposeTransfer(address(0), supplier, 6_000 ether, "");
    }

    function test_assetNotApproved() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.AssetNotApproved.selector, address(0xBEEF)));
        vault.proposeTransfer(address(0xBEEF), supplier, 1, "");
    }

    /// @dev Invariant 5: twenty-one LOW payments of 4,900 are created and approved at once (each alone is routine);
    ///      twenty execute (98k), the twenty-first breaches the 100k daily cap even though its pinned tier is LOW.
    function test_splitDrainHitsDailyCap() public {
        uint256[] memory ids = new uint256[](21);
        for (uint256 i = 0; i < 21; i++) {
            ids[i] = _propose(address(usd), supplier, 4_900 * USD);
            assertEq(uint8(vault.getProposal(ids[i]).tier), uint8(Tier.LOW));
            _approveBy(ids[i], bob);
        }
        for (uint256 i = 0; i < 20; i++) {
            _executeBy(ids[i], exec);
        }
        (uint256 spent, uint256 cap,,,) = vault.velocityOf(address(usd));
        assertEq(spent, 98_000 * USD);
        assertEq(cap, 100_000 * USD);

        uint256 last = ids[20];
        vm.prank(exec);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.VelocityExceeded.selector, 102_900 * USD, 100_000 * USD));
        vault.execute(last);

        // next day the bucket resets
        vm.warp(block.timestamp + 1 days);
        _executeBy(last, exec);
        assertEq(vault.totalOutflow(address(usd)), 102_900 * USD);
    }

    function test_circuitBreakerTripsLockdownInsteadOfPaying() public {
        // Native envelope: 10% of 10,000 KASH = 1,000 KASH per 24h. Daily cap is 5,000 so the envelope binds first.
        uint256 a = _propose(address(0), supplier, 900 ether);
        _runTransfer(a);
        assertEq(supplier.balance, 900 ether);

        uint256 b = _propose(address(0), supplier, 200 ether);
        Proposal memory p = vault.getProposal(b);
        for (uint256 i = 0; i < p.requiredApprovals; i++) {
            _approveBy(b, [alice, bob, carol][i]);
        }
        _warpTo(b);
        vm.expectEmit(true, false, false, true);
        emit ISkurVault.CircuitBreakerTripped(address(0), 200 ether, 900 ether, 1_000 ether);
        _executeBy(b, exec);

        assertEq(uint8(vault.mode()), uint8(Mode.LOCKDOWN));
        assertEq(uint8(vault.getProposal(b).status), uint8(Status.PENDING));
        assertEq(supplier.balance, 900 ether);
        assertEq(vault.totalOutflow(address(0)), 900 ether);

        vm.prank(exec);
        vm.expectRevert(ISkurVault.VaultLocked.selector);
        vault.execute(b);
    }

    function test_elevatedHalvesCapsAndBumpsTier() public {
        vm.prank(g1);
        vault.raiseMode(Mode.ELEVATED, "phish");
        RiskResult memory r = vault.previewTransfer(address(usd), supplier, 1_000 * USD);
        assertEq(uint8(r.tier), uint8(Tier.HIGH));
        assertTrue(r.reasons & REASON_MODE_ELEVATED != 0);
        (, uint256 cap,,,) = vault.velocityOf(address(usd));
        assertEq(cap, 50_000 * USD);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.PerTxLimitExceeded.selector, 60_000 * USD, 50_000 * USD));
        vault.proposeTransfer(address(usd), supplier, 60_000 * USD, "");
    }

    // ------------------------------------------------------------------ modes
    function test_raiseModeAuthority() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_OWNER | ROLE_GUARDIAN));
        vault.raiseMode(Mode.LOCKDOWN, "");
        vm.prank(exec);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_OWNER | ROLE_GUARDIAN));
        vault.raiseMode(Mode.LOCKDOWN, "");
        vm.prank(g1);
        vault.raiseMode(Mode.LOCKDOWN, "freeze");
        assertEq(uint8(vault.mode()), uint8(Mode.LOCKDOWN));
        vm.prank(alice);
        vm.expectRevert(ISkurVault.ModeNotStricter.selector);
        vault.raiseMode(Mode.ELEVATED, "");
    }

    function test_lockdownBlocksOutgoingButNotDepositsOrGuardians() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        _approveBy(id, bob);
        vm.prank(g1);
        vault.raiseMode(Mode.LOCKDOWN, "freeze");

        vm.prank(exec);
        vm.expectRevert(ISkurVault.VaultLocked.selector);
        vault.execute(id);
        vm.prank(alice);
        vm.expectRevert(ISkurVault.VaultLocked.selector);
        vault.proposeTransfer(address(usd), supplier, 1, "");

        // deposits still work
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        usd.mint(address(this), 5 * USD);
        usd.approve(address(vault), 5 * USD);
        vault.depositERC20(address(usd), 5 * USD);

        // guardians can still veto and propose recovery; policy can still be tightened
        vm.prank(g1);
        vault.veto(id, "x");
        vm.prank(g1);
        vault.proposeRecovery(bob, stranger);
        vm.prank(alice);
        uint256 tid = vault.proposeRecipientTrust(supplier, Trust.BLOCKED);
        _approveGovernance(tid);
        _executeBy(tid, alice);
        assertEq(uint8(vault.getRecipient(supplier).trust), uint8(Trust.BLOCKED));
    }

    function test_lockdownBlocksSecurityReducingChanges() public {
        vm.prank(g1);
        vault.raiseMode(Mode.LOCKDOWN, "freeze");
        Policy memory p = _defaultPolicy();
        p.approvalsHigh = 1;
        vm.prank(alice);
        vm.expectRevert(ISkurVault.VaultLocked.selector);
        vault.proposePolicy(p);
        vm.prank(alice);
        vm.expectRevert(ISkurVault.VaultLocked.selector);
        vault.proposeMember(stranger, ROLE_APPROVER);
    }

    function test_leavingLockdownIsStrongerThanEntering() public {
        vm.prank(g1);
        vault.raiseMode(Mode.LOCKDOWN, "freeze");

        vm.prank(alice);
        uint256 id = vault.proposeModeRelax(Mode.ELEVATED);
        Proposal memory p = vault.getProposal(id);
        assertEq(p.requiredApprovals, 2);
        assertEq(p.requiredGuardians, 1);
        assertEq(p.executableAfter, block.timestamp + 24 hours);
        assertTrue(vault.isVetoable(id));

        _approveGovernance(id);
        vm.warp(p.executableAfter);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.InsufficientGuardians.selector, 0, 1));
        vault.execute(id);

        _approveBy(id, g1);
        _executeBy(id, alice);
        assertEq(uint8(vault.mode()), uint8(Mode.ELEVATED));

        // Elevated -> Normal: approvals + guardian, no timelock
        vm.prank(alice);
        uint256 id2 = vault.proposeModeRelax(Mode.NORMAL);
        assertEq(vault.getProposal(id2).executableAfter, block.timestamp);
        _approveGovernance(id2);
        _approveBy(id2, g2);
        _executeBy(id2, alice);
        assertEq(uint8(vault.mode()), uint8(Mode.NORMAL));
    }

    function test_guardianCanVetoLockdownExit() public {
        vm.prank(g1);
        vault.raiseMode(Mode.LOCKDOWN, "freeze");
        vm.prank(alice);
        uint256 id = vault.proposeModeRelax(Mode.NORMAL);
        vm.prank(g2);
        vault.veto(id, "not yet");
        assertEq(uint8(vault.mode()), uint8(Mode.LOCKDOWN));
    }

    // ------------------------------------------------------------------ invariant 4: policy firewall
    function test_looseningPolicyIsDelayedAndVetoable() public {
        Policy memory p = _defaultPolicy();
        p.approvalsHigh = 1;
        vm.prank(alice);
        uint256 id = vault.proposePolicy(p);
        Proposal memory pr = vault.getProposal(id);
        assertTrue(pr.securityReducing);
        assertEq(pr.executableAfter, block.timestamp + 24 hours);
        assertTrue(vault.isVetoable(id));

        _approveGovernance(id);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.Timelocked.selector, pr.executableAfter));
        vault.execute(id);

        vm.warp(pr.executableAfter);
        vm.expectEmit(true, false, false, false);
        emit ISkurVault.PolicyActivated(2, uint64(block.timestamp), p);
        _executeBy(id, alice);
        assertEq(vault.getPolicy().approvalsHigh, 1);
    }

    function test_mixedChangeCountsAsLoosening() public {
        Policy memory p = _defaultPolicy();
        p.approvalsLow = 2; // tighter
        p.delayCritical = 12 hours; // looser
        vm.prank(alice);
        uint256 id = vault.proposePolicy(p);
        assertTrue(vault.getProposal(id).securityReducing);
    }

    function test_invalidPolicyRejected() public {
        Policy memory p = _defaultPolicy();
        p.approvalsCritical = 1; // < approvalsHigh
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.InvalidPolicy.selector, "approvalsCritical"));
        vault.proposePolicy(p);
        p = _defaultPolicy();
        p.proposalTtl = 1 hours;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.InvalidPolicy.selector, "proposalTtl too short"));
        vault.proposePolicy(p);
    }

    function test_policyCannotExceedMemberSet() public {
        Policy memory p = _defaultPolicy();
        p.approvalsCritical = 4; // only 3 approvers
        vm.prank(alice);
        uint256 id = vault.proposePolicy(p);
        _approveGovernance(id);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.ThresholdUnsatisfiable.selector, "approvalsCritical"));
        vault.execute(id);
    }

    function test_approvingNewAssetIsDelayed() public {
        AssetLimits memory l = AssetLimits({approved: true, lowMax: 1, highMax: 2, perTxMax: 0, dailyMax: 0});
        vm.prank(alice);
        uint256 id = vault.proposeAssetLimits(address(0xBEEF), l);
        assertTrue(vault.getProposal(id).securityReducing);
        _approveGovernance(id);
        _warpTo(id);
        _executeBy(id, alice);
        assertTrue(vault.getAssetLimits(address(0xBEEF)).approved);
        assertEq(vault.getAssets().length, 3);
    }

    function test_tighteningLimitsIsImmediate() public {
        AssetLimits memory l = vault.getAssetLimits(address(usd));
        l.dailyMax = 50_000 * USD;
        l.perTxMax = 50_000 * USD;
        vm.prank(alice);
        uint256 id = vault.proposeAssetLimits(address(usd), l);
        assertFalse(vault.getProposal(id).securityReducing);
        assertEq(vault.getProposal(id).executableAfter, block.timestamp);
    }

    // ------------------------------------------------------------------ membership
    function test_addingMemberIsDelayedRemovingIsImmediate() public {
        vm.prank(alice);
        uint256 add = vault.proposeMember(stranger, ROLE_APPROVER);
        assertTrue(vault.getProposal(add).securityReducing);
        _approveGovernance(add);
        vm.prank(alice);
        vm.expectRevert();
        vault.execute(add);
        _warpTo(add);
        _executeBy(add, alice);
        assertEq(vault.rolesOf(stranger), ROLE_APPROVER);
        assertEq(vault.approverCount(), 4);

        vm.prank(alice);
        uint256 rm = vault.proposeMember(stranger, 0);
        assertFalse(vault.getProposal(rm).securityReducing);
        _approveGovernance(rm);
        _executeBy(rm, alice);
        assertEq(vault.rolesOf(stranger), 0);
        (address[] memory m,) = vault.getMembers();
        assertEq(m.length, 6);
    }

    function test_removingGuardianIsSecurityReducing() public {
        vm.prank(alice);
        uint256 id = vault.proposeMember(g2, 0);
        assertTrue(vault.getProposal(id).securityReducing);
    }

    function test_cannotDropBelowThresholds() public {
        // remove both guardians -> guardianThreshold 1 unsatisfiable on the second removal
        vm.prank(alice);
        uint256 a = vault.proposeMember(g1, 0);
        vm.prank(alice);
        uint256 b = vault.proposeMember(g2, 0);
        _approveGovernance(a);
        _approveGovernance(b);
        _warpTo(b);
        _executeBy(a, alice);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.ThresholdUnsatisfiable.selector, "guardianThreshold"));
        vault.execute(b);
    }

    // ------------------------------------------------------------------ invariant 2: guardians never withdraw
    function test_guardianCannotMoveFunds() public {
        vm.startPrank(g1);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_OWNER | ROLE_APPROVER));
        vault.proposeTransfer(address(usd), g1, 1, "");
        vm.stopPrank();

        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        vm.prank(g1);
        vm.expectRevert(
            abi.encodeWithSelector(ISkurVault.InvalidProposal.selector, "guardian confirmation not required")
        );
        vault.approve(id);
        _approveBy(id, bob);
        vm.prank(g1);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_EXECUTOR));
        vault.execute(id);

        // guardians cannot grant themselves treasury roles, and cannot run governance
        vm.prank(g1);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_OWNER));
        vault.proposeMember(g1, ROLE_OWNER);
    }

    // ------------------------------------------------------------------ recovery
    function test_recoveryFlow() public {
        address newBob = makeAddr("newBob");
        uint32 versionBefore = vault.policyVersion();

        vm.prank(g1);
        uint256 id = vault.proposeRecovery(bob, newBob);
        Proposal memory p = vault.getProposal(id);
        assertEq(p.requiredApprovals, 0);
        assertEq(p.requiredGuardians, 1);
        assertEq(p.executableAfter, block.timestamp + 48 hours);

        // owners cannot approve a recovery, guardians confirm it
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_GUARDIAN));
        vault.approve(id);
        _approveBy(id, g1);

        vm.prank(g1);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.Timelocked.selector, p.executableAfter));
        vault.execute(id);

        vm.warp(p.executableAfter);
        _executeBy(id, g1);
        assertEq(vault.rolesOf(bob), 0);
        assertEq(vault.rolesOf(newBob), ROLE_OWNER | ROLE_APPROVER);
        assertEq(uint8(vault.mode()), uint8(Mode.ELEVATED));
        assertEq(vault.policyVersion(), versionBefore); // invariant 10
        assertEq(vault.ownerCount(), 3);
    }

    function test_ownerCanCancelRecoveryDuringDelay() public {
        vm.prank(g1);
        uint256 id = vault.proposeRecovery(bob, stranger);
        vm.prank(carol);
        vault.cancel(id);
        assertEq(uint8(vault.getProposal(id).status), uint8(Status.CANCELLED));
    }

    function test_recoveryValidation() public {
        vm.prank(g1);
        vm.expectRevert(ISkurVault.NotMember.selector);
        vault.proposeRecovery(stranger, makeAddr("x"));
        vm.prank(g1);
        vm.expectRevert(ISkurVault.MemberExists.selector);
        vault.proposeRecovery(bob, carol);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ISkurVault.NotAuthorized.selector, ROLE_GUARDIAN));
        vault.proposeRecovery(bob, stranger);
    }

    // ------------------------------------------------------------------ expiry & cancel
    function test_expiry() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        _approveBy(id, bob);
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(exec);
        vm.expectRevert(ISkurVault.ProposalExpired.selector);
        vault.execute(id);
        vm.prank(stranger);
        vault.expire(id);
        assertEq(uint8(vault.getProposal(id).status), uint8(Status.CANCELLED));
        assertEq(vault.pendingCount(), 0);
    }

    function test_cancelAuthority() public {
        uint256 id = _propose(address(usd), supplier, 1_000 * USD);
        vm.prank(exec);
        vm.expectRevert(ISkurVault.NotCancellable.selector);
        vault.cancel(id);
        vm.prank(alice); // proposer
        vault.cancel(id);
        uint256 id2 = _propose(address(usd), supplier, 1_000 * USD);
        vm.prank(carol); // owner
        vault.cancel(id2);
        assertEq(vault.pendingCount(), 0);
    }

    // ------------------------------------------------------------------ invariants 11 & 12
    function test_nonStandardERC20Transfers() public {
        NoBoolToken t = new NoBoolToken();
        t.mint(address(vault), 1_000_000);
        AssetLimits memory l = AssetLimits({approved: true, lowMax: 10_000, highMax: 100_000, perTxMax: 0, dailyMax: 0});
        vm.prank(alice);
        uint256 gid = vault.proposeAssetLimits(address(t), l);
        _approveGovernance(gid);
        _warpTo(gid);
        _executeBy(gid, alice);

        uint256 id = _propose(address(t), supplier, 5_000);
        _approveBy(id, bob);
        _executeBy(id, exec);
        assertEq(t.balanceOf(supplier), 5_000);
        assertEq(vault.totalOutflow(address(t)), 5_000);
    }

    function test_reentrancyBlocked() public {
        Reenterer r = new Reenterer(vault);
        vm.prank(alice);
        vault.registerRecipient(address(r));
        vm.warp(block.timestamp + 24 hours);
        uint256 a = _propose(address(0), address(r), 10 ether);
        uint256 b = _propose(address(0), address(r), 10 ether);
        _approveBy(a, bob);
        _approveBy(b, bob);
        r.setTarget(b);
        vm.prank(exec);
        vm.expectRevert(ISkurVault.NativeTransferFailed.selector);
        vault.execute(a);
        assertEq(vault.totalOutflow(address(0)), 0);
        assertEq(uint8(vault.getProposal(a).status), uint8(Status.PENDING));
    }

    function test_previewMatchesPinnedRequirements() public {
        RiskResult memory r = vault.previewTransfer(address(usd), supplier, 30_000 * USD);
        uint256 id = _propose(address(usd), supplier, 30_000 * USD);
        Proposal memory p = vault.getProposal(id);
        assertEq(uint8(r.tier), uint8(p.tier));
        assertEq(r.reasons, p.riskReasons);
        assertEq(r.requiredApprovals, p.requiredApprovals);
        assertEq(r.requiredGuardians, p.requiredGuardians);
        assertEq(p.executableAfter, block.timestamp + r.delay);
    }

    function test_depositsTracked() public {
        (bool ok,) = address(vault).call{value: 3 ether}("");
        assertTrue(ok);
        assertEq(vault.totalDeposited(address(0)), 10_003 ether);
        usd.mint(address(this), 7 * USD);
        usd.approve(address(vault), 7 * USD);
        vault.depositERC20(address(usd), 7 * USD);
        assertEq(vault.totalDeposited(address(usd)), 7 * USD);
    }
}
