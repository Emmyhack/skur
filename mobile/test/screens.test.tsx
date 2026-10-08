import { Mode, Role, Tier } from '@skur/sdk';
import { fireEvent } from '@testing-library/react-native';

// `fireEvent` is asynchronous in React Native Testing Library 14, like `render`. Leaving one
// un-awaited does not fail the test that fired it — it leaves React's work queue mid-flight, and
// the next test's render resolves to an empty tree. Every call here is awaited for that reason.
import { renderScreen } from './harness';
import { BOB, ME, VAULT, policy, proposal, view } from './fixtures';

/**
 * The rest of the screens: what they show, what they refuse, and what they actually do when
 * pressed. The last part matters most — a button that renders correctly and calls the wrong
 * builder is worse than one that does not render.
 */
const mockStore = jest.fn();
const mockView = jest.fn();
const mockPreview = jest.fn();
// Typed with the hook's real signature, so the assertions on what it was called with are checked
// rather than inferred from an empty tuple.
const mockRun = jest.fn<Promise<string>, [() => unknown, string]>(async () => 'digest');

jest.mock('../src/state/store', () => ({ useStore: () => mockStore() }));
jest.mock('../src/hooks/useVault', () => ({
  useVaultView: () => mockView(),
  useTransferPreview: () => mockPreview(),
}));
jest.mock('../src/hooks/useTx', () => ({
  useTx: () => ({ run: mockRun, state: { phase: 'idle' }, reset: jest.fn(), busy: false }),
}));

import { Home } from '../src/screens/Home';
import { Security } from '../src/screens/Security';
import { Send } from '../src/screens/Send';
import { TxDetail } from '../src/screens/TxDetail';

function seed(roles: number, over = {}) {
  mockStore.mockReturnValue({ vaultId: VAULT, address: ME, book: [], ready: true });
  mockView.mockReturnValue({ data: view(roles, over), isLoading: false, error: null, refetch: jest.fn(), isRefetching: false });
  mockPreview.mockReturnValue({ data: undefined, isLoading: false, error: null });
}

afterEach(() => jest.clearAllMocks());


describe('the treasury screen', () => {
  it('says plainly when the vault is frozen, and what it takes to reopen', async () => {
    seed(Role.APPROVER, { vault: { ...view(Role.APPROVER).vault, mode: Mode.LOCKDOWN } });
    const r = await renderScreen(<Home onOpenQueue={jest.fn()} onSwitch={jest.fn()} />);
    expect(r.queryByText(/This vault is frozen/)).not.toBeNull();
    expect(r.queryByText(/Deposits still work/)).not.toBeNull();
  });

  it('shows what the policy enforces, not a generic summary', async () => {
    seed(Role.APPROVER);
    const r = await renderScreen(<Home onOpenQueue={jest.fn()} onSwitch={jest.fn()} />);
    expect(r.queryByText(/1 approval, no wait/)).not.toBeNull();
    expect(r.queryByText(/3 approvals \+ 1 guardian/)).not.toBeNull();
  });
});

