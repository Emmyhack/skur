import {
  KIND_LABELS,
  MODE_LABELS,
  Kind,
  Mode,
  Role,
  Status,
  TIER_LABELS,
  Tier,
  Trust,
  describeReasons,
  short,
  type DecodedEvent,
} from '@skur/sdk';

/**
 * Who needs to be told, and why.
 *
 * The rule is the point of the whole service: an approver should hear about the queue, an
 * executor about what is ready, and a guardian about the things only a guardian can stop. Sending
 * everything to everyone is the same as sending nothing, because nobody reads the eleventh alert.
 *
 * `roles` is a bitmask of who the message is for; zero means every member of the vault.
 */
type Rule = {
  rule: string;
  title: string;
  body: string;
  severity: 'info' | 'action' | 'alert';
  roles: number;
};

const fmtAmount = (v: bigint) => v.toLocaleString('en-US');

export function rulesFor({ event }: DecodedEvent): Rule[] {
  switch (event.name) {
    case 'ProposalOpened': {
      const out: Rule[] = [];
      const who = event.kind === Kind.TRANSFER ? Role.APPROVER : Role.OWNER;
      const label = KIND_LABELS[event.kind] ?? 'Proposal';

      if (event.kind === Kind.TRANSFER) {
        const reasons = describeReasons(event.reasons);
        out.push({
          rule: 'transfer.opened',
          title: `${TIER_LABELS[event.tier]} payment awaiting approval`,
          body: [
            `${fmtAmount(event.amount)} to ${short(event.recipient)}${event.memo ? ` — ${event.memo}` : ''}.`,
            `Needs ${event.reqApprovals} approval${event.reqApprovals === 1 ? '' : 's'}${
              event.reqGuardians ? ` and ${event.reqGuardians} guardian confirmation${event.reqGuardians === 1 ? '' : 's'}` : ''
            }.`,
            reasons.length ? `Scored ${TIER_LABELS[event.tier]} because: ${reasons.join('; ')}.` : '',
          ]
            .filter(Boolean)
            .join(' '),
          severity: 'action',
          roles: who,
        });
        if (event.tier === Tier.CRITICAL) {
          out.push({
            rule: 'transfer.critical',
            title: 'A critical payment is open and can be vetoed',
            body: `${fmtAmount(event.amount)} to ${short(event.recipient)}, at ${(event.exposureBps / 100).toFixed(1)}% of holdings. You can veto it until it executes.`,
            severity: 'alert',
            roles: Role.GUARDIAN,
          });
        }
      } else {
        out.push({
          rule: 'governance.opened',
          title: `${label} awaiting owner approval`,
          body: `Opened by ${short(event.proposer)}.`,
          severity: 'action',
          roles: who,
        });
      }

      // The one notification that matters most: somebody is trying to make the vault weaker.
      if (event.reductionMask !== 0) {
        out.push({
          rule: 'governance.weakening',
          title: `${label} would weaken this vault`,
          body: `It cannot take effect before ${new Date(event.executableAt).toUTCString()}, and any guardian can veto it until then.`,
          severity: 'alert',
          roles: Role.GUARDIAN | Role.OWNER,
        });
      }
      if (event.kind === Kind.RECOVERY) {
        out.push({
          rule: 'recovery.opened',
          title: 'A signer recovery has been proposed',
          body: `Proposed by ${short(event.proposer)}. Any owner can cancel it before it executes.`,
          severity: 'alert',
          roles: Role.OWNER,
        });
      }
      return out;
    }

    case 'Approved':
      // Only the approval that completes the set is worth an interruption.
      if (event.approvals < event.reqApprovals) return [];
      return [
        {
          rule: 'proposal.ready',
          title: 'A payment has all its approvals',
          body: `Proposal #${event.proposal} is fully approved. It executes once its waiting period has elapsed.`,
          severity: 'action',
          roles: Role.EXECUTOR,
        },
      ];

    case 'BreakerTripped':
      return [
        {
          rule: 'breaker.tripped',
          title: 'The circuit breaker stopped a payment and froze the vault',
          body: `${fmtAmount(event.amount)} would have taken the window past its loss envelope of ${fmtAmount(event.envelopeLimit)} against a basis of ${fmtAmount(event.envelopeBasis)}. The money did not move. The vault is now in Lockdown and needs owners, a guardian and time to reopen.`,
          severity: 'alert',
          roles: 0,
        },
      ];

    case 'ModeChanged':
      if (event.to === Mode.NORMAL) {
        return [
          {
            rule: 'mode.normal',
            title: 'The vault is back to normal',
            body: `Lowered from ${MODE_LABELS[event.from]} by ${short(event.actor)}.`,
            severity: 'info',
            roles: 0,
          },
        ];
      }
      return [
        {
          rule: 'mode.raised',
          title: `The vault is now in ${MODE_LABELS[event.to]}`,
          body: [
            `Raised from ${MODE_LABELS[event.from]} by ${short(event.actor)}.`,
            event.to === Mode.LOCKDOWN
              ? 'Nothing outgoing executes until owners and a guardian agree to reopen it.'
              : 'Caps are halved and every payment is escalated one tier.',
            describeReasons(event.reasons).join('; '),
          ]
            .filter(Boolean)
            .join(' '),
          severity: 'alert',
          roles: 0,
        },
      ];

    case 'Settled':
      if (event.status === Status.VETOED) {
        return [
          {
            rule: 'proposal.vetoed',
            title: 'A guardian vetoed a proposal',
            body: `Proposal #${event.proposal} was vetoed by ${short(event.actor)}. The vault moved to Elevated.`,
            severity: 'alert',
            roles: 0,
          },
        ];
      }
      if (event.status === Status.EXPIRED) {
        return [
          {
            rule: 'proposal.expired',
            title: 'A proposal expired before it executed',
            body: `Proposal #${event.proposal} (${KIND_LABELS[event.kind]}) ran out of time. Its approvals no longer count for anything.`,
            severity: 'info',
            roles: Role.APPROVER | Role.OWNER,
          },
        ];
      }
      return [];

    case 'Executed':
      if (event.kind !== Kind.TRANSFER) return [];
      return [
        {
          rule: 'transfer.executed',
          title: 'A payment went out',
          body: `${fmtAmount(event.amount)} to ${short(event.recipient)}, executed by ${short(event.executor)}. ${fmtAmount(event.balanceAfter)} remains.`,
          severity: 'info',
          roles: 0,
        },
      ];

    case 'RecipientTrustChanged':
      if (event.to !== Trust.BLOCKED && event.to !== Trust.RESTRICTED) return [];
      return [
        {
          rule: 'recipient.restricted',
          title: `A recipient was ${event.to === Trust.BLOCKED ? 'blocked' : 'restricted'}`,
          body: `${short(event.recipient)} was set by ${short(event.actor)}. Payments to it are ${event.to === Trust.BLOCKED ? 'refused' : 'treated as critical'} from now on.`,
          severity: 'alert',
          roles: 0,
        },
      ];

    case 'Recovered':
      return [
        {
          rule: 'recovery.executed',
          title: 'A signer was replaced',
          body: `${short(event.lost)} was replaced by ${short(event.replacement)} with the same roles. The policy was not changed, and the vault is now Elevated.`,
          severity: 'alert',
          roles: 0,
        },
      ];

    case 'PolicyChanged':
      return [
        {
          rule: 'policy.changed',
          title: `The policy is now at version ${event.version}`,
          body: event.reductionMask === 0
            ? 'The change only tightened the vault.'
            : 'The change gave up one or more controls. It served its delay and was not vetoed.',
          severity: event.reductionMask === 0 ? 'info' : 'alert',
          roles: 0,
        },
      ];

    default:
      return [];
  }
}

