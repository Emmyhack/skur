/**
 * Create a demonstration vault and fund it, so an evaluator can open a real one rather than read
 * about it.
 *
 *   SUI_PRIVATE_KEY=suiprivkey1... \
 *   SKUR_NETWORK=testnet \
 *   SKUR_PACKAGE_ID=0x... \
 *   node --experimental-strip-types scripts/seed.ts
 *
 * The roster is deliberately realistic: two owners, a separate approver, a guardian that holds no
 * treasury role, and an agent that can only propose. Addresses other than the deployer's are
 * derived placeholders unless given — the point is to show the shape, and the deployer keeps the
 * roles needed to drive a demo alone.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SUI_TYPE_ARG } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { grpcClient, Role, templateById, tx as build, type Network } from '../dist/index.js';

const network = (process.env.SKUR_NETWORK ?? 'testnet') as Network;
const packageId = process.env.SKUR_PACKAGE_ID;
const secret = process.env.SUI_PRIVATE_KEY;

if (!packageId) throw new Error('SKUR_PACKAGE_ID is not set');
if (!secret) throw new Error('SUI_PRIVATE_KEY is not set (use a throwaway key for a demo)');

const { secretKey } = decodeSuiPrivateKey(secret);
const keypair = Ed25519Keypair.fromSecretKey(secretKey);
const me = keypair.toSuiAddress();
const client = grpcClient(network);

const extra = (process.env.SKUR_SIGNERS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const [owner2 = me, approver = me, guardian, agent] = extra;

const template = templateById('startup');

// A guardian must hold no treasury role, so a demo without a second key cannot have one. Saying
// so is better than quietly creating a vault with a guardian that is also an owner, which the
// contract would refuse anyway.
const members = [
  { address: me, roles: Role.OWNER | Role.APPROVER | Role.EXECUTOR },
  ...(owner2 !== me ? [{ address: owner2, roles: Role.OWNER | Role.APPROVER }] : []),
  ...(approver !== me && approver !== owner2 ? [{ address: approver, roles: Role.APPROVER }] : []),
  ...(guardian ? [{ address: guardian, roles: Role.GUARDIAN }] : []),
  ...(agent ? [{ address: agent, roles: Role.PROPOSER }] : []),
];

// The template's policy assumes a roster this demo may not have, so the thresholds are brought
// down to what these members can actually satisfy. A vault whose threshold nobody can reach is a
// frozen vault, and the contract refuses to create one.
const owners = members.filter((m) => (m.roles & Role.OWNER) !== 0).length;
const approvers = members.filter((m) => (m.roles & Role.APPROVER) !== 0).length;
const guardians = members.filter((m) => (m.roles & Role.GUARDIAN) !== 0).length;
const policy = {
  ...template.policy,
  governanceThreshold: Math.min(template.policy.governanceThreshold, owners),
  approvalsLow: Math.min(template.policy.approvalsLow, approvers),
  approvalsHigh: Math.min(template.policy.approvalsHigh, approvers),
  approvalsCritical: Math.min(template.policy.approvalsCritical, approvers),
  guardianThreshold: Math.min(template.policy.guardianThreshold, guardians),
  guardianRequiredCritical: guardians > 0 && template.policy.guardianRequiredCritical,
};

async function main() {
  console.log(`seeding on ${network} as ${me}`);

  const transaction = build.createVault(packageId!, {
    name: 'Skur Demo Treasury',
    policy,
    members,
    assets: [{ coinType: SUI_TYPE_ARG, limits: template.native }],
    recipients: [{ address: me, label: 'Operations' }],
  });

  const result = await client.signAndExecuteTransaction({
    transaction,
    signer: keypair,
    include: { effects: true, objectTypes: true },
  });
  await client.waitForTransaction({ result });

  const settled = result.Transaction ?? result.FailedTransaction;
  if (!settled?.status.success) {
    throw new Error(`vault creation failed: ${JSON.stringify(settled?.status)}`);
  }

  // `objectTypes` maps each changed object id to its type, which is how the new shared Vault is
  // identified without guessing from ownership.
  const types = result.Transaction?.objectTypes ?? {};
  const vaultId = settled.effects?.changedObjects.find(
    (o) => o.idOperation === 'Created' && types[o.objectId]?.endsWith('::vault::Vault'),
  )?.objectId;
  if (!vaultId) throw new Error('the vault object id was not in the effects');
  console.log(`vault: ${vaultId}`);

  const fund = build.deposit(packageId!, {
    vaultId,
    coinType: SUI_TYPE_ARG,
    amount: 1_000_000_000n, // 1 SUI
  });
  const funded = await client.signAndExecuteTransaction({
    transaction: fund,
    signer: keypair,
    include: { effects: true },
  });
  await client.waitForTransaction({ result: funded });
  console.log('funded with 1 SUI');

  const path = new URL(`../../sui/deployments/${network}.json`, import.meta.url).pathname;
  try {
    const file = JSON.parse(await readFile(path, 'utf8'));
    file.vaults = [
      ...(file.vaults ?? []).filter((v: { id: string }) => v.id !== vaultId),
      { id: vaultId, name: 'Skur Demo Treasury' },
    ];
    await writeFile(path, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`recorded in ${path}`);
  } catch {
    console.log(`could not update ${path}; record the vault id by hand`);
  }

  console.log(`explorer: https://suiscan.xyz/${network}/object/${vaultId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
