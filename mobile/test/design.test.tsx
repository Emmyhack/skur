import { fireEvent } from '@testing-library/react-native';
import { Role, Status } from '@skur/sdk';
import { renderScreen } from './harness';
import { ME, VAULT, proposal, view } from './fixtures';

/**
 * The product screens from the design pass: onboarding, dashboard, team, policies, logs, help.
 * Same contract as the other suites — what appears is what the chain would honour.
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

import { Launch } from '../src/screens/onboarding/Launch';
import { Tour } from '../src/screens/onboarding/Tour';
import { Start } from '../src/screens/onboarding/Start';
import { AddMembers } from '../src/screens/onboarding/AddMembers';
import { ActivityLog } from '../src/screens/ActivityLog';
import { Dashboard } from '../src/screens/Dashboard';
import { Help } from '../src/screens/Help';
import { Policies } from '../src/screens/Policies';
import { Roles } from '../src/screens/Roles';
import { Team } from '../src/screens/Team';

function seed(roles: number, over = {}) {
  mockStore.mockReturnValue({
    vaultId: VAULT,
    address: ME,
    book: [],
    ready: true,
    profile: { name: 'Olajumoke Emmanuel', email: 'tayo@company.com' },
  });
  mockView.mockReturnValue({
    data: view(roles, over),
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  });
}

afterEach(() => jest.clearAllMocks());

describe('the front door', () => {
  it('names the product and where it runs', async () => {
    seed(Role.OWNER);
    const r = await renderScreen(<Launch onStart={jest.fn()} />);
    expect(r.queryByText('Skur')).not.toBeNull();
    expect(r.queryByText('Secure. Shared. On Sui.')).not.toBeNull();
  });

  it('walks the tour and only then continues', async () => {
    const done = jest.fn();
    const r = await renderScreen(<Tour onDone={done} />);
    expect(r.queryByText('Multi-Signature Security')).not.toBeNull();
    expect(r.queryByText('Transaction Simulation')).not.toBeNull();
    await fireEvent.press(r.getByTestId('tour-next'));
    expect(done).not.toHaveBeenCalled();
    await fireEvent.press(r.getByTestId('tour-next'));
    await fireEvent.press(r.getByTestId('tour-next'));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('offers create and join as different paths', async () => {
    const create = jest.fn();
    const join = jest.fn();
    const r = await renderScreen(<Start onCreate={create} onJoin={join} />);
    await fireEvent.press(r.getByTestId('create-org'));
    await fireEvent.press(r.getByTestId('join-org'));
    expect(create).toHaveBeenCalled();
    expect(join).toHaveBeenCalled();
  });
});

describe('building the roster', () => {
  it('warns when no guardian is on it', async () => {
    seed(Role.OWNER);
    const r = await renderScreen(<AddMembers members={[]} onBack={jest.fn()} onDone={jest.fn()} />);
    expect(r.queryByText(/No guardian yet/)).not.toBeNull();
  });

  it('lists you first, as the owner', async () => {
    seed(Role.OWNER);
    const r = await renderScreen(<AddMembers members={[]} onBack={jest.fn()} onDone={jest.fn()} />);
    expect(r.queryByText(/Olajumoke Emmanuel \(You\)/)).not.toBeNull();
    expect(r.queryByText('Owner')).not.toBeNull();
  });
});

describe('the dashboard', () => {
  it('counts what is pending and who is on the vault', async () => {
    seed(Role.APPROVER);
    const r = await renderScreen(
      <Dashboard onOpenProposals={jest.fn()} onOpenProposal={jest.fn()} onOpenTreasury={jest.fn()} onSwitch={jest.fn()} />,
    );
    expect(r.queryByText('Pending approvals')).not.toBeNull();
    expect(r.queryByText('Active members')).not.toBeNull();
    expect(r.queryByText('Total treasury value')).not.toBeNull();
  });

  it('never shows a fiat figure it cannot know', async () => {
    seed(Role.APPROVER);
    const r = await renderScreen(
      <Dashboard onOpenProposals={jest.fn()} onOpenProposal={jest.fn()} onOpenTreasury={jest.fn()} onSwitch={jest.fn()} />,
    );
    expect(r.queryAllByText(/\$/).length).toBe(0);
  });
});

describe('the team', () => {
  it('offers Invite Member to an owner', async () => {
    seed(Role.OWNER);
    const r = await renderScreen(<Team onOpenRoles={jest.fn()} />);
    expect(r.queryByTestId('invite-member')).not.toBeNull();
  });

  it('does not offer it to a signer, and says why', async () => {
    seed(Role.APPROVER);
    const r = await renderScreen(<Team onOpenRoles={jest.fn()} />);
    expect(r.queryByTestId('invite-member')).toBeNull();
    expect(r.queryByText(/takes an owner/)).not.toBeNull();
  });

  it('marks the guardian as a separate plane in the role guide', async () => {
    const r = await renderScreen(<Roles onBack={jest.fn()} />);
    expect(r.queryByText('Guardian')).not.toBeNull();
    expect(r.queryByText(/refuses to combine/)).not.toBeNull();
    expect(r.queryByText('Viewer')).not.toBeNull();
  });
});

describe('spending policies', () => {
  it('shows the bands with the vault’s own numbers', async () => {
    seed(Role.OWNER);
    const r = await renderScreen(<Policies onBack={jest.fn()} />);
    // Fixture policy: 1 / 2 / 3 approvals, unknown-recipient timelock.
    expect(r.queryByText(/1 approval required, no wait/)).not.toBeNull();
    expect(r.queryByText('Unknown recipients')).not.toBeNull();
  });

  it('offers editing only to an owner', async () => {
    seed(Role.APPROVER);
    const r = await renderScreen(<Policies onBack={jest.fn()} />);
    expect(r.queryByTestId('edit-policies')).toBeNull();
  });
});

describe('activity logs', () => {
  it('derives entries from what actually happened', async () => {
    seed(Role.APPROVER, {
      proposals: [proposal({ approvals: [ME], status: Status.EXECUTED })],
    });
    const r = await renderScreen(<ActivityLog onBack={jest.fn()} />);
    expect(r.queryByText(/Payment opened/)).not.toBeNull();
    expect(r.queryByText(/Approved by/)).not.toBeNull();
    expect(r.queryByText(/Payment executed/)).not.toBeNull();
  });
});

describe('help', () => {
  it('answers the lost-phone question without hiding the loss', async () => {
    const r = await renderScreen(<Help onBack={jest.fn()} />);
    expect(r.queryByText('What happens if I lose my phone?')).not.toBeNull();
    expect(r.queryByText(/The key is gone with it/)).not.toBeNull();
    expect(r.queryByText('Chat with Support')).not.toBeNull();
  });
});
