const hre = require('hardhat')

async function main() {
  const contractName = 'Stake'
  const TokenAddress = '0x...'

  console.log(contractName)
  console.log("TokenAddress", TokenAddress);

  const MyContract = await hre.ethers.getContractFactory(contractName)
  const myContract = await MyContract.deploy(TokenAddress)

  await myContract.deployed()

  console.log(
    `${contractName} deployed ,contract address: ${myContract.address}`
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
