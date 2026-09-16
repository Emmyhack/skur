// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SkurFactory} from "../src/SkurFactory.sol";
import {SkurTestToken} from "../src/SkurTestToken.sol";
import {SkurTestUSD} from "../src/SkurTestUSD.sol";
import {SkurTemplates} from "./SkurTemplates.sol";
import {AssetLimits, Policy} from "../src/SkurTypes.sol";

/// @notice Devnet only: deploys a few more test tokens and a demo vault that holds a realistic mix,
///         so the interfaces have more than one asset to show.
contract DemoVaultScript is Script {
    address constant NATIVE = address(0);

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        SkurFactory factory = SkurFactory(vm.envAddress("FACTORY"));
        SkurTestUSD usd = SkurTestUSD(vm.envAddress("TEST_USD"));

        vm.startBroadcast(pk);

        SkurTestToken eur = new SkurTestToken("Skur Test EUR", "sEUR", 6);
        SkurTestToken btc = new SkurTestToken("Skur Test BTC", "sBTC", 8);
        SkurTestToken eth = new SkurTestToken("Skur Test ETH", "sETH", 18);

        address[] memory members = new address[](3);
        uint8[] memory roles = new uint8[](3);
        members[0] = deployer;
        roles[0] = 1 | 2 | 4;
        members[1] = vm.addr(uint256(keccak256(abi.encode(pk, "approver2"))));
        roles[1] = 1 | 2;
        members[2] = vm.addr(uint256(keccak256(abi.encode(pk, "guardian"))));
        roles[2] = 8;

        address[] memory assets = new address[](5);
        AssetLimits[] memory limits = new AssetLimits[](5);
        assets[0] = address(usd);
        limits[0] =
            AssetLimits({approved: true, lowMax: 5_000e6, highMax: 25_000e6, perTxMax: 100_000e6, dailyMax: 100_000e6});
        assets[1] = NATIVE;
        limits[1] =
            AssetLimits({approved: true, lowMax: 100 ether, highMax: 1_000 ether, perTxMax: 0, dailyMax: 5_000 ether});
        assets[2] = address(eur);
        limits[2] =
            AssetLimits({approved: true, lowMax: 5_000e6, highMax: 25_000e6, perTxMax: 100_000e6, dailyMax: 100_000e6});
        assets[3] = address(btc);
        limits[3] = AssetLimits({approved: true, lowMax: 5e7, highMax: 5e8, perTxMax: 2e9, dailyMax: 5e9});
        assets[4] = address(eth);
        limits[4] =
            AssetLimits({approved: true, lowMax: 1 ether, highMax: 10 ether, perTxMax: 40 ether, dailyMax: 100 ether});

        Policy memory policy = SkurTemplates.startup();
        address vault = factory.createVault(keccak256("skur-demo-vault-multi"), members, roles, policy, assets, limits);

        usd.mint(vault, 250_000 * 1e6);
        eur.mint(vault, 84_500 * 1e6);
        btc.mint(vault, 3_4200_0000);
        eth.mint(vault, 12.4 ether);
        // transfer() caps at 2300 gas; the vault emits on receive, so forward the full stipend.
        (bool ok,) = payable(vault).call{value: 3 ether}("");
        require(ok, "native funding failed");

        vm.stopBroadcast();

        console.log("demoVault:", vault);
        console.log("testEur:", address(eur));
        console.log("testBtc:", address(btc));
        console.log("testEth:", address(eth));
    }
}
