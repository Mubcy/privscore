// scripts/checkTestingModeEnv.js
// Usage: $env:CONTRACT_ADDR="0x..."; npx hardhat run --network localhost scripts/checkTestingModeEnv.js

async function main() {
  const hre = require("hardhat");
  const ethers = hre.ethers;

  const CONTRACT_ADDR = process.env.CONTRACT_ADDR;
  if (!CONTRACT_ADDR) throw new Error("Set CONTRACT_ADDR env var first");

  const abi = ["function testingMode() view returns (bool)"];
  const provider = hre.ethers.provider;
  const c = new ethers.Contract(CONTRACT_ADDR, abi, provider);

  try {
    const v = await c.testingMode();
    console.log("testingMode =", v);
  } catch (e) {
    console.error("Failed to read testingMode:", e && e.message ? e.message : e);
    console.error("Likely cause: the contract at CONTRACT_ADDR does not include testingMode(). Deploy the updated contract that has testingMode/setTestingMode, then try again.");
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
