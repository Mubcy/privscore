// scripts/read-mapping-normalized.js
// Very robust normalization for user addresses, with verbose logging.
// Usage:
//   node scripts/read-mapping-normalized.js <CONTRACT_ADDR> <USER_RAW> <MODEL_ID>

const { ethers } = require("ethers");

function tryGetAddressDirect(x) {
  try {
    return ethers.getAddress(String(x));
  } catch (e) {
    return null;
  }
}

function extract40Hex(s) {
  const m = s.match(/([0-9a-fA-F]{40})/);
  if (!m) return null;
  return "0x" + m[1];
}

function stripNonHexAndTakeLast40(s) {
  const hex = (s.replace(/0x/i, "").replace(/[^0-9a-fA-F]/g, "") || "");
  if (hex.length < 40) return null;
  return "0x" + hex.slice(-40);
}

function removeInvisibleAndTrim(s) {
  return s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").trim();
}

function normalizeAddressVerbose(raw) {
  const asStr = String(raw || "");
  console.log("raw user from request (repr):", JSON.stringify(asStr));

  // 1) try direct getAddress (fast path)
  const direct = tryGetAddressDirect(asStr);
  if (direct) {
    console.log("Normalization: direct ethers.getAddress succeeded");
    return direct;
  }
  // 2) remove invisible chars then try again
  const cleaned = removeInvisibleAndTrim(asStr);
  const direct2 = tryGetAddressDirect(cleaned);
  if (direct2) {
    console.log("Normalization: cleaned string then getAddress succeeded");
    return direct2;
  }

  // 3) extract 40 hex chars anywhere in string
  const hex40 = extract40Hex(cleaned);
  if (hex40) {
    try {
      const addr = ethers.getAddress(hex40);
      console.log("Normalization: extracted 40-hex match and checksummed:", addr);
      return addr;
    } catch (e) {
      console.warn("Normalization: extracted 40-hex but getAddress failed:", e.message || e);
    }
  }

  // 4) strip non-hex and take last 40 chars (best-effort)
  const last40 = stripNonHexAndTakeLast40(cleaned);
  if (last40) {
    try {
      const addr = ethers.getAddress(last40);
      console.log("Normalization: stripped non-hex & used last40, checksummed:", addr);
      return addr;
    } catch (e) {
      console.warn("Normalization: last40 candidate getAddress failed:", e.message || e);
    }
  }

  // 5) fallback: lowercase candidate (ethers.getAddress will still validate checksum; we return lowercased if it passes)
  const lc = cleaned.replace(/^0x/i, "").toLowerCase();
  if (/^[0-9a-f]{40}$/.test(lc)) {
    try {
      const addr = ethers.getAddress("0x" + lc);
      console.log("Normalization: lowercased candidate succeeded:", addr);
      return addr;
    } catch (e) {
      console.warn("Normalization: lowercased candidate failed:", e.message || e);
    }
  }

  throw new Error("Could not normalize/validate address from input: " + JSON.stringify(raw));
}

async function main() {
  const [ , , contractAddr, userRaw, modelIdRaw ] = process.argv;
  if (!contractAddr || !userRaw || !modelIdRaw) {
    console.error("Usage: node scripts/read-mapping-normalized.js <CONTRACT_ADDR> <USER_RAW> <MODEL_ID>");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  let userAddr;
  try {
    userAddr = normalizeAddressVerbose(userRaw);
  } catch (e) {
    console.error("Address normalization failed:", e.message || e);
    process.exit(1);
  }

  console.log("Final normalized user address:", userAddr);
  console.log(`Querying getEncryptedPayload(${userAddr}, ${modelIdRaw}) on ${contractAddr}`);

  const abi = ["function getEncryptedPayload(address user, uint256 modelId) external view returns (bytes memory)"];
  const contract = new ethers.Contract(contractAddr, abi, provider);

  try {
    const res = await contract.getEncryptedPayload(userAddr, Number(modelIdRaw));
    if (!res || res === "0x") {
      console.log("Result: 0x (empty) — no payload stored for this user/model on this contract.");
      process.exit(0);
    }
    const rawHex = String(res);
    console.log("raw hex (first 600 chars):", rawHex.slice(0, 600));

    // best-effort decode to UTF-8
    try {
      const arr = ethers.getBytes(res);
      const txt = ethers.toUtf8String(arr);
      console.log("decoded text (best-effort):", txt);
    } catch (err) {
      console.log("Could not decode payload as UTF-8 (that's OK).");
    }
  } catch (e) {
    console.error("call error:", e && e.message ? e.message : e);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
