// scripts/setTestingMode.js
// Usage:
//   npx hardhat run --network localhost scripts/setTestingMode.js true
// or
//   CONTRACT_ADDR=0x... npx hardhat run --network localhost scripts/setTestingMode.js true

async function main() {
  const hre = require("hardhat");
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: npx hardhat run --network localhost scripts/setTestingMode.js <true|false> [contractAddr]");
    process.exit(1);
  }
  const flag = String(args[0]).toLowerCase() === "true";
  const contractArg = args[1] || process.env.CONTRACT_ADDR;
  if (!contractArg) {
    console.error("Missing contract address. Set CONTRACT_ADDR env or pass as second arg.");
    process.exit(1);
  }

  const ethers = hre.ethers;
  const signers = await ethers.getSigners();
  const owner = signers[0];
  console.log("Using signer:", await owner.getAddress());
  console.log("Contract:", contractArg);

  const priv = await ethers.getContractAt("PrivScore", contractArg, owner);
  const tx = await priv.setTestingMode(flag);
  console.log("tx sent:", tx.hash);
  const rec = await tx.wait();
  console.log("tx mined in block", rec.blockNumber);
  console.log("testingMode set to", flag);
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
