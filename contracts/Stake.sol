// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IStake.sol";

contract Stake is IStake, Ownable {
    uint256[] public epoch_reward = [
        10 ether,
        9 ether,
        9 ether,
        8 ether,
        8 ether,
        7 ether,
        7 ether,
        7 ether,
        7 ether,
        7 ether,
        7 ether,
        7 ether,
        7 ether
    ];

    uint256 public constant DEFAULT_EPOCH_REWARD = 7 ether;

    uint256 public epoch_index;

    uint256 public status; // 0 stake, 1 unstake

    mapping(address => uint256) public userStakeInfo;

    // farmer
    mapping(address => uint256) public farmerInfo;
    uint256 farmerTotalSupply;
    address[] farmers;

    IERC20 relToken;

    constructor(address _token) {
        relToken = IERC20(_token);
    }

    modifier onlyStake() {
        require(status == 0, "not in stake Period");
        _;
    }
    modifier onlyUnStake(address _user) {
        require(farmerInfo[_user] == 0, "still in farm period");
        _;
    }

    ///////////////////////////////// epoch reward ///////////////////////////////////////
    function getEpochReward(uint256 epoch_id) public view returns (uint256) {
        if (epoch_id < 13) {
            return epoch_reward[epoch_id];
        } else {
            return DEFAULT_EPOCH_REWARD;
        }
    }

    ///////////////////////////////// stake ///////////////////////////////////////
    function stake(uint256 _amount) external override onlyStake {
        address _user = msg.sender;

        relToken.transferFrom(_user, address(this), _amount);

        userStakeInfo[_user] = userStakeInfo[_user] + _amount;

        emit Stake(_user, _amount);
    }

    function unstake(
        uint256 _amount
    ) external override onlyUnStake(msg.sender) {
        address _user = msg.sender;

        require(userStakeInfo[_user] >= _amount, "no efficient amount");

        userStakeInfo[_user] = userStakeInfo[_user] - _amount;

        relToken.transfer(_user, _amount);

        emit UnStake(_user, _amount);
    }

    function finalize(StakeInfo[] calldata infos) external override onlyOwner {
        for (uint256 i = 0; i < infos.length; i++) {
            add_farmer(infos[i].user, infos[i].amount);
        }

        status = 1;
    }

    //////////////////////////// farmer ////////////////////////////////////////////////////////////
    function distributeRewardAndRemoveFarmer() external override onlyOwner {
        for (uint i = farmers.length; i > 0; i--) {
            remove_farmer(farmers[i - 1]);
            farmers.pop();
        }

        farmerTotalSupply = 0;
        status = 0;
        ++epoch_index;
    }

    function remove_farmer(address _user) internal {
        uint256 amount = farmerInfo[_user];
        uint256 pendingAmount = (amount * getEpochReward(epoch_index)) /
            farmerTotalSupply;

        userStakeInfo[_user] = userStakeInfo[_user] + pendingAmount;

        delete farmerInfo[_user];

        emit Reward(_user, pendingAmount);
        emit Stake(_user, pendingAmount);
    }

    function add_farmer(address _user, uint256 _amount) internal {
        farmerTotalSupply = farmerTotalSupply + _amount;
        farmerInfo[_user] = _amount;
        farmers.push(_user);

        emit Farm(_user, _amount);
    }
}
