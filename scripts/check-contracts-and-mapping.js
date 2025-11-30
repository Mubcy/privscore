// scripts/check-contracts-and-mapping.js
// Usage: node scripts/check-contracts-and-mapping.js <contractA> <contractB> <user> <modelId>
// Example:
// node scripts/check-contracts-and-mapping.js 0x5FbDB... 0xa513E... 0xf39Fd6... 1

const { ethers } = require("ethers");
const fs = require("fs");

async function main() {
  const [ , , addrA, addrB, user, modelIdRaw ] = process.argv;
  if (!addrA || !addrB || !user || !modelIdRaw) {
    console.error("Usage: node scripts/check-contracts-and-mapping.js <addrA> <addrB> <user> <modelId>");
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const addrs = [addrA, addrB];
  const modelId = Number(modelIdRaw);
  const abi = [
    "function getEncryptedPayload(address user, uint256 modelId) external view returns (bytes memory)",
    "function encryptedPayload(address user, uint256 modelId) external view returns (bytes memory)"
  ];
  for (const a of addrs) {
    console.log("==== Checking", a, "====");
    try {
      const code = await provider.getCode(a);
      console.log("code length (bytes):", code ? (code.length / 2) : 0);
    } catch (e) {
      console.log("getCode error:", e.message || e);
    }

    // Try low-level call to getEncryptedPayload via minimal ABI
    try {
      const contract = new ethers.Contract(a, abi, provider);
      let calldata;
      try {
        const r = await contract.getEncryptedPayload(user, modelId);
        console.log("getEncryptedPayload returned (hex):", String(r).slice(0, 200));
      } catch (e) {
        console.log("getEncryptedPayload call failed:", e.message || e);
      }
      // also try mapping getter name encryptedPayload if present
      try {
        const r2 = await contract.encryptedPayload(user, modelId);
        console.log("encryptedPayload mapping getter returned (hex):", String(r2).slice(0,200));
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.log("contract call error:", e.message || e);
    }
    console.log("");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
