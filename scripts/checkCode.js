// scripts/checkCode.js

const hre = require("hardhat");

async function main() {
  const address = process.env.CONTRACT_ADDR;

  if (!address) {
    console.error("ERROR: No CONTRACT_ADDR provided.");
    console.error("Usage:");
    console.error("   CONTRACT_ADDR=0x123... npx hardhat run --network localhost scripts/checkCode.js");
    process.exit(1);
  }

  const code = await hre.ethers.provider.getCode(address);
  console.log("Contract:", address);
  console.log("Code length in bytes:", code.length / 2);
  console.log("First bytes:", code.slice(0, 20));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
