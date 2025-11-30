// scripts/setTestingModeCli_retry.js
const hre = require("hardhat");

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function main(){
  const addr = process.env.CONTRACT_ADDR;
  if(!addr) throw new Error("Set CONTRACT_ADDR env var first");
  const arg = process.argv[2];
  if(!arg) throw new Error("Provide 'true' or 'false' as first arg");
  const value = arg.toLowerCase() === "true";

  const [signer] = await hre.ethers.getSigners();
  console.log("Using signer:", signer.address, "->", addr, "setting testingMode ->", value);

  const code = await hre.ethers.provider.getCode(addr);
  console.log("code length bytes =", code === "0x" ? 0 : (code.length - 2)/2);

  const contract = await hre.ethers.getContractAt("PrivScore", addr, signer);
  const tx = await contract.setTestingMode(value);
  console.log("tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("tx mined, status:", receipt.status, "blockNumber:", receipt.blockNumber);

  // now try to read testingMode, retry a few times if empty
  const artifact = await hre.artifacts.readArtifact("PrivScore");
  const iface = new hre.ethers.Interface(artifact.abi);
  const callData = iface.encodeFunctionData("testingMode", []);
  let raw = null;
  for(let i=0;i<10;i++){
    raw = await hre.ethers.provider.call({ to: addr, data: callData });
    console.log(`read attempt ${i+1}, raw:`, raw);
    if(raw && raw !== "0x") break;
    await sleep(300); // wait 300ms then retry
  }

  if(!raw || raw === "0x"){
    console.error("reading testingMode failed: raw is empty after retries. Possible ABI mismatch or node state issue.");
    return;
  }

  try {
    const decoded = iface.decodeFunctionResult("testingMode", raw);
    console.log("testingMode (decoded) =", decoded[0]);
  } catch(e){
    console.error("decode failed:", e.message);
    console.log("raw:", raw);
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
