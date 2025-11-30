// scripts/listContractFunctions.js
// npx hardhat run --network localhost scripts/listContractFunctions.js

async function main() {
  const hre = require("hardhat");
  const ethers = hre.ethers;

  const CONTRACT_ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const [sender] = await ethers.getSigners();
  console.log("Using signer:", sender.address);

  const contract = await ethers.getContractAt("PrivScore", CONTRACT_ADDR);
  console.log("Connected to contract at:", CONTRACT_ADDR);

  if (!contract.interface || !contract.interface.functions) {
    console.log("No interface/functions present on contract object. Printing contract object keys instead:");
    console.log(Object.keys(contract));
    return;
  }

  const fnList = Object.values(contract.interface.functions).map(fn => fn.format());
  console.log("\nContract functions (signatures):");
  fnList.forEach((s, i) => console.log(`${i+1}. ${s}`));

  console.log("\nIf you see a function that looks like it stores an encrypted payload (names like set*, store*, submit*, upload*, publish*), copy the exact signature and tell me and I'll give you the exact submission call.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
