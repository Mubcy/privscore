// frontend/src/contract.js
import artifact from "./artifacts/PrivScore.json";
import deployments from "./deployments/local.json";
import { ethers } from "ethers";

const LOCAL_RPC = "http://127.0.0.1:8545"; // hardhat node

export function getLocalProvider() {
  return new ethers.providers.JsonRpcProvider(LOCAL_RPC);
}

// returns a contract connected to the provider or signer
export async function getContract(providerOrSigner) {
  const address = deployments.PrivScore;
  return new ethers.Contract(address, artifact.abi, providerOrSigner);
}

// returns an ethers provider and signer if MetaMask available.
// If no wallet, returns a JsonRpcProvider for read-only access.
export async function getProviderAndSigner() {
  if (typeof window !== "undefined" && window.ethereum) {
    // ethers v6: BrowserProvider
    const provider = new ethers.BrowserProvider(window.ethereum);
    try {
      await provider.send("eth_requestAccounts", []);
    } catch (e) {
      // user may have rejected
    }
    const signer = await provider.getSigner();
    return { provider, signer };
  } else {
    const provider = getLocalProvider();
    return { provider, signer: null };
  }
}
