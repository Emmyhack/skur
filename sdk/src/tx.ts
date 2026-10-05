import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG } from '@mysten/sui/utils';
import { CLOCK_ID, moveTarget } from './network.js';
import type { AssetLimits, Mode, Policy, Trust } from './types.js';

/**
 * Programmable transaction blocks for every vault action.
 *
 * Two things here are worth knowing. First, a policy is built on chain by calling
 * `policy::new(...)` inside the same block, so the seventeen fields are validated by the module
 * that owns them rather than packed into bytes by this file. Second, creating a vault is one
 * block: `begin` hands back a value with no abilities, so the same transaction has to configure
 * the assets and call `finish`, and there is no moment when a half-configured vault exists.
 */

export type Builder = { tx: Transaction; packageId: string };

function target(pkg: string, module: string, fn: string) {
  return moveTarget(pkg, module, fn);
}

/** Build the `Policy` struct inside the block. */
export function policyArg(b: Builder, p: Policy): TransactionObjectArgument {
  const { tx, packageId } = b;
  return tx.moveCall({
    target: target(packageId, 'policy', 'new'),
    arguments: [
      tx.pure.u8(p.approvalsLow),
      tx.pure.u8(p.approvalsHigh),
      tx.pure.u8(p.approvalsCritical),
      tx.pure.u8(p.governanceThreshold),
      tx.pure.u8(p.guardianThreshold),
      tx.pure.bool(p.guardianRequiredCritical),
      tx.pure.u64(p.delayHigh),
      tx.pure.u64(p.delayCritical),
      tx.pure.u64(p.recipientActivationDelay),
      tx.pure.u64(p.policyChangeDelay),
      tx.pure.u64(p.recoveryDelay),
      tx.pure.u64(p.proposalTtl),
      tx.pure.u64(p.highExposureBps),
      tx.pure.u64(p.criticalExposureBps),
      tx.pure.u64(p.hardBlockExposureBps),
      tx.pure.u64(p.envelopeBps),
      tx.pure.u64(p.envelopeWindow),
    ],
  });
}

export type MemberSeed = { address: string; roles: number };
export type AssetSeed = { coinType: string; limits: AssetLimits };
export type RecipientSeed = { address: string; label: string };

/** `begin` → `setup_asset`* → `setup_recipient`* → `finish`, in one block. */
export function createVault(
  packageId: string,
  input: {
    name: string;
    policy: Policy;
    members: MemberSeed[];
    assets: AssetSeed[];
    recipients?: RecipientSeed[];
  },
): Transaction {
  const tx = new Transaction();
  const b = { tx, packageId };
  const setup = tx.moveCall({
    target: target(packageId, 'vault', 'begin'),
    arguments: [
      tx.pure.string(input.name),
      policyArg(b, input.policy),
      tx.pure.vector('address', input.members.map((m) => m.address)),
      tx.pure.vector('u8', input.members.map((m) => m.roles)),
      tx.object(CLOCK_ID),
    ],
  });

  for (const a of input.assets) {
    tx.moveCall({
      target: target(packageId, 'vault', 'setup_asset'),
      typeArguments: [a.coinType],
      arguments: [
        setup,
        tx.pure.bool(a.limits.approved),
        tx.pure.u64(a.limits.lowMax),
        tx.pure.u64(a.limits.highMax),
        tx.pure.u64(a.limits.perTxMax),
        tx.pure.u64(a.limits.dailyMax),
      ],
    });
  }
  for (const r of input.recipients ?? []) {
    tx.moveCall({
      target: target(packageId, 'vault', 'setup_recipient'),
      arguments: [setup, tx.pure.address(r.address), tx.pure.string(r.label)],
    });
  }
  tx.moveCall({ target: target(packageId, 'vault', 'finish'), arguments: [setup] });
  return tx;
}

/**
 * Fund a vault. SUI comes out of the gas coin, which is the only coin a PTB always has; any other
 * asset is merged from the coin objects the caller holds and then split to the exact amount, so a
 * deposit never has to match a coin's balance.
 */
export function deposit(
  packageId: string,
  input: { vaultId: string; coinType: string; amount: bigint; coinObjectIds?: string[] },
): Transaction {
  const tx = new Transaction();
  let coin: TransactionObjectArgument;
  if (input.coinType === SUI_TYPE_ARG || input.coinType === '0x2::sui::SUI') {
    [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(input.amount)]);
  } else {
    const ids = input.coinObjectIds ?? [];
    if (ids.length === 0) throw new Error('coinObjectIds is required for a non-SUI deposit');
    const primary = tx.object(ids[0]);
    if (ids.length > 1) tx.mergeCoins(primary, ids.slice(1).map((id) => tx.object(id)));
    [coin] = tx.splitCoins(primary, [tx.pure.u64(input.amount)]);
  }
  tx.moveCall({
    target: target(packageId, 'vault', 'deposit'),
    typeArguments: [input.coinType],
    arguments: [tx.object(input.vaultId), coin, tx.object(CLOCK_ID)],
  });
  return tx;
}

export function proposeTransfer(
  packageId: string,
  input: {
    vaultId: string;
    coinType: string;
    amount: bigint;
    recipient: string;
    memo?: string;
  },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'propose_transfer'),
    typeArguments: [input.coinType],
    arguments: [
      tx.object(input.vaultId),
      tx.pure.u64(input.amount),
      tx.pure.address(input.recipient),
      tx.pure.string(input.memo ?? ''),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/** `approve`, `reject`, `confirm`, `veto`, `cancel` and `expire` all take the same arguments. */
function proposalAction(packageId: string, fn: string, vaultId: string, proposalId: bigint) {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', fn),
    arguments: [tx.object(vaultId), tx.pure.u64(proposalId), tx.object(CLOCK_ID)],
  });
  return tx;
}

