// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Skur test stablecoin (devnet only)
/// @notice Ark devnet has no canonical USDC. This 6-decimal token stands in for the stablecoin that
///         exposure and velocity policies are denominated in. Anyone can mint on devnet.
/// @dev NEVER deploy this to a network with real value. Registering it as an approved asset on a vault
///      is itself a policy decision that goes through the policy-change firewall.
contract SkurTestUSD is ERC20 {
    uint256 public constant MAX_MINT = 10_000_000 * 1e6;

    error MintTooLarge();

    constructor() ERC20("Skur Test USD", "sUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        if (amount > MAX_MINT) revert MintTooLarge();
        _mint(to, amount);
    }
}
