// frontend/src/App.jsx
import React, { useEffect, useState, useRef } from "react";
import { ethers } from "ethers";
import {
  getProviderAndSigner,
  getDeploymentAddress,
  readTestingMode,
  readOwner,
  readEncryptedPayload,
  sendSubmitEncryptedMetrics,
  sendSubmitDecryptedScore,
  sendSetFHEVerifier,
  sendSetTestingMode,
  toBytesLike,
  parseHandlesCsv,
} from "./services/privscore";
import "./index.css";

/* ---------- Small inline SVG logo ---------- */
function Logo({ size = 44 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: 6 }}
    >
      <rect width="48" height="48" rx="6" fill="#0b0b0b" />
      <text
        x="50%"
        y="52%"
        fill="#f9bb05"
        fontWeight="800"
        fontSize="14"
        textAnchor="middle"
        fontFamily="Inter, system-ui"
      >
        FHE
      </text>
    </svg>
  );
}

/* ---------- Helpers ---------- */
function short(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function etherscanBaseForChain(chainId) {
  const map = {
    1: "https://etherscan.io/tx/",
    5: "https://goerli.etherscan.io/tx/",
    11155111: "https://sepolia.etherscan.io/tx/",
    31337: null,
    1337: null,
  };
  return map[chainId] ?? null;
}

/* ---------- Main App ---------- */
export default function App() {
  // global UI state
  const [connected, setConnected] = useState(false);
  const [walletAddr, setWalletAddr] = useState(null);
  const [ownerAddr, setOwnerAddr] = useState(null);
  const [testingMode, setTestingModeState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [pendingTx, setPendingTx] = useState(null);
  const [lastTx, setLastTx] = useState(null);
  const [networkChainId, setNetworkChainId] = useState(null);

  // file upload for encrypted metrics
  const [encUser, setEncUser] = useState("");
  const [encModelId, setEncModelId] = useState("0");
  const [encPayloadText, setEncPayloadText] = useState("");
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // read payload
  const [readUser, setReadUser] = useState("");
  const [readModelId, setReadModelId] = useState("0");
  const [readPayloadResult, setReadPayloadResult] = useState(null);

  // decrypted score (main form)
  const [handlesCsv, setHandlesCsv] = useState("");
  const [scoreValue, setScoreValue] = useState("0");
  const [proof, setProof] = useState("");

  // owner tools
  const [fheAddr, setFheAddr] = useState("");

  // decrypt history
  const [scoreHistory, setScoreHistory] = useState([]);
  const [expandedProofIndex, setExpandedProofIndex] = useState(null);

  // modal: decrypt submission
  const [showDecryptModal, setShowDecryptModal] = useState(false);
  const [modalModelId, setModalModelId] = useState("0");
  const [modalHandle, setModalHandle] = useState("");
  const [modalScore, setModalScore] = useState("0");
  const [modalProofText, setModalProofText] = useState("");
  const modalFileRef = useRef(null);

  // modal: create survey (new)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createModelId, setCreateModelId] = useState("0");
  const [createPayloadHex, setCreatePayloadHex] = useState("");
  const createFileRef = useRef(null);
  const [createDrag, setCreateDrag] = useState(false);

  // CTA animation flag (brief)
  const [createSuccessAnim, setCreateSuccessAnim] = useState(false);

  // toast
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message, txHash, explorer }

  /* ---------- log helper ---------- */
  function pushLog(s) {
    setLogs((l) => [new Date().toLocaleTimeString() + " - " + s, ...l].slice(0, 80));
  }

  /* ---------- basic refresh ---------- */
  async function refresh() {
    setLoading(true);
    try {
      const { provider, signer } = await getProviderAndSigner();
      if (signer) {
        try {
          const addr = await signer.getAddress();
          setWalletAddr(addr);
          setConnected(true);
        } catch {
          setConnected(false);
          setWalletAddr(null);
        }
      } else {
        setConnected(false);
        setWalletAddr(null);
      }

      const own = await readOwner();
      setOwnerAddr(own);
      const tm = await readTestingMode();
      setTestingModeState(Boolean(tm));

      // network for explorer links
      try {
        const net = provider ? await provider.getNetwork() : null;
        setNetworkChainId(net?.chainId ?? null);
      } catch {
        setNetworkChainId(null);
      }
    } catch (e) {
      pushLog("refresh error: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  /* ---------- history from ScorePublished events ---------- */
  async function loadHistory() {
    try {
      const { provider } = await getProviderAndSigner();
      const addr = getDeploymentAddress();
      if (!addr) {
        setScoreHistory([]);
        return;
      }

      const abi = [
        "event ScorePublished(address indexed user, uint256 indexed modelId, uint256 score, bytes proof)",
      ];
      const iface = new ethers.Interface(abi);
      const topic0 = ethers.id("ScorePublished(address,uint256,uint256,bytes)");
      const logs = await provider.getLogs({
        address: addr,
        topics: [topic0],
        fromBlock: 0,
        toBlock: "latest",
      });

      const latest = logs.slice(-20).reverse();
      const entries = [];

      for (const log of latest) {
        try {
          const parsed = iface.parseLog(log);
          const args = parsed.args;
          entries.push({
            user: args.user,
            modelId: args.modelId.toString(),
            score: args.score.toString(),
            proofHex: ethers.hexlify(args.proof),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            // helpful id used for scrolling/highlight 'm{model}-u{first8}'
            createdId: `m${args.modelId.toString()}-u${(args.user || "").slice(2, 10)}`,
          });
        } catch (innerErr) {
          console.warn("could not parse log", innerErr);
        }
      }

      setScoreHistory(entries);
    } catch (e) {
      pushLog("loadHistory error: " + (e?.message || e));
    }
  }

  /* ---------- effects ---------- */
  useEffect(() => {
    refresh();
    loadHistory();
    const id = setInterval(() => {
      refresh();
      loadHistory();
    }, 12000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (lastTx && lastTx.type === "submitDecryptedScore" && lastTx.status === "success") {
      loadHistory();
    }
  }, [lastTx]);

  // auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000); // auto-dismiss after 6s
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- connect wallet ---------- */
  async function connectWallet() {
    try {
      const { signer } = await getProviderAndSigner();
      if (!signer) {
        alert("No wallet detected. Install MetaMask and connect to localhost:8545.");
        return;
      }
      const addr = await signer.getAddress();
      setWalletAddr(addr);
      setConnected(true);
      pushLog("Wallet connected: " + addr);
    } catch (e) {
      pushLog("connect wallet error: " + (e?.message || e));
    }
  }

  /* ---------- send & track tx helper ---------- */
  async function sendAndTrack(txPromise, label) {
    setLoading(true);
    try {
      const tx = await txPromise;
      setPendingTx({ hash: tx.hash, type: label });
      pushLog(`${label} tx sent: ${tx.hash}`);
      const receipt = await tx.wait();
      setPendingTx(null);
      setLastTx({
        hash: tx.hash,
        type: label,
        status: receipt.status === 1 ? "success" : "failed",
      });
      pushLog(`${label} mined: ${tx.hash}`);
      return receipt;
    } catch (e) {
      setPendingTx(null);
      setLastTx({
        hash: e?.transaction?.hash || null,
        type: label,
        status: "failed",
      });
      pushLog(`${label} failed: ${e?.message || e}`);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  /* ---------- encrypted metrics: file upload helpers ---------- */
  function onDropFile(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }
  function onDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave(e) {
    e.preventDefault();
    setDragOver(false);
  }
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }
  async function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target.result;
      const u8 = new Uint8Array(buffer);
      let hex = "0x";
      for (let i = 0; i < u8.length; i++) {
        hex += u8[i].toString(16).padStart(2, "0");
      }
      setEncPayloadText(hex);
      pushLog(`Loaded encrypted file "${file.name}" (${u8.length} bytes)`);
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------- encrypted metrics: submit ---------- */
  async function handleSubmitEncrypted() {
    try {
      const userAddr = encUser || walletAddr;
      if (!userAddr) throw new Error("User address required (or connect wallet).");
      const modelId = Number(encModelId);
      const payload =
        encPayloadText && encPayloadText.startsWith("0x") ? encPayloadText : toBytesLike(encPayloadText || "");
      pushLog(`sending submitEncryptedMetrics(user=${userAddr}, modelId=${modelId})`);
      const receipt = await sendAndTrack(sendSubmitEncryptedMetrics(userAddr, modelId, payload), "submitEncryptedMetrics");

      // success toast
      const txHash = receipt?.transactionHash ?? receipt?.transaction?.hash ?? null;
      const explorer = etherscanBaseForChain(networkChainId) ? etherscanBaseForChain(networkChainId) + txHash : null;
      setToast({ type: "success", message: `Encrypted payload stored for model ${modelId}`, txHash, explorer });
    } catch (e) {
      pushLog("submitEncrypted failed: " + (e?.message || e));
      setToast({ type: "error", message: "Submit encrypted failed: " + (e?.message || e), txHash: null, explorer: null });
    }
  }

  /* ---------- read encrypted payload ---------- */
  async function handleReadPayload() {
    try {
      const userAddr = readUser || walletAddr;
      const modelId = Number(readModelId);
      if (!userAddr) throw new Error("User address required");
      const b = await readEncryptedPayload(userAddr, modelId);
      const hex = b ? b : "0x";
      let text = "";
      try {
        text = new TextDecoder().decode(ethersToUint8Array(b));
      } catch {
        text = "<non-UTF8 or empty>";
      }
      setReadPayloadResult({ hex, text });
      pushLog(`readEncryptedPayload (${userAddr}, ${modelId})`);
    } catch (e) {
      pushLog("readEncryptedPayload failed: " + (e?.message || e));
      setReadPayloadResult(null);
    }
  }
  function ethersToUint8Array(b) {
    if (!b) return new Uint8Array();
    if (typeof b === "string" && b.startsWith("0x")) {
      const hex = b.slice(2);
      const arr = new Uint8Array(hex.length / 2);
      for (let i = 0; i < arr.length; i++) {
        arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return arr;
    }
    try {
      return new Uint8Array(b);
    } catch {
      return new Uint8Array();
    }
  }

  /* ---------- submit decrypted score (main form) ---------- */
  async function handleSubmitDecrypted() {
    try {
      const userAddr = encUser || walletAddr;
      if (!userAddr) throw new Error("User address required (or connect wallet).");
      const modelId = Number(encModelId || 0);
      const handles = parseHandlesCsv(handlesCsv);
      const score = Number(scoreValue);
      const proofBytes = toBytesLike(proof);
      pushLog(`sending submitDecryptedScore(user=${userAddr}, modelId=${modelId}, score=${score})`);
      await sendAndTrack(sendSubmitDecryptedScore(userAddr, modelId, handles, score, proofBytes), "submitDecryptedScore");
    } catch (e) {
      pushLog("submitDecryptedScore failed: " + (e?.message || e));
      setToast({ type: "error", message: "Submit decrypted failed: " + (e?.message || e), txHash: null, explorer: null });
    }
  }

  /* ---------- owner actions ---------- */
  async function handleSetFhe() {
    try {
      if (!fheAddr) throw new Error("Provide FHE verifier address");
      await sendAndTrack(sendSetFHEVerifier(fheAddr), "setFHEVerifier");
    } catch (e) {
      pushLog("setFHEVerifier failed: " + (e?.message || e));
      setToast({ type: "error", message: "setFHEVerifier failed: " + (e?.message || e), txHash: null, explorer: null });
    }
  }
  async function handleToggleTestingMode(value) {
    try {
      await sendAndTrack(sendSetTestingMode(value), "setTestingMode");
      await refresh();
    } catch (e) {
      pushLog("setTestingMode failed: " + (e?.message || e));
      setToast({ type: "error", message: "setTestingMode failed: " + (e?.message || e), txHash: null, explorer: null });
    }
  }

  const isOwner = walletAddr && ownerAddr && walletAddr.toLowerCase() === ownerAddr.toLowerCase();

  /* ---------- copy helpers ---------- */
  async function copyTxHash(hash) {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      pushLog("Copied tx hash to clipboard");
    } catch {
      pushLog("Copy failed");
    }
  }
  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      pushLog("Copied text");
    } catch {
      pushLog("Copy failed");
    }
  }

  /* ---------- modal: decrypt submission ---------- */
  function handleModalFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const buffer = ev.target.result;
        const u8 = new Uint8Array(buffer);
        let hex = "0x";
        for (let i = 0; i < u8.length; i++) {
          hex += u8[i].toString(16).padStart(2, "0");
        }
        setModalProofText(hex);
        pushLog(`Loaded proof file "${file.name}" (${u8.length} bytes) for modal`);
      };
      reader.readAsArrayBuffer(file);
    }
  }

  async function handleModalDecrypt(e) {
    e?.preventDefault();
    try {
      const userAddr = encUser || walletAddr;
      if (!userAddr) throw new Error("User address required (or connect wallet).");
      const modelId = Number(modalModelId || 0);
      const handles = parseHandlesCsv(modalHandle);
      const score = Number(modalScore);
      const proofBytes = toBytesLike(modalProofText);
      pushLog(`modal submitDecryptedScore(user=${userAddr}, modelId=${modelId}, score=${score})`);
      await sendAndTrack(sendSubmitDecryptedScore(userAddr, modelId, handles, score, proofBytes), "submitDecryptedScore");
      setShowDecryptModal(false);
    } catch (e2) {
      pushLog("modal submitDecryptedScore failed: " + (e2?.message || e2));
      setToast({ type: "error", message: "Modal decrypt failed: " + (e2?.message || e2), txHash: null, explorer: null });
    }
  }

  /* ---------- Create modal helpers (new) ---------- */
  function handleCreateDrop(e) {
    e.preventDefault();
    setCreateDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) readCreateFile(f);
  }
  function handleCreateDragOver(e) {
    e.preventDefault();
    setCreateDrag(true);
  }
  function handleCreateDragLeave(e) {
    e.preventDefault();
    setCreateDrag(false);
  }
  function handleCreateFileSelect(e) {
    const f = e.target.files?.[0];
    if (f) readCreateFile(f);
  }
  function readCreateFile(file) {
    const r = new FileReader();
    r.onload = (ev) => {
      const buffer = ev.target.result;
      const u8 = new Uint8Array(buffer);
      let hex = "0x";
      for (let i = 0; i < u8.length; i++) hex += u8[i].toString(16).padStart(2, "0");
      setCreatePayloadHex(hex);
      pushLog(`Loaded survey payload file "${file.name}" (${u8.length} bytes)`);
    };
    r.readAsArrayBuffer(file);
  }

  async function handleCreateSubmit(e) {
    e?.preventDefault();
    try {
      const userAddr = encUser || walletAddr;
      if (!userAddr) throw new Error("User address required (connect wallet).");
      const modelId = Number(createModelId || 0);

      // prefer uploaded file payload, fallback to description text
      const payload = createPayloadHex && createPayloadHex.startsWith("0x")
        ? createPayloadHex
        : (createDesc ? toBytesLike(createDesc) : "0x");

      pushLog(`Create survey: title="${createTitle}" descLen=${(createDesc||"").length} payload=${payload && payload !== "0x" ? "yes" : "no"}`);
      // call submitEncryptedMetrics to store survey payload on-chain
      const receipt = await sendAndTrack(sendSubmitEncryptedMetrics(userAddr, modelId, payload), "createSurvey");

      // parse receipt logs for MetricsSubmitted event (if emitted)
      const createdDetails = { modelId: null, user: null, createdId: null };
      try {
        const iface = new ethers.Interface([
          "event MetricsSubmitted(address indexed user, uint256 indexed modelId, bytes encPayload)",
        ]);
        const deployedAddr = getDeploymentAddress()?.toLowerCase();
        for (const lg of receipt.logs || []) {
          if (!lg.address) continue;
          if (deployedAddr && lg.address.toLowerCase() !== deployedAddr) continue;
          try {
            const parsed = iface.parseLog(lg);
            const args = parsed.args;
            createdDetails.modelId = args.modelId?.toString?.() ?? null;
            createdDetails.user = args.user ?? null;
            createdDetails.createdId = `m${createdDetails.modelId}-u${(createdDetails.user || "").slice(2, 10)}`;
            break;
          } catch {
            // ignore non-matching logs
          }
        }
      } catch (e) {
        // ignore parse errors
      }

      // show toast on success with explorer link
      const txHash = receipt?.transactionHash ?? receipt?.transaction?.hash ?? null;
      const explorer = etherscanBaseForChain(networkChainId) ? etherscanBaseForChain(networkChainId) + txHash : null;
      let msg = `Survey created ${createTitle ? `("${createTitle}") ` : ""}`;
      if (createdDetails.modelId !== null) msg += `model ${createdDetails.modelId}`;
      if (createdDetails.user) msg += ` — user ${short(createdDetails.user)}`;
      setToast({ type: "success", message: msg + (txHash ? ` — tx ${short(txHash)}` : ""), txHash, explorer });

      // play tiny success animation on CTA
      setCreateSuccessAnim(true);
      setTimeout(() => setCreateSuccessAnim(false), 900);

      setShowCreateModal(false);

      // refresh and load history, then try to auto-scroll to created record
      await refresh();
      await loadHistory();

      if (createdDetails.createdId) {
        // slight delay to ensure render
        setTimeout(() => {
          const el = document.querySelector(`[data-created="${createdDetails.createdId}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            // add highlight class for a moment
            el.classList.add("history-highlight");
            setTimeout(() => el.classList.remove("history-highlight"), 1800);
          }
        }, 300);
      }
    } catch (err) {
      pushLog("createSurvey failed: " + (err?.message || err));
      setToast({ type: "error", message: "Create failed: " + (err?.message || err), txHash: null, explorer: null });
    }
  }

  /* ---------- JSX ---------- */
  return (
    <div className="app-shell">
      {/* HEADER */}
      <header className="header">
        <div className="brand" style={{ gap: 14 }}>
          <Logo />
          <div>
            <h1 style={{ margin: 0, fontSize: 18 }}>PrivScore</h1>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              Decrypt & publish confidential survey scores
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="contract-pill">
            Contract: <span className="mono">{short(getDeploymentAddress())}</span>
          </div>

          <button className={`connect-btn ${connected ? "connected" : ""}`} onClick={connectWallet}>
            {connected ? short(walletAddr) : "Connect Wallet"}
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="hero hero-yellow" id="hero">
        <div className="hero-inner hero-yellow-inner">
          <div className="hero-banner">
            <h2>Decrypt Confidential Survey Results</h2>
          </div>

          <p className="hero-sub">
            Use PrivScore to decrypt and publish survey scores while keeping raw answers
            encrypted end-to-end. Owners can publish aggregated results without ever seeing
            individual responses.
          </p>

          <div className="hero-ctas">
            <button
              className={`cta primary ${createSuccessAnim ? "cta-success" : ""}`}
              onClick={() => setShowCreateModal(true)}
            >
              Launch a Confidential Survey
            </button>
            <button className="cta ghost" onClick={() => setShowDecryptModal(true)}>
              Decrypt Next Submission →
            </button>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <main className="container">
        {/* LEFT COLUMN */}
        <div>
          {/* Account & tx status */}
          <div className="card" style={{ marginBottom: 18 }}>
            <h3>Account & Contract</h3>
            <p>
              Wallet: <b>{connected ? short(walletAddr) : "not connected"}</b>
            </p>
            <p>
              Owner: <b>{ownerAddr ? short(ownerAddr) : "unknown"}</b>
            </p>
            <p>
              testingMode: <b>{testingMode === null ? "unknown" : testingMode.toString()}</b>
            </p>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => handleToggleTestingMode(true)} disabled={loading}>
                Testing ON
              </button>
              <button className="btn secondary" onClick={() => handleToggleTestingMode(false)} disabled={loading}>
                Testing OFF
              </button>
            </div>

            <div className="tx-status">
              {pendingTx && (
                <>
                  <div className="spinner" />
                  <div className="tx-pill">{pendingTx.type} pending</div>
                </>
              )}
              {!pendingTx && lastTx && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div className="tx-pill">
                    {lastTx.type} {lastTx.status}
                  </div>
                  {lastTx.hash && (
                    <>
                      <div style={{ fontSize: 13 }}>
                        <code style={{ wordBreak: "break-all" }}>{lastTx.hash}</code>
                      </div>
                      <button className="btn ghost" onClick={() => copyTxHash(lastTx.hash)} style={{ marginLeft: 4 }}>
                        Copy
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Submit encrypted metrics */}
          <div className="card" style={{ marginBottom: 18 }}>
            <h3>Submit Encrypted Metrics</h3>
            <div style={{ marginBottom: 8, color: "#666" }}>
              Upload an encrypted blob (preferred) or paste hex/text. This calls <code>submitEncryptedMetrics</code>.
            </div>

            <div
              onDrop={onDropFile}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={`dropzone ${dragOver ? "drag" : ""}`}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileSelect} />
              <div className="droptext">Drag & drop a file here or click to choose — its bytes will be sent as <code>bytes</code>.</div>
            </div>

            <label>User address (optional, uses wallet if empty)</label>
            <input value={encUser} onChange={(e) => setEncUser(e.target.value)} placeholder="0x..." />

            <label style={{ marginTop: 8 }}>Model ID</label>
            <input value={encModelId} onChange={(e) => setEncModelId(e.target.value)} />

            <label style={{ marginTop: 8 }}>Encrypted payload (hex 0x... or text; overridden by file)</label>
            <textarea rows={3} value={encPayloadText} onChange={(e) => setEncPayloadText(e.target.value)} placeholder="0x..." />

            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={handleSubmitEncrypted} disabled={loading}>
                Submit Encrypted Metrics
              </button>
            </div>
          </div>

          {/* Publish decrypted score (manual form) */}
          <div className="card" style={{ marginBottom: 18 }}>
            <h3>Publish Decrypted Score</h3>
            <div style={{ marginBottom: 8, color: "#666" }}>
              Calls <code>submitDecryptedScore</code> directly — use this for quick manual testing.
            </div>

            <label>Handles (comma-separated strings or 0x hex)</label>
            <input value={handlesCsv} onChange={(e) => setHandlesCsv(e.target.value)} placeholder="handle1,handle2" />

            <label style={{ marginTop: 8 }}>Score (uint256)</label>
            <input value={scoreValue} onChange={(e) => setScoreValue(e.target.value)} />

            <label style={{ marginTop: 8 }}>Proof (hex 0x... or text)</label>
            <textarea rows={3} value={proof} onChange={(e) => setProof(e.target.value)} />

            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={handleSubmitDecrypted} disabled={loading}>
                Submit Decrypted Score
              </button>
            </div>
          </div>

          {/* Decrypted score history */}
          <div className="card">
            <h3>Decrypted Score History</h3>
            {scoreHistory.length === 0 ? (
              <div style={{ color: "#666", fontSize: 14 }}>No <code>ScorePublished</code> events found yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {scoreHistory.map((h, idx) => {
                  const proofShort = h.proofHex.length > 20 ? h.proofHex.slice(0, 14) + "..." + h.proofHex.slice(-8) : h.proofHex;
                  return (
                    <div
                      key={h.txHash + idx}
                      className="history-row"
                      data-created={h.createdId || ""}
                      data-model={h.modelId}
                    >
                      <div style={{ fontSize: 13 }}>
                        <b>Model {h.modelId}</b> — score <b>{h.score}</b>{" "}
                        <span style={{ color: "#666" }}>(user {short(h.user)} · block {h.blockNumber})</span>
                      </div>

                      <div className="history-actions">
                        <button className="btn ghost" onClick={() => copyTxHash(h.txHash)}>Copy tx</button>
                        <button className="btn ghost" onClick={() => setExpandedProofIndex(expandedProofIndex === idx ? null : idx)}>
                          {expandedProofIndex === idx ? "Hide proof" : "View proof"}
                        </button>
                        <span style={{ fontSize: 12, color: "#666" }}>proof: {proofShort}</span>
                      </div>

                      {expandedProofIndex === idx && (
                        <div className="proof-box">
                          {h.proofHex}
                          <div style={{ marginTop: 6 }}>
                            <button className="btn ghost" onClick={() => copyText(h.proofHex)}>Copy proof</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (aside) */}
        <aside>
          {/* Owner tools */}
          <div className="card" style={{ marginBottom: 18 }}>
            <h3>Owner Tools</h3>
            {isOwner ? (
              <>
                <label>FHE verifier address</label>
                <input value={fheAddr} onChange={(e) => setFheAddr(e.target.value)} placeholder="0x..." />
                <div style={{ marginTop: 10 }}>
                  <button className="btn" onClick={handleSetFhe} disabled={loading}>Set FHE Verifier</button>
                </div>
              </>
            ) : (
              <div style={{ color: "#666", fontSize: 14 }}>Owner tools hidden — connect the owner account to access.</div>
            )}
          </div>

          {/* Read encrypted payload */}
          <div className="card" style={{ marginBottom: 18 }}>
            <h3>Read Stored Encrypted Payload</h3>
            <label>User (optional, default wallet)</label>
            <input value={readUser} onChange={(e) => setReadUser(e.target.value)} placeholder="0x..." />
            <label style={{ marginTop: 8 }}>Model ID</label>
            <input value={readModelId} onChange={(e) => setReadModelId(e.target.value)} />
            <div style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={handleReadPayload} disabled={loading}>Get Encrypted Payload</button>
            </div>
            {readPayloadResult && (
              <>
                <div className="payload-box"><b>Hex</b><div className="payload-value">{readPayloadResult.hex}</div></div>
                <div className="payload-box"><b>UTF-8 preview</b><div className="payload-value">{readPayloadResult.text}</div></div>
              </>
            )}
          </div>

          {/* Logs */}
          <div className="card">
            <h3>Logs</h3>
            <div className="logs">
              {logs.map((l, i) => (
                <div key={i}><small>{l}</small></div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* MODAL: Decrypt submission */}
      {showDecryptModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2 style={{ marginTop: 0 }}>Decrypt & Publish a Survey Score</h2>
            <form onSubmit={handleModalDecrypt}>
              <label>Model ID</label>
              <input value={modalModelId} onChange={(e) => setModalModelId(e.target.value)} />

              <label style={{ marginTop: 8 }}>Submission handle(s)</label>
              <input value={modalHandle} onChange={(e) => setModalHandle(e.target.value)} placeholder="handle123" />

              <label style={{ marginTop: 8 }}>Score (uint256)</label>
              <input value={modalScore} onChange={(e) => setModalScore(e.target.value)} />

              <label style={{ marginTop: 8 }}>Proof (hex or text)</label>
              <textarea rows={3} value={modalProofText} onChange={(e) => setModalProofText(e.target.value)} />

              <div style={{ marginTop: 8 }}>
                <input ref={modalFileRef} type="file" style={{ display: "none" }} onChange={handleModalFileSelect} />
                <button type="button" className="btn ghost" onClick={() => modalFileRef.current?.click()}>Upload proof file</button>
                <span style={{ fontSize: 12, color: "#666", marginLeft: 6 }}>File bytes will override the textarea.</span>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn ghost" onClick={() => setShowDecryptModal(false)}>Cancel</button>
                <button className="btn" type="submit" disabled={loading}>Decrypt & publish</button>
              </div>
            </form>

            <div style={{ marginTop: 10, color: "#666", fontSize: 13 }}>
              This flow calls <code>submitDecryptedScore</code> using the connected wallet.
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create survey (new) */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2 style={{ marginTop: 0 }}>Launch a Confidential Survey</h2>
            <form onSubmit={handleCreateSubmit}>
              <label>Title</label>
              <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Survey title" />

              <label style={{ marginTop: 8 }}>Short description (optional)</label>
              <textarea rows={3} value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="What is this survey about?" />

              <label style={{ marginTop: 8 }}>Model ID (on-chain)</label>
              <input value={createModelId} onChange={(e) => setCreateModelId(e.target.value)} placeholder="0" />

              <label style={{ marginTop: 8 }}>Upload survey payload (optional)</label>
              <div
                onDrop={handleCreateDrop}
                onDragOver={handleCreateDragOver}
                onDragLeave={handleCreateDragLeave}
                className={`dropzone ${createDrag ? "drag" : ""}`}
                onClick={() => createFileRef.current?.click()}
              >
                <input ref={createFileRef} type="file" style={{ display: "none" }} onChange={handleCreateFileSelect} />
                <div className="droptext">Drag & drop a file here or click to choose — its bytes will be uploaded as the encrypted payload.</div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button className="btn" type="submit" disabled={loading}>Create Survey</button>
              </div>
            </form>

            <div style={{ marginTop: 10, color: "#666", fontSize: 13 }}>
              The survey payload will be stored on-chain via <code>submitEncryptedMetrics</code>. You can upload an encrypted file or use the description as payload.
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`toast ${toast.type === "error" ? "error" : "success"}`} role="status" aria-live="polite">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>{toast.type === "error" ? "Error" : "Success"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {toast.txHash && (
                <button className="btn ghost" onClick={() => copyTxHash(toast.txHash)}>Copy</button>
              )}
              {toast.explorer && (
                <a className="btn ghost" href={toast.explorer} target="_blank" rel="noreferrer">Explorer</a>
              )}
              <button className="btn" onClick={() => setToast(null)}>Close</button>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>{toast.message}</div>
        </div>
      )}
    </div>
  );
}
