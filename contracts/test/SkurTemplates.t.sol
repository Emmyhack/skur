// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import "../src/SkurTypes.sol";
import {SkurVault} from "../src/SkurVault.sol";
import {SkurFactory} from "../src/SkurFactory.sol";
import {SkurTestUSD} from "../src/SkurTestUSD.sol";
import {SkurTemplates} from "../script/SkurTemplates.sol";

/// @notice Every shipped template must be accepted by the vault with a member set large enough to satisfy it.
contract SkurTemplatesTest is Test {
    SkurFactory factory;
    SkurTestUSD usd;

    function setUp() public {
        factory = new SkurFactory(address(new SkurVault()));
        usd = new SkurTestUSD();
    }

    function _members(uint8 signers, uint8 guardians)
        internal
        returns (address[] memory members, uint8[] memory roles)
    {
        members = new address[](signers + guardians);
        roles = new uint8[](signers + guardians);
        for (uint8 i = 0; i < signers; i++) {
            members[i] = makeAddr(string.concat("signer", vm.toString(i)));
            roles[i] = ROLE_OWNER | ROLE_APPROVER | ROLE_EXECUTOR;
        }
        for (uint8 i = 0; i < guardians; i++) {
            members[signers + i] = makeAddr(string.concat("guardian", vm.toString(i)));
            roles[signers + i] = ROLE_GUARDIAN;
        }
    }

    function _deploy(Policy memory p, uint8 signers, uint8 guardians) internal returns (SkurVault v) {
        (address[] memory m, uint8[] memory r) = _members(signers, guardians);
        (address[] memory a, AssetLimits[] memory l) = SkurTemplates.startupAssets(address(usd));
        v = SkurVault(payable(factory.createVault(bytes32(uint256(signers)), m, r, p, a, l)));
    }

    function test_startup() public {
        SkurVault v = _deploy(SkurTemplates.startup(), 2, 1);
        assertEq(v.policyVersion(), 1);
    }

    function test_sme() public {
        _deploy(SkurTemplates.sme(), 3, 1);
    }

    function test_dao() public {
        _deploy(SkurTemplates.dao(), 4, 2);
    }

    function test_fund() public {
        _deploy(SkurTemplates.fund(), 3, 2);
    }

    function test_nonprofit() public {
        _deploy(SkurTemplates.nonprofit(), 3, 1);
    }

    function test_familyOffice() public {
        _deploy(SkurTemplates.familyOffice(), 2, 1);
    }

    function test_templateRejectsInsufficientMembers() public {
        (address[] memory m, uint8[] memory r) = _members(1, 0);
        (address[] memory a, AssetLimits[] memory l) = SkurTemplates.startupAssets(address(usd));
        vm.expectRevert();
        factory.createVault(bytes32("x"), m, r, SkurTemplates.startup(), a, l);
    }

    /// @dev Every template keeps the "leaving lockdown is stronger than entering" property: at least one guardian.
    function test_everyTemplateHasGuardianLayer() public pure {
        Policy[6] memory ps = [
            SkurTemplates.startup(),
            SkurTemplates.sme(),
            SkurTemplates.dao(),
            SkurTemplates.fund(),
            SkurTemplates.nonprofit(),
            SkurTemplates.familyOffice()
        ];
        for (uint256 i = 0; i < ps.length; i++) {
            assertGe(ps[i].guardianThreshold, 1);
            assertTrue(ps[i].guardianRequiredCritical);
            assertGt(ps[i].policyChangeDelay, 0);
            assertGt(ps[i].recipientActivationDelay, 0);
            assertGt(ps[i].envelopeBps, 0);
        }
    }
}
