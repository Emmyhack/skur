import { describe, expect, it } from 'vitest';
import { Kind, Mode, Role, Status, Tier, Trust, type DecodedEvent } from '@skur/sdk';
import { buildExpoPushMessage, linkTo, rulesFor } from '../src/rules.ts';

/**
 * The rules decide who gets interrupted. Getting this wrong in either direction is a real failure:
 * too little and a guardian misses the one thing only they can stop; too much and nobody reads the
 * eleventh alert.
 */
const position = { transactionDigest: 'DIGEST', eventIndex: 0 };

function wrap(event: DecodedEvent['event']): DecodedEvent {
  return { event, position };
}

const openedBase = {
  name: 'ProposalOpened' as const,
  vault: '0xV',
  proposal: 7n,
  kind: Kind.TRANSFER,
  proposer: '0xP',
  asset: '0x2::sui::SUI',
  amount: 1_000n,
  recipient: '0xR',
  tier: Tier.LOW,
  reasons: 0,
  exposureBps: 10,
  reqApprovals: 1,
  reqGuardians: 0,
  executableAt: 1,
  expiresAt: 2,
  reductionMask: 0,
  memo: 'invoice',
  at: 1,
};

describe('who hears about a new payment', () => {
  it('tells approvers, and nobody else', () => {
    const rules = rulesFor(wrap(openedBase));
    expect(rules).toHaveLength(1);
    expect(rules[0].rule).toBe('transfer.opened');
    expect(rules[0].roles).toBe(Role.APPROVER);
    expect(rules[0].severity).toBe('action');
  });

  it('also tells guardians when the payment is critical, because only they can veto it', () => {
    const rules = rulesFor(wrap({ ...openedBase, tier: Tier.CRITICAL, reqGuardians: 1 }));
    const guardian = rules.find((r) => r.rule === 'transfer.critical');
    expect(guardian).toBeDefined();
    expect(guardian!.roles).toBe(Role.GUARDIAN);
    expect(guardian!.severity).toBe('alert');
  });

  it('explains why the tier landed where it did', () => {
    const rules = rulesFor(
      wrap({ ...openedBase, tier: Tier.HIGH, reasons: 1 | 256, reqApprovals: 2 }),
    );
    expect(rules[0].body).toMatch(/never paid this address/);
    expect(rules[0].body).toMatch(/2 approvals/);
  });

  it('routes a governance proposal to owners instead', () => {
    const rules = rulesFor(wrap({ ...openedBase, kind: Kind.POLICY_UPDATE }));
    expect(rules[0].rule).toBe('governance.opened');
    expect(rules[0].roles).toBe(Role.OWNER);
  });

  it('raises an alert to guardians and owners when a change would weaken the vault', () => {
    const rules = rulesFor(
      wrap({ ...openedBase, kind: Kind.POLICY_UPDATE, reductionMask: 1 }),
    );
    const weakening = rules.find((r) => r.rule === 'governance.weakening');
    expect(weakening).toBeDefined();
    expect(weakening!.roles).toBe(Role.GUARDIAN | Role.OWNER);
    expect(weakening!.severity).toBe('alert');
    expect(weakening!.body).toMatch(/veto/);
  });

  it('tells owners about a recovery, because any one of them can cancel it', () => {
    const rules = rulesFor(wrap({ ...openedBase, kind: Kind.RECOVERY, reductionMask: 1 }));
    expect(rules.some((r) => r.rule === 'recovery.opened' && r.roles === Role.OWNER)).toBe(true);
  });
});

describe('approvals', () => {
  it('says nothing until the set is complete', () => {
    expect(
      rulesFor(
        wrap({
          name: 'Approved',
          vault: '0xV',
          proposal: 7n,
          approver: '0xA',
          approvals: 1,
          reqApprovals: 3,
          at: 1,
        }),
      ),
    ).toEqual([]);
  });

  it('tells executors once it is complete', () => {
    const rules = rulesFor(
      wrap({
        name: 'Approved',
        vault: '0xV',
        proposal: 7n,
        approver: '0xA',
        approvals: 3,
        reqApprovals: 3,
        at: 1,
      }),
    );
    expect(rules).toHaveLength(1);
    expect(rules[0].roles).toBe(Role.EXECUTOR);
  });
});

describe('rejections', () => {
  const base = {
    name: 'Rejected' as const,
    vault: '0xV',
    proposal: 7n,
    rejecter: '0xA',
    rejections: 1,
    reqApprovals: 2,
    settled: false,
    at: 1,
  };

  it('stays quiet on a rejection that has not settled anything', () => {
    expect(rulesFor(wrap(base))).toEqual([]);
  });

  it('tells the vault once the rejection carries', () => {
    const rules = rulesFor(wrap({ ...base, rejections: 2, settled: true }));
    expect(rules).toHaveLength(1);
    expect(rules[0].rule).toBe('proposal.rejected');
    expect(rules[0].roles).toBe(0);
    expect(rules[0].body).toMatch(/2 signers/);
  });
});

