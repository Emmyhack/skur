'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { NETWORK } from '@/config';
import { IconChevronRight } from './icons';
import { useScrolled } from './motion';

export type MarketingPage = 'landing' | 'product' | 'solutions' | 'security' | 'docs';

const REPO = 'https://github.com/Emmyhack/skur';

/** Nav, closing call to action and footer, shared by every marketing page. */
export function MarketingShell({
  page,
  children,
  hideCta = false,
}: {
  page: MarketingPage;
  children: ReactNode;
  hideCta?: boolean;
}) {
  const scrolled = useScrolled();
  return (
    <div className="land">
      <header className={`land-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="wrap">
          <Link className="logo" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mark" src="/mark.png" alt="" width={28} height={28} />
            <span>Skur</span>
          </Link>
          <nav>
            <Link href="/product" className={page === 'product' ? 'on' : ''}>
              Product
            </Link>
            <Link href="/solutions" className={page === 'solutions' ? 'on' : ''}>
              Solutions
            </Link>
            <Link href="/security" className={page === 'security' ? 'on' : ''}>
              Security
            </Link>
            <Link href="/docs" className={page === 'docs' ? 'on' : ''}>
              Docs
            </Link>
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </nav>
          <div className="nav-right">
            <span className="netchip">Sui · {NETWORK}</span>
            <Link className="btn btn-accent" href="/app">
              Launch app <IconChevronRight width={16} height={16} />
            </Link>
          </div>
        </div>
      </header>
      {children}
      {!hideCta && (
        <section className="cta">
          <div className="wrap" style={{ position: 'relative' }}>
            <div className="secno" style={{ justifyContent: 'center' }}>
              Start here
            </div>
            <h2>
              Put an authorization layer
              <br />
              <span>in front of the treasury</span>
            </h2>
            <p className="sub">
              Self-custodial, enforced in Move, and readable by the people who sign.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Link className="btn btn-white" href="/docs">
                Read the docs
              </Link>
              <Link className="btn btn-accent" href="/app">
                Launch app <IconChevronRight width={16} height={16} />
              </Link>
            </div>
          </div>
        </section>
      )}
      <div className="tape" />
      <footer className="land-footer">
        <div className="wrap">
          <div className="cols">
            <div>
              <Link className="logo" href="/" style={{ fontWeight: 800, fontSize: 20 }}>
                Skur
              </Link>
              <p style={{ color: '#adb5bd', marginTop: 12, maxWidth: 240 }}>
                A programmable authorization and treasury security layer for Sui organizations.
              </p>
            </div>
            <div>
              <h5>Product</h5>
              <ul>
                <li><Link href="/product">Risk-tiered authorization</Link></li>
                <li><Link href="/security">Guardians</Link></li>
                <li><Link href="/product#simulator">Policy simulator</Link></li>
                <li><Link href="/docs/agents">Agent proposers</Link></li>
                <li><a href={`${REPO}/tree/main/sui`} target="_blank" rel="noreferrer">Move package</a></li>
              </ul>
            </div>
            <div>
              <h5>Solutions</h5>
              <ul>
                <li><Link href="/solutions">Finance teams</Link></li>
                <li><Link href="/solutions#guardians">Guardians</Link></li>
                <li><Link href="/solutions#dao">Protocols and funds</Link></li>
              </ul>
            </div>
            <div>
              <h5>Project</h5>
              <ul>
                <li><a href={REPO} target="_blank" rel="noreferrer">GitHub</a></li>
                <li><Link href="/docs/limitations">Limitations</Link></li>
                <li><a href={`${REPO}/blob/main/docs/SUI_POSITIONING.md`} target="_blank" rel="noreferrer">Positioning</a></li>
              </ul>
            </div>
            <div>
              <h5>Resources</h5>
              <ul>
                <li><Link href="/docs">Documentation</Link></li>
                <li><Link href="/#faq">Questions</Link></li>
                <li><Link href="/docs/risk-tiers">Security model</Link></li>
                <li><a href={`https://suiscan.xyz/${NETWORK}`} target="_blank" rel="noreferrer">Explorer</a></li>
                <li><a href="https://faucet.sui.io" target="_blank" rel="noreferrer">Faucet</a></li>
              </ul>
            </div>
          </div>
          <div className="legal">
            <span>Skur V1 · Sui {NETWORK}</span>
            <span>
              MIT licensed. Skur limits and delays damage; it is not a guarantee against loss, and
              it has not been audited.
            </span>
          </div>
          <div className="giant">Skur</div>
        </div>
      </footer>
    </div>
  );
}

/** The hero used by the product, solutions and security pages. */
export function SubHero({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  sub: string;
  children?: ReactNode;
}) {
  return (
    <>
      <section className="hero sub-hero">
        <div className="grid-bg" />
        {[
          [0, 130],
          [1310, 0],
          [1180, 260],
          [130, 390],
          [910, 390],
        ].map(([x, y], i) => (
          <span key={i} className="cell" style={{ left: x, top: y, animationDelay: `${i * 0.6}s` }} />
        ))}
        <div className="wrap">
          <div className="eyebrow">{eyebrow}</div>
          <h1 style={{ fontSize: 64, lineHeight: '66px', maxWidth: 860 }}>{title}</h1>
          <p className="sub">{sub}</p>
          <div className="cta-row">
            <Link className="btn btn-accent btn-lg" href="/app">
              Launch app <IconChevronRight width={16} height={16} />
            </Link>
            {children}
          </div>
        </div>
      </section>
      <div className="tape" />
    </>
  );
}
