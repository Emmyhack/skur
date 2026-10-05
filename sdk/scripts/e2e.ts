/**
 * Drive a real vault on a real network, end to end, and check that the chain agrees with the SDK
 * at every step.
 *
 *   SUI_PRIVATE_KEY=suiprivkey1... \
 *   SKUR_NETWORK=testnet \
 *   SKUR_PACKAGE_ID=0x... \
 *   node --experimental-strip-types scripts/e2e.ts
 *
 * This is the test the unit suites cannot be: it proves the BCS layouts match the Move structs,
 * that the PTB builders produce transactions the vault accepts, that `preview_transfer` decodes,
 * and that the events decode back into the shapes the indexer projects. One wrong field offset and
 * this fails loudly where a unit test would pass.
 *
 * It creates its own vault with a single signer holding every treasury role, so it needs no
 * coordination — and therefore it exercises the routine path rather than the multi-signer one.
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SUI_TYPE_ARG } from '@mysten/sui/utils';
import type { Transaction } from '@mysten/sui/transactions';
import {
  HOUR,
  Role,
  Status,
  Tier,
  describeFailure,
  describeReasons,
  fetchVaultView,
  grpcClient,
  listVaultEvents,
  previewTransfer,
  templateById,
  tx as build,
  type Network,
} from '../src/index.ts';

const network = (process.env.SKUR_NETWORK ?? 'testnet') as Network;
const packageId = process.env.SKUR_PACKAGE_ID;
const secret = process.env.SUI_PRIVATE_KEY;
if (!packageId || packageId === '0x0') throw new Error('SKUR_PACKAGE_ID is not set');
if (!secret) throw new Error('SUI_PRIVATE_KEY is not set (use a throwaway key)');

const keypair = Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(secret).secretKey);
const me = keypair.toSuiAddress();
const client = grpcClient(network);

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function send(transaction: Transaction, label: string) {
  const result = await client.signAndExecuteTransaction({
    transaction,
    signer: keypair,
    include: { effects: true, objectTypes: true },
  });
  const settled = result.Transaction ?? result.FailedTransaction;
  if (!settled?.status.success) {
    throw new Error(`${label}: ${describeFailure(settled?.status.error?.message ?? label)}`);
  }
  await client.waitForTransaction({ digest: settled.digest });
  return result;
}

async function main() {
  console.log(`end to end on ${network} as ${me}\n`);

  // A policy this one signer can actually satisfy, with a one-minute activation delay so the
  // probation path is exercised rather than skipped.
  const template = templateById('startup');
  const policy = {
    ...template.policy,
    approvalsLow: 1,
    approvalsHigh: 1,
    approvalsCritical: 1,
    governanceThreshold: 1,
    guardianThreshold: 0,
    guardianRequiredCritical: false,
    delayHigh: 0,
    delayCritical: 0,
    recipientActivationDelay: 60_000,
    policyChangeDelay: 60_000,
    recoveryDelay: 60_000,
    proposalTtl: 2 * HOUR,
  };

  console.log('1. create');
  const created = await send(
    build.createVault(packageId!, {
      name: 'Skur end-to-end',
      policy,
      members: [{ address: me, roles: Role.OWNER | Role.APPROVER | Role.EXECUTOR }],
      assets: [
        {
          coinType: SUI_TYPE_ARG,
          limits: {
            approved: true,
            lowMax: 100_000_000n, // 0.1 SUI stays routine
            highMax: 500_000_000n,
            perTxMax: 0n,
            dailyMax: 0n,
          },
        },
      ],
      recipients: [],
    }),
    'create',
  );
  const types = created.Transaction?.objectTypes ?? {};
  const vaultId = created.Transaction?.effects?.changedObjects.find(
    (o) => o.idOperation === 'Created' && types[o.objectId]?.endsWith('::vault::Vault'),
  )?.objectId;
  if (!vaultId) throw new Error('no vault in the effects');
  console.log(`   vault ${vaultId}`);

  console.log('2. read it back');
  let view = await fetchVaultView(client, vaultId);
  check('the name round-tripped through BCS', view.vault.name === 'Skur end-to-end', view.vault.name);
  check('the policy round-tripped', view.vault.policy.recipientActivationDelay === 60_000, String(view.vault.policy.recipientActivationDelay));
  check('the roster is there', view.members.length === 1 && view.members[0].address === me);
  check('the roles are right', view.members[0]?.roles === (Role.OWNER | Role.APPROVER | Role.EXECUTOR));
  check('SUI is approved', view.assets.some((a) => a.limits.approved));
  check('the counters are right', view.vault.ownerCount === 1 && view.vault.pendingCount === 0);

  console.log('3. deposit 0.2 SUI');
  await send(
    build.deposit(packageId!, { vaultId, coinType: SUI_TYPE_ARG, amount: 200_000_000n }),
    'deposit',
  );
  view = await fetchVaultView(client, vaultId);
  const sui = view.assets.find((a) => a.coinType === SUI_TYPE_ARG || a.coinType.endsWith('::sui::SUI'));
  check('the balance is in the bag', sui?.balance === 200_000_000n, String(sui?.balance));

  console.log('4. preview, to an address the vault has never paid');
  const stranger = Ed25519Keypair.generate().toSuiAddress();
  const unknown = await previewTransfer(client, {
    packageId: packageId!,
    vaultId,
    coinType: SUI_TYPE_ARG,
    amount: 10_000_000n,
    recipient: stranger,
    sender: me,
  });
  check('an unknown recipient is escalated', unknown.tier === Tier.HIGH, `tier ${unknown.tier}`);
  check('and the reason says so', describeReasons(unknown.reasons).some((r) => /never paid/.test(r)), describeReasons(unknown.reasons).join('; '));

  console.log('5. preview, to ourselves (a registered recipient)');
  await send(
    build.registerRecipient(packageId!, { vaultId, recipient: me, label: 'Operations' }),
    'register',
  );
  const probation = await previewTransfer(client, {
    packageId: packageId!,
    vaultId,
    coinType: SUI_TYPE_ARG,
    amount: 10_000_000n,
    recipient: me,
    sender: me,
  });
  check('a registered recipient still waits out probation', probation.tier === Tier.HIGH, `tier ${probation.tier}`);

  console.log('6. open a payment and clear it');
  const opened = await send(
    build.proposeTransfer(packageId!, {
      vaultId,
      coinType: SUI_TYPE_ARG,
      amount: 10_000_000n,
      recipient: me,
      memo: 'end to end',
    }),
    'propose',
  );
  view = await fetchVaultView(client, vaultId);
  const proposal = view.proposals[0];
  check('the proposal decoded', Boolean(proposal), proposal ? `#${proposal.id}` : 'none');
  check('its memo survived', proposal?.memo === 'end to end', proposal?.memo);
  check('its amount survived', proposal?.amount === 10_000_000n, String(proposal?.amount));
  check('it is pending', proposal?.status === Status.PENDING);
  check('the preview and the proposal agree on the tier', proposal?.tier === probation.tier);
  check('the vault counted it', view.vault.pendingCount === 1);

  await send(build.approve(packageId!, vaultId, proposal!.id), 'approve');
  view = await fetchVaultView(client, vaultId);
  check('the approval was recorded against the address', view.proposals[0]?.approvals.includes(me));

  console.log('7. the activation delay actually holds');
  try {
    await send(
      build.executeTransfer(packageId!, { vaultId, coinType: SUI_TYPE_ARG, proposalId: proposal!.id }),
      'execute-early',
    );
    check('executing before activation is refused', false, 'it went through');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    check('executing before activation is refused', /waiting period|probation|activation/i.test(message), message.slice(0, 120));
  }

  console.log('   waiting out the 60s activation delay');
  await new Promise((r) => setTimeout(r, 66_000));

  await send(
    build.executeTransfer(packageId!, { vaultId, coinType: SUI_TYPE_ARG, proposalId: proposal!.id }),
    'execute',
  );
  view = await fetchVaultView(client, vaultId);
  check('it executed', view.proposals[0]?.status === Status.EXECUTED);
  check('the balance moved', view.assets.find((a) => a.coinType.endsWith('::sui::SUI'))?.balance === 190_000_000n);
  check('the pending count came back down', view.vault.pendingCount === 0);
  check('the recipient was credited', view.recipients.find((r) => r.address === me)?.paidCount === 1);

  console.log('8. the events decode');
  const { events } = await listVaultEvents(client, { packageId: packageId!, vaultId, limit: 50 });
  const names = new Set(events.map((e) => e.event.name));
  for (const expected of ['VaultCreated', 'Deposited', 'ProposalOpened', 'Approved', 'RecipientRegistered', 'Executed']) {
    check(`${expected} decoded`, names.has(expected as never));
  }
  const executed = events.find((e) => e.event.name === 'Executed');
  check(
    'the Executed event carries the amount and the remaining balance',
    executed?.event.name === 'Executed' && executed.event.amount === 10_000_000n && executed.event.balanceAfter === 190_000_000n,
  );

  console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
  console.log(`vault: https://suiscan.xyz/${network}/object/${vaultId}`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
