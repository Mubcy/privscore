// scripts/approveWorker.js
const { ethers } = require("hardhat");

async function main() {
  const CONTRACT_ADDR = process.env.CONTRACT_ADDR;
  const WORKER_ADDR = process.env.WORKER_ADDR; // address to approve
  if (!CONTRACT_ADDR || !WORKER_ADDR) {
    console.error("Set CONTRACT_ADDR and WORKER_ADDR in env");
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Using deployer:", deployer.address);

  const PrivScore = await ethers.getContractFactory("PrivScore");
  const ps = await PrivScore.attach(CONTRACT_ADDR);

  const tx = await ps.setApprovedWorker(WORKER_ADDR, true);
  await tx.wait();
  console.log("Approved worker", WORKER_ADDR, "tx:", tx.hash);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