describe('the things everyone hears about', () => {
  it('tells the whole vault when the breaker trips, and says the money did not move', () => {
    const rules = rulesFor(
      wrap({
        name: 'BreakerTripped',
        vault: '0xV',
        proposal: 9n,
        asset: '0x2::sui::SUI',
        amount: 200_000n,
        envelopeSpent: 0n,
        envelopeLimit: 100_000n,
        envelopeBasis: 1_000_000n,
        at: 1,
      }),
    );
    expect(rules[0].roles).toBe(0);
    expect(rules[0].severity).toBe('alert');
    expect(rules[0].body).toMatch(/did not move/);
    expect(rules[0].body).toMatch(/Lockdown/);
  });

  it('distinguishes a freeze from a thaw', () => {
    const raised = rulesFor(
      wrap({ name: 'ModeChanged', vault: '0xV', from: Mode.NORMAL, to: Mode.LOCKDOWN, actor: '0xG', reasons: 0, at: 1 }),
    );
    expect(raised[0].severity).toBe('alert');
    expect(raised[0].body).toMatch(/until owners and a guardian/);

    const lowered = rulesFor(
      wrap({ name: 'ModeChanged', vault: '0xV', from: Mode.ELEVATED, to: Mode.NORMAL, actor: '0xO', reasons: 0, at: 1 }),
    );
    expect(lowered[0].severity).toBe('info');
  });

  it('alerts on a veto and merely notes an expiry', () => {
    const vetoed = rulesFor(
      wrap({ name: 'Settled', vault: '0xV', proposal: 1n, kind: Kind.TRANSFER, status: Status.VETOED, actor: '0xG', at: 1 }),
    );
    expect(vetoed[0].severity).toBe('alert');

    const expired = rulesFor(
      wrap({ name: 'Settled', vault: '0xV', proposal: 1n, kind: Kind.TRANSFER, status: Status.EXPIRED, actor: '0xA', at: 1 }),
    );
    expect(expired[0].severity).toBe('info');

    const cancelled = rulesFor(
      wrap({ name: 'Settled', vault: '0xV', proposal: 1n, kind: Kind.TRANSFER, status: Status.CANCELLED, actor: '0xA', at: 1 }),
    );
    expect(cancelled).toEqual([]);
  });

  it('alerts when a recipient is blocked and stays quiet when one is merely verified', () => {
    const blocked = rulesFor(
      wrap({ name: 'RecipientTrustChanged', vault: '0xV', proposal: 0n, recipient: '0xR', from: Trust.NEW, to: Trust.BLOCKED, actor: '0xG', at: 1 }),
    );
    expect(blocked[0].severity).toBe('alert');

    const verified = rulesFor(
      wrap({ name: 'RecipientTrustChanged', vault: '0xV', proposal: 1n, recipient: '0xR', from: Trust.NEW, to: Trust.VERIFIED, actor: '0xO', at: 1 }),
    );
    expect(verified).toEqual([]);
  });

  it('marks a tightening policy change as information and a weakening as an alert', () => {
    const tightened = rulesFor(
      wrap({ name: 'PolicyChanged', vault: '0xV', proposal: 1n, version: 2n, reductionMask: 0, at: 1 }),
    );
    expect(tightened[0].severity).toBe('info');

    const weakened = rulesFor(
      wrap({ name: 'PolicyChanged', vault: '0xV', proposal: 1n, version: 3n, reductionMask: 64, at: 1 }),
    );
    expect(weakened[0].severity).toBe('alert');
  });

  it('does not notify on a deposit, because incoming money is not an event anyone must act on', () => {
    expect(
      rulesFor(
        wrap({ name: 'Deposited', vault: '0xV', asset: '0x2::sui::SUI', amount: 1n, balance: 1n, from: '0xX', at: 1 }),
      ),
    ).toEqual([]);
  });
});


describe('push delivery to a device', () => {
  const queued = {
    endpoint: 'ExponentPushToken[abc123]',
    title: 'A critical payment is open and can be vetoed',
    body: 'Body.',
    severity: 'alert',
    link: 'skur://vault/0xV/proposal/7',
    vault_id: '0xV',
  };

  it('builds what Expo accepts, with the deep link in the data', () => {
    const m = buildExpoPushMessage(queued);
    expect(m.to).toBe('ExponentPushToken[abc123]');
    expect(m.data.url).toBe('skur://vault/0xV/proposal/7');
    expect(m.sound).toBe('default');
  });

  it('wakes a phone for an alert and not for information', () => {
    expect(buildExpoPushMessage(queued).priority).toBe('high');
    expect(buildExpoPushMessage({ ...queued, severity: 'info' }).priority).toBe('default');
  });

  it('refuses an endpoint that is not an Expo token, before Expo has to', () => {
    expect(() => buildExpoPushMessage({ ...queued, endpoint: 'https://example.com/hook' })).toThrow(
      /not an Expo push token/,
    );
  });

  it('falls back to the vault link when a rule carried none', () => {
    expect(buildExpoPushMessage({ ...queued, link: null }).data.url).toBe('skur://vault/0xV');
  });
});

describe('the links the rules carry', () => {
  it('a payment notification opens that payment', () => {
    const rules = rulesFor(
      wrap({ ...openedBase, tier: Tier.CRITICAL, reqGuardians: 1 }),
    );
    for (const r of rules) {
      expect(r.link).toBe('skur://vault/0xV/proposal/7');
    }
  });

  it('linkTo composes the scheme the app parses', () => {
    expect(linkTo('0xabc')).toBe('skur://vault/0xabc');
    expect(linkTo('0xabc', 42n)).toBe('skur://vault/0xabc/proposal/42');
  });
});
