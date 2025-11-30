// scripts/diagnoseSubmission.js
// Run with:
// npx hardhat run --network localhost scripts/diagnoseSubmission.js

const hre = require("hardhat");

async function main() {
  const ethers = hre.ethers;
  const provider = ethers.provider;
  const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const contract = await ethers.getContractAt("PrivScore", CONTRACT);
  const iface = contract.interface;

  // Tx hashes we've used in this session (include any others you want checked)
  const txHashes = [
    "0x1a64d2ed4d939fdd9ac5b1e24691542e61a41ee71ea0b6284a0f2923a4f9468d",
    "0x54db7249069022be4c01a60218c05b24aa6b8c4f69cf6a3e56885ab4c9a6df06",
    "0x3221efb5715a63547e82c0594dd9da719743bcf4d2ba899e62125aeb8bc18e0c"
  ];

  console.log("Using contract:", CONTRACT);
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);
  console.log("----\n");

  // 1) Inspect each tx receipt + logs
  for (const th of txHashes) {
    try {
      console.log("Inspecting tx:", th);
      const receipt = await provider.getTransactionReceipt(th);
      if (!receipt) {
        console.log("  No receipt found for", th);
        console.log("----\n");
        continue;
      }
      console.log("  Receipt: block", receipt.blockNumber, "status", receipt.status, "gasUsed", receipt.gasUsed.toString());
      console.log("  Raw logs count:", receipt.logs.length);
      receipt.logs.forEach((l, i) => {
        console.log(`   log[${i}] address=${l.address} topics=${JSON.stringify(l.topics)} data=${l.data.slice(0,120)}${l.data.length>120?'...':''}`);
      });

      // Try to decode logs with the contract interface
      console.log("  Decoded events (by contract interface):");
      let foundAny = false;
      for (const l of receipt.logs) {
        try {
          const parsed = iface.parseLog(l);
          console.log("   ->", parsed.name, parsed.args);
          foundAny = true;
        } catch (e) {
          // not a contract event
        }
      }
      if (!foundAny) console.log("   (no logs decoded by PrivScore ABI)");
    } catch (e) {
      console.error("  Error inspecting tx:", e);
    }
    console.log("----\n");
  }

  // 2) Low-level call to getEncryptedPayload to capture raw return data
  try {
    const user = signer.address;
    const modelId = 1;
    console.log(`Low-level call getEncryptedPayload(${user}, ${modelId}) to get raw return bytes:`);
    const data = iface.encodeFunctionData("getEncryptedPayload", [user, modelId]);
    const raw = await provider.call({ to: CONTRACT, data });
    console.log("  raw return (hex):", raw);
    if (!raw || raw === "0x") {
      console.log("  -> raw return is empty (0x) — contract returned nothing for that view.");
    } else {
      // try to decode it safely
      try {
        const decoded = iface.decodeFunctionResult("getEncryptedPayload", raw);
        console.log("  decoded result:", decoded[0], "length(bytes):", decoded[0] ? (decoded[0].length - 2) / 2 : 0);
      } catch (e) {
        console.log("  Could not decode return via ABI (short/odd data). Raw returned:", raw);
      }
    }
  } catch (e) {
    console.error("Error doing low-level call:", e);
  }

  // 3) Read public mapping accessor 'encryptedPayload' low-level
  try {
    const user = signer.address;
    const modelId = 1;
    console.log(`Low-level call encryptedPayload(${user}, ${modelId}) to get raw return bytes:`);
    const data2 = iface.encodeFunctionData("encryptedPayload", [user, modelId]);
    const raw2 = await provider.call({ to: CONTRACT, data: data2 });
    console.log("  raw return (hex):", raw2);
    if (!raw2 || raw2 === "0x") {
      console.log("  -> raw return is empty (0x) — mapping has no stored value for this user/model.");
    } else {
      try {
        const dec2 = iface.decodeFunctionResult("encryptedPayload", raw2);
        console.log("  decoded mapping value (bytes):", dec2[0], "length(bytes):", dec2[0] ? (dec2[0].length - 2) / 2 : 0);
      } catch (e) {
        console.log("  Could not decode mapping return; raw:", raw2);
      }
    }
  } catch (e) {
    console.error("Error calling mapping accessor low-level:", e);
  }

  // 4) Query chain for MetricsSubmitted events (0..latest) and print them
  try {
    console.log("\nQuerying stored MetricsSubmitted events via contract.queryFilter:");
    const events = await contract.queryFilter(contract.filters.MetricsSubmitted(), 0, "latest");
    console.log("  Found count:", events.length);
    events.forEach((ev, i) => {
      console.log(`   #${i+1}`, {
        user: ev.args?.user,
        modelId: ev.args?.modelId?.toString?.(),
        encPayloadLen: ev.args?.encPayload ? (ev.args.encPayload.length - 2)/2 : 0,
        txHash: ev.transactionHash,
        blockNumber: ev.blockNumber
      });
    });
  } catch (e) {
    console.error("Error querying events:", e);
  }

  console.log("\nDONE.\n\nInterpretation hints:");
  console.log("- If receipts had no decoded events and the low-level calls returned 0x, your submit calls executed but didn't store or emit.");
  console.log("- That usually means submitEncryptedMetrics executed a codepath that did not write (e.g. failed internal checks but didn't revert), or the function delegatecalls elsewhere or requires specific conditions (KMS sig, allowed caller, etc.).");
  console.log("- If receipts show MetricsSubmitted events, copy the event blockNumber/txHash and check worker logs around that block/tx for errors.");
}

main().catch(e => { console.error(e); process.exit(1); });
