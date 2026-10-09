import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseLink } from '../src/lib/links';
import { StoreProvider, useStore } from '../src/state/store';
import { deserialize, serialize } from '../src/lib/persist';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { OfflineBanner, TxProgress } from '../src/components/ui';
import { renderScreen } from './harness';
import { act, fireEvent, render } from '@testing-library/react-native';

describe('the links the app answers to', () => {
  it('parses a vault link', () => {
    expect(parseLink('skur://vault/0xabc123def456')).toEqual({ kind: 'vault', vaultId: '0xabc123def456' });
  });

  it('parses a proposal in the open vault', () => {
    expect(parseLink('skur://proposal/42')).toEqual({ kind: 'proposal', proposalId: '42' });
  });

  it('parses a vault and a proposal together — the shape a push notification carries', () => {
    expect(parseLink('skur://vault/0xabc123def456/proposal/7')).toEqual({
      kind: 'vault',
      vaultId: '0xabc123def456',
      proposalId: '7',
    });
  });

  it('ignores the dev client’s own URLs instead of treating them as navigation', () => {
    expect(parseLink('exp+skur://expo-development-client/?url=http%3A%2F%2Flocalhost')).toBeNull();
  });

  it('refuses what only looks like a link', () => {
    expect(parseLink('skur://vault/not-an-id')).toBeNull();
    expect(parseLink('skur://proposal/42/extra')).toBeNull();
    expect(parseLink('skur://vault/0xabc/proposal/NaN')).toBeNull();
    expect(parseLink('https://vault/0xabc123def456')).toBeNull();
    expect(parseLink('')).toBeNull();
  });
});

describe('the cache that survives a restart', () => {
  it('round-trips bigints, which plain JSON would throw on', () => {
    const data = { balance: 1_000_000_000_000n, nested: [{ amount: 42n }], name: 'Treasury', n: 7 };
    expect(deserialize(serialize(data))).toEqual(data);
  });

  it('leaves everything else exactly as it was', () => {
    const data = { s: 'text', b: true, x: null, list: [1, 2, 3] };
    expect(deserialize(serialize(data))).toEqual(data);
  });
});

describe('the last line between a crash and a white screen', () => {
  const Bomb = () => {
    throw new Error('exploded in render');
  };

  it('shows what happened and that nothing was signed', async () => {
    // The boundary logs the crash; the test does not need to also print it.
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(r.queryByText(/Something broke in the app/)).not.toBeNull();
    expect(r.queryByText(/Nothing was signed/)).not.toBeNull();
    expect(r.queryByText(/exploded in render/)).not.toBeNull();
    quiet.mockRestore();
  });

  it('restart remounts and recovers when the cause was transient', async () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;
    const Flaky = () => {
      if (shouldThrow) throw new Error('transient');
      return <Text>recovered</Text>;
    };
    const r = await render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    shouldThrow = false;
    await fireEvent.press(r.getByText('Restart'));
    expect(r.queryByText('recovered')).not.toBeNull();
    quiet.mockRestore();
  });
});

describe('a transaction, step by step', () => {
  it('is silent when nothing is happening', async () => {
    // The harness providers render wrapper views, so the tree is not null — but nothing in it
    // should say anything.
    const r = await renderScreen(<TxProgress state={{ phase: 'idle' }} />);
    expect(r.queryByText(/./)).toBeNull();
  });

  it('names the step it is on', async () => {
    const r = await renderScreen(<TxProgress state={{ phase: 'signing' }} />);
    expect(r.queryByText('Sign and send')).not.toBeNull();
    expect(r.queryByText('Settle on the network')).not.toBeNull();
  });

  it('a declined fingerprint is a decision, not an error', async () => {
    const r = await renderScreen(<TxProgress state={{ phase: 'cancelled' }} />);
    expect(r.queryByText('Cancelled.')).not.toBeNull();
  });

  it('an error is the contract’s sentence, not a code', async () => {
    const r = await renderScreen(
      <TxProgress state={{ phase: 'error', message: 'The recipient is still in its activation delay.' }} />,
    );
    expect(r.queryByText(/activation delay/)).not.toBeNull();
  });
});

describe('being offline', () => {
  it('states the age of what is on screen', async () => {
    const r = await renderScreen(<OfflineBanner asOf={new Date('2026-10-06T09:30:00').getTime()} />);
    expect(r.queryByText(/Offline — showing the vault as of 9:30/)).not.toBeNull();
  });

  it('says only that it is offline when there is nothing cached to date', async () => {
    const r = await renderScreen(<OfflineBanner />);
    expect(r.queryByText('Offline')).not.toBeNull();
  });
});

describe('restoring the open vault', () => {
  const EVM = '0xD3f026024e015e1eC841a88D983883d4a017ED52'; // 40 hex — an EVM address
  const SUI = '0x' + 'ab'.repeat(32); // 64 hex — a normalised Sui object id

  async function restoredVaultId(stored: string | null): Promise<string | null> {
    if (stored === null) await AsyncStorage.removeItem('skur.vault');
    else await AsyncStorage.setItem('skur.vault', stored);
    let seen: string | null = null;
    function Probe() {
      const s = useStore();
      if (s.ready) seen = s.vaultId;
      return null;
    }
    await renderScreen(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    // The store loads asynchronously; flush until ready.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return seen;
  }

  it('restores a Sui object id', async () => {
    expect(await restoredVaultId(SUI)).toBe(SUI);
  });

  it('discards an EVM address left by an earlier build', async () => {
    expect(await restoredVaultId(EVM)).toBeNull();
    expect(await AsyncStorage.getItem('skur.vault')).toBeNull();
  });
});

describe('amount input', () => {
  it('drops grouping and keeps the decimal point', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { normalizeAmount } = require('../src/lib/amount') as typeof import('../src/lib/amount');
    // This machine is a dot-decimal locale: commas are grouping, never value.
    expect(normalizeAmount('1,500')).toBe('1500');
    expect(normalizeAmount('1 000.5')).toBe('1000.5');
    expect(normalizeAmount('2_000')).toBe('2000');
  });
});
