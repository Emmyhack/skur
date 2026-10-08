'use client';

import Link from 'next/link';
import { MarketingShell, SubHero } from '@/marketing/Shell';
import { AppMockup } from '@/marketing/Mockup';
import { Reveal } from '@/marketing/Reveal';
import {
  IconArrowRight,
  IconBank,
  IconClock,
  IconGuard,
  IconLayers,
  IconShield,
  IconUsers,
} from '@/marketing/icons';
import { TEMPLATES, fmtDuration } from '@skur/sdk';
import { NETWORK } from '@/config';

export default function Solutions() {
  return (
    <MarketingShell page="solutions">
      <SubHero
        eyebrow="SOLUTIONS"
        title={
          <>
            Treasury control
            <br />
            for onchain organizations
          </>
        }
        sub="Approvals that scale with risk, recipients that earn trust, and guardians who can stop a bad day without ever being able to cause one."
      />

      <section className="white">
        <div className="wrap">
          <Reveal>
            <h2>Three steps to a protected treasury</h2>
            <p className="lead">
              Nobody designs seventeen policy fields from first principles. Pick a template, name
              the people, sign once.
            </p>
          </Reveal>
          <Reveal stagger className="feat6">
            <div>
              <div className="ico"><IconUsers /></div>
              <h4>Name signers and guardians</h4>
              <p>
                Owners govern, approvers confirm payments, executors execute, proposers can only
                ask. Guardians hold the brake and nothing else; the contract will not let them hold
                both.
              </p>
            </div>
            <div>
              <div className="ico"><IconLayers /></div>
              <h4>Pick a policy template</h4>
              <p>
                Seven profiles, from Startup to Family office, set the tiers, delays, caps and loss
                envelope. Every number can be tuned later through governance.
              </p>
            </div>
            <div>
              <div className="ico"><IconShield /></div>
              <h4>Operate behind a firewall</h4>
              <p>
                Every payment is scored and reviewed in plain language. Every loosening of the
                policy waits, and any guardian can stop it.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="light" id="dao">
        <div className="wrap">
          <Reveal>
            <h2>One vault, seven starting points</h2>
            <p className="lead">
              Each template is a complete, valid policy. Start with the closest fit and tighten from
              there.
            </p>
          </Reveal>
          <Reveal stagger className="feat6">
            {TEMPLATES.map((t) => (
              <div key={t.id}>
                <div className="ico"><IconBank /></div>
                <h4>{t.name}</h4>
                <p>{t.tagline}</p>
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-2)' }}>{t.audience}</p>
                <p style={{ marginTop: 12, fontSize: 14 }}>
                  Critical payments wait {fmtDuration(t.policy.delayCritical)} · new recipients wait{' '}
                  {fmtDuration(t.policy.recipientActivationDelay)} · loss envelope{' '}
                  {t.policy.envelopeBps / 100}% per {fmtDuration(t.policy.envelopeWindow)}
                </p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="dark" id="guardians">
        <div className="wrap">
          <Reveal>
            <h2>For guardians</h2>
            <p className="lead">
              A cold key in a drawer, a board member, a security firm: anyone who should be able to
              stop money but must never be able to move it.
            </p>
          </Reveal>
          <Reveal className="shield">
            <div>
              <h2 style={{ fontSize: 32 }}>Hold the brake, not the wheel</h2>
              <p>
                The contract refuses to give a guardian any treasury role, and refuses to give a
                treasury member the guardian role. That makes guardians the second control plane an
                attacker has to breach, and the one they cannot profit from.
              </p>
              <ul>
                <li>
                  <IconGuard /> Freeze the vault the moment something looks wrong
                </li>
                <li>
                  <IconShield /> Veto critical payments and any weakening of the policy
                </li>
                <li>
                  <IconClock /> Replace a lost signer after a delay owners can cancel
                </li>
              </ul>
            </div>
            <div className="tilt">
              <AppMockup variant="queue" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="white">
        <div className="wrap">
          <Reveal>
            <h2>No custody. No fees on assets. No lock-in.</h2>
            <p className="lead">
              Skur never holds a key and never takes a percentage. The vault is a shared object you
              can reach with any compatible interface.
            </p>
          </Reveal>
          <Reveal stagger className="audiences">
            <div className="acard">
              <h3>Self-custodial by construction</h3>
              <p>
                The vault object holds the assets. Your wallets hold the keys. Nothing created the
                vault that retains authority over it, because there is no factory — a vault is
                configured and shared in one transaction.
              </p>
              <Link href="/security">
                Read the security model <IconArrowRight width={16} height={16} />
              </Link>
            </div>
            <div className="acard">
              <h3>Reachable without Skur</h3>
              <p>
                The package is published on Sui and every endpoint lives in one configuration file.
                The indexer makes a dashboard faster; switching it off costs you speed, not control.
              </p>
              <a href={`https://suiscan.xyz/${NETWORK}`} target="_blank" rel="noreferrer">
                Open the explorer <IconArrowRight width={16} height={16} />
              </a>
              <div className="art">
                <AppMockup />
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
