// frontend/src/services/privscore.js
import { ethers } from "ethers";

/*
  Minimal ABI for PrivScore — includes the methods/events we use in the UI.
  This avoids importing the full artifact JSON and prevents Vite path errors.
*/
const artifact = {
  abi: [
    "constructor(address initialOwner, address fheVerifierAddr)",
    "function owner() view returns (address)",
    "function testingMode() view returns (bool)",
    "function getEncryptedPayload(address user, uint256 modelId) view returns (bytes)",
    "function submitEncryptedMetrics(address user, uint256 modelId, bytes encPayload)",
    "function submitDecryptedScore(address user, uint256 modelId, bytes32[] handles, uint256 score, bytes decryptionProof)",
    "function setTestingMode(bool v)",
    "function setFHEVerifier(address addr)",
    "event MetricsSubmitted(address indexed user, uint256 indexed modelId, bytes encPayload)",
    "event ScorePublished(address indexed user, uint256 indexed modelId, uint256 score, bytes proof)"
  ]
};

/* ----------------- Deployment address resolution -----------------
   - Preferred: set VITE_CONTRACT_ADDR in your frontend .env (Vite)
     e.g. in frontend/.env: VITE_CONTRACT_ADDR=0x...
   - Alternative: expose via index.html inline script: window.__ENV = { CONTRACT_ADDR: '0x...' }
   - If neither is set, getDeploymentAddress() returns "" and UI will show a message.
*/
export function getDeploymentAddress() {
  // 1) vite env
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_CONTRACT_ADDR) {
      return String(import.meta.env.VITE_CONTRACT_ADDR);
    }
  } catch (e) {}

  // 2) runtime global from index.html
  try {
    if (typeof window !== "undefined" && window.__ENV?.CONTRACT_ADDR) {
      return String(window.__ENV.CONTRACT_ADDR);
    }
  } catch (e) {}

  // fallback: empty
  return "";
}

export function getArtifact() {
  return artifact;
}

/* ----------------- provider & signer helpers ----------------- */
export async function getProviderAndSigner() {
  // Prefer injected (MetaMask)
  if (typeof window !== "undefined" && window.ethereum) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      let signer = null;
      try {
        // getSigner can throw if user hasn't connected; we treat that gracefully
        signer = await provider.getSigner();
      } catch (e) {
        signer = null;
      }
      return { provider, signer };
    } catch (e) {
      // fall through to JSON-RPC provider
      console.warn("Browser provider failed, falling back to JSON-RPC:", e?.message || e);
    }
  }

  // Fallback to local hardhat node
  const rpc = "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpc);
  return { provider, signer: null };
}

/* ----------------- contract instance helper ----------------- */
async function contractInstance(useSigner = false) {
  const addr = getDeploymentAddress();
  if (!addr) throw new Error("Contract address not configured. Set VITE_CONTRACT_ADDR or window.__ENV.CONTRACT_ADDR.");

  const art = getArtifact();
  if (!art?.abi) throw new Error("Artifact ABI not found");

  const { provider, signer } = await getProviderAndSigner();
  if (useSigner && signer) {
    return new ethers.Contract(addr, art.abi, signer);
  }
  return new ethers.Contract(addr, art.abi, provider);
}

/* ----------------- read helpers ----------------- */
export async function readOwner() {
  try {
    const c = await contractInstance(false);
    const o = await c.owner();
    return o;
  } catch (e) {
    console.warn("readOwner error", e?.message || e);
    return null;
  }
}

export async function readTestingMode() {
  try {
    const c = await contractInstance(false);
    const tm = await c.testingMode();
    return tm;
  } catch (e) {
    console.warn("readTestingMode error", e?.message || e);
    return null;
  }
}

export async function readEncryptedPayload(userAddress, modelId) {
  try {
    const c = await contractInstance(false);
    const b = await c.getEncryptedPayload(userAddress, Number(modelId));
    if (!b) return null;
    // normalize to 0x hex string
    if (typeof b === "string" && b.startsWith("0x")) return b;
    try {
      return ethers.hexlify(b);
    } catch {
      return null;
    }
  } catch (e) {
    console.warn("readEncryptedPayload failed", e?.message || e);
    return null;
  }
}

/* ----------------- send / tx helpers ----------------- */
export async function sendSetTestingMode(value) {
  const c = await contractInstance(true);
  return c.setTestingMode(Boolean(value));
}

export async function sendSetFHEVerifier(addr) {
  const c = await contractInstance(true);
  return c.setFHEVerifier(addr);
}

export async function sendSubmitEncryptedMetrics(user, modelId, bytesHex) {
  const c = await contractInstance(true);
  const b = bytesHex || "0x";
  return c.submitEncryptedMetrics(user, Number(modelId), b);
}

export async function sendSubmitDecryptedScore(user, modelId, handlesArray, score, proofBytes) {
  const c = await contractInstance(true);
  // ensure score is BigInt for ethers v6 if necessary
  const s = typeof score === "bigint" ? score : BigInt(Number(score || 0));
  return c.submitDecryptedScore(user, Number(modelId), handlesArray || [], s, proofBytes || "0x");
}

/* ----------------- utilities ----------------- */
export function toBytesLike(input) {
  if (input === undefined || input === null) return "0x";
  if (typeof input === "string") {
    const s = input.trim();
    if (s === "") return "0x";
    if (s.startsWith("0x")) return s;
    return ethers.hexlify(ethers.toUtf8Bytes(s));
  }
  try {
    return ethers.hexlify(input);
  } catch {
    throw new Error("Could not convert input to bytes-like");
  }
}

/**
 * parseHandlesCsv("abc,0x1234...,def")
 * returns array of bytes32 hex strings (0x + 64 hex chars)
 */
export function parseHandlesCsv(csv) {
  if (!csv) return [];
  return csv.split(",").map((s) => {
    const t = s.trim();
    if (!t) return "0x" + "0".repeat(64);
    if (t.startsWith("0x") && t.length === 66) return t;
    const b = ethers.toUtf8Bytes(t);
    let hex = ethers.hexlify(b).slice(2);
    if (hex.length > 64) hex = hex.slice(0, 64);
    while (hex.length < 64) hex += "00";
    return "0x" + hex;
  });
}
