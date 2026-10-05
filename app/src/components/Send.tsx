'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useMemo, useState } from 'react';
import {
  Role,
  Trust,
  canPropose,
  describeReasons,
  fmtAmount,
  fmtDuration,
  parseAmount,
  tx as build,
  type VaultView,
} from '@skur/sdk';
import { API_URL, PACKAGE_ID } from '@/config';
import { useTransferPreview, type TxState } from '@/hooks/useVault';
import { Addr, Amount, Countdown, Notice, TierPill, TrustPill, coinDecimals, coinSymbol } from './ui';

/**
 * Opening a payment.
 *
 * The review under the form is the vault's own classification, simulated live. The interface does
 * not compute it, so it cannot promise something the vault would refuse — which is the whole point
 * of `preview_transfer` being the same code `execute_transfer` runs.
 */
export function Send({ view, tx }: { view: VaultView; tx: TxState }) {
  const account = useCurrentAccount();
  const me = account?.address;
  const roles = me ? (view.members.find((m) => m.address === me)?.roles ?? 0) : 0;
  const approved = view.assets.filter((a) => a.limits.approved);
  const [coinType, setCoinType] = useState(approved[0]?.coinType ?? '');
  const [recipient, setRecipient] = useState('');
  const [amountText, setAmountText] = useState('');
  const [memo, setMemo] = useState('');

  const asset = approved.find((a) => a.coinType === coinType) ?? approved[0];
  const decimals = coinType ? coinDecimals(coinType) : 9;
  const amount = useMemo(() => parseAmount(amountText, decimals) ?? 0n, [amountText, decimals]);
  const recipientValid = /^0x[0-9a-fA-F]{1,64}$/.test(recipient);

  const known = view.recipients.find((r) => r.address === recipient);
  const trust = known?.trust ?? Trust.UNKNOWN;
  const activatesAt = known?.activatesAt ?? 0;

  const preview = useTransferPreview({
    vaultId: view.vault.id,
    coinType,
    amount,
    recipient,
    sender: me,
    enabled: Boolean(coinType) && recipientValid && amount > 0n,
  });

  // Local checks that mirror what `propose_transfer` would refuse, so the form says why before a
  // wallet opens rather than after a transaction fails.
  const problems: string[] = [];
  if (asset && amount > 0n) {
    if (trust === Trust.BLOCKED) problems.push('This recipient is blocked by the vault.');
    if (asset.limits.perTxMax !== 0n && amount > asset.limits.perTxMax)
      problems.push(
        `Above the per-payment cap of ${fmtAmount(asset.limits.perTxMax, decimals, coinSymbol(coinType))}.`,
      );
    const spent = asset.velocity?.daySpent ?? 0n;
    if (asset.limits.dailyMax !== 0n && spent + amount > asset.limits.dailyMax)
      problems.push(
        `Above what is left of today's allowance (${fmtAmount(asset.limits.dailyMax - spent, decimals, coinSymbol(coinType))}).`,
      );
    const hb = view.vault.policy.hardBlockExposureBps;
    if (hb !== 0 && asset.balance > 0n && (amount * 10_000n) / asset.balance >= BigInt(hb))
      problems.push(`At or above the hard block of ${hb / 100}% of this asset. No approval clears it.`);
    if (amount > asset.balance)
      problems.push(`The vault holds ${fmtAmount(asset.balance, decimals, coinSymbol(coinType))}.`);
  }

  const mayPropose = canPropose(roles);
  const ready = mayPropose && recipientValid && amount > 0n && problems.length === 0 && Boolean(coinType);

  const submit = () => {
    tx.run(
      build.proposeTransfer(PACKAGE_ID, {
        vaultId: view.vault.id,
        coinType,
        amount,
        recipient,
        memo,
      }),
      'propose',
    ).then((digest) => {
      if (digest) {
        setAmountText('');
        setMemo('');
      }
    });
  };

  if (approved.length === 0) {
    return (
      <Notice kind="warn">
        No asset is approved for this vault yet. An owner has to approve one through governance
        before anything can be paid.
      </Notice>
    );
  }

  return (
    <div className="grid cols-2">
      <div className="card">
        <h3>Open a payment</h3>
        <p className="small soft">
          Opening a payment is not approving it. The vault scores it first and then says what it
          needs.
        </p>

        <div style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="asset">Asset</label>
            <select id="asset" value={coinType} onChange={(e) => setCoinType(e.target.value)}>
              {approved.map((a) => (
                <option key={a.coinType} value={a.coinType}>
                  {coinSymbol(a.coinType)} — {fmtAmount(a.balance, coinDecimals(a.coinType))}{' '}
                  available
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="to">Recipient</label>
            <input
              id="to"
              placeholder="0x…"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.trim())}
              spellCheck={false}
            />
            {recipient && !recipientValid ? (
              <p className="small" style={{ color: 'var(--bad)', marginTop: 5 }}>
                That is not a Sui address.
              </p>
            ) : null}
            {recipientValid ? (
              <div className="row wrap" style={{ marginTop: 7 }}>
                <TrustPill trust={trust} />
                {known?.label ? <span className="small soft">{known.label}</span> : null}
                {known && known.paidCount > 0 ? (
                  <span className="small faint">
                    paid {known.paidCount} time{known.paidCount === 1 ? '' : 's'} before
                  </span>
                ) : (
                  <span className="small faint">never paid by this vault</span>
                )}
                {activatesAt > Date.now() ? (
                  <span className="small" style={{ color: 'var(--warn)' }}>
                    activates <Countdown to={activatesAt} />
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="amt">Amount</label>
            <input
              id="amt"
              placeholder="0.00"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              inputMode="decimal"
            />
            {asset ? (
              <p className="small faint" style={{ marginTop: 5 }}>
                Routine up to {fmtAmount(asset.limits.lowMax, decimals)} · high risk up to{' '}
                {fmtAmount(asset.limits.highMax, decimals)} · above that, critical
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="memo">Reference</label>
            <input
              id="memo"
              placeholder="What this is for"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={120}
            />
          </div>
        </div>

        {!mayPropose ? (
          <div style={{ marginTop: 14 }}>
            <Notice kind="warn">
              The connected key cannot open payments in this vault. That takes an owner, approver,
              executor or proposer role.
            </Notice>
          </div>
        ) : null}

        {problems.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <Notice kind="bad">
              <strong>The vault would refuse this.</strong>
              <ul className="reasons">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Notice>
          </div>
        ) : null}
        {tx.error ? (
          <div style={{ marginTop: 14 }}>
            <Notice kind="bad">{tx.error}</Notice>
          </div>
        ) : null}

        <button
          className="btn primary"
          style={{ marginTop: 16, width: '100%' }}
          disabled={!ready || Boolean(tx.pending)}
          onClick={submit}
        >
          {tx.pending === 'propose' ? 'Opening…' : 'Open for approval'}
        </button>
      </div>

      <div className="card">
        <h3>What the vault will demand</h3>
        <p className="small soft">
          Read from the vault itself, not computed here. If this says three approvals and a day,
          that is what execution will require.
        </p>

        {!recipientValid || amount === 0n ? (
          <div className="empty">Fill in a recipient and an amount.</div>
        ) : preview.isLoading ? (
          <div className="empty">Asking the vault…</div>
        ) : preview.error ? (
          <div style={{ marginTop: 14 }}>
            <Notice kind="warn">
              Could not reach the vault for a preview. The checks on the left still apply, and
              execution is governed by the chain either way.
            </Notice>
          </div>
        ) : preview.data ? (
          <PreviewBody
            data={preview.data}
            amount={amount}
            coinType={coinType}
            balance={asset?.balance ?? 0n}
            activatesAt={activatesAt}
          />
        ) : null}
      </div>
    </div>
  );
}

function PreviewBody({
  data,
  amount,
  coinType,
  balance,
  activatesAt,
}: {
  data: { tier: number; reasons: number; exposureBps: number; reqApprovals: number; reqGuardians: number; delay: number };
  amount: bigint;
  coinType: string;
  balance: bigint;
  activatesAt: number;
}) {
  const decimals = coinDecimals(coinType);
  const reasons = describeReasons(data.reasons);
  const executableAt = Math.max(Date.now() + data.delay, activatesAt);
  return (
    <div style={{ marginTop: 16 }}>
      <div className="row wrap">
        <TierPill tier={data.tier as 0 | 1 | 2} />
        <span className="small faint">
          {(data.exposureBps / 100).toFixed(2)}% of this asset
        </span>
      </div>

      <dl style={{ marginTop: 14 }}>
        <div className="kv">
          <dt>Leaves the vault</dt>
          <dd>
            <Amount value={amount} coinType={coinType} />
          </dd>
        </div>
        <div className="kv">
          <dt>Remains after</dt>
          <dd>{fmtAmount(balance > amount ? balance - amount : 0n, decimals, coinSymbol(coinType))}</dd>
        </div>
        <div className="kv">
          <dt>Approvals needed</dt>
          <dd>{data.reqApprovals}</dd>
        </div>
        <div className="kv">
          <dt>Guardian confirmations</dt>
          <dd>{data.reqGuardians === 0 ? 'none' : data.reqGuardians}</dd>
        </div>
        <div className="kv">
          <dt>Waits</dt>
          <dd>{data.delay === 0 ? 'no wait' : fmtDuration(data.delay)}</dd>
        </div>
        <div className="kv">
          <dt>Earliest execution</dt>
          <dd>
            <Countdown to={executableAt} />
          </dd>
        </div>
      </dl>

      {reasons.length > 0 ? (
        <>
          <p className="small soft" style={{ marginTop: 14 }}>
            Scored this way because:
          </p>
          <ul className="reasons">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="small soft" style={{ marginTop: 14 }}>
          Nothing about this payment is unusual, so it stays at the routine tier.
        </p>
      )}

      {activatesAt > Date.now() + data.delay ? (
        <p className="small" style={{ marginTop: 12, color: 'var(--warn)' }}>
          The recipient&apos;s activation delay, not the tier, is what governs when this can
          execute.
        </p>
      ) : null}
    </div>
  );
}
