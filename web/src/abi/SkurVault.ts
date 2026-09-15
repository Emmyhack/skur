// Generated from contracts/out/SkurVault.sol/SkurVault.json by scripts/export-abi.py. Do not edit.
export const SkurVaultAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "approverCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancel",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "depositERC20",
    "inputs": [
      {
        "name": "asset",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "execute",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executedCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "executorCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "expire",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getApprovers",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAssetLimits",
    "inputs": [
      {
        "name": "asset",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct AssetLimits",
        "components": [
          {
            "name": "approved",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "lowMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "highMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "perTxMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "dailyMax",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAssets",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getGuardianConfirmers",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMembers",
    "inputs": [],
    "outputs": [
      {
        "name": "addrs",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "roles",
        "type": "uint8[]",
        "internalType": "uint8[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPolicy",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Policy",
        "components": [
          {
            "name": "approvalsLow",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "approvalsHigh",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "approvalsCritical",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "governanceThreshold",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "guardianThreshold",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "guardianRequiredCritical",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "delayHigh",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "delayCritical",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "recipientActivationDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "policyChangeDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "recoveryDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "proposalTtl",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "highExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "criticalExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "hardBlockExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "envelopeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "envelopeWindow",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getProposal",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Proposal",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum Kind"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum Status"
          },
          {
            "name": "tier",
            "type": "uint8",
            "internalType": "enum Tier"
          },
          {
            "name": "requiredApprovals",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "requiredGuardians",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "securityReducing",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "riskReasons",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "policyVersion",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "proposer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "asset",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "target",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "createdAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "executableAfter",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "expiresAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "data",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRecipient",
    "inputs": [
      {
        "name": "r",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Recipient",
        "components": [
          {
            "name": "trust",
            "type": "uint8",
            "internalType": "enum Trust"
          },
          {
            "name": "registeredAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "activatesAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "paymentCount",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "totalPaid",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "guardianCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasApproved",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "members",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "roles",
        "type": "uint8[]",
        "internalType": "uint8[]"
      },
      {
        "name": "policy",
        "type": "tuple",
        "internalType": "struct Policy",
        "components": [
          {
            "name": "approvalsLow",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "approvalsHigh",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "approvalsCritical",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "governanceThreshold",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "guardianThreshold",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "guardianRequiredCritical",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "delayHigh",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "delayCritical",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "recipientActivationDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "policyChangeDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "recoveryDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "proposalTtl",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "highExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "criticalExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "hardBlockExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "envelopeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "envelopeWindow",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      },
      {
        "name": "assets",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "limits",
        "type": "tuple[]",
        "internalType": "struct AssetLimits[]",
        "components": [
          {
            "name": "approved",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "lowMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "highMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "perTxMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "dailyMax",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isVetoable",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "liveApprovals",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "approvals",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "guardians",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "mode",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum Mode"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ownerCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pendingCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "policyVersion",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "previewTransfer",
    "inputs": [
      {
        "name": "asset",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "r",
        "type": "tuple",
        "internalType": "struct RiskResult",
        "components": [
          {
            "name": "tier",
            "type": "uint8",
            "internalType": "enum Tier"
          },
          {
            "name": "reasons",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "exposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "requiredApprovals",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "requiredGuardians",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "delay",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "proposalCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "proposeAssetLimits",
    "inputs": [
      {
        "name": "asset",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "next",
        "type": "tuple",
        "internalType": "struct AssetLimits",
        "components": [
          {
            "name": "approved",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "lowMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "highMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "perTxMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "dailyMax",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "proposeMember",
    "inputs": [
      {
        "name": "member",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "roles",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "proposeModeRelax",
    "inputs": [
      {
        "name": "target",
        "type": "uint8",
        "internalType": "enum Mode"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "proposePolicy",
    "inputs": [
      {
        "name": "next",
        "type": "tuple",
        "internalType": "struct Policy",
        "components": [
          {
            "name": "approvalsLow",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "approvalsHigh",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "approvalsCritical",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "governanceThreshold",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "guardianThreshold",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "guardianRequiredCritical",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "delayHigh",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "delayCritical",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "recipientActivationDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "policyChangeDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "recoveryDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "proposalTtl",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "highExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "criticalExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "hardBlockExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "envelopeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "envelopeWindow",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "proposeRecipientTrust",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "trust",
        "type": "uint8",
        "internalType": "enum Trust"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "proposeRecovery",
    "inputs": [
      {
        "name": "oldSigner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "newSigner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "proposeTransfer",
    "inputs": [
      {
        "name": "asset",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "memo",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "raiseMode",
    "inputs": [
      {
        "name": "target",
        "type": "uint8",
        "internalType": "enum Mode"
      },
      {
        "name": "reason",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registerRecipient",
    "inputs": [
      {
        "name": "r",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rolesOf",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalDeposited",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalOutflow",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "velocityOf",
    "inputs": [
      {
        "name": "asset",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "daySpent",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "dailyMax",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "envelopeSpent",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "envelope",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "envelopeResetsAt",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "veto",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "reason",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "AssetLimitsSet",
    "inputs": [
      {
        "name": "asset",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "limits",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct AssetLimits",
        "components": [
          {
            "name": "approved",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "lowMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "highMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "perTxMax",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "dailyMax",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CircuitBreakerTripped",
    "inputs": [
      {
        "name": "asset",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "attempted",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "envelopeSpent",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "envelope",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Deposit",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "asset",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MemberSet",
    "inputs": [
      {
        "name": "member",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "previousRoles",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "roles",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ModeChanged",
    "inputs": [
      {
        "name": "previous",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum Mode"
      },
      {
        "name": "mode",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum Mode"
      },
      {
        "name": "by",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "reason",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PolicyActivated",
    "inputs": [
      {
        "name": "version",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "activatedAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "policy",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct Policy",
        "components": [
          {
            "name": "approvalsLow",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "approvalsHigh",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "approvalsCritical",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "governanceThreshold",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "guardianThreshold",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "guardianRequiredCritical",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "delayHigh",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "delayCritical",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "recipientActivationDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "policyChangeDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "recoveryDelay",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "proposalTtl",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "highExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "criticalExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "hardBlockExposureBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "envelopeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "envelopeWindow",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProposalApproved",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "approver",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "approvals",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProposalCancelled",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "by",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProposalCreated",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "kind",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum Kind"
      },
      {
        "name": "proposer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "asset",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "target",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "tier",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum Tier"
      },
      {
        "name": "riskReasons",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "requiredApprovals",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "requiredGuardians",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "executableAfter",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "expiresAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "securityReducing",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "memo",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProposalExecuted",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "executor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProposalGuardianConfirmed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "guardian",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "confirmations",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProposalVetoed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "guardian",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "reason",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RecipientRegistered",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "activatesAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RecipientTrustSet",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "previous",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum Trust"
      },
      {
        "name": "trust",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum Trust"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RecoveryCompleted",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "oldSigner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newSigner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "roles",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TransferExecuted",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "asset",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VaultInitialized",
    "inputs": [
      {
        "name": "policyVersion",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "memberCount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyApproved",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AlreadyInitialized",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AmountZero",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AssetNotApproved",
    "inputs": [
      {
        "name": "asset",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ExposureHardBlocked",
    "inputs": [
      {
        "name": "exposureBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "maxBps",
        "type": "uint16",
        "internalType": "uint16"
      }
    ]
  },
  {
    "type": "error",
    "name": "InsufficientApprovals",
    "inputs": [
      {
        "name": "have",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "need",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InsufficientBalance",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "balance",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InsufficientGuardians",
    "inputs": [
      {
        "name": "have",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "need",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidPolicy",
    "inputs": [
      {
        "name": "reason",
        "type": "string",
        "internalType": "string"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidProposal",
    "inputs": [
      {
        "name": "reason",
        "type": "string",
        "internalType": "string"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidRoles",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MemberExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ModeNotRelaxation",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ModeNotStricter",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NativeTransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAuthorized",
    "inputs": [
      {
        "name": "requiredRole",
        "type": "uint8",
        "internalType": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotCancellable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotMember",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotPending",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotVetoable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PerTxLimitExceeded",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "max",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ProposalExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RecipientBlocked",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "RecipientNotRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ThresholdUnsatisfiable",
    "inputs": [
      {
        "name": "reason",
        "type": "string",
        "internalType": "string"
      }
    ]
  },
  {
    "type": "error",
    "name": "Timelocked",
    "inputs": [
      {
        "name": "executableAfter",
        "type": "uint64",
        "internalType": "uint64"
      }
    ]
  },
  {
    "type": "error",
    "name": "UnknownProposal",
    "inputs": []
  },
  {
    "type": "error",
    "name": "VaultLocked",
    "inputs": []
  },
  {
    "type": "error",
    "name": "VelocityExceeded",
    "inputs": [
      {
        "name": "wouldSpend",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "dailyMax",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
