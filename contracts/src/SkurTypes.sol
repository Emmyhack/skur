// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// @title Skur shared types
// @notice Enums, structs and constants shared by SkurVault, SkurFactory, SkurRisk and tests.
// @dev Everything here is deterministic and auditable. No opaque scoring exists anywhere in V1.

// Role bits. A member may hold several treasury roles, but GUARDIAN is exclusive:
// guardians never hold OWNER, APPROVER or EXECUTOR (independent control plane).
uint8 constant ROLE_OWNER = 1;
uint8 constant ROLE_APPROVER = 2;
uint8 constant ROLE_EXECUTOR = 4;
uint8 constant ROLE_GUARDIAN = 8;
uint8 constant ROLE_TREASURY_MASK = ROLE_OWNER | ROLE_APPROVER | ROLE_EXECUTOR;

uint256 constant BPS = 10_000;

// Risk reason flags (bitmask) so the interface can explain *why* a tier was assigned.
uint16 constant REASON_AMOUNT_HIGH = 1 << 0;
uint16 constant REASON_AMOUNT_CRITICAL = 1 << 1;
uint16 constant REASON_EXPOSURE_HIGH = 1 << 2;
uint16 constant REASON_EXPOSURE_CRITICAL = 1 << 3;
uint16 constant REASON_RECIPIENT_PROBATION = 1 << 4;
uint16 constant REASON_RECIPIENT_RESTRICTED = 1 << 5;
uint16 constant REASON_MODE_ELEVATED = 1 << 6;
uint16 constant REASON_VELOCITY_PRESSURE = 1 << 7;
uint16 constant REASON_RECIPIENT_UNKNOWN = 1 << 8;

enum Mode {
    NORMAL,
    ELEVATED,
    LOCKDOWN
}

enum Tier {
    LOW,
    HIGH,
    CRITICAL
}

enum Trust {
    UNKNOWN, // never seen by this vault
    NEW, // registered, serving (or finished) activation delay
    VERIFIED,
    TRUSTED,
    RESTRICTED,
    BLOCKED
}

enum Kind {
    TRANSFER, // treasury plane: native KASH or approved ERC-20 out
    POLICY_UPDATE, // governance plane
    ASSET_LIMITS, // governance plane
    MEMBER_SET, // governance plane
    RECIPIENT_TRUST, // governance plane
    MODE_RELAX, // governance plane + guardian confirmation
    RECOVERY // guardian plane: replace a signer after a delay, owner-cancellable
}

enum Status {
    NONE,
    PENDING,
    EXECUTED,
    CANCELLED,
    VETOED
}

// Vault-wide policy. Versioned; every activation is emitted onchain.
struct Policy {
    uint8 approvalsLow;
    uint8 approvalsHigh;
    uint8 approvalsCritical;
    uint8 governanceThreshold; // owner approvals for governance proposals
    uint8 guardianThreshold; // guardian confirmations for critical transfers, mode relax, recovery
    bool guardianRequiredCritical;
    uint32 delayHigh; // seconds a HIGH transfer must wait after creation
    uint32 delayCritical; // seconds a CRITICAL transfer must wait; doubles as the guardian veto window
    uint32 recipientActivationDelay; // probation for NEW recipients
    uint32 policyChangeDelay; // timelock for security-reducing governance changes
    uint32 recoveryDelay; // timelock for guardian-initiated signer replacement
    uint32 proposalTtl; // proposals expire this long after creation
    uint16 highExposureBps; // amount / asset balance >= this => at least HIGH
    uint16 criticalExposureBps; // >= this => CRITICAL
    uint16 hardBlockExposureBps; // > this => refused outright (0 = disabled)
    uint16 envelopeBps; // circuit breaker: max outflow per envelopeWindow as % of balance at window start (0 = off)
    uint32 envelopeWindow; // seconds
}

// Per-asset limits. address(0) is native KASH. Amounts are in the asset's own units.
struct AssetLimits {
    bool approved;
    uint256 lowMax; // amount <= lowMax => LOW
    uint256 highMax; // amount <= highMax => HIGH, else CRITICAL
    uint256 perTxMax; // hard cap per transfer (0 = none)
    uint256 dailyMax; // hard cap per rolling 24h bucket (0 = none)
}

struct Recipient {
    Trust trust;
    uint64 registeredAt;
    uint64 activatesAt;
    uint64 paymentCount;
    uint256 totalPaid;
}

struct Velocity {
    uint64 dayStart;
    uint64 envelopeStart;
    uint256 daySpent;
    uint256 envelopeBase; // asset balance snapshot at envelope window start
    uint256 envelopeSpent;
}

struct Proposal {
    Kind kind;
    Status status;
    Tier tier;
    uint8 requiredApprovals;
    uint8 requiredGuardians;
    bool securityReducing;
    uint16 riskReasons;
    uint32 policyVersion;
    address proposer;
    address asset; // TRANSFER only
    address target; // recipient, member, old signer
    uint256 amount; // TRANSFER only
    uint64 createdAt;
    uint64 executableAfter;
    uint64 expiresAt;
    bytes data; // kind-specific ABI payload
}

// Result of the deterministic risk engine, also used for the interface preview.
struct RiskResult {
    Tier tier;
    uint16 reasons;
    uint16 exposureBps;
    uint8 requiredApprovals;
    uint8 requiredGuardians;
    uint32 delay;
}
