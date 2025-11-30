// checkTestingMode.js
async function main() {
  const hre = require("hardhat");
  const ethers = hre.ethers;
  const addr = process.env.CONTRACT_ADDR;
  if (!addr) throw new Error("Set CONTRACT_ADDR env var first");
  const c = await ethers.getContractAt("PrivScore", addr);
  try {
    const v = await c.testingMode();
    console.log("testingMode =", v.toString());
  } catch (e) {
    console.error("Failed to read testingMode:", e);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
