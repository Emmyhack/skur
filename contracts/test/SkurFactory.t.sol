// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SkurBase} from "./SkurBase.t.sol";
import "../src/SkurTypes.sol";
import {SkurVault} from "../src/SkurVault.sol";
import {SkurTemplates} from "../script/SkurTemplates.sol";

contract SkurFactoryTest is SkurBase {
    function test_registry() public view {
        assertEq(factory.vaultCount(), 1);
        assertEq(factory.vaultAt(0), address(vault));
        assertTrue(factory.isVault(address(vault)));
        assertEq(factory.vaultsOf(alice).length, 1);
        assertEq(factory.vaultsOf(g1)[0], address(vault));
        assertEq(factory.vaultsOf(stranger).length, 0);
    }

    function test_predictAddress() public {
        (address[] memory m, uint8[] memory r) = _defaultMembers();
        (address[] memory a, AssetLimits[] memory l) = SkurTemplates.startupAssets(address(usd));
        address predicted = factory.predictVaultAddress(address(this), bytes32("second"));
        address created = factory.createVault(bytes32("second"), m, r, _defaultPolicy(), a, l);
        assertEq(created, predicted);
        assertEq(factory.vaultCount(), 2);
    }

    function test_sameSaltDifferentCreator() public {
        (address[] memory m, uint8[] memory r) = _defaultMembers();
        (address[] memory a, AssetLimits[] memory l) = SkurTemplates.startupAssets(address(usd));
        vm.prank(stranger);
        address v2 = factory.createVault(bytes32("t"), m, r, _defaultPolicy(), a, l);
        assertTrue(v2 != address(vault));
    }

    function test_factoryHasNoPowerOverVault() public {
        vm.prank(address(factory));
        vm.expectRevert();
        vault.raiseMode(Mode.LOCKDOWN, "");
    }

    function test_vaultsAreIndependent() public {
        (address[] memory m, uint8[] memory r) = _defaultMembers();
        (address[] memory a, AssetLimits[] memory l) = SkurTemplates.startupAssets(address(usd));
        SkurVault v2 = SkurVault(payable(factory.createVault(bytes32("v2"), m, r, _defaultPolicy(), a, l)));
        vm.prank(g1);
        v2.raiseMode(Mode.LOCKDOWN, "only v2");
        assertEq(uint8(vault.mode()), uint8(Mode.NORMAL));
        assertEq(uint8(v2.mode()), uint8(Mode.LOCKDOWN));
    }
}
