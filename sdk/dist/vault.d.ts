import type { ClientWithCoreApi } from '@mysten/sui/client';
import { type AssetLimits, type Proposal, type RecipientRecord, type TransferPreview, type VaultSummary, type Velocity } from './types.js';
export declare function fetchVault(client: ClientWithCoreApi, vaultId: string): Promise<VaultSummary>;
export declare function fetchMembers(client: ClientWithCoreApi, vault: VaultSummary): Promise<{
    address: string;
    roles: number;
}[]>;
export declare function fetchLimits(client: ClientWithCoreApi, vault: VaultSummary): Promise<{
    coinType: string;
    limits: AssetLimits;
}[]>;
export declare function fetchBalances(client: ClientWithCoreApi, vault: VaultSummary): Promise<{
    coinType: string;
    balance: bigint;
}[]>;
export declare function fetchVelocity(client: ClientWithCoreApi, vault: VaultSummary): Promise<{
    coinType: string;
    velocity: Velocity;
}[]>;
export declare function fetchRecipients(client: ClientWithCoreApi, vault: VaultSummary): Promise<RecipientRecord[]>;
/** One proposal by its number. */
export declare function fetchProposal(client: ClientWithCoreApi, vault: VaultSummary, id: bigint): Promise<Proposal | null>;
/**
 * The most recent proposals, newest first. Proposal numbers are sequential from 1, so this walks
 * backwards from the counter instead of listing the whole table — a vault with ten thousand
 * settled payments should not have to read all of them to show the queue.
 */
export declare function fetchRecentProposals(client: ClientWithCoreApi, vault: VaultSummary, count?: number): Promise<Proposal[]>;
/**
 * What the vault itself says a transfer would need, read by simulating its own
 * `preview_transfer`. The interface never computes this for a live vault: if the preview and the
 * execution could disagree, the preview is worthless.
 */
export declare function previewTransfer(client: ClientWithCoreApi, input: {
    packageId: string;
    vaultId: string;
    coinType: string;
    amount: bigint;
    recipient: string;
    sender: string;
}): Promise<TransferPreview>;
/** Everything an interface needs for one screen, in as few round trips as the transport allows. */
export type VaultView = {
    vault: VaultSummary;
    members: {
        address: string;
        roles: number;
    }[];
    assets: {
        coinType: string;
        limits: AssetLimits;
        balance: bigint;
        velocity: Velocity | null;
    }[];
    recipients: RecipientRecord[];
    proposals: Proposal[];
};
export declare function fetchVaultView(client: ClientWithCoreApi, vaultId: string, proposalCount?: number): Promise<VaultView>;
//# sourceMappingURL=vault.d.ts.map