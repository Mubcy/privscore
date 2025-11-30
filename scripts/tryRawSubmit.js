// scripts/tryRawSubmit_fixed.js
// Run with:
// npx hardhat run --network localhost scripts/tryRawSubmit_fixed.js

const fs = require("fs");
const crypto = require("crypto");
const ethersLib = require("ethers"); // use ethers directly for encoding

function sha256Hex(buffer) {
  return "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
}

function makeSelector(sig) {
  return ethersLib.utils.id(sig).slice(0, 10);
}

async function main() {
  const hre = require("hardhat");
  const hreEthers = hre.ethers; // for provider / signer
  const CONTRACT_ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const signers = await hreEthers.getSigners();
  const signer = signers[0];
  console.log("Using signer:", signer.address);
  console.log("Target contract:", CONTRACT_ADDR);

  // Try to read the uploaded screenshot (optional)
  const filePath = "/mnt/data/b5bd0e5d-a9c7-4f5a-9b5b-0e0869ea5c98.png";
  let payloadHex;
  try {
    const buff = fs.readFileSync(filePath);
    payloadHex = sha256Hex(buff);
    console.log("Using sha256(file) as payload:", payloadHex);
  } catch (e) {
    console.log("Could not read file at", filePath, "- falling back to text payload.");
    payloadHex = "0x" + Buffer.from("test-encrypted-payload").toString("hex");
    console.log("Fallback payload:", payloadHex);
  }

  const modelId = 1;
  const userAddr = signer.address;

  const tries = [
    "submitEncryptedInput(address,uint256,bytes)",
    "submitEncryptedInput(uint256,address,bytes)",
    "submitEncryptedPayload(address,uint256,bytes)",
    "submitEncryptedPayload(uint256,address,bytes)",
    "publishEncryptedPayload(address,uint256,bytes)",
    "publishEncryptedPayload(uint256,address,bytes)",
    "uploadEncryptedPayload(address,uint256,bytes)",
    "storeEncryptedPayload(address,uint256,bytes)",
    "storePayload(address,uint256,bytes)",
    "setEncryptedPayload(address,uint256,bytes)",
    "addEncryptedPayload(address,uint256,bytes)",
    "submit(address,uint256,bytes)",
    "submit(uint256,address,bytes)",
    "setPayload(bytes)",
    "setEncrypted(bytes)",
    "upload(bytes)",
    "uploadPayload(bytes)"
  ];

  const abiCoder = ethersLib.utils.defaultAbiCoder;

  for (const sig of tries) {
    try {
      console.log("\nTrying signature:", sig);
      const typesRaw = sig.slice(sig.indexOf("(") + 1, sig.indexOf(")")).trim();
      const types = typesRaw === "" ? [] : typesRaw.split(",").map(s => s.trim());

      let args = [];
      if (types.length === 3 && types.join(",") === "address,uint256,bytes") {
        args = [userAddr, modelId, payloadHex];
      } else if (types.length === 3 && types.join(",") === "uint256,address,bytes") {
        args = [modelId, userAddr, payloadHex];
      } else if (types.length === 1 && types[0] === "bytes") {
        args = [payloadHex];
      } else if (types.includes("bytes") && types.includes("address") && types.includes("uint256")) {
        // best-effort: address,uint256,bytes
        args = [userAddr, modelId, payloadHex];
      } else {
        console.log("Unknown argument types for", sig, "- skipping.");
        continue;
      }

      const selector = makeSelector(sig);
      const encoded = types.length ? abiCoder.encode(types, args) : "0x";
      const txData = selector + encoded.slice(2);

      console.log("Encoded tx data size (hex chars):", txData.length);
      const tx = await signer.sendTransaction({
        to: CONTRACT_ADDR,
        data: txData,
        gasLimit: 800000
      });

      console.log("Sent tx:", tx.hash);
      const receipt = await tx.wait();
      console.log("Mined receipt:", receipt.transactionHash, "status:", receipt.status);
      console.log("Success with signature:", sig);
      console.log(">> STOPPING (one function succeeded). Check worker logs now.");
      return;
    } catch (err) {
      const msg = (err && err.error && err.error.message) || err.message || String(err);
      console.warn("Attempt failed for", sig, "->", msg);
    }
  }

  console.log("\nAll candidate signatures attempted and none succeeded (or all reverted).");
  console.log("Next: share your contract artifact ABI (artifacts/.../PrivScore.json) or contract source so I can call the exact function.");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
