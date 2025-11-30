// worker/scripts/submitSample.js
const path = require("path");
const { ethers } = require("ethers");

// load worker/.env reliably
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function normalizeAddress(candidate) {
  if (!candidate) return null;

  // If it's already a string, trim and return
  if (typeof candidate === "string") {
    const s = candidate.trim();
    return s;
  }

  // If it's a BigInt or number (unlikely), convert to hex (not used here)
  if (typeof candidate === "bigint" || typeof candidate === "number") {
    try {
      return ethers.getAddress(BigInt(candidate).toString(16));
    } catch {
      return null;
    }
  }

  // If it's an object that looks like { address: "0x..." } or { _address: "0x..." }
  if (typeof candidate === "object") {
    if (candidate.address && typeof candidate.address === "string") return candidate.address;
    if (candidate._address && typeof candidate._address === "string") return candidate._address;
    // if it is a Provider Account object (ethers v7+), try toString
    if (candidate.toString && typeof candidate.toString === "function") {
      const s = String(candidate.toString()).trim();
      if (s) return s;
    }
  }

  // If it's an array, try first element
  if (Array.isArray(candidate) && candidate.length > 0) {
    return normalizeAddress(candidate[0]);
  }

  return null;
}

async function main() {
  try {
    const rpc = process.env.RPC_URL || "http://127.0.0.1:8545";
    const provider = new ethers.JsonRpcProvider(rpc);

    if (!process.env.WORKER_PRIVATE_KEY) {
      throw new Error("WORKER_PRIVATE_KEY not set in worker/.env");
    }
    const wallet = new ethers.Wallet(process.env.WORKER_PRIVATE_KEY, provider);

    const contractAddr = process.env.CONTRACT_ADDR;
    if (!contractAddr) throw new Error("CONTRACT_ADDR not set in worker/.env");

    const abi = require(path.join(
      __dirname,
      "..",
      "..",
      "artifacts",
      "contracts",
      "PrivScore.sol",
      "PrivScore.json"
    )).abi;

    const contract = new ethers.Contract(contractAddr, abi, wallet);

    // Resolve user address robustly
    let userCandidate = null;

    if (process.env.USER_ADDRESS && process.env.USER_ADDRESS.trim() !== "") {
      userCandidate = process.env.USER_ADDRESS.trim();
    } else {
      const accounts = await provider.listAccounts();
      userCandidate = accounts && accounts.length > 0 ? accounts[0] : null;
    }

    let user = normalizeAddress(userCandidate);
    // If normalize didn't produce a usable string, fall back to wallet
    if (!user) user = wallet.address;

    // Final validation using ethers helper
    if (!ethers.isAddress(user)) {
      throw new Error("Invalid user address: " + String(user));
    }

    const modelId = 1;
    const payload = ethers.toUtf8Bytes(
      JSON.stringify({
        note: "simulated-fhe",
        timestamp: Date.now(),
      })
    );

    console.log("Submitting encrypted metrics...");
    console.log("RPC:", rpc);
    console.log("Contract:", contractAddr);
    console.log("Worker:", wallet.address);
    console.log("User (resolved):", user);
    console.log("ModelId:", modelId);
    console.log("Payload (utf8 sample):", JSON.stringify({ note: "simulated-fhe" }));

    const tx = await contract.submitEncryptedMetrics(user, modelId, payload);
    console.log("Tx sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("Tx mined in block:", receipt.blockNumber);
  } catch (err) {
    console.error("Error when sending transaction:", err);
    process.exit(1);
  }
}

main();
