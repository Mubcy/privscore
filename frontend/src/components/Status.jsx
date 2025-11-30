// frontend/src/components/Status.jsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

function Dot({ ok }) {
  return (
    <span style={{
      display: "inline-block", width: 10, height: 10, borderRadius: 10,
      marginRight: 8, background: ok ? "#22c55e" : "#e11d48"
    }} />
  );
}

export default function Status({ contractAddr, workerAddress }) {
  const [rpcOk, setRpcOk] = useState(false);
  const [block, setBlock] = useState(null);
  const [contractOk, setContractOk] = useState(false);
  const [approved, setApproved] = useState(false);
  const RPC = "http://127.0.0.1:8545";

  useEffect(() => {
    let mounted = true;
    const provider = new ethers.JsonRpcProvider(RPC);

    async function refresh() {
      try {
        const bn = await provider.getBlockNumber();
        if (!mounted) return;
        setRpcOk(true);
        setBlock(bn);
      } catch {
        setRpcOk(false);
        setBlock(null);
      }

      try {
        const code = await provider.getCode(contractAddr);
        setContractOk(code && code !== "0x");
      } catch {
        setContractOk(false);
      }

      if (workerAddress) {
        try {
          const abi = require("../../artifacts/contracts/PrivScore.sol/PrivScore.json").abi;
          const c = new ethers.Contract(contractAddr, abi, provider);
          const ok = await c.approvedWorker(workerAddress);
          setApproved(Boolean(ok));
        } catch {
          setApproved(false);
        }
      } else {
        setApproved(false);
      }
    }

    refresh();
    const id = setInterval(refresh, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [contractAddr, workerAddress]);

  return (
    <div style={{display:"flex", gap:16, alignItems:"center", fontSize:12, color:"#374151"}}>
      <div style={{display:"flex", alignItems:"center"}}><Dot ok={rpcOk} />RPC {rpcOk ? `(block ${block})` : "(unreachable)"}</div>
      <div style={{display:"flex", alignItems:"center"}}><Dot ok={contractOk} />Contract {contractOk ? "deployed" : "no code"}</div>
      {workerAddress ? (
        <div style={{display:"flex", alignItems:"center"}}><Dot ok={approved} />Worker {approved ? "approved" : "not approved"} ({workerAddress.slice(0,8)}...)</div>
      ) : <div style={{display:"flex", alignItems:"center", color:"#999"}}>Worker address not set</div>}
    </div>
  );
}
