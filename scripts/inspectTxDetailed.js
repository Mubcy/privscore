// scripts/inspectTxDetailed.js
// Run with:
// npx hardhat run --network localhost scripts/inspectTxDetailed.js

const hre = require("hardhat");

async function main(){
  const ethers = hre.ethers;
  const provider = ethers.provider;
  const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const iface = (await ethers.getContractAt("PrivScore", CONTRACT)).interface;

  // Add tx hashes you want inspected (I prefilled ones you posted)
  const txHashes = [
    "0x1a64d2ed4d939fdd9ac5b1e24691542e61a41ee71ea0b6284a0f2923a4f9468d",
    "0x54db7249069022be4c01a60218c05b24aa6b8c4f69cf6a3e56885ab4c9a6df06",
    "0x3221efb5715a63547e82c0594dd9da719743bcf4d2ba899e62125aeb8bc18e0c",
    "0xebd59b4a0cbaa2d17e3c2df034923a3e4b15ca96b3b92ac3a17bb3a3623ad714",
    "0x1163179425248d1117b44dcfb1e4feac04c58a59265ce9ac248367e62d496a76",
    "0x9aa332c69d6ca7930088c19ee24da80ca76c43cdd64f9edcbc8c4da886bc7002",
    "0x23a3ee6a5bf841e4ffb0203ad90c9015f3b8cc17b925ccf05186d774a83b8a2e"
  ];

  console.log("Contract address checked:", CONTRACT);
  const code = await provider.getCode(CONTRACT);
  console.log("Contract code at address (hex prefix + length):", code ? `${code.slice(0,10)}... (bytes=${code.length/2})` : "0x (no code)");
  console.log("--------------------------------------------------\n");

  for (const th of txHashes) {
    try {
      console.log("Inspecting tx:", th);
      const tx = await provider.getTransaction(th);
      const receipt = await provider.getTransactionReceipt(th);
      if (!tx) {
        console.log("  No transaction object found (maybe wrong hash).");
        console.log("--------------------------------------------------\n");
        continue;
      }
      console.log("  to:", tx.to);
      console.log("  from:", tx.from);
      console.log("  nonce:", tx.nonce);
      console.log("  gasPrice/gasLimit:", tx.gasPrice ? tx.gasPrice.toString() : "n/a", tx.gasLimit.toString());
      console.log("  data (first 10 chars):", tx.data ? tx.data.slice(0,10) : "0x");
      console.log("  value:", (tx.value || "0").toString());
      if (receipt) {
        console.log("  receipt: block", receipt.blockNumber, "status", receipt.status, "gasUsed", receipt.gasUsed.toString(), "logs:", receipt.logs.length);
      } else {
        console.log("  receipt: not found / not mined");
      }

      // Decode calldata if it matches known function
      try {
        const parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
        console.log("  DECODED: function:", parsed.name, "args:", parsed.args);
      } catch (e) {
        console.log("  Could not decode calldata with PrivScore ABI (maybe different target or selector).");
      }

      // Print raw logs summary
      if (receipt && receipt.logs.length > 0) {
        console.log("  raw logs (first 3 shown):");
        receipt.logs.slice(0,3).forEach((l, i) => {
          console.log(`   log[${i}] address=${l.address} topics=[${l.topics.join(",")}] data=${l.data.slice(0,120)}${l.data.length>120?"...":""}`);
        });
      }

      console.log("--------------------------------------------------\n");
    } catch (err) {
      console.log(" Error inspecting tx:", err && err.message ? err.message : err);
      console.log("--------------------------------------------------\n");
    }
  }

  // Also print latest block number to sanity-check node
  const block = await provider.getBlockNumber();
  console.log("Latest block number:", block);
}

main().catch(e => { console.error(e); process.exit(1); });
