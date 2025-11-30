// scripts/setTestingModeCli.js
const hre = require("hardhat");

async function main() {
  const addr = process.env.CONTRACT_ADDR;
  if (!addr) throw new Error("Set CONTRACT_ADDR env var first, e.g. $env:CONTRACT_ADDR=\"0x...\"");

  // read CLI arg: node scripts/setTestingModeCli.js true
  const arg = process.argv[2];
  if (!arg) throw new Error("Provide 'true' or 'false' as first arg: node scripts/setTestingModeCli.js true");
  const value = arg.toLowerCase() === "true";

  const [signer] = await hre.ethers.getSigners();
  console.log("Using signer:", signer.address, "setting testingMode ->", value);

  const contract = await hre.ethers.getContractAt("PrivScore", addr, signer);
  const tx = await contract.setTestingMode(value);
  console.log("tx hash:", tx.hash);
  await tx.wait();
  console.log("mined — testingMode set. Verifying...");

  const tm = await contract.testingMode();
  console.log("testingMode =", tm.toString());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