export const approve = (pkg: string, vaultId: string, id: bigint) =>
  proposalAction(pkg, 'approve', vaultId, id);
export const reject = (pkg: string, vaultId: string, id: bigint) =>
  proposalAction(pkg, 'reject', vaultId, id);
export const confirm = (pkg: string, vaultId: string, id: bigint) =>
  proposalAction(pkg, 'confirm', vaultId, id);
export const veto = (pkg: string, vaultId: string, id: bigint) =>
  proposalAction(pkg, 'veto', vaultId, id);
export const cancel = (pkg: string, vaultId: string, id: bigint) =>
  proposalAction(pkg, 'cancel', vaultId, id);
export const expire = (pkg: string, vaultId: string, id: bigint) =>
  proposalAction(pkg, 'expire', vaultId, id);
export const executePolicy = (pkg: string, vaultId: string, id: bigint) =>
  proposalAction(pkg, 'execute_policy', vaultId, id);
export const executeMember = (pkg: string, vaultId: string, id: bigint) =>
  proposalAction(pkg, 'execute_member', vaultId, id);
export const executeRecipientTrust = (pkg: string, vaultId: string, id: bigint) =>
  proposalAction(pkg, 'execute_recipient_trust', vaultId, id);
export const executeModeRelax = (pkg: string, vaultId: string, id: bigint) =>
  proposalAction(pkg, 'execute_mode_relax', vaultId, id);
export const executeRecovery = (pkg: string, vaultId: string, id: bigint) =>
  proposalAction(pkg, 'execute_recovery', vaultId, id);

export function executeTransfer(
  packageId: string,
  input: { vaultId: string; coinType: string; proposalId: bigint },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'execute_transfer'),
    typeArguments: [input.coinType],
    arguments: [
      tx.object(input.vaultId),
      tx.pure.u64(input.proposalId),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function registerRecipient(
  packageId: string,
  input: { vaultId: string; recipient: string; label: string },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'register_recipient'),
    arguments: [
      tx.object(input.vaultId),
      tx.pure.address(input.recipient),
      tx.pure.string(input.label),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/** A guardian restricting or blocking a destination, immediately and alone. */
export function guardianRestrict(
  packageId: string,
  input: { vaultId: string; recipient: string; trust: Trust },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'guardian_restrict'),
    arguments: [
      tx.object(input.vaultId),
      tx.pure.address(input.recipient),
      tx.pure.u8(input.trust),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function raiseMode(
  packageId: string,
  input: { vaultId: string; mode: Mode; reasons?: number },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'raise_mode'),
    arguments: [
      tx.object(input.vaultId),
      tx.pure.u8(input.mode),
      tx.pure.u16(input.reasons ?? 0),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function proposePolicy(
  packageId: string,
  input: { vaultId: string; policy: Policy },
): Transaction {
  const tx = new Transaction();
  const b = { tx, packageId };
  tx.moveCall({
    target: target(packageId, 'vault', 'propose_policy'),
    arguments: [tx.object(input.vaultId), policyArg(b, input.policy), tx.object(CLOCK_ID)],
  });
  return tx;
}

export function proposeAssetLimits(
  packageId: string,
  input: { vaultId: string; coinType: string; limits: AssetLimits },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'propose_asset_limits'),
    typeArguments: [input.coinType],
    arguments: [
      tx.object(input.vaultId),
      tx.pure.bool(input.limits.approved),
      tx.pure.u64(input.limits.lowMax),
      tx.pure.u64(input.limits.highMax),
      tx.pure.u64(input.limits.perTxMax),
      tx.pure.u64(input.limits.dailyMax),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function executeAssetLimits(
  packageId: string,
  input: { vaultId: string; coinType: string; proposalId: bigint },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'execute_asset_limits'),
    typeArguments: [input.coinType],
    arguments: [tx.object(input.vaultId), tx.pure.u64(input.proposalId), tx.object(CLOCK_ID)],
  });
  return tx;
}

/** `roles` of 0 removes the member. */
export function proposeMember(
  packageId: string,
  input: { vaultId: string; member: string; roles: number },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'propose_member'),
    arguments: [
      tx.object(input.vaultId),
      tx.pure.address(input.member),
      tx.pure.u8(input.roles),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function proposeRecipientTrust(
  packageId: string,
  input: { vaultId: string; recipient: string; trust: Trust },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'propose_recipient_trust'),
    arguments: [
      tx.object(input.vaultId),
      tx.pure.address(input.recipient),
      tx.pure.u8(input.trust),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function proposeModeRelax(
  packageId: string,
  input: { vaultId: string; mode: Mode },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'propose_mode_relax'),
    arguments: [tx.object(input.vaultId), tx.pure.u8(input.mode), tx.object(CLOCK_ID)],
  });
  return tx;
}

export function proposeRecovery(
  packageId: string,
  input: { vaultId: string; lost: string; replacement: string },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'propose_recovery'),
    arguments: [
      tx.object(input.vaultId),
      tx.pure.address(input.lost),
      tx.pure.address(input.replacement),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/** The block used to read `preview_transfer` back through a simulation. */
export function previewTransferTx(
  packageId: string,
  input: { vaultId: string; coinType: string; amount: bigint; recipient: string },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(packageId, 'vault', 'preview_transfer'),
    typeArguments: [input.coinType],
    arguments: [
      tx.object(input.vaultId),
      tx.pure.u64(input.amount),
      tx.pure.address(input.recipient),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}
