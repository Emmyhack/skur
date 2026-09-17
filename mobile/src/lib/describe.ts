import { fmtAmount, short } from "@web/lib/format";
import { Kind, MODE_LABEL, roleNames, Status, TRUST_LABEL, type Mode, type Trust } from "@web/lib/types";
import type { ProposalView, VaultData } from "@web/lib/vaultReads";

/** Title and one-line detail for a proposal row, in the same words the web interface uses. */
export function describeProposal(p: ProposalView, vault: VaultData): { title: string; detail: string; icon: string } {
  const asset = vault.assets.find((a) => a.address.toLowerCase() === p.asset.toLowerCase());
  switch (p.kind) {
    case Kind.TRANSFER:
      return { title: "Send", detail: `${asset ? fmtAmount(p.amount, asset.decimals, asset.symbol) : String(p.amount)} to ${short(p.target)}`, icon: "↗" };
    case Kind.POLICY_UPDATE:
      return { title: "Policy update", detail: p.securityReducing ? "loosens at least one control" : "tightens or keeps every control", icon: "≡" };
    case Kind.ASSET_LIMITS:
      return { title: "Asset limits", detail: `${asset?.symbol ?? short(p.target)}${p.securityReducing ? " · loosens a cap" : ""}`, icon: "≡" };
    case Kind.MEMBER_SET: {
      const roles = Number(p.amount);
      return { title: roles === 0 ? "Remove member" : "Set roles", detail: `${short(p.target)}${roles ? ` → ${roleNames(roles).join(" + ")}` : ""}`, icon: "◎" };
    }
    case Kind.RECIPIENT_TRUST:
      return { title: "Recipient trust", detail: `${short(p.target)} → ${TRUST_LABEL[Number(p.amount) as Trust]}`, icon: "◎" };
    case Kind.MODE_RELAX:
      return { title: "Lower security mode", detail: `to ${MODE_LABEL[Number(p.amount) as Mode]} · guardians must confirm`, icon: "⛨" };
    case Kind.RECOVERY:
      return { title: "Signer recovery", detail: `${short(p.target)} replaced`, icon: "⛨" };
    default:
      return { title: "Proposal", detail: "", icon: "•" };
  }
}

export function statusText(p: ProposalView): string {
  if (p.status === Status.PENDING) return `${p.liveApprovals} of ${p.requiredApprovals}${p.requiredGuardians ? ` + ${p.liveGuardians} of ${p.requiredGuardians} guardian` : ""}`;
  return ["", "Pending", "Executed", "Cancelled", "Vetoed"][p.status] ?? "";
}

export function memoText(p: ProposalView): string {
  return p.memo;
}
