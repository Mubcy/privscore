// frontend/src/zamaRelayer.js
import { Relayer } from "@zama-fhe/relayer-sdk";
import { ethers } from "ethers";
import abiJson from "../abis/PrivScore.json"; // create this by copying artifacts->PrivScore.json into frontend/src/abis/

const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || "https://relayer.zama.ai";
const CONTRACT_ADDR = import.meta.env.VITE_CONTRACT_ADDR;

export async function publicDecryptAndSubmitFrontend({ signer, userAddr, modelId }) {
  if (!signer) throw new Error("Signer required");
  const provider = signer.provider ?? new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(CONTRACT_ADDR, abiJson.abi, provider);

  // fetch encrypted payload from chain
  const enc = await contract.getEncryptedPayload(userAddr, modelId);
  console.log("On-chain enc payload:", enc);

  const relayer = new Relayer({ baseUrl: RELAYER_URL });

  // Call relayer.publicDecrypt — shape varies, so be tolerant
  const pd = await relayer.publicDecrypt({ handle: enc }).catch((e) => {
    console.warn("publicDecrypt(handle) failed, trying handles array", e?.message);
    return relayer.publicDecrypt({ handles: [enc] });
  });

  console.log("Relayer result:", pd);

  // normalize
  const handles = pd.handles ?? pd.handlesList ?? pd.handlesArray ?? (pd.handle ? [pd.handle] : null);
  const proof = pd.proof ?? pd.decryptionProof ?? pd.signature ?? null;
  let value = pd.value ?? pd.clearValue ?? pd.clearValues ?? pd.result ?? null;

  // try decode value if it's bytes / hex
  if (typeof value === "string" && value.startsWith("0x")) {
    try {
      // try decode uint256
      value = BigInt(value);
    } catch {
      try {
        value = BigInt(ethers.toUtf8Bytes(value));
      } catch {
        // leave as-is
      }
    }
  }

  if (!handles || !proof) {
    console.error("Relayer response missing handles/proof", pd);
    throw new Error("Relayer response invalid; see console");
  }

  const contractWithSigner = new ethers.Contract(CONTRACT_ADDR, abiJson.abi, signer);
  const numericValue = BigInt(value?.toString?.() ?? value ?? 0);
  const tx = await contractWithSigner.submitDecryptedScore(userAddr, modelId, handles, numericValue, proof);
  const receipt = await tx.wait();
  return { txHash: tx.hash, block: receipt.blockNumber };
}
