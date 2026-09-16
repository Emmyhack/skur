// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Skur test token (devnet only)
/// @notice A parameterised stand-in so a demo vault can hold a realistic mix of assets. Anyone can mint.
/// @dev NEVER deploy this to a network with real value. Approving one on a vault is still a policy
///      decision that goes through the policy-change firewall.
contract SkurTestToken is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
