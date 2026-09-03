const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('Set DEPLOYER_PRIVATE_KEY before deployment.');
  const factory = await ethers.getContractFactory('PixelBossCards');
  const contract = await factory.deploy(deployer.address);
  await contract.waitForDeployment();
  console.log('PixelBossCards owner:', deployer.address);
  console.log('PixelBossCards address:', await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
