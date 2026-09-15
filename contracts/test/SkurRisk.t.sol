// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import "../src/SkurTypes.sol";
import {SkurRisk} from "../src/SkurRisk.sol";

/// @notice Pinned vectors for the risk engine. web/src/lib/risk.test.ts asserts the same table.
contract SkurRiskTest is Test {
    uint256 constant USD = 1e6;

    function _base() internal pure returns (SkurRisk.Input memory i) {
        i.amount = 1_000 * USD;
        i.assetBalance = 1_000_000 * USD;
        i.lowMax = 5_000 * USD;
        i.highMax = 25_000 * USD;
        i.dailyMax = 100_000 * USD;
        i.daySpent = 0;
        i.trust = Trust.VERIFIED;
        i.inProbation = false;
        i.mode = Mode.NORMAL;
        i.highExposureBps = 500;
        i.criticalExposureBps = 2000;
    }

    function test_routineSupplierPaymentIsLow() public pure {
        (Tier t, uint16 r, uint16 e) = SkurRisk.classify(_base());
        assertEq(uint8(t), uint8(Tier.LOW));
        assertEq(r, 0);
        assertEq(e, 10); // 0.1%
    }

    function test_amountAboveLowMaxIsHigh() public pure {
        SkurRisk.Input memory i = _base();
        i.amount = 10_000 * USD;
        (Tier t, uint16 r,) = SkurRisk.classify(i);
        assertEq(uint8(t), uint8(Tier.HIGH));
        assertEq(r, REASON_AMOUNT_HIGH);
    }

    function test_amountAboveHighMaxIsCritical() public pure {
        SkurRisk.Input memory i = _base();
        i.amount = 30_000 * USD;
        (Tier t, uint16 r,) = SkurRisk.classify(i);
        assertEq(uint8(t), uint8(Tier.CRITICAL));
        assertEq(r, REASON_AMOUNT_CRITICAL);
    }

    function test_exposureEscalatesSmallTreasury() public pure {
        SkurRisk.Input memory i = _base();
        i.assetBalance = 50_000 * USD;
        i.amount = 4_000 * USD; // 8% of holdings, under lowMax by amount
        i.dailyMax = 0;
        (Tier t, uint16 r, uint16 e) = SkurRisk.classify(i);
        assertEq(e, 800);
        assertEq(uint8(t), uint8(Tier.HIGH));
        assertEq(r, REASON_EXPOSURE_HIGH);
    }

    function test_exposureCritical() public pure {
        SkurRisk.Input memory i = _base();
        i.assetBalance = 20_000 * USD;
        i.amount = 4_000 * USD; // 20%
        i.dailyMax = 0;
        (Tier t, uint16 r, uint16 e) = SkurRisk.classify(i);
        assertEq(e, 2000);
        assertEq(uint8(t), uint8(Tier.CRITICAL));
        assertEq(r, REASON_EXPOSURE_CRITICAL);
    }

    function test_newRecipientBumpsOneTier() public pure {
        SkurRisk.Input memory i = _base();
        i.trust = Trust.NEW;
        i.inProbation = true;
        (Tier t, uint16 r,) = SkurRisk.classify(i);
        assertEq(uint8(t), uint8(Tier.HIGH));
        assertEq(r, REASON_RECIPIENT_PROBATION);

        i.amount = 10_000 * USD;
        (t, r,) = SkurRisk.classify(i);
        assertEq(uint8(t), uint8(Tier.CRITICAL));
        assertEq(r, REASON_AMOUNT_HIGH | REASON_RECIPIENT_PROBATION);
    }

    function test_unknownRecipientTreatedAsProbation() public pure {
        SkurRisk.Input memory i = _base();
        i.trust = Trust.UNKNOWN;
        (Tier t, uint16 r,) = SkurRisk.classify(i);
        assertEq(uint8(t), uint8(Tier.HIGH));
        assertEq(r, REASON_RECIPIENT_UNKNOWN | REASON_RECIPIENT_PROBATION);
    }

    function test_activatedNewRecipientIsNormal() public pure {
        SkurRisk.Input memory i = _base();
        i.trust = Trust.NEW;
        i.inProbation = false;
        (Tier t, uint16 r,) = SkurRisk.classify(i);
        assertEq(uint8(t), uint8(Tier.LOW));
        assertEq(r, 0);
    }

    function test_restrictedRecipientAlwaysCritical() public pure {
        SkurRisk.Input memory i = _base();
        i.trust = Trust.RESTRICTED;
        (Tier t, uint16 r,) = SkurRisk.classify(i);
        assertEq(uint8(t), uint8(Tier.CRITICAL));
        assertEq(r, REASON_RECIPIENT_RESTRICTED);
    }

    function test_velocityPressure() public pure {
        SkurRisk.Input memory i = _base();
        i.daySpent = 49_500 * USD; // 49.5k spent + 1k => 50.5k > half of 100k
        (Tier t, uint16 r,) = SkurRisk.classify(i);
        assertEq(uint8(t), uint8(Tier.HIGH));
        assertEq(r, REASON_VELOCITY_PRESSURE);
    }

    function test_elevatedModeBumps() public pure {
        SkurRisk.Input memory i = _base();
        i.mode = Mode.ELEVATED;
        (Tier t, uint16 r,) = SkurRisk.classify(i);
        assertEq(uint8(t), uint8(Tier.HIGH));
        assertEq(r, REASON_MODE_ELEVATED);
    }

    function test_worstCaseStacks() public pure {
        SkurRisk.Input memory i = _base();
        i.amount = 30_000 * USD;
        i.assetBalance = 100_000 * USD;
        i.trust = Trust.UNKNOWN;
        i.mode = Mode.ELEVATED;
        (Tier t, uint16 r, uint16 e) = SkurRisk.classify(i);
        assertEq(uint8(t), uint8(Tier.CRITICAL));
        assertEq(e, 3000);
        assertEq(
            r,
            REASON_AMOUNT_CRITICAL | REASON_EXPOSURE_CRITICAL | REASON_RECIPIENT_UNKNOWN | REASON_RECIPIENT_PROBATION
                | REASON_MODE_ELEVATED
        );
    }

    function test_exposureBpsEdges() public pure {
        assertEq(SkurRisk.exposureBps(0, 100), 0);
        assertEq(SkurRisk.exposureBps(1, 0), 10_000);
        assertEq(SkurRisk.exposureBps(100, 100), 10_000);
        assertEq(SkurRisk.exposureBps(150, 100), 10_000);
        assertEq(SkurRisk.exposureBps(1, 100), 100);
        assertEq(SkurRisk.exposureBps(1, 30_000), 0); // rounds down
    }

    /// @dev Tier is monotone in amount: more money never lowers the tier.
    function testFuzz_tierMonotoneInAmount(uint128 a, uint128 b, uint128 balance) public pure {
        vm.assume(a <= b);
        SkurRisk.Input memory i = _base();
        i.assetBalance = balance;
        i.dailyMax = 0;
        i.amount = a;
        (Tier ta,,) = SkurRisk.classify(i);
        i.amount = b;
        (Tier tb,,) = SkurRisk.classify(i);
        assertLe(uint8(ta), uint8(tb));
    }

    /// @dev Elevated mode never yields a lower tier than normal mode for the same inputs.
    function testFuzz_elevatedNeverLower(uint128 amount, uint128 balance, uint8 trustRaw) public pure {
        SkurRisk.Input memory i = _base();
        i.amount = amount;
        i.assetBalance = balance;
        i.trust = Trust(bound(trustRaw, 0, 4)); // exclude BLOCKED (refused before classify)
        i.inProbation = i.trust == Trust.NEW;
        (Tier tn,,) = SkurRisk.classify(i);
        i.mode = Mode.ELEVATED;
        (Tier te,,) = SkurRisk.classify(i);
        assertLe(uint8(tn), uint8(te));
    }

    function test_requirementsPerTier() public pure {
        Policy memory p;
        p.approvalsLow = 1;
        p.approvalsHigh = 2;
        p.approvalsCritical = 3;
        p.guardianThreshold = 2;
        p.guardianRequiredCritical = true;
        p.delayHigh = 6 hours;
        p.delayCritical = 24 hours;
        (uint8 a, uint8 g, uint32 d) = SkurRisk.requirements(p, Tier.LOW);
        assertEq(a, 1);
        assertEq(g, 0);
        assertEq(d, 0);
        (a, g, d) = SkurRisk.requirements(p, Tier.HIGH);
        assertEq(a, 2);
        assertEq(g, 0);
        assertEq(d, 6 hours);
        (a, g, d) = SkurRisk.requirements(p, Tier.CRITICAL);
        assertEq(a, 3);
        assertEq(g, 2);
        assertEq(d, 24 hours);
        p.guardianRequiredCritical = false;
        (, g,) = SkurRisk.requirements(p, Tier.CRITICAL);
        assertEq(g, 0);
    }
}
