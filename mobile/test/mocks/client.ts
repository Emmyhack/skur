/** No network in tests. Every read is supplied by the fixtures instead. */
export const client = {} as never;
export function getClient() {
  throw new Error('tests must not reach the network');
}
