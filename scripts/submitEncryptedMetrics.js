// scripts/submitEncryptedMetrics.js
// run with:
// npx hardhat run --network localhost scripts/submitEncryptedMetrics.js

const fs = require("fs");
const crypto = require("crypto");

function sha256Hex(buffer) {
  return "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  const hre = require("hardhat");
  const ethers = hre.ethers;

  const CONTRACT_ADDR = process.env.CONTRACT_ADDR || "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
  const filePath = "/mnt/data/b5bd0e5d-a9c7-4f5a-9b5b-0e0869ea5c98.png"; // uploaded file path (optional)

  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  const contract = await ethers.getContractAt("PrivScore", CONTRACT_ADDR, signer);
  console.log("Connected to contract at:", CONTRACT_ADDR);

  // --- choose payload ---
  let payload;
  try {
    const buff = fs.readFileSync(filePath);
    // Recommended: submit a small deterministic hash of the file (SHA-256)
    payload = sha256Hex(buff);
    console.log("Using sha256(file) as payload:", payload);
    // If you prefer to send the raw file bytes (can be large), uncomment the next line:
    // payload = "0x" + buff.toString("hex");
    // console.log("Using raw file bytes as payload (may be large): length(bytes)=", buff.length);
  } catch (e) {
    console.log("Could not read file at", filePath, "- falling back to text payload.");
    payload = "0x" + Buffer.from("test-encrypted-payload").toString("hex");
    console.log("Fallback payload:", payload);
  }

  const modelId = 1; // match your demo/model
  const userAddress = signer.address;

  console.log("Calling submitEncryptedMetrics(", userAddress, ",", modelId, ", <payload>) ...");

  // send the transaction
  const tx = await contract.submitEncryptedMetrics(userAddress, modelId, payload, {
    gasLimit: 800000,
  });
  console.log("Tx sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("Tx mined:", receipt.transactionHash, "status:", receipt.status);
  if (receipt.status === 1) {
    console.log("submitEncryptedMetrics succeeded — worker should pick this up shortly.");
  } else {
    console.log("submitEncryptedMetrics transaction failed. Check Hardhat logs for revert reason.");
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
