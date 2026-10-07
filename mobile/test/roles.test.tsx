import { Role, Status, Tier } from '@skur/sdk';
import { renderScreen } from './harness';
import { BOB, ME, VAULT, proposal, view } from './fixtures';

/**
 * What a signer is offered, by role.
 *
 * This is the security-critical part of the interface. The contract refuses an action the caller
 * has no role for, so an interface that offers it is not unsafe — it is worse than that, it is
 * lying to the person holding the phone. Each case below asserts both halves: what appears, and
 * what does not.
 */
const mockStore = jest.fn();
const mockView = jest.fn();
const mockRun = jest.fn(async () => 'digest');

jest.mock('../src/state/store', () => ({ useStore: () => mockStore() }));
jest.mock('../src/hooks/useVault', () => ({
  useVaultView: () => mockView(),
  useTransferPreview: () => ({ data: undefined, isLoading: false, error: null }),
}));
jest.mock('../src/hooks/useTx', () => ({
  useTx: () => ({ run: mockRun, state: { phase: 'idle' }, reset: jest.fn(), busy: false }),
}));

import { TxDetail } from '../src/screens/TxDetail';

/** Renders the screen for a device key holding exactly `roles`, and returns a `has` predicate. */
async function show(roles: number, over = {}) {
  mockStore.mockReturnValue({ vaultId: VAULT, address: ME, book: [], ready: true });
  mockView.mockReturnValue({ data: view(roles, over), isLoading: false, error: null, refetch: jest.fn() });
  const r = await renderScreen(<TxDetail id={1n} onBack={jest.fn()} />);
  // queryAllByText: a fact may legitimately appear twice — once in the review-before-signing
  // card and once in the what-it-needs card. The assertion is "the screen says it", not "once".
  return Object.assign((label: string | RegExp) => r.queryAllByText(label).length > 0, {
    action: (id: string) => r.queryByTestId(`action-${id}`) !== null,
    enabled: (id: string) => {
      const node = r.queryByTestId(`action-${id}`);
      return node !== null && node.props.accessibilityState?.disabled !== true;
    },
  });
}

describe('a payment, by the role the device holds', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('offers an approver Approve and Reject, and not Execute', async () => {
    const has = await show(Role.APPROVER);
    expect(has.action('approve')).toBe(true);
    expect(has.action('reject')).toBe(true);
    expect(has.action('execute')).toBe(false);
  });

  it('offers an executor Execute, and not Approve', async () => {
    const has = await show(Role.EXECUTOR);
    expect(has.action('execute')).toBe(true);
    expect(has.action('approve')).toBe(false);
    expect(has.action('reject')).toBe(false);
  });

  it('offers both to someone holding both roles', async () => {
    const has = await show(Role.APPROVER | Role.EXECUTOR);
    expect(has.action('approve')).toBe(true);
    expect(has.action('execute')).toBe(true);
  });

  it('never offers a guardian Approve on a payment', async () => {
    // A guardian holds no treasury role at all — the contract refuses to give it one — so the
    // only things it can do here are confirm and veto.
    const has = await show(Role.GUARDIAN, { proposals: [proposal({ tier: Tier.CRITICAL, reqGuardians: 1 })] });
    expect(has.action('approve')).toBe(false);
    expect(has.action('reject')).toBe(false);
    expect(has.action('execute')).toBe(false);
    expect(has.action('confirm')).toBe(true);
    expect(has.action('veto')).toBe(true);
  });

  it('offers an agent nothing at all', async () => {
    // A proposer can open a payment and that is the whole of its authority. If a compromised
    // agent key could be nudged into approving from this screen, the role would be pointless.
    const has = await show(Role.PROPOSER);
    expect(has.action('approve')).toBe(false);
    expect(has.action('reject')).toBe(false);
    expect(has.action('execute')).toBe(false);
    expect(has.action('veto')).toBe(false);
    expect(has(/holds no role that can act/)).toBe(true);
  });

  it('tells a stranger they can read it and nothing more', async () => {
    const has = await show(0);
    expect(has(/holds no role that can act/)).toBe(true);
  });

  it('does not offer a veto on a routine payment', async () => {
    // Vetoable means critical, security-reducing, a recovery or a relaxation. A routine payment
    // is none of those, and showing the button would promise something the vault would refuse.
    const has = await show(Role.GUARDIAN, { proposals: [proposal({ tier: Tier.LOW, reqGuardians: 0 })] });
    expect(has.action('veto')).toBe(false);
  });

  it('offers a veto on a change that weakens the vault', async () => {
    const has = await show(Role.GUARDIAN, { proposals: [proposal({ reductionMask: 1 })] });
    expect(has.action('veto')).toBe(true);
  });
});

describe('what the screen says it still needs', () => {
  afterEach(() => jest.clearAllMocks());

  it('counts only approvals from addresses that still hold the role', async () => {
    // The vault recounts at execution, so a removed signer's approval stops counting. The screen
    // has to say the same thing, or someone waits for an execution that cannot happen.
    const stranger = `0x${'99'.repeat(32)}`;
    const has = await show(Role.EXECUTOR, {
      proposals: [proposal({ approvals: [ME, stranger], reqApprovals: 2 })],
    });
    // ME holds EXECUTOR here, not APPROVER, and the stranger is not a member at all — so zero of
    // the two recorded approvals count.
    expect(has(/0 of 2/)).toBe(true);
    expect(has(/2 no longer count/)).toBe(true);
  });

  it('will not let an executor execute before the waiting period', async () => {
    const has = await show(Role.EXECUTOR, {
      proposals: [proposal({ executableAt: Date.now() + 3_600_000, approvals: [], reqApprovals: 0 })],
    });
    expect(has(/Waits until/)).toBe(true);
    // Offered, but not pressable — the vault would refuse it.
    expect(has.enabled('execute')).toBe(false);
  });

  it('says a critical payment still needs its guardian', async () => {
    const has = await show(Role.EXECUTOR, {
      proposals: [proposal({ tier: Tier.CRITICAL, reqGuardians: 1, confirmations: [] })],
    });
    expect(has('0 of 1')).toBe(true);
  });
});

describe('a settled proposal', () => {
  afterEach(() => jest.clearAllMocks());

  it('offers no actions once it has executed', async () => {
    const has = await show(Role.APPROVER | Role.EXECUTOR | Role.GUARDIAN, {
      proposals: [proposal({ status: Status.EXECUTED })],
    });
    expect(has.action('approve')).toBe(false);
    expect(has.action('execute')).toBe(false);
    expect(has.action('veto')).toBe(false);
  });

  it('says plainly when the breaker refused it', async () => {
    const has = await show(Role.APPROVER, { proposals: [proposal({ status: Status.BLOCKED })] });
    expect(has(/Refused by the circuit breaker/)).toBe(true);
  });
});
