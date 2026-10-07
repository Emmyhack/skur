import { Role } from '@skur/sdk';

/**
 * The roles the app talks about, mapped to the bits the contract enforces.
 *
 * The contract's vocabulary is capabilities (owner, approver, executor, proposer, guardian); the
 * product's vocabulary is job titles. This file is the only place the two meet, so a title can
 * never quietly drift from what the key can actually do.
 */
export type RoleId = 'owner' | 'admin' | 'signer' | 'guardian' | 'viewer';

export type RoleSpec = {
  id: RoleId;
  title: string;
  /** What this role may do, in the words the Roles & Permissions screen shows. */
  grants: string;
  bits: number;
};

export const ROLE_SPECS: RoleSpec[] = [
  {
    id: 'owner',
    title: 'Owner',
    grants: 'Full access to all features: governance, approvals, execution and policy.',
    bits: Role.OWNER | Role.APPROVER | Role.EXECUTOR,
  },
  {
    id: 'admin',
    title: 'Admin',
    grants: 'Manage day-to-day money movement: approve and execute payments.',
    bits: Role.APPROVER | Role.EXECUTOR,
  },
  {
    id: 'signer',
    title: 'Signer',
    grants: 'Approve transactions and proposals. Cannot execute or change policy.',
    bits: Role.APPROVER,
  },
  {
    id: 'guardian',
    title: 'Guardian',
    grants: 'An independent brake: veto critical payments, freeze the vault, confirm recovery. Holds no treasury role by design.',
    bits: Role.GUARDIAN,
  },
  {
    id: 'viewer',
    title: 'Viewer',
    grants: 'View-only access. A vault is a shared object, so viewers need no on-chain role at all.',
    bits: 0,
  },
];

export const roleSpec = (id: RoleId): RoleSpec => ROLE_SPECS.find((r) => r.id === id)!;

/** The closest title for a member's bits, for badges on the team list. */
export function titleForBits(bits: number): string {
  if (bits & Role.GUARDIAN) return 'Guardian';
  if (bits & Role.OWNER) return 'Owner';
  if ((bits & Role.APPROVER) !== 0 && (bits & Role.EXECUTOR) !== 0) return 'Admin';
  if (bits & Role.APPROVER) return 'Signer';
  if (bits & Role.EXECUTOR) return 'Executor';
  if (bits & Role.PROPOSER) return 'Agent';
  return 'Viewer';
}
