import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

/**
 * The query cache survives a restart, so opening the app offline shows the vault as it last was —
 * with its age stated — instead of a spinner that will never resolve.
 *
 * The serializer is the part that matters: vault data is full of bigints, and a plain
 * JSON.stringify throws on the first one. Persistence would then fail silently on exactly the
 * data it exists for, which is the kind of bug that passes every demo and fails the first user
 * with a balance.
 */
const TAG = '__skur_bigint__';

export function serialize(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? { [TAG]: v.toString() } : v));
}

export function deserialize(text: string): unknown {
  return JSON.parse(text, (_k, v) =>
    v && typeof v === 'object' && TAG in v ? BigInt((v as Record<string, string>)[TAG]) : v,
  );
}

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'skur.querycache.v1',
  serialize,
  deserialize: deserialize as (s: string) => never,
  throttleTime: 2_000,
});
