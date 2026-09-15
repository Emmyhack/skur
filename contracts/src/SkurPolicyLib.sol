// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./SkurTypes.sol";
import {ISkurVault} from "./ISkurVault.sol";

/// @title Skur policy validation and security-reducing classification
/// @notice Pure rules that decide whether a policy is well-formed and whether a change weakens security.
/// @dev Deployed as an external library (linked) to keep SkurVault under the EIP-170 size limit.
///      The interface's policy editor mirrors `policyReduces` and `limitsReduce` in web/src/lib/policy.ts.
library SkurPolicyLib {
    uint32 internal constant MIN_EXECUTION_WINDOW = 1 hours;

    function validatePolicy(Policy memory p) public pure {
        if (p.approvalsLow == 0) revert ISkurVault.InvalidPolicy("approvalsLow");
        if (p.approvalsHigh < p.approvalsLow) revert ISkurVault.InvalidPolicy("approvalsHigh");
        if (p.approvalsCritical < p.approvalsHigh) revert ISkurVault.InvalidPolicy("approvalsCritical");
        if (p.governanceThreshold == 0) revert ISkurVault.InvalidPolicy("governanceThreshold");
        if (p.guardianRequiredCritical && p.guardianThreshold == 0) {
            revert ISkurVault.InvalidPolicy("guardianThreshold");
        }
        if (p.delayCritical < p.delayHigh) revert ISkurVault.InvalidPolicy("delayCritical < delayHigh");
        if (p.criticalExposureBps != 0 && p.highExposureBps > p.criticalExposureBps) {
            revert ISkurVault.InvalidPolicy("exposure order");
        }
        if (p.criticalExposureBps > BPS || p.highExposureBps > BPS) revert ISkurVault.InvalidPolicy("exposure bps");
        if (p.hardBlockExposureBps != 0 && p.hardBlockExposureBps < p.criticalExposureBps) {
            revert ISkurVault.InvalidPolicy("hardBlock < critical");
        }
        if (p.hardBlockExposureBps > BPS) revert ISkurVault.InvalidPolicy("hardBlock bps");
        if (p.envelopeBps > BPS) revert ISkurVault.InvalidPolicy("envelope bps");
        if (p.envelopeBps != 0 && p.envelopeWindow < MIN_EXECUTION_WINDOW) {
            revert ISkurVault.InvalidPolicy("envelopeWindow");
        }
        uint256 longest = p.delayCritical;
        if (p.policyChangeDelay > longest) longest = p.policyChangeDelay;
        if (p.recoveryDelay > longest) longest = p.recoveryDelay;
        if (p.recipientActivationDelay > longest) longest = p.recipientActivationDelay;
        if (p.proposalTtl < longest + MIN_EXECUTION_WINDOW) revert ISkurVault.InvalidPolicy("proposalTtl too short");
    }

    function validateLimits(AssetLimits memory l) public pure {
        if (l.lowMax > l.highMax) revert ISkurVault.InvalidPolicy("lowMax > highMax");
        if (l.perTxMax != 0 && l.dailyMax != 0 && l.perTxMax > l.dailyMax) {
            revert ISkurVault.InvalidPolicy("perTxMax > dailyMax");
        }
    }

    /// @notice True when any field of `b` is weaker than `a`. Tightening and loosening in one change counts as loosening.
    function policyReduces(Policy memory a, Policy memory b) public pure returns (bool) {
        if (b.approvalsLow < a.approvalsLow) return true;
        if (b.approvalsHigh < a.approvalsHigh) return true;
        if (b.approvalsCritical < a.approvalsCritical) return true;
        if (b.governanceThreshold < a.governanceThreshold) return true;
        if (b.guardianThreshold < a.guardianThreshold) return true;
        if (a.guardianRequiredCritical && !b.guardianRequiredCritical) return true;
        if (b.delayHigh < a.delayHigh) return true;
        if (b.delayCritical < a.delayCritical) return true;
        if (b.recipientActivationDelay < a.recipientActivationDelay) return true;
        if (b.policyChangeDelay < a.policyChangeDelay) return true;
        if (b.recoveryDelay < a.recoveryDelay) return true;
        if (b.proposalTtl > a.proposalTtl) return true;
        if (thresholdLoosens(a.highExposureBps, b.highExposureBps)) return true;
        if (thresholdLoosens(a.criticalExposureBps, b.criticalExposureBps)) return true;
        if (thresholdLoosens(a.hardBlockExposureBps, b.hardBlockExposureBps)) return true;
        if (thresholdLoosens(a.envelopeBps, b.envelopeBps)) return true;
        if (a.envelopeBps != 0 && b.envelopeWindow < a.envelopeWindow) return true;
        return false;
    }

    function limitsReduce(AssetLimits memory a, AssetLimits memory b) public pure returns (bool) {
        if (!a.approved && b.approved) return true;
        if (b.lowMax > a.lowMax) return true;
        if (b.highMax > a.highMax) return true;
        if (capLoosens(a.perTxMax, b.perTxMax)) return true;
        if (capLoosens(a.dailyMax, b.dailyMax)) return true;
        return false;
    }

    /// @dev "0 = disabled" thresholds: disabling, or raising a live threshold, loosens security.
    function thresholdLoosens(uint256 a, uint256 b) internal pure returns (bool) {
        if (a == 0) return false;
        if (b == 0) return true;
        return b > a;
    }

    /// @dev "0 = unlimited" caps: enabling only tightens; disabling or raising loosens.
    function capLoosens(uint256 a, uint256 b) internal pure returns (bool) {
        if (a == 0) return false;
        if (b == 0) return true;
        return b > a;
    }
}