describe('opening a payment', () => {
  it('shows the vault’s own numbers rather than computing its own', async () => {
    seed(Role.APPROVER);
    // The chain says critical, three approvals, a day's wait. The screen must say exactly that,
    // even though the amount alone would not imply it.
    mockPreview.mockReturnValue({
      data: { tier: Tier.CRITICAL, reasons: 256, exposureBps: 2600, reqApprovals: 3, reqGuardians: 1, delay: 86_400_000 },
      isLoading: false,
      error: null,
    });
    const r = await renderScreen(<Send onDone={jest.fn()} />);
    await fireEvent.changeText(r.getByPlaceholderText('0x…'), BOB);
    await fireEvent.changeText(r.getByPlaceholderText('0.00'), '1');
    expect(r.queryByText('Critical')).not.toBeNull();
    expect(r.queryByText('3')).not.toBeNull();
    expect(r.queryByText(/never paid this address/)).not.toBeNull();
  });

  it('refuses an amount over the per-payment cap, and says why', async () => {
    seed(Role.APPROVER);
    const r = await renderScreen(<Send onDone={jest.fn()} />);
    await fireEvent.changeText(r.getByPlaceholderText('0x…'), BOB);
    // The cap is 50 SUI; ask for 60.
    await fireEvent.changeText(r.getByPlaceholderText('0.00'), '60');
    expect(r.queryByText(/The vault would refuse this/)).not.toBeNull();
    expect(r.queryByText(/per-payment cap/)).not.toBeNull();
  });

  it('refuses more than the vault holds', async () => {
    seed(Role.APPROVER);
    const r = await renderScreen(<Send onDone={jest.fn()} />);
    await fireEvent.changeText(r.getByPlaceholderText('0x…'), BOB);
    await fireEvent.changeText(r.getByPlaceholderText('0.00'), '999999');
    expect(r.queryByText(/The vault would refuse this/)).not.toBeNull();
  });

  it('tells a guardian it cannot open payments at all', async () => {
    seed(Role.GUARDIAN);
    const r = await renderScreen(<Send onDone={jest.fn()} />);
    expect(r.queryByText(/cannot open payments in this vault/)).not.toBeNull();
  });

  it('lets an agent open one, because proposing is the whole of its authority', async () => {
    seed(Role.PROPOSER);
    const r = await renderScreen(<Send onDone={jest.fn()} />);
    expect(r.queryByText(/cannot open payments in this vault/)).toBeNull();
  });
});

describe('the security screen', () => {
  it('offers the brake to a guardian', async () => {
    seed(Role.GUARDIAN);
    const r = await renderScreen(<Security />);
    expect(r.queryByText('Freeze the vault')).not.toBeNull();
    expect(r.queryByText('Raise to Elevated')).not.toBeNull();
  });

  it('does not offer it to a plain approver', async () => {
    seed(Role.APPROVER);
    const r = await renderScreen(<Security />);
    expect(r.queryByText('Freeze the vault')).toBeNull();
    expect(r.queryByText(/takes an owner or a guardian/)).not.toBeNull();
  });

  it('flags a vault with no guardian as bad, not as a warning', async () => {
    const base = view(Role.OWNER);
    seed(Role.OWNER, { vault: { ...base.vault, guardianCount: 0 } });
    const r = await renderScreen(<Security />);
    expect(r.queryByText(/No guardian: nobody independent/)).not.toBeNull();
  });

  it('states the assumptions behind the maximum-loss numbers', async () => {
    seed(Role.OWNER);
    const r = await renderScreen(<Security />);
    expect(r.queryByText(/never a guarantee/)).not.toBeNull();
  });
});

describe('what a press actually does', () => {
  it('approving builds an approve transaction for this proposal', async () => {
    seed(Role.APPROVER);
    const r = await renderScreen(<TxDetail id={1n} onBack={jest.fn()} />);
    await fireEvent.press(r.getByTestId('action-approve'));
    expect(mockRun).toHaveBeenCalledTimes(1);
    // The hook is handed a builder and a reason; the reason is what the biometric prompt shows.
    expect(mockRun.mock.calls[0][1]).toMatch(/Approve/);
  });

  it('rejecting is a different action, not a differently-labelled approve', async () => {
    seed(Role.APPROVER);
    const r = await renderScreen(<TxDetail id={1n} onBack={jest.fn()} />);
    await fireEvent.press(r.getByTestId('action-reject'));
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun.mock.calls[0][1]).toMatch(/Reject/);
  });

  it('a guardian’s veto asks to veto', async () => {
    seed(Role.GUARDIAN, { proposals: [proposal({ tier: Tier.CRITICAL, reqGuardians: 1 })] });
    const r = await renderScreen(<TxDetail id={1n} onBack={jest.fn()} />);
    await fireEvent.press(r.getByTestId('action-veto'));
    expect(mockRun.mock.calls[0][1]).toMatch(/Veto/);
  });

  it('does nothing when the action is disabled', async () => {
    // Executable in an hour, so the button is present and must not fire.
    seed(Role.EXECUTOR, { proposals: [proposal({ executableAt: Date.now() + 3_600_000 })] });
    const r = await renderScreen(<TxDetail id={1n} onBack={jest.fn()} />);
    await fireEvent.press(r.getByTestId('action-execute'));
    expect(mockRun).not.toHaveBeenCalled();
  });
});
