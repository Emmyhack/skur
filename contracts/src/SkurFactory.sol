// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import "./SkurTypes.sol";
import {SkurVault} from "./SkurVault.sol";

/// @title SkurFactory
/// @notice Creates and registers SkurVault instances as EIP-1167 minimal proxies over one immutable implementation.
/// @dev Vault logic is not upgradeable in V1. Migrating means creating a new vault and moving assets through
///      that vault's own policy. The factory holds no privileges over vaults it creates.
contract SkurFactory {
    event VaultCreated(address indexed vault, address indexed creator, uint256 indexed index, bytes32 salt);

    error NotAVault();

    address public immutable implementation;
    address[] private _vaults;
    mapping(address => bool) public isVault;
    mapping(address => address[]) private _vaultsByMember;

    error NotImplementation();

    /// @param impl A deployed SkurVault used as the logic contract for every clone. Deployed separately so
    ///             explorers index and verify it as a top-level contract.
    constructor(address impl) {
        if (impl.code.length == 0) revert NotImplementation();
        implementation = impl;
    }

    /// @notice Deploy a vault. `salt` lets integrators precompute the address with `predictVaultAddress`.
    function createVault(
        bytes32 salt,
        address[] calldata members,
        uint8[] calldata roles,
        Policy calldata policy,
        address[] calldata assets,
        AssetLimits[] calldata limits
    ) external returns (address vault) {
        bytes32 fullSalt = keccak256(abi.encode(msg.sender, salt));
        vault = Clones.cloneDeterministic(implementation, fullSalt);
        isVault[vault] = true;
        _vaults.push(vault);
        for (uint256 i = 0; i < members.length; i++) {
            _vaultsByMember[members[i]].push(vault);
        }
        emit VaultCreated(vault, msg.sender, _vaults.length - 1, salt);
        SkurVault(payable(vault)).initialize(members, roles, policy, assets, limits);
    }

    function predictVaultAddress(address creator, bytes32 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, keccak256(abi.encode(creator, salt)), address(this));
    }

    function vaultCount() external view returns (uint256) {
        return _vaults.length;
    }

    function vaultAt(uint256 index) external view returns (address) {
        return _vaults[index];
    }

    /// @notice Vaults a member was part of at creation time. Later membership changes live on the vault itself.
    function vaultsOf(address member) external view returns (address[] memory) {
        return _vaultsByMember[member];
    }
}
