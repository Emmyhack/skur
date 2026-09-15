import { useCallback, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { BaseError, ContractFunctionRevertedError, type Abi } from "viem";
import { arkDevnet } from "../config/chain";

export type TxState =
  | { phase: "idle" }
  | { phase: "simulating" }
  | { phase: "signing" }
  | { phase: "mining"; hash: `0x${string}` }
  | { phase: "done"; hash: `0x${string}` }
  | { phase: "error"; message: string };

/**
 * Simulate, sign, wait. Simulation runs first so a policy refusal surfaces as a readable custom error
 * before the wallet ever asks for a signature (human-readable intent before signing).
 */
export function useTx(onDone?: () => void) {
  const { data: wallet } = useWalletClient();
  const client = usePublicClient();
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const send = useCallback(
    async (args: { address: `0x${string}`; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint }) => {
      if (!wallet || !client) {
        setState({ phase: "error", message: "Connect a wallet to continue." });
        return;
      }
      try {
        setState({ phase: "simulating" });
        const { request } = await client.simulateContract({
          ...args,
          account: wallet.account,
          chain: arkDevnet,
        } as Parameters<typeof client.simulateContract>[0]);
        setState({ phase: "signing" });
        const hash = await wallet.writeContract(request);
        setState({ phase: "mining", hash });
        await client.waitForTransactionReceipt({ hash });
        setState({ phase: "done", hash });
        onDone?.();
      } catch (e) {
        setState({ phase: "error", message: describeError(e) });
      }
    },
    [wallet, client, onDone],
  );

  const reset = useCallback(() => setState({ phase: "idle" }), []);
  return { state, send, reset, busy: state.phase === "simulating" || state.phase === "signing" || state.phase === "mining" };
}

const ERROR_TEXT: Record<string, (a: readonly unknown[]) => string> = {
  NotAuthorized: (a) => `Your wallet does not hold the required role (${roleText(Number(a[0]))}).`,
  VaultLocked: () => "The vault is in Lockdown. Outgoing payments and security-reducing changes are blocked until it is lowered.",
  Timelocked: (a) => `This cannot execute before ${new Date(Number(a[0]) * 1000).toLocaleString()}.`,
  InsufficientApprovals: (a) => `${a[0]} of the required ${a[1]} approvals are in place.`,
  InsufficientGuardians: (a) => `${a[0]} of the required ${a[1]} guardian confirmations are in place.`,
  PerTxLimitExceeded: () => "This amount is above the per-transaction cap for the asset.",
  VelocityExceeded: () => "This would push today's outflow past the 24-hour cap for the asset.",
  ExposureHardBlocked: (a) => `This would move ${Number(a[0]) / 100}% of holdings; the policy refuses anything above ${Number(a[1]) / 100}%.`,
  RecipientBlocked: () => "This recipient is blocked by policy.",
  AssetNotApproved: () => "This asset is not on the vault's approved list.",
  AlreadyApproved: () => "You have already confirmed this proposal.",
  NotPending: () => "This proposal is no longer open.",
  ProposalExpired: () => "This proposal has expired.",
  NotVetoable: () => "Guardians cannot veto this proposal: it is neither critical, probationary nor security-reducing.",
  ModeNotStricter: () => "The mode can only be raised directly. Lowering it goes through governance.",
  ModeNotRelaxation: () => "That mode is not lower than the current one.",
  InvalidPolicy: (a) => `Invalid policy: ${String(a[0])}.`,
  ThresholdUnsatisfiable: (a) => `Thresholds would be unsatisfiable: ${String(a[0])}.`,
  InvalidProposal: (a) => `Invalid proposal: ${String(a[0])}.`,
  InvalidRoles: () => "Guardians cannot hold treasury roles, and roles must be valid.",
  MemberExists: () => "That address is already a member.",
  NotMember: () => "That address is not a member.",
  InsufficientBalance: () => "The vault does not hold enough of this asset right now.",
  AmountZero: () => "Amount must be greater than zero.",
  ZeroAddress: () => "Address cannot be empty.",
  NotCancellable: () => "Only the proposer or an owner can cancel this.",
};

function roleText(bits: number): string {
  const n: string[] = [];
  if (bits & 1) n.push("Owner");
  if (bits & 2) n.push("Approver");
  if (bits & 4) n.push("Executor");
  if (bits & 8) n.push("Guardian");
  return n.join(" or ") || "unknown";
}

export function describeError(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (revert?.data) {
      const name = revert.data.errorName;
      const f = ERROR_TEXT[name];
      if (f) return f(revert.data.args ?? []);
      return `${name}(${(revert.data.args ?? []).map(String).join(", ")})`;
    }
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : String(e);
}
