// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

struct StakeInfo {
    address user;
    uint256 amount;
}

interface IStake {
    event Stake(address indexed _user, uint256 amount);
    event UnStake(address indexed _user, uint256 amount);

    event Reward(address indexed _user, uint256 amount);
    event Farm(address indexed _user, uint256 amount);

    function stake(uint256 _amount) external;

    function unstake(uint256 _amount) external;

    function finalize(StakeInfo[] calldata infos) external;

    function distributeRewardAndRemoveFarmer() external;
}
