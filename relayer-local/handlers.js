// handlers.js - small helper functions used by index.js
const fs = require("fs");
const path = require("path");
const { keccak256 } = require("js-sha3"); // sha3 output hex
const MAP_FILE = path.join(__dirname, "map.json");

let mapping = {};
try {
  mapping = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
} catch (e) {
  mapping = {};
}

/**
 * Given a single handle (hex string or other), return a "relayer style" response:
 * { handles: [...], proof: "...", value: <clear value> }
 *
 * If map.json contains value for handle, return it. Otherwise return deterministic number.
 */
function publicDecryptMock({ handle, handles }) {
  const h = (handle || (Array.isArray(handles) ? handles[0] : null) || "").toString();

  // exact match from map
  if (mapping[h]) {
    const entry = mapping[h];
    return {
      handles: [h],
      proof: entry.proof ?? "0x",
      value: entry.value
    };
  }

  // deterministic fallback: keccak(handle) % 1000 + 100 (so values are >100)
  const hex = h.startsWith("0x") ? h.slice(2) : h;
  const digest = keccak256(hex || "00");
  // take last 8 chars as number
  const n = parseInt(digest.slice(-8), 16);
  const value = (n % 900) + 100;
  return { handles: [h], proof: "0x", value };
}

module.exports = { publicDecryptMock, mapping };
