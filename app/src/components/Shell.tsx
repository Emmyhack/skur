'use client';

import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import Link from 'next/link';
import { NETWORK } from '@/config';
import { ThemeToggle } from './ui';

export function Shell({
  children,
  tabs,
}: {
  children: React.ReactNode;
  tabs?: { id: string; label: string; active: boolean; onClick: () => void }[];
}) {
  const account = useCurrentAccount();
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" style={{ textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mark" src="/mark.png" alt="" width={26} height={26} />
          Skur
        </Link>
        <span className="pill">{NETWORK}</span>
        {tabs ? (
          <nav className="nav">
            {tabs.map((t) => (
              <button key={t.id} data-active={t.active} onClick={t.onClick}>
                {t.label}
              </button>
            ))}
          </nav>
        ) : null}
        <span className="grow" />
        <ThemeToggle />
        <ConnectButton />
      </header>
      <main className="shell">
        {!account ? (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Connect a wallet to act</h3>
            <p className="soft small">Reading is public. Acting needs the key that holds the role.</p>
          </div>
        ) : null}
        {children}
      </main>
    </>
  );
}
