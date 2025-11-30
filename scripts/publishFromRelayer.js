// scripts/publishFromRelayer.js
// Node-side helper that:
//  1) Calls the local relayer /public-decrypt
//  2) Normalizes the user address
//  3) Calls submitDecryptedScore(user, modelId, handles, score, proof) on PrivScore
//
// Usage:
//   $env:CONTRACT_ADDR="0x5FbDB2315678afecb367f032d93F642f64180aa3"
//   node scripts/publishFromRelayer.js --user 0xf39Fd6e51aad88f6f4ce6aB8827279cffFb92266 --modelId 1

const fs = require("fs");
const path = require("path");
const ethers = require("ethers"); // v6 style
// Node 18+ has global fetch; if not, you can install node-fetch, but we try native first.

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const RELAYER_URL = process.env.RELAYER_URL || "http://localhost:3000";
const CONTRACT_ADDR = process.env.CONTRACT_ADDR || "";

/** Simple CLI arg parser: --key value */
function parseArgs(argv) {
  const out = {};
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = args[i + 1];
      out[key] = val;
      i++;
    }
  }
  return out;
}

/** Normalize an Ethereum address string, being tolerant of bad checksum. */
function normalizeEthAddress(raw) {
  const s = String(raw || "").trim();
  // Look for a 0x + 40 hex chars pattern
  const m = s.match(/0x[0-9a-fA-F]{40}/);
  if (!m) {
    throw new Error(`could not find hex address in "${raw}"`);
  }
  const candidate = m[0];

  // Try strict checksum first
  try {
    return ethers.getAddress(candidate);
  } catch (e1) {
    // Fallback: all-lowercase then checksummed
    try {
      return ethers.getAddress(candidate.toLowerCase());
    } catch (e2) {
      throw new Error(
        `bad address checksum even after lowercase: ${candidate} (${e2.message || e2})`
      );
    }
  }
}

/** Normalize relayer response into { handles, proof, value } */
function normalizeRelayerResp(pd) {
  if (!pd) return {};
  const handles =
    pd.handles ??
    pd.handlesList ??
    pd.handlesArray ??
    (pd.handle ? [pd.handle] : null);

  const proof =
    pd.proof ??
    pd.decryptionProof ??
    pd.signature ??
    null;

  let value =
    pd.value ??
    pd.clearValue ??
    pd.clearValues ??
    pd.result ??
    pd.resultValue ??
    null;

  if (Array.isArray(value) && value.length === 1) {
    value = value[0];
  }

  return { handles, proof, value };
}

async function main() {
  const args = parseArgs(process.argv);

  const userArg = args.user;
  const modelIdRaw = args.modelId ?? "1";

  if (!userArg) {
    console.error("Missing --user 0x... argument");
    process.exit(1);
  }

  const modelId = BigInt(modelIdRaw);

  if (!CONTRACT_ADDR) {
    console.error(
      "CONTRACT_ADDR env not set. Do:\n  $env:CONTRACT_ADDR=\"0x5FbDB2315678afecb367f032d93F642f64180aa3\""
    );
    process.exit(1);
  }

  // Load ABI from root privscore.json (copied from artifacts/..., as you did earlier)
  const abiPath = path.join(__dirname, "..", "privscore.json");
  if (!fs.existsSync(abiPath)) {
    console.error("privscore.json not found. Place ABI at ./privscore.json in project root.");
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));

  console.log("=== publishFromRelayer ===");
  console.log("RPC:", RPC_URL);
  console.log("Relayer:", RELAYER_URL);
  console.log("Contract:", CONTRACT_ADDR);
  console.log("User (raw):", userArg);
  console.log("modelId:", modelId.toString());

  // Normalize user address robustly
  let userAddress;
  try {
    userAddress = normalizeEthAddress(userArg);
    console.log("Normalized user address:", userAddress);
  } catch (e) {
    console.error("Failed to normalize user address:", e.message || e);
    process.exit(1);
  }

  // 1) Call relayer /public-decrypt
  const relayerUrl = RELAYER_URL.replace(/\/$/, "") + "/public-decrypt";

  if (typeof fetch !== "function") {
    console.error(
      "Global fetch is not available in this Node. Use Node 18+ or install node-fetch and adapt the script."
    );
    process.exit(1);
  }

  console.log("Calling relayer:", relayerUrl);
  const body = {
    contract: CONTRACT_ADDR,
    user: userArg, // send original, relayer has its own normalization
    modelId: Number(modelId),
  };

  const resp = await fetch(relayerUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    console.error(`Relayer returned ${resp.status}: ${txt}`);
    process.exit(1);
  }

  const pd = await resp.json();
  console.log("Relayer raw response:", pd);

  const { handles, proof, value } = normalizeRelayerResp(pd);
  if (!handles || handles.length === 0) {
    console.error("❌ Relayer returned no handles — cannot submit.");
    process.exit(1);
  }

  // Convert value to bigint (score)
  let scoreBig;
  if (typeof value === "bigint") {
    scoreBig = value;
  } else if (typeof value === "number") {
    scoreBig = BigInt(Math.floor(value));
  } else if (typeof value === "string" && value.match(/^\d+$/)) {
    scoreBig = BigInt(value);
  } else {
    // fallback: hash and mod 1000 (shouldn't happen with your current local relayer)
    const fallback = BigInt(
      "0x" + Buffer.from(String(value ?? ""), "utf8").toString("hex")
    );
    scoreBig = fallback % 1000n;
  }

  console.log("Normalized relayer output:");
  console.log("  handles[0]:", handles[0]);
  console.log("  proof:", proof);
  console.log("  scoreBig:", scoreBig.toString());

  // 2) Submit to contract
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = await provider.getSigner(); // first Hardhat account
  const contract = new ethers.Contract(CONTRACT_ADDR, artifact.abi, signer);

  console.log("Submitting submitDecryptedScore...");
  try {
    const tx = await contract.submitDecryptedScore(
      userAddress,          // normalized address
      modelId,              // uint256
      handles,              // bytes32[]
      scoreBig,             // uint256
      proof || "0x"         // bytes
    );
    console.log("Tx sent:", tx.hash);
    const receipt = await tx.wait();
    console.log(
      "✔ submitDecryptedScore mined in block",
      receipt.blockNumber,
      "status",
      receipt.status
    );
  } catch (e) {
    console.error("submitDecryptedScore failed:", e.reason || e.message || e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error in publishFromRelayer:", e && e.stack ? e.stack : e);
  process.exit(1);
});
