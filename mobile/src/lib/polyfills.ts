/**
 * Must be imported before anything that touches crypto or BCS.
 *
 * Hermes is not a browser and not Node. Two things the Sui SDK assumes are missing or partial:
 * a CSPRNG behind `crypto.getRandomValues`, which key generation needs, and the text codecs that
 * BCS uses for every string it serialises.
 */
import 'react-native-get-random-values';

// Hermes ships TextEncoder and TextDecoder on recent React Native, but the version is not
// something this app should depend on — and a silent absence would surface much later as a
// corrupted transaction rather than a missing global. UTF-8 only, which is all BCS uses.
if (typeof globalThis.TextEncoder === 'undefined') {
  class MinimalTextEncoder {
    readonly encoding = 'utf-8';
    encode(input = ''): Uint8Array {
      const bytes: number[] = [];
      for (let i = 0; i < input.length; i++) {
        let code = input.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
          const low = input.charCodeAt(i + 1);
          if (low >= 0xdc00 && low <= 0xdfff) {
            code = ((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
            i++;
          }
        }
        if (code < 0x80) bytes.push(code);
        else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        else if (code < 0x10000)
          bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        else
          bytes.push(
            0xf0 | (code >> 18),
            0x80 | ((code >> 12) & 0x3f),
            0x80 | ((code >> 6) & 0x3f),
            0x80 | (code & 0x3f),
          );
      }
      return new Uint8Array(bytes);
    }
  }
  globalThis.TextEncoder = MinimalTextEncoder as unknown as typeof TextEncoder;
}

if (typeof globalThis.TextDecoder === 'undefined') {
  class MinimalTextDecoder {
    readonly encoding = 'utf-8';
    decode(input?: Uint8Array): string {
      if (!input) return '';
      let out = '';
      for (let i = 0; i < input.length; ) {
        const b = input[i++];
        if (b < 0x80) out += String.fromCharCode(b);
        else if (b < 0xe0) out += String.fromCharCode(((b & 0x1f) << 6) | (input[i++] & 0x3f));
        else if (b < 0xf0)
          out += String.fromCharCode(
            ((b & 0x0f) << 12) | ((input[i++] & 0x3f) << 6) | (input[i++] & 0x3f),
          );
        else {
          const cp =
            (((b & 0x07) << 18) |
              ((input[i++] & 0x3f) << 12) |
              ((input[i++] & 0x3f) << 6) |
              (input[i++] & 0x3f)) -
            0x10000;
          out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        }
      }
      return out;
    }
  }
  globalThis.TextDecoder = MinimalTextDecoder as unknown as typeof TextDecoder;
}

/**
 * Hermes ships a partial `Intl`, and `PluralRules` is one of the pieces it leaves out.
 *
 * This matters more than it sounds. The Sui SDK builds an ordinal formatter at **module scope** —
 * `new Intl.PluralRules("en-US", { type: "ordinal" })`, used to say "1st command" in an error —
 * so on Hermes the constructor is `undefined` and importing anything from the SDK's client throws
 * `undefined cannot be used as a constructor` before a line of app code runs. There is no stack
 * worth reading, because it happens while the module graph is still loading.
 *
 * English only, which is all the SDK asks for, and only installed when it is genuinely absent.
 */
if (typeof (globalThis as { Intl?: { PluralRules?: unknown } }).Intl?.PluralRules === 'undefined') {
  class MinimalPluralRules {
    #ordinal: boolean;

    constructor(_locales?: string | string[], options?: { type?: string }) {
      this.#ordinal = options?.type === 'ordinal';
    }

    select(n: number): string {
      if (!this.#ordinal) return n === 1 ? 'one' : 'other';
      // en-US ordinals: 1st, 2nd, 3rd, 4th … and the 11th/12th/13th exceptions.
      const tens = Math.abs(n) % 100;
      const units = Math.abs(n) % 10;
      if (units === 1 && tens !== 11) return 'one';
      if (units === 2 && tens !== 12) return 'two';
      if (units === 3 && tens !== 13) return 'few';
      return 'other';
    }

    resolvedOptions() {
      return { locale: 'en-US', type: this.#ordinal ? 'ordinal' : 'cardinal' };
    }

    static supportedLocalesOf(locales?: string | string[]): string[] {
      return typeof locales === 'string' ? [locales] : (locales ?? []);
    }
  }

  const intl = ((globalThis as { Intl?: Record<string, unknown> }).Intl ??= {} as Record<string, unknown>);
  intl.PluralRules = MinimalPluralRules;
}

/** Fail loudly at startup rather than mid-signature. */
export function assertCryptoReady() {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues is unavailable; react-native-get-random-values did not load');
  }
  if (new TextEncoder().encode('ß').length !== 2) {
    throw new Error('TextEncoder is not producing UTF-8');
  }
  // The SDK builds an ordinal formatter at module scope, so this has to work before it is imported.
  const ordinals = new Intl.PluralRules('en-US', { type: 'ordinal' });
  if (ordinals.select(1) !== 'one' || ordinals.select(11) !== 'other') {
    throw new Error('Intl.PluralRules is not producing English ordinals');
  }
}

/**
 * Hermes has neither `structuredClone` (used by the Sui SDK while building a transaction — the
 * resolver splices cloned commands) nor `Promise.withResolvers` (used by its gRPC transport).
 * Without the first, every `tx.build()` dies with "undefined is not a function" *after* the user
 * has already passed the biometric prompt, which reads like a signing failure and is not.
 *
 * The clone below covers what the SDK actually clones — plain objects, arrays, strings, numbers,
 * bytes — not the full HTML algorithm. Uint8Array is the one typed case that matters: transaction
 * arguments carry BCS bytes, and JSON round-tripping would quietly turn them into objects.
 */
if (typeof (globalThis as { structuredClone?: unknown }).structuredClone !== 'function') {
  const clone = (value: unknown, seen: WeakMap<object, unknown>): unknown => {
    if (value === null || typeof value !== 'object') return value;
    const hit = seen.get(value);
    if (hit) return hit;
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (value instanceof ArrayBuffer) return value.slice(0);
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof Map) {
      const out = new Map();
      seen.set(value, out);
      for (const [k, v] of value) out.set(clone(k, seen), clone(v, seen));
      return out;
    }
    if (value instanceof Set) {
      const out = new Set();
      seen.set(value, out);
      for (const v of value) out.add(clone(v, seen));
      return out;
    }
    if (Array.isArray(value)) {
      const out: unknown[] = [];
      seen.set(value, out);
      for (const v of value) out.push(clone(v, seen));
      return out;
    }
    const out: Record<string, unknown> = {};
    seen.set(value, out);
    for (const [k, v] of Object.entries(value)) out[k] = clone(v, seen);
    return out;
  };
  (globalThis as { structuredClone?: unknown }).structuredClone = (value: unknown) =>
    clone(value, new WeakMap());
}

if (typeof (Promise as { withResolvers?: unknown }).withResolvers !== 'function') {
  (Promise as { withResolvers?: unknown }).withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

/**
 * Hermes (via React Native) ships `AbortController` but not the static helpers on `AbortSignal`.
 * The Sui client's `waitForTransaction` builds its deadline with `AbortSignal.timeout` and merges
 * it with the caller's signal via `AbortSignal.any` — so without these, a payment executes on
 * chain and then the app throws while *waiting to report it*, which is the worst possible place
 * to fail.
 */
type AbortSignalStatics = {
  timeout?: (ms: number) => AbortSignal;
  any?: (signals: Iterable<AbortSignal>) => AbortSignal;
  abort?: (reason?: unknown) => AbortSignal;
};
const signalStatics = AbortSignal as unknown as AbortSignalStatics;

if (typeof signalStatics.timeout !== 'function') {
  signalStatics.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => {
      controller.abort(new Error(`signal timed out after ${ms}ms`));
    }, ms);
    return controller.signal;
  };
}

if (typeof signalStatics.any !== 'function') {
  signalStatics.any = (signals: Iterable<AbortSignal>) => {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        break;
      }
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }
    return controller.signal;
  };
}

if (typeof signalStatics.abort !== 'function') {
  signalStatics.abort = (reason?: unknown) => {
    const controller = new AbortController();
    controller.abort(reason);
    return controller.signal;
  };
}

/**
 * React Native's own `AbortSignal` predates `throwIfAborted`. The Sui client calls it on every
 * poll of `waitForTransaction`.
 */
type AbortSignalWithThrow = AbortSignal & { throwIfAborted?: () => void };
const signalProto = AbortSignal.prototype as AbortSignalWithThrow;
if (typeof signalProto.throwIfAborted !== 'function') {
  signalProto.throwIfAborted = function throwIfAborted(this: AbortSignal) {
    if (this.aborted) {
      throw (this as { reason?: unknown }).reason ?? new Error('the operation was aborted');
    }
  };
}
