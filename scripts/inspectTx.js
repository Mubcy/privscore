// scripts/inspectTx.js
// Usage: npx hardhat run --network localhost scripts/inspectTx.js --tx <txHash>
const hre = require("hardhat");

async function main() {
  const args = process.argv.slice(2);
  const txArgIndex = args.indexOf("--tx");
  if (txArgIndex === -1 || !args[txArgIndex+1]) {
    console.error("Usage: node inspectTx.js --tx <txHash>");
    process.exit(1);
  }
  const txHash = args[txArgIndex+1];
  const ethers = hre.ethers;
  const CONTRACT_ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const contract = await ethers.getContractAt("PrivScore", CONTRACT_ADDR);

  console.log("Fetching receipt for", txHash);
  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  if (!receipt) {
    console.log("No receipt found (maybe wrong network or tx not mined).");
    return;
  }
  console.log("Receipt:", {
    blockNumber: receipt.blockNumber,
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString(),
    transactionHash: receipt.transactionHash
  });

  // Print raw logs
  console.log("\nRaw logs (count):", receipt.logs.length);
  receipt.logs.forEach((l, i) => {
    console.log(i+1, {
      address: l.address,
      topics: l.topics,
      data: l.data,
      logIndex: l.logIndex
    });
  });

  // Try to parse logs via contract.interface
  console.log("\nDecoded events (if any):");
  for (const l of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(l);
      console.log("EVENT:", parsed.name, parsed.args);
    } catch (e) {
      // ignore unparsed logs
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
