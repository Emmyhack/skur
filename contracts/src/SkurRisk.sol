// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./SkurTypes.sol";

/// @title Skur deterministic risk engine
/// @notice Pure classification of a proposed transfer into LOW / HIGH / CRITICAL from observable inputs.
/// @dev No storage, no randomness, no oracle. The TypeScript mirror in web/src/lib/risk.ts must stay identical;
///      test/SkurRisk.t.sol pins the vectors both implementations are checked against.
library SkurRisk {
    struct Input {
        uint256 amount;
        uint256 assetBalance; // vault balance of the asset before the transfer
        uint256 lowMax;
        uint256 highMax;
        uint256 dailyMax; // 0 = no cap
        uint256 daySpent; // outflow already recorded in the current 24h bucket
        Trust trust;
        bool inProbation; // NEW recipient before activatesAt
        Mode mode;
        uint16 highExposureBps;
        uint16 criticalExposureBps;
    }

    /// @notice Exposure of a transfer as basis points of the current asset balance, capped at 100%.
    function exposureBps(uint256 amount, uint256 balance) internal pure returns (uint16) {
        if (amount == 0) return 0;
        if (balance == 0 || amount >= balance) return uint16(BPS);
        return uint16((amount * BPS) / balance);
    }

    /// @notice Deterministic tier + reasons. Never reverts; BLOCKED recipients are refused by the vault before this.
    function classify(Input memory i) internal pure returns (Tier tier, uint16 reasons, uint16 exposure) {
        tier = Tier.LOW;

        // 1. Amount tier
        if (i.amount > i.highMax) {
            tier = Tier.CRITICAL;
            reasons |= REASON_AMOUNT_CRITICAL;
        } else if (i.amount > i.lowMax) {
            tier = Tier.HIGH;
            reasons |= REASON_AMOUNT_HIGH;
        }

        // 2. Treasury exposure (percentage of this asset's holdings)
        exposure = exposureBps(i.amount, i.assetBalance);
        if (i.criticalExposureBps != 0 && exposure >= i.criticalExposureBps) {
            tier = Tier.CRITICAL;
            reasons |= REASON_EXPOSURE_CRITICAL;
        } else if (i.highExposureBps != 0 && exposure >= i.highExposureBps) {
            tier = _atLeast(tier, Tier.HIGH);
            reasons |= REASON_EXPOSURE_HIGH;
        }

        // 3. Recipient trust
        if (i.trust == Trust.RESTRICTED) {
            tier = Tier.CRITICAL;
            reasons |= REASON_RECIPIENT_RESTRICTED;
        } else if (i.trust == Trust.UNKNOWN) {
            // auto-registered on proposal creation; treated exactly like a NEW recipient in probation
            tier = _bump(tier);
            reasons |= REASON_RECIPIENT_UNKNOWN | REASON_RECIPIENT_PROBATION;
        } else if (i.trust == Trust.NEW && i.inProbation) {
            tier = _bump(tier);
            reasons |= REASON_RECIPIENT_PROBATION;
        }

        // 4. Velocity pressure: this transfer would push the 24h bucket past half of its cap
        if (i.dailyMax != 0 && (i.daySpent + i.amount) * 2 > i.dailyMax) {
            tier = _atLeast(tier, Tier.HIGH);
            reasons |= REASON_VELOCITY_PRESSURE;
        }

        // 5. Security posture
        if (i.mode == Mode.ELEVATED) {
            tier = _bump(tier);
            reasons |= REASON_MODE_ELEVATED;
        }
    }

    /// @notice Requirements pinned to a proposal at creation for a given tier.
    function requirements(Policy memory p, Tier tier)
        internal
        pure
        returns (uint8 approvals, uint8 guardians, uint32 delay)
    {
        if (tier == Tier.LOW) return (p.approvalsLow, 0, 0);
        if (tier == Tier.HIGH) return (p.approvalsHigh, 0, p.delayHigh);
        return (p.approvalsCritical, p.guardianRequiredCritical ? p.guardianThreshold : 0, p.delayCritical);
    }

    function _bump(Tier t) private pure returns (Tier) {
        if (t == Tier.LOW) return Tier.HIGH;
        return Tier.CRITICAL;
    }

    function _atLeast(Tier t, Tier floor) private pure returns (Tier) {
        return uint8(t) >= uint8(floor) ? t : floor;
    }
}
