pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RelationToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18;

    constructor(address receiver) public ERC20("REL Token", "REL") {
        _mint(receiver, TOTAL_SUPPLY);
    }
}
