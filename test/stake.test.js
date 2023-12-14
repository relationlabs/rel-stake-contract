const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const {anyValue} = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const {expect} = require("chai");
const {BigNumber} = require("ethers");
const {idText} = require("typescript");

describe("Stake", function () {
    async function deployOneYearLockFixture() {
        const [owner] = await ethers.getSigners();

        const RelationToken = await ethers.getContractFactory("RelationToken", owner);
        const erc20 = await RelationToken.deploy(owner.address);

        await erc20.deployed();

        const Stake = await ethers.getContractFactory("Stake", owner);
        const stake = await Stake.deploy(erc20.address);

        await stake.deployed();

        const epoch = 28 * 24 * 60 * 60;
        const unstakeTime = (await time.latest()) + epoch;

        return {stake, unstakeTime, erc20, owner};
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const {stake, owner} = await loadFixture(deployOneYearLockFixture);
            expect(await stake.owner()).to.equal(owner.address);
        });
    });

    describe("Stake", function () {
        it("The whole process of stake", async function () {
            const {stake, unstakeTime, erc20, owner} = await loadFixture(deployOneYearLockFixture);
            const ether = BigNumber.from('1000000000000000000');
            const stake_balance = BigNumber.from('10').mul(ether);
            const totalSupply = BigNumber.from('1000000000').mul(ether)
            let totalStack = BigNumber.from("0");

            const farmerSize = 1;
            const testAccountSize = 5;

            let arr = [];
            let quitStackIndex = Math.floor((Math.random() * testAccountSize) + 1);
            console.log('quitStackIndex', quitStackIndex)
            for (let i = 1; i < testAccountSize + 1; i++) {
                let acc = (await ethers.getSigners())[i];
                if (acc) {
                    let balance = Math.floor((Math.random() * 1000000) + 100);
                    let stakeAmount = Math.floor((Math.random() * balance) + 1);
                    let unstakeBeforeFinalize = Math.floor((Math.random() * stakeAmount / 2));
                    if (i == quitStackIndex) {
                        unstakeBeforeFinalize = stakeAmount;
                    }
                    let item = {
                        'acc': acc,
                        'balance': BigNumber.from(balance).mul(ether),
                        'stakeAmount': BigNumber.from(stakeAmount).mul(ether),
                        'unstakeBeforeFinalize': BigNumber.from(unstakeBeforeFinalize).mul(ether)
                    };
                    arr.push(item)
                    // console.log(item.acc.address, balance, stakeAmount, unstakeBeforeFinalize)
                    totalStack = totalStack.add(BigNumber.from(stakeAmount).mul(ether));
                }
            }
            console.log("\r\n>>>>>>generate test account num:", arr.length)
            console.log("\r\n>>>>>>set farmer num:", farmerSize)

            let owner_balance = totalSupply.sub(stake_balance);

            console.log("\r\n>>>>>>transfer(REL Token) to stake contract")
            await erc20.connect(owner).transfer(stake.address, stake_balance)

            console.log("\r\n>>>>>>transfer(REL Token) to test account")
            for (let index = 0; index < arr.length; index++) {
                const element = arr[index];
                await erc20.connect(owner).transfer(element.acc.address, element.balance)
                owner_balance = owner_balance.sub(element.balance)
            }

            console.log("\r\n>>>>>>Check initial balance of test account")
            expect(await erc20.balanceOf(stake.address)).to.equal(stake_balance);
            expect(await erc20.balanceOf(owner.address)).to.equal(owner_balance);
            for (let index = 0; index < arr.length; index++) {
                const element = arr[index];
                expect(await erc20.balanceOf(element.acc.address)).to.equal(element.balance);
                await erc20.connect(element.acc).approve(stake.address, totalSupply);
            }
            await erc20.connect(owner).approve(stake.address, totalSupply)


            console.log("\r\n>>>>>>Stake and check Stake Event")
            for (let index = 0; index < arr.length; index++) {
                const element = arr[index];
                await expect(await stake.connect(element.acc).stake(element.stakeAmount)).to.emit(stake, "Stake").withArgs(element.acc.address, element.stakeAmount);
                expect(await stake.userStakeInfo(element.acc.address)).to.equal(element.stakeAmount);
                expect(await stake.farmerInfo(element.acc.address)).to.equal(0);
            }

            console.log("\r\n>>>>>>Check the balance after staking")
            expect(await erc20.balanceOf(stake.address)).to.equal(stake_balance.add(totalStack));
            expect(await erc20.balanceOf(owner.address)).to.equal(owner_balance);
            for (let index = 0; index < arr.length; index++) {
                const element = arr[index];
                expect(await erc20.balanceOf(element.acc.address)).to.equal(element.balance.sub(element.stakeAmount));
            }
            console.log("\r\n>>>>>>check status=0")
            expect(await stake.status()).to.equal(0);


            console.log("\r\n>>>>>>unstake part")
            for (let index = 0; index < arr.length; index++) {
                const element = arr[index];
                await expect(await stake.connect(element.acc).unstake(element.unstakeBeforeFinalize))
                    .to.emit(stake, "UnStake").withArgs(element.acc.address, element.unstakeBeforeFinalize);
                element.stakeAmount = element.stakeAmount.sub(element.unstakeBeforeFinalize);
                console.log(element.stakeAmount)
                if (element.stakeAmount == 0) {
                    console.log("\r\n>>>>>>unstake all")
                    arr.splice(index, 1);
                }
            }

            console.log('Stakeing account num:', arr.length)

            console.log("\r\n>>>>>>execute finalize")
            // sort
            arr.sort((a, b) => b.stakeAmount - a.stakeAmount);

            let infos = [];
            let actualFarmerNum = farmerSize > arr.length ? arr.length : farmerSize
            for (let i = 0; i < actualFarmerNum; i++) {
                item = {"user": arr[i].acc.address, "amount": arr[i].stakeAmount}
                infos.push(item)
            }
            const transaction = await stake.connect(owner).finalize(infos);
            const receipt = await transaction.wait();

            console.log("\r\n>>>>>>Check status=1")
            expect(await stake.status()).to.equal(1);

            console.log("\r\n>>>>>>finalize stake")
            // todo

            console.log("\r\n>>>>>>finalize, farmer can not unstake")
            await expect(stake.connect(arr[0].acc).unstake(1)).to.be.revertedWith("still in farm period")

            console.log("\r\n>>>>>>Check the num of Farm events emitted by finalize", actualFarmerNum)
            expect(receipt.events.length).to.equal(actualFarmerNum);

            console.log("\r\n>>>>>>Check the Farm event property of finalize")
            for (let index = 0; index < actualFarmerNum; index++) {
                const element = arr[index];
                expect(receipt.events[index].event).to.equal("Farm");

                expect(receipt.events[index].args).to.deep.equal([
                    element.acc.address,
                    element.stakeAmount,
                ]);
            }

            console.log("\r\n>>>>>>Check farmerInfo")
            for (let index = 0; index < actualFarmerNum; index++) {
                const element = arr[index];
                expect(await stake.farmerInfo(element.acc.address)).to.equal(element.stakeAmount);
            }

            console.log("\r\n>>>>>>After 4 weeks。。。")
            await time.increaseTo(unstakeTime);


            console.log("\r\n>>>>>>distributeRewardAndRemoveFarmer")
            const distributeTx = await stake.connect(owner).distributeRewardAndRemoveFarmer();
            const distributeReceipt = await distributeTx.wait();

            console.log("\r\n>>>>>>Check status=0")
            expect(await stake.status()).to.equal(0);

            console.log("\r\n>>>>>>Check the Event num")
            expect(distributeReceipt.events.length).to.equal(arr.length > farmerSize ? farmerSize * 2 : arr.length * 2);

            let reward = []
            let totalReward = BigNumber.from("0");
            for (let index = 0; index < actualFarmerNum; index++) {
                reward.push(distributeReceipt.events[index * 2].args[1])
                totalReward = totalReward.add(distributeReceipt.events[index * 2].args[1])
            }
            reward.sort((a, b) => b - a);

            console.log("\r\n>>>>>>Check total reward", totalReward, stake_balance)
            expect(totalReward).to.lte(stake_balance);


            console.log("\r\n>>>>>>Check the amount that the farmer can unstake")
            for (let index = 0; index < actualFarmerNum; index++) {
                const element = arr[index];
                const r = reward[index];

                const unstakeAmount = BigNumber.from(element.stakeAmount).add(r)

                expect(await stake.userStakeInfo(element.acc.address)).to.equal(unstakeAmount);
            }
            console.log("\r\n>>>>>>Check the amount that non-farmers can unstake", arr.length - actualFarmerNum)
            for (let index = actualFarmerNum; index < arr.length; index++) {
                const element = arr[index];

                expect(await stake.userStakeInfo(element.acc.address)).to.equal(element.stakeAmount);
            }

            console.log("\r\n>>>>>>farmer part unstake", actualFarmerNum)
            for (let index = 0; index < actualFarmerNum; index++) {
                const element = arr[index];
                const r = reward[index];

                const unstakeAmount = BigNumber.from(element.stakeAmount).add(r).sub(1);
                console.log("farmer unstake", element.acc.address, unstakeAmount)

                await stake.connect(element.acc).unstake(unstakeAmount);
            }
            console.log("\r\n>>>>>>Non-farmer part unstake", arr.length - actualFarmerNum)
            for (let index = actualFarmerNum; index < arr.length; index++) {
                const element = arr[index];

                const unstakeAmount = BigNumber.from(element.stakeAmount).sub(1);
                console.log("Non-farmer part unstake", element.acc.address, unstakeAmount)
                await expect(await stake.connect(element.acc).unstake(unstakeAmount))
                    .to.emit(stake, "UnStake").withArgs(element.acc.address, unstakeAmount);
            }

            console.log("\r\n>>>>>>Amount verification after partial unstake")
            for (let index = 0; index < arr.length; index++) {
                const element = arr[index];
                expect(await stake.userStakeInfo(element.acc.address)).to.equal(1);
            }

            console.log("\r\n>>>>>>Unstake All", arr.length)
            for (let index = 0; index < arr.length; index++) {
                const element = arr[index];
                await expect(await stake.connect(element.acc).unstake(BigNumber.from("1")))
                    .to.emit(stake, "UnStake").withArgs(element.acc.address, 1);
            }

            console.log("\r\n>>>>>>Check the contract balance after unstaking:")
            console.log('stake:', await erc20.balanceOf(stake.address))
            expect(await erc20.balanceOf(stake.address)).to.equal(stake_balance.sub(totalReward));

            console.log("\r\n>>>>>>Check the Farmer balance after unstaking", actualFarmerNum)
            for (let index = 0; index < actualFarmerNum; index++) {
                const element = arr[index];
                const r = reward[index];
                expect(await erc20.balanceOf(element.acc.address)).to.equal(BigNumber.from(element.balance).add(r));
            }
            console.log("\r\n>>>>>>Check the Non-Farmer balance after unstaking", arr.length - actualFarmerNum)
            for (let index = actualFarmerNum; index < arr.length; index++) {
                const element = arr[index];
                expect(await erc20.balanceOf(element.acc.address)).to.equal(BigNumber.from(element.balance));
            }
        });
    });

});
