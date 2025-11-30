// relayer-local/index.js
// Local mock relayer for testing purposes only
// Usage: node index.js
// Requires: npm i express ethers cors dotenv

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const ethers = require("ethers");

const PORT = process.env.RELAYER_PORT ? Number(process.env.RELAYER_PORT) : 3000;
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDR = process.env.CONTRACT_ADDR || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const app = express();
app.use(express.json());
// allow your frontend origin (adjust if needed)
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));

const provider = new ethers.JsonRpcProvider(RPC_URL);
const privscoreAbi = [
  "function getEncryptedPayload(address user, uint256 modelId) external view returns (bytes memory)"
];

const contract = new ethers.Contract(CONTRACT_ADDR, privscoreAbi, provider);

// helper: pad hex string to 32 bytes (0x + 64 hex chars)
function padHexTo32(hex) {
  if (!hex) return "0x" + "0".repeat(64);
  let h = String(hex).startsWith("0x") ? String(hex).slice(2) : String(hex);
  if (h.length > 64) h = h.slice(-64); // trim if accidentally longer
  return "0x" + h.padStart(64, "0");
}

function normalizeHandleToBytes32(hexOrString) {
  if (typeof hexOrString !== "string") hexOrString = String(hexOrString);

  // Already bytes32 hex?
  if (/^0x[0-9a-fA-F]{64}$/.test(hexOrString)) return hexOrString;

  // Short hex-ish -> pad to 32 bytes
  if (/^0x[0-9a-fA-F]+$/.test(hexOrString)) {
    try {
      return padHexTo32(hexOrString);
    } catch (e) {
      // fallthrough
    }
  }

  // Otherwise hash the UTF-8 text to a 32-byte value
  return ethers.keccak256(ethers.toUtf8Bytes(hexOrString));
}

app.post("/public-decrypt", async (req, res) => {
  try {
    const { contract: contractAddrBody, user, modelId } = req.body || {};

    // guard
    if (!user || typeof modelId === "undefined") {
      return res.status(400).json({ error: "missing 'user' or 'modelId' in body" });
    }

    console.log("public-decrypt request:", { user, modelId, contractFromBody: contractAddrBody });

    // --- robust user normalization with lowercase fallback ---
    let userAddress;
    try {
      const raw = String(user || "");
      console.log("raw user from request (repr):", JSON.stringify(raw));

      // Remove invisible / NBSP chars and trim
      const cleanedWhitespace = raw.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").trim();

      // Extract 40 hex chars (addresses could be embedded or have stray chars)
      const match = cleanedWhitespace.match(/([0-9a-fA-F]{40})/);
      if (!match) {
        console.warn("Could not extract 40-hex address from incoming user:", JSON.stringify(cleanedWhitespace));
        return res.status(400).json({ error: "invalid user address (no hex found)" });
      }

      const hex40 = match[1];
      const candidate = "0x" + hex40;
      console.log("candidate address after extraction:", candidate);

      // Try checksumming the candidate; if that fails, try the lowercase variant
      try {
        userAddress = ethers.getAddress(candidate); // preferred - validates checksum if mixed-case
      } catch (e1) {
        try {
          const lower = candidate.toLowerCase();
          console.log("candidate lowercased fallback:", lower);
          userAddress = ethers.getAddress(lower); // will accept lower-case and return checksummed form
        } catch (e2) {
          console.warn("Address validation failed for both original and lowercased candidate:", e1.message, e2.message);
          return res.status(400).json({ error: "invalid user address" });
        }
      }
    } catch (err) {
      console.warn("Invalid user address supplied to relayer.public-decrypt:", user, err && err.message);
      return res.status(400).json({ error: "invalid user address" });
    }

    console.log("normalized user address:", userAddress);

    // Read encrypted payload from chain
    const callData = await contract.getEncryptedPayload(userAddress, Number(modelId)).catch(e => {
      console.warn("getEncryptedPayload failed:", e.message || e);
      return "0x";
    });

    if (!callData || callData === "0x") {
      console.log("No encrypted payload found on-chain for user/model");
      return res.json({ handles: [], decryptionProof: "0x", value: null });
    }

    // Try to decode the payload as UTF-8 text (best-effort) using Buffer
    let payloadText = null;
    let payloadBytes;
    try {
      const hex = String(callData).startsWith("0x") ? String(callData).slice(2) : String(callData);
      payloadBytes = Buffer.from(hex, "hex");
      // decode best-effort
      try {
        payloadText = new TextDecoder().decode(payloadBytes);
      } catch (err) {
        payloadText = null;
      }
      // if decode produced replacement characters or empty, we still keep payloadText if non-empty
      if (!payloadText) payloadText = null;
    } catch (e) {
      payloadText = null;
      payloadBytes = Buffer.from([]);
    }

    console.log("raw payload (hex):", String(callData).slice(0, 200));
    console.log("payload interpreted as text (best-effort):", payloadText);

    // Build deterministic handles & proof for testing:
    // handle = either padded hex or keccak(payloadText)
    const handle = normalizeHandleToBytes32(payloadText || callData);

    // Build proof = keccak256(payloadBytes || userAddress bytes)
    const userBytes = Buffer.from(String(userAddress).replace(/^0x/, ""), "hex");
    // if we couldn't create payloadBytes earlier, fallback to utf8 bytes of payloadText or callData hex
    if (!payloadBytes || payloadBytes.length === 0) {
      if (payloadText) payloadBytes = Buffer.from(String(payloadText), "utf8");
      else {
        const fallbackHex = String(callData).startsWith("0x") ? String(callData).slice(2) : String(callData);
        payloadBytes = Buffer.from(fallbackHex, "hex");
      }
    }

    const concatBuf = Buffer.concat([payloadBytes, userBytes]);
    const proofHex = ethers.keccak256("0x" + concatBuf.toString("hex"));

    // compute a toy numeric score using keccak(payloadText) -> bigint
    const numericHashHex = ethers.keccak256("0x" + (payloadBytes.length ? payloadBytes.toString("hex") : ""));
    const numericHashBigInt = BigInt(numericHashHex);
    const value = Number(numericHashBigInt % 1000n);

    const response = {
      handles: [handle],          // bytes32[]
      decryptionProof: proofHex,  // bytes
      value: value,               // numeric score for convenience
      debug: {
        payloadText,
        rawHex: callData
      }
    };

    console.log("public-decrypt response preview:", { value: response.value, handle: response.handles[0].slice(0, 10) });
    return res.json(response);
  } catch (err) {
    console.error("public-decrypt handler error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

app.listen(PORT, () => {
  console.log(`Local test relayer listening on http://localhost:${PORT} (RPC ${RPC_URL})`);
  console.log(`Using PrivScore contract: ${CONTRACT_ADDR}`);
});
