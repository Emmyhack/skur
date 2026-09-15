// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../src/SkurTypes.sol";

/// @title Skur policy templates
/// @notice The same six templates the interface offers, so tests and deploy scripts never design a policy
///         from first principles. Stablecoin amounts assume a 6-decimal token; native amounts assume 18 decimals.
/// @dev Mirror of web/src/lib/templates.ts. Keep both in sync; test/SkurTemplates.t.sol validates each one.
library SkurTemplates {
    uint256 internal constant USD = 1e6;
    uint256 internal constant KASH = 1e18;

    /// Startup: simple thresholds, new-recipient delay, one guardian.
    function startup() internal pure returns (Policy memory p) {
        p.approvalsLow = 1;
        p.approvalsHigh = 2;
        p.approvalsCritical = 2;
        p.governanceThreshold = 2;
        p.guardianThreshold = 1;
        p.guardianRequiredCritical = true;
        p.delayHigh = 6 hours;
        p.delayCritical = 24 hours;
        p.recipientActivationDelay = 24 hours;
        p.policyChangeDelay = 24 hours;
        p.recoveryDelay = 48 hours;
        p.proposalTtl = 7 days;
        p.highExposureBps = 500; // 5%
        p.criticalExposureBps = 2000; // 20%
        p.hardBlockExposureBps = 5000; // 50%
        p.envelopeBps = 1000; // 10% of holdings per 24h
        p.envelopeWindow = 24 hours;
    }

    /// SME: tiered approvals, velocity limits, supplier trust.
    function sme() internal pure returns (Policy memory p) {
        p = startup();
        p.approvalsLow = 1;
        p.approvalsHigh = 2;
        p.approvalsCritical = 3;
        p.governanceThreshold = 2;
        p.delayHigh = 4 hours;
        p.delayCritical = 24 hours;
        p.envelopeBps = 500; // 5% per 24h
    }

    /// Protocol / DAO: higher quorum, timelocks.
    function dao() internal pure returns (Policy memory p) {
        p = startup();
        p.approvalsLow = 2;
        p.approvalsHigh = 3;
        p.approvalsCritical = 4;
        p.governanceThreshold = 3;
        p.guardianThreshold = 2;
        p.delayHigh = 24 hours;
        p.delayCritical = 72 hours;
        p.policyChangeDelay = 72 hours;
        p.recoveryDelay = 7 days;
        p.proposalTtl = 14 days;
        p.highExposureBps = 200; // 2%
        p.criticalExposureBps = 1000; // 10%
        p.hardBlockExposureBps = 2500;
        p.envelopeBps = 500;
    }

    /// Fund: exposure limits, strong guardians, long critical delays.
    function fund() internal pure returns (Policy memory p) {
        p = startup();
        p.approvalsLow = 2;
        p.approvalsHigh = 3;
        p.approvalsCritical = 3;
        p.governanceThreshold = 2;
        p.guardianThreshold = 2;
        p.delayHigh = 12 hours;
        p.delayCritical = 72 hours;
        p.recipientActivationDelay = 48 hours;
        p.policyChangeDelay = 72 hours;
        p.recoveryDelay = 7 days;
        p.proposalTtl = 14 days;
        p.highExposureBps = 100; // 1%
        p.criticalExposureBps = 500; // 5%
        p.hardBlockExposureBps = 2000;
        p.envelopeBps = 300; // 3% per 24h
    }

    /// Nonprofit: restricted recipients, approval separation, auditability.
    function nonprofit() internal pure returns (Policy memory p) {
        p = startup();
        p.approvalsLow = 2;
        p.approvalsHigh = 2;
        p.approvalsCritical = 3;
        p.governanceThreshold = 2;
        p.recipientActivationDelay = 72 hours;
        p.delayHigh = 12 hours;
        p.delayCritical = 48 hours;
        p.envelopeBps = 500;
    }

    /// Family office: conservative limits, cold guardian, recovery policy.
    function familyOffice() internal pure returns (Policy memory p) {
        p = startup();
        p.approvalsLow = 1;
        p.approvalsHigh = 2;
        p.approvalsCritical = 2;
        p.governanceThreshold = 2;
        p.guardianThreshold = 1;
        p.delayHigh = 24 hours;
        p.delayCritical = 72 hours;
        p.recipientActivationDelay = 72 hours;
        p.policyChangeDelay = 72 hours;
        p.recoveryDelay = 14 days;
        p.proposalTtl = 21 days;
        p.highExposureBps = 100;
        p.criticalExposureBps = 500;
        p.hardBlockExposureBps = 1500;
        p.envelopeBps = 200; // 2% per 24h
    }

    /// Asset limits for the startup template: sUSD tiers plus a native KASH policy.
    function startupAssets(address stable)
        internal
        pure
        returns (address[] memory assets, AssetLimits[] memory limits)
    {
        assets = new address[](2);
        limits = new AssetLimits[](2);
        assets[0] = stable;
        limits[0] = AssetLimits({
            approved: true, lowMax: 5_000 * USD, highMax: 25_000 * USD, perTxMax: 100_000 * USD, dailyMax: 100_000 * USD
        });
        assets[1] = address(0);
        limits[1] = AssetLimits({
            approved: true, lowMax: 100 * KASH, highMax: 1_000 * KASH, perTxMax: 0, dailyMax: 5_000 * KASH
        });
    }
}
