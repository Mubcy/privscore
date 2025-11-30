import React, { useState } from "react";
import { ethers } from "ethers";
import { generateKeys, encryptMetrics } from "../utils/crypto";
import abiJson from "../abis/PrivScore.json";

export default function EncryptForm({ contractAddr }) {
  const [keys, setKeys] = useState(null);
  const [metrics, setMetrics] = useState({ income: 3000, onTimePayments: 12, debtRatio: 20 });
  const [status, setStatus] = useState("");

  async function connectWallet() {
    if (!window.ethereum) return alert("Install MetaMask");
    await window.ethereum.request({ method: "eth_requestAccounts" });
  }

  function onGenerate() {
    const k = generateKeys();
    setKeys(k);
    setStatus("Keys generated (simulated)");
  }

  async function onSubmitEncrypted() {
    setStatus("Submitting...");
    if (!window.ethereum) { setStatus("No web3"); return; }
    await connectWallet();
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddr, abiJson.abi, signer);

    const ciphertextBytes = encryptMetrics(keys?.publicKey, metrics);
    try {
      const tx = await contract.submitEncryptedMetrics(1, ciphertextBytes, "0x");
      setStatus("tx sent: " + tx.hash);
      await tx.wait();
      setStatus("Submitted and mined: " + tx.hash);
    } catch (e) {
      console.error(e);
      setStatus("Error: " + (e?.message || e));
    }
  }

  return (
    <div>
      <h3>Submit Private Metrics</h3>
      <div>
        <button onClick={onGenerate}>Generate Keys (simulated)</button>
        <div>Public: <code>{keys?.publicKey}</code></div>
      </div>

      <label>Income</label>
      <input type="number" value={metrics.income} onChange={(e)=>setMetrics({...metrics, income: +e.target.value})} />

      <label>On-time payments</label>
      <input type="number" value={metrics.onTimePayments} onChange={(e)=>setMetrics({...metrics, onTimePayments: +e.target.value})} />

      <label>Debt ratio (%)</label>
      <input type="number" value={metrics.debtRatio} onChange={(e)=>setMetrics({...metrics, debtRatio: +e.target.value})} />

      <div style={{marginTop:12}}>
        <button onClick={onSubmitEncrypted}>Encrypt & Submit</button>
      </div>
      <div style={{marginTop:8}}><small>Status: {status}</small></div>
    </div>
  );
}
