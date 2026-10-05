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

/** Fail loudly at startup rather than mid-signature. */
export function assertCryptoReady() {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues is unavailable; react-native-get-random-values did not load');
  }
  if (new TextEncoder().encode('ß').length !== 2) {
    throw new Error('TextEncoder is not producing UTF-8');
  }
}
