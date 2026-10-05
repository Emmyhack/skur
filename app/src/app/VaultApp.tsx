'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useState } from 'react';
import { Role, hasRole } from '@skur/sdk';
import { CONFIGURED } from '@/config';
import { useVaultTx, useVaultView } from '@/hooks/useVault';
import { CreateVault } from '@/components/CreateVault';
import { Overview } from '@/components/Overview';
import { People } from '@/components/People';
import { PolicyPanel } from '@/components/PolicyPanel';
import { Queue } from '@/components/Queue';
import { Security } from '@/components/Security';
import { Send } from '@/components/Send';
import { Shell } from '@/components/Shell';
import { Notice } from '@/components/ui';

type Tab = 'overview' | 'queue' | 'send' | 'policy' | 'people' | 'security';

export default function VaultApp({ vaultId }: { vaultId: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  const account = useCurrentAccount();
  const query = useVaultView(vaultId);
  const tx = useVaultTx(vaultId);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'queue', label: 'Queue' },
    { id: 'send', label: 'Pay' },
    { id: 'policy', label: 'Policy' },
    { id: 'people', label: 'People' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <Shell
      tabs={tabs.map((t) => ({
        id: t.id,
        label: t.label,
        active: tab === t.id,
        onClick: () => setTab(t.id),
      }))}
    >
      {!CONFIGURED ? (
        <Notice kind="warn">
          No package is configured for this network. Publish the Move package and set{' '}
          <code className="mono">NEXT_PUBLIC_SKUR_PACKAGE_ID</code>.
        </Notice>
      ) : query.isLoading ? (
        <div className="empty">Reading the vault…</div>
      ) : query.error ? (
        <Notice kind="bad">
          Could not read that vault. Check the id and the network.
          <p className="small faint" style={{ marginTop: 6 }}>
            {query.error instanceof Error ? query.error.message : String(query.error)}
          </p>
        </Notice>
      ) : query.data ? (
        <>
          <div className="row wrap" style={{ marginBottom: 20 }}>
            <h1>{query.data.vault.name}</h1>
            {account ? (
              <RoleBadge roles={query.data.members.find((m) => m.address === account.address)?.roles ?? 0} />
            ) : null}
            <span className="grow" />
            {tx.pending ? <span className="pill accent">working…</span> : null}
          </div>
          {tab === 'overview' ? <Overview view={query.data} /> : null}
          {tab === 'queue' ? <Queue view={query.data} tx={tx} /> : null}
          {tab === 'send' ? <Send view={query.data} tx={tx} /> : null}
          {tab === 'policy' ? <PolicyPanel view={query.data} tx={tx} /> : null}
          {tab === 'people' ? <People view={query.data} tx={tx} /> : null}
          {tab === 'security' ? <Security view={query.data} tx={tx} /> : null}
        </>
      ) : null}
    </Shell>
  );
}

function RoleBadge({ roles }: { roles: number }) {
  if (roles === 0) return <span className="pill">read only</span>;
  const names: string[] = [];
  if (hasRole(roles, Role.OWNER)) names.push('owner');
  if (hasRole(roles, Role.APPROVER)) names.push('approver');
  if (hasRole(roles, Role.EXECUTOR)) names.push('executor');
  if (hasRole(roles, Role.GUARDIAN)) names.push('guardian');
  if (hasRole(roles, Role.PROPOSER)) names.push('proposer');
  return <span className="pill accent">{names.join(' · ')}</span>;
}

export { CreateVault };
