// frontend/src/components/RevealButton.jsx
import React, { useState } from "react";
import { ethers } from "ethers";
import { publicDecryptAndSubmitFrontend } from "../zamaRelayer";

export default function RevealButton({ modelId }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onReveal() {
    try {
      setBusy(true);
      setMsg("Connecting wallet...");
      if (!window.ethereum) throw new Error("No wallet found");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddr = await signer.getAddress();
      setMsg("Calling relayer...");
      const res = await publicDecryptAndSubmitFrontend({ signer, userAddr, modelId });
      setMsg(`Submitted tx ${res.txHash} (block ${res.block})`);
    } catch (e) {
      console.error(e);
      setMsg("Error: " + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={onReveal} disabled={busy}>
        {busy ? "Working..." : "Reveal my score"}
      </button>
      <div style={{ marginTop: 8 }}>{msg}</div>
    </div>
  );
}
