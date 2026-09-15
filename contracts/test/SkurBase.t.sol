// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import "../src/SkurTypes.sol";
import {ISkurVault} from "../src/ISkurVault.sol";
import {SkurVault} from "../src/SkurVault.sol";
import {SkurFactory} from "../src/SkurFactory.sol";
import {SkurTestUSD} from "../src/SkurTestUSD.sol";
import {SkurTemplates} from "../script/SkurTemplates.sol";

/// @notice Shared fixture: a startup-template vault with 3 owners/approvers, 1 executor-only member, 2 guardians.
abstract contract SkurBase is Test {
    uint256 internal constant USD = 1e6;

    SkurFactory internal factory;
    SkurVault internal vault;
    SkurTestUSD internal usd;

    address internal alice = makeAddr("alice"); // owner + approver + executor
    address internal bob = makeAddr("bob"); // owner + approver
    address internal carol = makeAddr("carol"); // owner + approver
    address internal exec = makeAddr("exec"); // executor only
    address internal g1 = makeAddr("guardian1");
    address internal g2 = makeAddr("guardian2");
    address internal supplier = makeAddr("supplier");
    address internal stranger = makeAddr("stranger");

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        usd = new SkurTestUSD();
        factory = new SkurFactory(address(new SkurVault()));

        (address[] memory members, uint8[] memory roles) = _defaultMembers();
        (address[] memory assets, AssetLimits[] memory limits) = SkurTemplates.startupAssets(address(usd));
        Policy memory policy = _defaultPolicy();

        vault = SkurVault(payable(factory.createVault(bytes32("t"), members, roles, policy, assets, limits)));

        usd.mint(address(vault), 1_000_000 * USD);
        vm.deal(address(this), 100_000 ether);
        (bool ok,) = address(vault).call{value: 10_000 ether}("");
        require(ok);

        // supplier is a long-activated, VERIFIED recipient so LOW-tier tests are not escalated by probation
        _setTrust(supplier, Trust.VERIFIED);
    }

    function _defaultMembers() internal view returns (address[] memory members, uint8[] memory roles) {
        members = new address[](6);
        roles = new uint8[](6);
        members[0] = alice;
        roles[0] = ROLE_OWNER | ROLE_APPROVER | ROLE_EXECUTOR;
        members[1] = bob;
        roles[1] = ROLE_OWNER | ROLE_APPROVER;
        members[2] = carol;
        roles[2] = ROLE_OWNER | ROLE_APPROVER;
        members[3] = exec;
        roles[3] = ROLE_EXECUTOR;
        members[4] = g1;
        roles[4] = ROLE_GUARDIAN;
        members[5] = g2;
        roles[5] = ROLE_GUARDIAN;
    }

    function _defaultPolicy() internal pure returns (Policy memory p) {
        p = SkurTemplates.startup();
    }

    // ------------------------------------------------------------ helpers
    function _setTrust(address r, Trust t) internal {
        vm.prank(alice);
        uint256 id = vault.proposeRecipientTrust(r, t);
        _approveGovernance(id);
        Proposal memory p = vault.getProposal(id);
        if (block.timestamp < p.executableAfter) vm.warp(p.executableAfter);
        vm.prank(alice);
        vault.execute(id);
    }

    function _approveGovernance(uint256 id) internal {
        vm.prank(alice);
        vault.approve(id);
        vm.prank(bob);
        vault.approve(id);
    }

    function _propose(address asset, address to, uint256 amount) internal returns (uint256 id) {
        vm.prank(alice);
        id = vault.proposeTransfer(asset, to, amount, "test");
    }

    function _approveBy(uint256 id, address who) internal {
        vm.prank(who);
        vault.approve(id);
    }

    function _executeBy(uint256 id, address who) internal {
        vm.prank(who);
        vault.execute(id);
    }

    function _warpTo(uint256 id) internal {
        Proposal memory p = vault.getProposal(id);
        if (block.timestamp < p.executableAfter) vm.warp(p.executableAfter);
    }

    /// @dev Fully approve (approvers + guardians as needed), wait, execute.
    function _runTransfer(uint256 id) internal {
        Proposal memory p = vault.getProposal(id);
        address[3] memory approvers = [alice, bob, carol];
        for (uint256 i = 0; i < p.requiredApprovals; i++) {
            _approveBy(id, approvers[i]);
        }
        address[2] memory guardians = [g1, g2];
        for (uint256 i = 0; i < p.requiredGuardians; i++) {
            _approveBy(id, guardians[i]);
        }
        _warpTo(id);
        _executeBy(id, exec);
    }
}
