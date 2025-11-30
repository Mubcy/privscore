// scripts/deployMockFHE.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying MockFHE with deployer:", deployer.address);

  const Mock = await hre.ethers.getContractFactory("MockFHE");
  const mock = await Mock.deploy();
  await mock.waitForDeployment();
  console.log("MockFHE deployed to:", mock.target || mock.address);

  // Optionally set it on PrivScore if CONTRACT_ADDR env var is provided
  const privAddr = process.env.CONTRACT_ADDR;
  if (privAddr) {
    console.log("Setting PrivScore.fheVerifier ->", mock.target || mock.address, "on", privAddr);
    const priv = await hre.ethers.getContractAt("PrivScore", privAddr, deployer);
    const tx = await priv.setFHEVerifier(mock.target || mock.address);
    console.log("setFHEVerifier tx:", tx.hash);
    await tx.wait();
    console.log("setFHEVerifier mined");
  } else {
    console.log("CONTRACT_ADDR not set — only deployed MockFHE. To attach it, set CONTRACT_ADDR and run a script to call setFHEVerifier.");
  }

  // Print a friendly reminder
  console.log("\n✅ MockFHE address:", (mock.target || mock.address));
  console.log("If you didn't auto-set PrivScore, set it in the UI (Owner Tools) or call setFHEVerifier with this address.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
