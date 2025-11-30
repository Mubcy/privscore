// scripts/setTestingModeCli_env.js
const hre = require("hardhat");

async function main() {
  const addr = process.env.CONTRACT_ADDR;
  if (!addr) throw new Error("Set CONTRACT_ADDR env var first");

  const arg = process.env.TOGGLE;
  if (!arg) throw new Error("Set TOGGLE env var to 'true' or 'false' (e.g. $env:TOGGLE = 'true')");
  const value = arg.toLowerCase() === "true";

  const [signer] = await hre.ethers.getSigners();
  console.log("Using signer:", signer.address, "->", addr, "setting testingMode ->", value);

  const code = await hre.ethers.provider.getCode(addr);
  console.log("code length bytes =", code === "0x" ? 0 : (code.length - 2) / 2);

  const contract = await hre.ethers.getContractAt("PrivScore", addr, signer);
  const tx = await contract.setTestingMode(value);
  console.log("tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("tx mined, status:", receipt.status, "blockNumber:", receipt.blockNumber);

  // Read once (no retry here — you can add retries if you want)
  const tm = await contract.testingMode();
  console.log("testingMode =", tm.toString());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
