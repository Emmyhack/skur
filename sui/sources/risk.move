/// The risk engine. Given a payment and the state of the vault around it, decide what tier it is,
/// why, and therefore how much authorization it needs.
///
/// This is deterministic and pure: the same function the interface dry-runs to preview a transfer
/// is the function the vault calls when it executes one, so a preview can never promise something
/// the vault would refuse.
module skur::risk;

use skur::policy::Policy;
use skur::types;

/// Everything the classifier reads. Collected into one struct so the vault, the simulator and the
/// tests all pass the same shape.
public struct RiskInput has copy, drop {
    amount: u64,
    /// The asset's balance in the vault *before* this transfer.
    asset_balance: u64,
    low_max: u64,
    high_max: u64,
    daily_max: u64,
    /// Already executed out of this asset in the live 24-hour bucket.
    day_spent: u64,
    trust: u8,
    /// The recipient's activation delay has not elapsed yet.
    in_probation: bool,
    mode: u8,
    high_exposure_bps: u64,
    critical_exposure_bps: u64,
}

public fun new_input(
    amount: u64,
    asset_balance: u64,
    low_max: u64,
    high_max: u64,
    daily_max: u64,
    day_spent: u64,
    trust: u8,
    in_probation: bool,
    mode: u8,
    high_exposure_bps: u64,
    critical_exposure_bps: u64,
): RiskInput {
    RiskInput {
        amount,
        asset_balance,
        low_max,
        high_max,
        daily_max,
        day_spent,
        trust,
        in_probation,
        mode,
        high_exposure_bps,
        critical_exposure_bps,
    }
}

public struct RiskOutput has copy, drop {
    tier: u8,
    /// Bitmask of `types::reason_*`: every reason the tier landed where it did.
    reasons: u16,
    exposure_bps: u64,
}

public fun tier(o: &RiskOutput): u8 { o.tier }
public fun reasons(o: &RiskOutput): u16 { o.reasons }
public fun exposure(o: &RiskOutput): u64 { o.exposure_bps }

/// A transfer's share of the asset's holdings, in basis points. Taking everything, or taking
/// anything from an empty balance, is full exposure.
public fun exposure_bps(amount: u64, balance: u64): u64 {
    let bps = types::bps();
    if (amount == 0) return 0;
    if (balance == 0 || amount >= balance) return bps;
    (((amount as u128) * (bps as u128)) / (balance as u128)) as u64
}

/// One step up the ladder. Already critical stays critical.
fun bump(t: u8): u8 {
    if (t == types::tier_low()) types::tier_high() else types::tier_critical()
}

fun at_least(t: u8, floor: u8): u8 {
    if (t >= floor) t else floor
}

/// Five independent signals, each able to raise the tier and none able to lower it.
public fun classify(i: &RiskInput): RiskOutput {
    let low = types::tier_low();
    let high = types::tier_high();
    let critical = types::tier_critical();

    let mut tier = low;
    let mut reasons: u16 = 0;

    // 1. Absolute size, against this asset's own limits.
    if (i.amount > i.high_max) {
        tier = critical;
        reasons = reasons | types::reason_amount_critical();
    } else if (i.amount > i.low_max) {
        tier = high;
        reasons = reasons | types::reason_amount_high();
    };

    // 2. Share of the treasury. A small absolute amount out of a small balance still hurts.
    let exposure = exposure_bps(i.amount, i.asset_balance);
    if (i.critical_exposure_bps != 0 && exposure >= i.critical_exposure_bps) {
        tier = critical;
        reasons = reasons | types::reason_exposure_critical();
    } else if (i.high_exposure_bps != 0 && exposure >= i.high_exposure_bps) {
        tier = at_least(tier, high);
        reasons = reasons | types::reason_exposure_high();
    };

    // 3. Who is receiving it. An address the vault has never paid is the signature of a drain.
    if (i.trust == types::trust_restricted()) {
        tier = critical;
        reasons = reasons | types::reason_recipient_restricted();
    } else if (i.trust == types::trust_unknown()) {
        tier = bump(tier);
        reasons = reasons | types::reason_recipient_unknown() | types::reason_recipient_probation();
    } else if (i.trust == types::trust_new() && i.in_probation) {
        tier = bump(tier);
        reasons = reasons | types::reason_recipient_probation();
    };

    // 4. Velocity. Crossing half the day's allowance is enough to escalate, so a drain split into
    //    pieces runs into a higher bar partway through instead of at the very end.
    if (i.daily_max != 0
        && ((i.day_spent as u128) + (i.amount as u128)) * 2 > (i.daily_max as u128)) {
        tier = at_least(tier, high);
        reasons = reasons | types::reason_velocity_pressure();
    };

    // 5. The vault's own posture. Elevated means something already looked wrong.
    if (i.mode == types::mode_elevated()) {
        tier = bump(tier);
        reasons = reasons | types::reason_mode_elevated();
    };

    RiskOutput { tier, reasons, exposure_bps: exposure }
}

/// What a tier costs: approvals, guardian confirmations, and the wait before execution.
public fun requirements(p: &Policy, tier: u8): (u8, u8, u64) {
    if (tier == types::tier_low()) {
        (p.approvals_low(), 0, 0)
    } else if (tier == types::tier_high()) {
        (p.approvals_high(), 0, p.delay_high())
    } else {
        let guardians = if (p.guardian_required_critical()) p.guardian_threshold() else 0;
        (p.approvals_critical(), guardians, p.delay_critical())
    }
}

/// Elevated halves the caps, never below one unit, so a vault that has already seen something
/// wrong keeps paying salaries but cannot be emptied at the usual rate.
public fun effective_caps(per_tx_max: u64, daily_max: u64, mode: u8): (u64, u64) {
    if (mode != types::mode_elevated()) return (per_tx_max, daily_max);
    (half(per_tx_max), half(daily_max))
}

fun half(x: u64): u64 {
    if (x == 0) return 0;
    let h = x / 2;
    if (h == 0) 1 else h
}
