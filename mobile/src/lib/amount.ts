/**
 * Normalise a typed amount to the dot-decimal form the SDK parses.
 *
 * On decimal-comma locales the numeric keyboard offers a comma, and the SDK's parser strips
 * commas as thousands separators — so "1,5" silently became 15: a tenfold overpayment with no
 * error anywhere. The device's own locale says which character is the decimal separator; the
 * other one is grouping and is dropped.
 */
const DECIMAL = (() => {
  try {
    const s = (1.1).toLocaleString();
    const ch = s.charAt(1);
    return ch === ',' || ch === '.' ? ch : '.';
  } catch {
    return '.';
  }
})();

export function normalizeAmount(text: string): string {
  const t = text.replace(/[\s_]/g, '');
  if (DECIMAL === ',') {
    return t.replace(/\./g, '').replace(/,/g, '.');
  }
  return t.replace(/,/g, '');
}
