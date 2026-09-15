// Generated from contracts/out/SkurFactory.sol/SkurFactory.json by scripts/export-abi.py. Do not edit.
export const SkurFactoryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "impl",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createVault",
    "inputs": [
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      },
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
    "outputs": [
      {
        "name": "vault",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "implementation",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isVault",
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
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "predictVaultAddress",
    "inputs": [
      {
        "name": "creator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "vaultAt",
    "inputs": [
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "vaultCount",
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
    "name": "vaultsOf",
    "inputs": [
      {
        "name": "member",
        "type": "address",
        "internalType": "address"
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
    "type": "event",
    "name": "VaultCreated",
    "inputs": [
      {
        "name": "vault",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "creator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "index",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "FailedDeployment",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientBalance",
    "inputs": [
      {
        "name": "balance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotAVault",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotImplementation",
    "inputs": []
  }
] as const;
