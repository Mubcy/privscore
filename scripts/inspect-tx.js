// scripts/inspect-tx.js
// Usage: node scripts/inspect-tx.js <TX_HASH>

const { ethers } = require("ethers");

async function main() {
  const txHash = process.argv[2];
  if (!txHash) {
    console.error("Usage: node scripts/inspect-tx.js <TX_HASH>");
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    console.log("Transaction not found:", txHash);
    process.exit(0);
  }
  console.log("tx.hash:", tx.hash);
  console.log("from:", tx.from);
  console.log("to:", tx.to);
  console.log("nonce:", tx.nonce);
  console.log("data (first 10 bytes):", tx.data?.slice(0, 10));
  const rec = await provider.getTransactionReceipt(txHash);
  console.log("receipt:", rec ? { blockNumber: rec.blockNumber, status: rec.status, gasUsed: rec.gasUsed?.toString(), logsCount: rec.logs?.length } : null);
}

main().catch(e => { console.error(e); process.exit(1); });
