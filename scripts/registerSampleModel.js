// scripts/registerSampleModel.js
const { ethers } = require("hardhat");

async function main() {
  const CONTRACT_ADDR = process.env.CONTRACT_ADDR || "<REPLACE_WITH_CONTRACT_ADDR>";

  if (CONTRACT_ADDR.startsWith("<")) {
    console.error("Set CONTRACT_ADDR in env or edit the script.");
    process.exit(1);
  }

  const PrivScore = await ethers.getContractFactory("PrivScore");
  const ps = await PrivScore.attach(CONTRACT_ADDR);

  const modelHash = ethers.keccak256(ethers.toUtf8Bytes("linear-model-v1"));
  const tx = await ps.registerModel(modelHash, "Linear scoring v1");
  await tx.wait();
  console.log("Model registered (modelId = 1). tx:", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
