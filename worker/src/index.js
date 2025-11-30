// worker/src/index.js
// Robust worker runner — polling mode for MetricsSubmitted events.
// Keeps the process alive and logs actions clearly.

const path = require("path");
const { ethers } = require("ethers");

// load env
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// quick env check
console.log(">>> worker booting (polling mode)");
console.log("CWD:", process.cwd());
console.log("ENV preview:", {
  RPC_URL: process.env.RPC_URL,
  CONTRACT_ADDR: process.env.CONTRACT_ADDR && process.env.CONTRACT_ADDR.slice(0, 10),
  WORKER_PRIVATE_KEY: !!process.env.WORKER_PRIVATE_KEY,
});

// config
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDR = process.env.CONTRACT_ADDR;
const POLL_INTERVAL_MS = 3000; // poll every 3s

if (!CONTRACT_ADDR) {
  console.error("Missing CONTRACT_ADDR in worker/.env — aborting.");
  process.exit(1);
}

// provider & wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = process.env.WORKER_PRIVATE_KEY ? new ethers.Wallet(process.env.WORKER_PRIVATE_KEY, provider) : null;

// load ABI (from project root artifacts)
const abiPath = path.join(__dirname, "..", "..", "artifacts", "contracts", "PrivScore.sol", "PrivScore.json");
let abi;
try {
  abi = require(abiPath).abi;
} catch (e) {
  console.error("Failed to load contract ABI at", abiPath, e.message);
  process.exit(1);
}
const contract = new ethers.Contract(CONTRACT_ADDR, abi, provider);

// state
let lastPolledBlock = 0;
let isPolling = false;

// helpers
function tryParseJSON(txt) {
  if (!txt || typeof txt !== "string") return null;
  try {
    const clean = txt.replace(/^\uFEFF/, "").replace(/\0/g, "").trim();
    if (!clean) return null;
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

function normalizeEncPayload(enc) {
  // enc could be hex (0x...), Uint8Array, or Bytes
  try {
    if (typeof enc === "string" && enc.startsWith("0x")) {
      try {
        const txt = ethers.toUtf8String(enc);
        return { text: txt, parsed: tryParseJSON(txt), rawHex: enc };
      } catch { return { rawHex: enc }; }
    }
    if (enc instanceof Uint8Array) {
      try {
        const txt = ethers.toUtf8String(enc);
        return { text: txt, parsed: tryParseJSON(txt) };
      } catch { return { raw: enc }; }
    }
    // fallback: try toString
    try {
      const s = String(enc);
      const parsed = tryParseJSON(s);
      return { text: s, parsed };
    } catch { }
  } catch (e) {}
  return { unknown: true };
}

function computeScoreFromMetrics(m) {
  // Keep your actual scoring logic here. This is a safe example fallback.
  try {
    const inc = Number(m.inc ?? m.income ?? 400);
    const onTime = Number(m.onTimePayments ?? m.onTime ?? 10);
    const debt = Number(m.debtRatio ?? m.debt ?? 25);
    const score = Math.max(0, Math.min(850, Math.round(inc / 10 + onTime * 10 - debt)));
    return score;
  } catch {
    return 500;
  }
}

async function pollOnce() {
  if (isPolling) return;
  isPolling = true;
  try {
    const blockNumber = await provider.getBlockNumber();
    if (lastPolledBlock === 0) {
      // start from block 0 for dev or blockNumber-20 for recent-only
      lastPolledBlock = Math.max(0, blockNumber - 50);
      console.log("Starting poll from block", lastPolledBlock);
    }

    const from = lastPolledBlock + 1;
    const to = blockNumber;
    if (to < from) {
      // nothing new
      isPolling = false;
      return;
    }

    // get logs for MetricsSubmitted events only
    const filter = contract.filters.MetricsSubmitted();
    const logs = await contract.queryFilter(filter, from, to);
    if (logs.length > 0) {
      console.log(`Found ${logs.length} MetricsSubmitted log(s) from ${from}..${to}`);
    }

    for (const ev of logs) {
      try {
        const args = ev.args;
        const user = args.user;
        const modelId = args.modelId.toString ? args.modelId.toString() : String(args.modelId);
        const encPayload = args.encPayload;

        console.log(`MetricsSubmitted (block ${ev.blockNumber}): user=${user} modelId=${modelId}`);

        const norm = normalizeEncPayload(encPayload);
        let metrics = null;
        if (norm.parsed) {
          metrics = norm.parsed;
          console.log("Parsed JSON metrics:", metrics);
        } else if (norm.text) {
          console.log("Payload text:", norm.text.slice(0, 200));
        } else if (norm.rawHex) {
          console.log("Payload raw hex (first 200 chars):", norm.rawHex.slice(0, 200));
        } else {
          console.log("Could not parse metrics from ciphertext — using defaults");
        }

        const metricObj = (metrics && metrics.metrics) ? metrics.metrics : (metrics ?? { inc: 400, onTimePayments: 10, debtRatio: 25 });
        const score = computeScoreFromMetrics(metricObj);

        console.log(`Computed score ${score} for ${user}.`);
        console.log("SECURE PUBLISH FLOW: To publish on-chain, the frontend must call relayer.publicDecrypt -> then contract.submitDecryptedScore(handles, score, proof).");
        console.log("You can retrieve enc payload with contract.getEncryptedPayload(user, modelId). Example:");
        console.log(`  contract.getEncryptedPayload("${user}", ${modelId})`);

        // (dev-only) If you want to test a local insecure publish, uncomment the following block.
        // WARNING: this bypasses KMS verification and is insecure — use only for local testing.
        /*
        try {
          const signer = wallet ?? (await provider.getSigner());
          const contractWithSigner = contract.connect(signer);
          const tx = await contractWithSigner.submitDecryptedScore(user, modelId, [], score, "0x");
          console.log("Dev insecure submit tx sent:", tx.hash);
          const rcpt = await tx.wait();
          console.log("Dev insecure submit tx mined in block", rcpt.blockNumber);
        } catch (err) {
          console.warn("Dev insecure submission failed:", err.message || err);
        }
        */

      } catch (err) {
        console.error("Error handling event:", err);
      }
    }

    // update lastPolledBlock
    lastPolledBlock = to;
  } catch (err) {
    console.error("Poll error:", err && err.message ? err.message : err);
  } finally {
    isPolling = false;
  }
}

// start periodic poll (keeps Node alive)
setInterval(() => {
  pollOnce().catch((e) => console.error("pollOnce top error:", e));
}, POLL_INTERVAL_MS);

// also fire an immediate poll
pollOnce().catch((e) => console.error("initial poll error:", e));

// keep process alive if nothing else
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (r) => {
  console.error("Unhandled rejection:", r);
});
