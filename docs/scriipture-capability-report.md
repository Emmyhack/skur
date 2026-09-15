# Scriipture 0.1.0 capability report

**Date:** 2026-09-15
**Scope:** Can Skur's V1 contracts be authored in Scriipture TypeScript, as the project brief assumes?
**Result:** No. The vault, factory and test stablecoin are authored in plain Solidity 0.8.28 and built with Foundry. The brief explicitly allows this fallback ("authoring that module in plain Solidity") and asks for the decision to be made before the state-machine design. This document records the evidence.

## Method

`scriipture@0.1.0` was installed into a scratch directory and its published artifacts were read directly: `types/index.d.ts`, `types/standards.d.ts`, `docs/details.md`, and the compiled parser, mapper, emitter and validator in `dist/index.js`. Claims below reference the bundle's own source comments (`// src/parser/parse.ts`, `// src/mapper/expressions.ts`, and so on).

## What is present

| Primitive the brief asked to verify | Status | Evidence |
|---|---|---|
| `msg.sender` inside function bodies | Present | `msg`, `block` globals are declared in `types/index.d.ts` and rewritten verbatim by `GLOBAL_OBJECT_REWRITES`. Per-role checks are expressible with `require(rolesOf.get(msg.sender) & ROLE != 0n, "...")`. |
| `block.timestamp` | Present | Same global rewrite. |
| `require` / `revert` | Present | `require(cond, "msg")` is rewritten into an auto-derived parameterless custom error by the `custom-errors` optimizer pass. `revert("...")` is emitted as a string revert. |
| Reentrancy guard | Present | `@nonReentrant` wires OpenZeppelin `ReentrancyGuard`. |
| Mappings | Present, no iteration | `Map<K,V>` maps to `mapping`; `.get/.set/.has/.delete` only. |

## What is missing

| Primitive | Status | Evidence | Impact on Skur |
|---|---|---|---|
| **Events** | Absent | `parseClass` returns `events: []` unconditionally; no syntax populates it. `emit(...)` is exported as a function type but `emitCall` has no special case, so `emit(Foo, a)` is emitted literally as `emit(Foo, a)`, which is not Solidity. | Section 10 of the blueprint requires every policy version and activation time onchain; the interface reads events for history. |
| **Custom errors with parameters** | Absent | Only the auto-derived, parameterless errors from `require` strings exist (`errorByMsg` in the custom-errors pass). | Reverts such as `Timelocked(executableAfter)` and `InsufficientApprovals(have, need)` cannot be expressed. |
| **Enums** | Absent | `parseContractFiles` only visits `ts.isClassDeclaration` nodes; enum declarations are skipped. The docs additionally state string enums are rejected. | Modes, tiers, trust states and proposal kinds would have to be untyped `bigint` constants. |
| **Structs** | Absent | Only `PropertyDeclaration`, `MethodDeclaration` and `ConstructorDeclaration` class members are parsed. A custom type name is passed through `solidityType` verbatim with no declaration emitted. | `Proposal`, `Policy`, `AssetLimits`, `Recipient` would need to be split into parallel mappings. |
| **ERC-20 interface calls** | Absent | `STANDARD_IMPORTS` contains only `ERC20`, `ERC721`, `Ownable`, `ReentrancyGuard`, `Test`. There is no way to import `IERC20` or `SafeERC20`, and no `interface` declaration syntax. | Vault cannot call `transfer` on an approved token. A low-level `call` would be flagged by the validator and Slither. |
| **Inheritance beyond OZ bases** | Partial | `extends X` emits `is X` but only adds an import when `X` is in `STANDARD_IMPORTS`. | Cannot split the vault into modules. |
| **Invariants over aggregates** | Present in principle | `@invariant` methods become Forge invariant tests. | Usable, but moot if the contract cannot be written. |
| **Visibility control** | Undocumented | `external/public/internal/private` decorators exist in `FUNCTION_DECORATORS` but are not exported from `types/index.d.ts`. All state variables are emitted `public`. | Internal helpers would be public entry points unless the undocumented decorators are used. |

## Escape hatches considered

1. **`solidity\`...\`` tagged templates.** Any expression statement wrapped in this tag is emitted verbatim. Events could be emitted this way, but their *declarations* still cannot be, because the emitter only writes declarations from `contract.events`, which nothing populates.
2. **Plugin optimizer pass.** A plugin receives the `IRContract` and could push into `contract.events` and `contract.errors`. This would recover events and parameterless errors. It cannot recover enums, structs, interfaces or imports because the IR has no slot for them.
3. **Raw statements.** Unrecognised statements are emitted verbatim (`kind: "raw"`), but only inside function bodies. Contract-level declarations are unreachable.

Combining all three would produce a TypeScript file that is mostly Solidity strings glued together by a 0.1.0 transpiler. The generated Solidity is what gets audited either way, and the brief itself notes that a 0.1.0 transpiler in the path of a treasury contract is part of the threat model. Plain Solidity is the smaller attack surface.

## What Scriipture is still used for

- `scriipture deploy --browser` can deploy any compiled artifact (it reads `out/artifacts/<Contract>.json` and only needs bytecode plus ABI). It is documented in the README as an optional self-custodial deploy path for teams that want a browser-wallet signature instead of a keystore.
- `scriipture verify-source` targets only the Etherscan v2 multichain API (`ETHERSCAN_V2` in the CLI bundle). Ark devnet's explorer is Blockscout, so verification uses `forge verify-contract --verifier blockscout` instead.

## Re-evaluation trigger

Re-run this check when Scriipture publishes a version whose parser handles enum, struct, interface and event declarations, or documents a plugin parse hook. Until then, the TypeScript surface of Skur is the interface and the risk-engine mirror in `web/src/lib/risk.ts`, which is pinned to the Solidity engine by shared test vectors.
