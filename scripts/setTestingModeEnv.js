// scripts/setTestingModeEnv.js
// Usage (PowerShell):
// $env:CONTRACT_ADDR="0x..."; $env:TESTING_MODE="true"; npx hardhat run --network localhost scripts/setTestingModeEnv.js

async function main() {
  const hre = require("hardhat");
  const ethers = hre.ethers;

  const CONTRACT_ADDR = process.env.CONTRACT_ADDR;
  if (!CONTRACT_ADDR) throw new Error("Set CONTRACT_ADDR env var first");

  const rawMode = process.env.TESTING_MODE;
  if (typeof rawMode === "undefined") throw new Error("Set TESTING_MODE env var to 'true' or 'false'");

  const desired = String(rawMode).toLowerCase() === "true";

  console.log("CONTRACT:", CONTRACT_ADDR);
  console.log("Desired testingMode:", desired);

  const signer = (await hre.ethers.getSigners())[0];
  console.log("Using signer:", signer.address);

  // Try to get contract instance (we'll attempt with the PrivScore ABI shape)
  // Minimal ABI with the two functions we need
  const abi = [
    "function testingMode() view returns (bool)",
    "function setTestingMode(bool) external"
  ];

  const c = new ethers.Contract(CONTRACT_ADDR, abi, signer);

  // Try to read existing testingMode (catch BAD_DATA / missing function)
  try {
    const cur = await c.testingMode();
    console.log("Current testingMode:", cur);
  } catch (e) {
    console.warn("Failed to read testingMode (contract may not expose it):", e && e.message ? e.message : e);
    console.warn("If the contract does not expose testingMode/setTestingMode, you must deploy the updated contract that includes these functions.");
    // don't abort; continue to attempt set (it will probably fail below if function missing)
  }

  // Try to set
  try {
    const tx = await c.setTestingMode(desired);
    console.log("setTestingMode tx sent:", tx.hash);
    const rec = await tx.wait();
    console.log("setTestingMode tx mined in block", rec.blockNumber);
  } catch (e) {
    console.error("setTestingMode failed:", e && e.message ? e.message : e);
    console.error("If this failed with BAD_DATA or method not found, the deployed contract doesn't include setTestingMode.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
