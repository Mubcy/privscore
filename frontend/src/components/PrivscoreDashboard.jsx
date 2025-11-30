// frontend/src/components/PrivscoreDashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { ethers } from "ethers";
import abiJson from "../abis/PrivScore.json";

/**
 * PrivscoreDashboard (patched)
 *
 * - Sends relayer request as { contract, user, modelId, testFilePath }
 * - Normalizes relayer response shapes and attempts submitDecryptedScore(...)
 *
 * Environment:
 *  VITE_CONTRACT_ADDR
 *  VITE_RPC_URL (optional)
 *  VITE_RELAYER_URL (primary relayer/proxy)
 *  VITE_LOCAL_RELAYER_URL (fallback local relayer)
 *
 * NOTE: If your on-chain contract calls FHE.checkSignatures() then
 * the relayer MUST return a real proof (mock proofs will revert).
 */

export default function PrivscoreDashboard() {
  const CONTRACT_ADDR = import.meta.env.VITE_CONTRACT_ADDR;
  const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";
  const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || "http://localhost:3000";
  const LOCAL_RELAYER_URL = import.meta.env.VITE_LOCAL_RELAYER_URL || "http://localhost:3000";

  // test file path (uploaded test image)
  const TEST_FILE_PATH = "/mnt/data/b5bd0e5d-a9c7-4f5a-9b5b-0e0869ea5c98.png";

  const [watchAddr, setWatchAddr] = useState("");
  const [scores, setScores] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);
  const [connectedAddr, setConnectedAddr] = useState(null);
  const [isRevealing, setIsRevealing] = useState(false);

  const providerRef = useRef(null);
  const contractRef = useRef(null);

  function normalizeRelayerResp(pd) {
    if (!pd) return {};
    const handles =
      pd.handles ?? pd.handlesList ?? pd.handlesArray ?? (pd.handle ? [pd.handle] : null) ?? [];
    const proof = pd.proof ?? pd.decryptionProof ?? pd.signature ?? null;
    let value = pd.value ?? pd.clearValue ?? pd.clearValues ?? pd.result ?? pd.resultValue ?? null;

    // convert hex string value -> number if appropriate
    if (typeof value === "string" && value.startsWith("0x")) {
      try {
        // try numeric decode
        const bn = ethers.BigInt(value);
        value = Number(bn);
      } catch {
        // try utf8 decode
        try {
          value = ethers.toUtf8String(value);
        } catch {
          // leave as string
        }
      }
    }
    // if array with one element -> single
    if (Array.isArray(value) && value.length === 1) value = value[0];
    return { handles, proof, value };
  }

  useEffect(() => {
    providerRef.current = new ethers.BrowserProvider(window.ethereum ?? new ethers.JsonRpcProvider(RPC_URL));
    if (!CONTRACT_ADDR) {
      setError("VITE_CONTRACT_ADDR is not set (frontend/.env).");
      return;
    }
    try {
      contractRef.current = new ethers.Contract(CONTRACT_ADDR, abiJson.abi, providerRef.current);
    } catch (e) {
      setError("Failed to create contract: " + (e?.message ?? e));
    }

    // listen for ScorePublished and update UI live
    const c = contractRef.current;
    if (c && c.on) {
      const onScore = (user, modelId, score, proof, ev) => {
        try {
          const s = {
            user: String(user),
            modelId: modelId?.toString?.() ?? String(modelId),
            score: score?.toString?.() ?? String(score),
            proof,
            tx: ev?.transactionHash ?? null,
            block: ev?.blockNumber ?? null,
            timestamp: Date.now(),
          };
          setScores((prev) => {
            if (s.tx && prev.some((p) => p.tx === s.tx)) return prev;
            return [s, ...prev];
          });
        } catch (err) {
          console.error("ScorePublished parse error:", err);
        }
      };
      try {
        c.on("ScorePublished", onScore);
      } catch (e) {
        console.warn("Could not attach ScorePublished listener:", e?.message ?? e);
      }
      return () => {
        try {
          c.off("ScorePublished", onScore);
        } catch {}
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectWallet() {
    setError(null);
    try {
      if (!window.ethereum) throw new Error("No wallet (window.ethereum) found.");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setConnectedAddr(addr);
      providerRef.current = provider;
      contractRef.current = new ethers.Contract(CONTRACT_ADDR, abiJson.abi, provider);
      setStatus("Wallet connected: " + addr);
    } catch (e) {
      console.error(e);
      setError("Wallet connect failed: " + (e?.message ?? e));
    }
  }

  async function fetchScoresNow(addr) {
    setError(null);
    setStatus("Fetching on-chain ScorePublished logs...");
    if (!contractRef.current) {
      setError("Contract not ready.");
      return;
    }
    try {
      const provider = providerRef.current ?? new ethers.JsonRpcProvider(RPC_URL);
      const iface = new ethers.Interface(abiJson.abi);
      const logs = await provider.getLogs({ address: CONTRACT_ADDR, fromBlock: 0, toBlock: "latest" });
      const parsed = [];
      for (const l of logs) {
        try {
          const ev = iface.parseLog(l);
          if (ev.name === "ScorePublished") {
            const args = ev.args;
            const userArg = String(args[0]).toLowerCase();
            if (!addr || userArg === addr.toLowerCase()) {
              parsed.push({
                user: userArg,
                modelId: args[1]?.toString?.() ?? String(args[1]),
                score: args[2]?.toString?.() ?? String(args[2]),
                proof: args[3],
                tx: l.transactionHash,
                block: l.blockNumber,
                timestamp: Date.now(),
              });
            }
          }
        } catch {}
      }
      setScores(parsed);
      setStatus(`Found ${parsed.length} score(s).`);
    } catch (e) {
      console.error(e);
      setError("Failed to fetch logs: " + (e?.message ?? e));
      setStatus("");
    }
  }

  // call relayer (tries primary then fallback)
  async function callRelayerWithContract(userAddr, modelId) {
    const tryUrls = [RELAYER_URL, LOCAL_RELAYER_URL].filter(Boolean);
    let lastErr = null;
    for (const base of tryUrls) {
      try {
        const url = base.replace(/\/$/, "") + "/public-decrypt";
        setStatus(`Calling relayer: ${url}`);
        const body = {
          contract: CONTRACT_ADDR,
          user: userAddr,
          modelId,
          // include our uploaded test image so relayer can produce deterministic output
          testFilePath: TEST_FILE_PATH,
        };
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Relayer ${url} returned ${res.status}: ${txt}`);
        }
        const json = await res.json();
        return json;
      } catch (e) {
        lastErr = e;
        console.warn("Relayer call failed for", base, e?.message ?? e);
      }
    }
    throw lastErr ?? new Error("Relayer calls failed");
  }

  // Reveal flow: fetch enc payload from chain, call relayer, submit decrypted score
  async function revealScore(modelId = 1) {
    setError(null);
    setIsRevealing(true);
    setStatus("Preparing reveal...");
    try {
      if (!window.ethereum) {
        setStatus("No wallet available — reveal requires signer (MetaMask).");
        throw new Error("No wallet (MetaMask) available for signing.");
      }
      // ensure signer is available
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const userAddr = await signer.getAddress();

      setStatus("Fetching encrypted payload from contract...");
      const provider = providerRef.current ?? new ethers.JsonRpcProvider(RPC_URL);
      const c = contractRef.current ?? new ethers.Contract(CONTRACT_ADDR, abiJson.abi, provider);

      // getEncryptedPayload may throw if view returns empty; handle gracefully
      let enc = "0x";
      try {
        enc = await c.getEncryptedPayload(userAddr, modelId);
      } catch (e) {
        console.warn("getEncryptedPayload call error (continuing):", e?.message ?? e);
      }

      if (!enc || enc === "0x") {
        throw new Error(
          `Encrypted payload empty for user ${userAddr}, model ${modelId}. Ensure the worker published and contract address is correct.`
        );
      }

      setStatus("Encrypted payload fetched. Calling relayer...");
      const pd = await callRelayerWithContract(userAddr, modelId);
      setStatus("Relayer returned result. Normalizing...");

      const { handles, proof, value } = normalizeRelayerResp(pd);
      if (!handles || !Array.isArray(handles) || handles.length === 0) {
        throw new Error("Relayer response missing handles (cannot publish).");
      }

      // ensure numeric value
      let numericValue;
      if (typeof value === "bigint") numericValue = value;
      else if (typeof value === "string" && value.match(/^\d+$/)) numericValue = BigInt(value);
      else if (typeof value === "number") numericValue = BigInt(Math.floor(value));
      else {
        const maybe = Number(value);
        numericValue = BigInt(Math.floor(maybe || 0));
      }

      setStatus("Submitting decrypted score on-chain...");
      const contractWithSigner = contractRef.current.connect(signer);
      const tx = await contractWithSigner.submitDecryptedScore(userAddr, modelId, handles, numericValue, proof ?? "0x");
      setStatus("Transaction sent: " + tx.hash);
      const receipt = await tx.wait();
      setStatus("Decrypted score submitted in block " + receipt.blockNumber);
      // ScorePublished listener will update UI
    } catch (e) {
      console.error("Reveal failed:", e);
      setError("Reveal failed: " + (e?.message ?? e));
      setStatus("");
    } finally {
      setIsRevealing(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      <h2>PrivScore — Demo</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input
          placeholder="0x... (user address to watch)"
          value={watchAddr}
          onChange={(e) => setWatchAddr(e.target.value)}
          style={{ flex: 1, padding: 10, borderRadius: 6 }}
        />
        <button onClick={() => fetchScoresNow(watchAddr)} style={{ padding: "8px 14px" }}>
          Fetch Scores Now
        </button>

        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 12 }}>
            Contract: <code style={{ fontSize: 12 }}>{CONTRACT_ADDR}</code>
          </div>
          <div style={{ fontSize: 12, color: connectedAddr ? "green" : "orange" }}>
            {connectedAddr ? `Connected: ${connectedAddr}` : "Wallet not connected"}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <button onClick={connectWallet} style={{ marginRight: 8 }}>
          Connect Wallet
        </button>

        <button onClick={() => revealScore(1)} disabled={isRevealing}>
          {isRevealing ? "Revealing..." : "Reveal my score (modelId=1)"}
        </button>

        <div style={{ marginTop: 8, color: "gray", fontSize: 13 }}>{status || "No status"}</div>
        {error && (
          <div style={{ marginTop: 6, color: "crimson" }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      <div>
        <h4>Scores</h4>
        {scores.length === 0 && <div>No scores yet</div>}
        {scores.map((s, i) => (
          <div
            key={s.tx ?? i}
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#fafafa",
              marginBottom: 10,
              boxShadow: "0 0 0 1px rgba(0,0,0,0.03)",
            }}
          >
            <div>
              <strong>ModelId:</strong> {s.modelId}
            </div>
            <div>
              <strong>Score:</strong> {s.score}
            </div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
              Tx: <code style={{ fontSize: 12 }}>{s.tx}</code>
            </div>
            <div style={{ fontSize: 12, color: "#777" }}>
              Block: {s.block} • {new Date(s.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
