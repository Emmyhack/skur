// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import "../src/SkurTypes.sol";
import {SkurFactory} from "../src/SkurFactory.sol";
import {SkurVault} from "../src/SkurVault.sol";
import {SkurTestUSD} from "../src/SkurTestUSD.sol";
import {SkurTemplates} from "./SkurTemplates.sol";

/// @notice Deploys the test stablecoin, the vault implementation (via the factory) and the factory.
///         Optionally creates a demo vault when DEMO_VAULT=true so the interface has something to read.
/// @dev    forge script script/Deploy.s.sol --rpc-url ark_devnet --broadcast --private-key $PK
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        bool demo = vm.envOr("DEMO_VAULT", false);

        vm.startBroadcast(pk);
        SkurTestUSD usd = new SkurTestUSD();
        SkurVault implementation = new SkurVault();
        SkurFactory factory = new SkurFactory(address(implementation));

        address vault;
        if (demo) {
            // Demo vault: deployer is owner+approver+executor; two extra signers and a guardian are derived from the key.
            address approver2 = vm.addr(uint256(keccak256(abi.encode(pk, "approver2"))));
            address guardian = vm.addr(uint256(keccak256(abi.encode(pk, "guardian"))));

            address[] memory members = new address[](3);
            uint8[] memory roles = new uint8[](3);
            members[0] = deployer;
            roles[0] = ROLE_OWNER | ROLE_APPROVER | ROLE_EXECUTOR;
            members[1] = approver2;
            roles[1] = ROLE_APPROVER;
            members[2] = guardian;
            roles[2] = ROLE_GUARDIAN;

            (address[] memory assets, AssetLimits[] memory limits) = SkurTemplates.startupAssets(address(usd));
            Policy memory policy = SkurTemplates.startup();
            // One-owner demo: governance threshold must be satisfiable by the member set.
            policy.governanceThreshold = 1;

            vault = factory.createVault(keccak256("skur-demo-vault"), members, roles, policy, assets, limits);
            usd.mint(vault, 250_000 * 1e6);
            (bool ok,) = vault.call{value: 2 ether}("");
            require(ok, "fund failed");
        }
        vm.stopBroadcast();

        console.log("SkurTestUSD:", address(usd));
        console.log("SkurFactory:", address(factory));
        console.log("SkurVault implementation:", factory.implementation());
        if (demo) console.log("Demo vault:", vault);

        string memory json = string.concat(
            '{"chainId":',
            vm.toString(block.chainid),
            ',"testUsd":"',
            vm.toString(address(usd)),
            '","factory":"',
            vm.toString(address(factory)),
            '","vaultImplementation":"',
            vm.toString(factory.implementation()),
            '","demoVault":"',
            vm.toString(vault),
            '","deployer":"',
            vm.toString(deployer),
            '","deployedAtBlock":',
            vm.toString(block.number),
            "}"
        );
        vm.writeFile(string.concat("deployments/", vm.toString(block.chainid), ".json"), json);
    }
}
