/**
 * Deep links the app answers to.
 *
 *   skur://vault/0x…        open that vault
 *   skur://proposal/42      open that proposal in the currently open vault
 *   skur://vault/0x…/proposal/42   open the vault, then the proposal
 *
 * Parsing is a pure function so it can be tested like one. The navigation side lives in App.tsx,
 * because a link can arrive before the navigator is mounted or before a vault is open, and what
 * to do then is a navigation decision, not a parsing one.
 */
export type ParsedLink =
  | { kind: 'vault'; vaultId: string; proposalId?: string }
  | { kind: 'proposal'; proposalId: string };

const VAULT_ID = /^0x[0-9a-fA-F]{10,64}$/;
const PROPOSAL_ID = /^\d{1,18}$/;

export function parseLink(url: string): ParsedLink | null {
  let path: string;
  try {
    // skur://vault/0x1 parses with 'vault' as the host, not the path — normalise both shapes,
    // and expo dev-client URLs (exp+skur://expo-development-client/…) fall through to null.
    const u = new URL(url);
    if (!/^(skur|exp\+skur):$/.test(u.protocol)) return null;
    path = `${u.host}${u.pathname}`;
  } catch {
    return null;
  }
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'vault' && parts[1] && VAULT_ID.test(parts[1])) {
    if (parts[2] === 'proposal' && parts[3] && PROPOSAL_ID.test(parts[3])) {
      return { kind: 'vault', vaultId: parts[1], proposalId: parts[3] };
    }
    if (parts.length === 2) return { kind: 'vault', vaultId: parts[1] };
    return null;
  }
  if (parts[0] === 'proposal' && parts[1] && PROPOSAL_ID.test(parts[1]) && parts.length === 2) {
    return { kind: 'proposal', proposalId: parts[1] };
  }
  return null;
}
