// scripts/deploy.js
require("dotenv").config();

async function main() {
  const hre = require("hardhat");
  const { ethers } = hre;

  // -----------------------------
  // 1. Select deployer
  // -----------------------------
  let deployer;

  if (process.env.PRIVATE_KEY) {
    console.log("Using PRIVATE_KEY from .env");
    const provider = new ethers.JsonRpcProvider(
      hre.network.name === "localhost"
        ? "http://127.0.0.1:8545"
        : process.env.SEPOLIA_RPC_URL
    );
    deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  } else {
    console.log("Using Hardhat default signer");
    [deployer] = await ethers.getSigners();
  }

  console.log("Deployer Address:", deployer.address);

  // -----------------------------
  // 2. Prepare deployment
  // -----------------------------
  const AddressZero = "0x0000000000000000000000000000000000000000";

  const PrivScore = await ethers.getContractFactory("PrivScore", deployer);

  console.log("Deploying PrivScore...");

  // Constructor = (owner, fheVerifier)
  const contract = await PrivScore.deploy(deployer.address, AddressZero);

  await contract.waitForDeployment();

  const deployedAddress =
    contract.target || (contract.getAddress && await contract.getAddress()) || contract.address;

  console.log("---------------------------------------------------");
  console.log("PrivScore deployed to:", deployedAddress);
  console.log("DEPLOYED_ADDRESS=" + deployedAddress);
  console.log("---------------------------------------------------");
}

main().catch((err) => {
  console.error("deploy.js failed:", err);
  process.exitCode = 1;
});
