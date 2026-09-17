/** Hands a scanned address from the Scan screen back to whichever screen asked for it. */
type Listener = (value: string) => void;
let listener: Listener | null = null;
export const scanBus = {
  request(fn: Listener) { listener = fn; },
  deliver(value: string) { const fn = listener; listener = null; fn?.(value); },
  clear() { listener = null; },
};
