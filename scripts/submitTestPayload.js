// scripts/submitTestPayload.js
// Run with:
// npx hardhat run --network localhost scripts/submitTestPayload.js

async function tryCall(contract, fnName, args) {
  if (typeof contract[fnName] === "function") {
    console.log(`Trying function: ${fnName}()`);
    const tx = await contract[fnName](...args);
    console.log(`> Sent tx for ${fnName}:`, tx.hash || tx.transactionHash || tx);
    const receipt = await tx.wait();
    console.log(`> Mined (receipt):`, receipt.transactionHash || receipt.transactionHash);
    return true;
  } else {
    console.log(`Function ${fnName}() not in ABI (skipping).`);
    return false;
  }
}

async function main() {
  const hre = require("hardhat");
  const ethers = hre.ethers;

  // Replace this with your deployed contract address if different
  const CONTRACT_ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const [sender] = await ethers.getSigners();
  console.log("Using signer:", sender.address);

  // get contract instance using artifact name "PrivScore"
  // Ensure the artifact exists: artifacts/contracts/PrivScore.sol/PrivScore.json
  const contract = await ethers.getContractAt("PrivScore", CONTRACT_ADDR);
  console.log("Connected to contract at:", CONTRACT_ADDR);

  // Build a test encrypted payload (small hex blob)
  const payload = "0x" + Buffer.from("test-encrypted-payload").toString("hex");
  const modelId = 1; // use model 1 (match your demo)
  const userAddress = sender.address; // publish for this user

  console.log("Test payload:", payload);
  console.log("ModelId:", modelId, "User:", userAddress);

  // Try a list of common function names used by similar demos
  // The expected signatures tried below are either:
  //  - fn(user, modelId, payload)
  //  - fn(modelId, user, payload)
  //  - fn(payload) etc.
  const tries = [
    { name: "submitEncryptedInput", args: [userAddress, modelId, payload] },
    { name: "submitEncryptedPayload", args: [userAddress, modelId, payload] },
    { name: "publishEncryptedPayload", args: [userAddress, modelId, payload] },
    { name: "uploadEncryptedPayload", args: [userAddress, modelId, payload] },
    { name: "storeEncryptedPayload", args: [userAddress, modelId, payload] },
    { name: "submit", args: [userAddress, modelId, payload] },
    // some contracts might expect (modelId, user, payload)
    { name: "submitEncryptedInput", args: [modelId, userAddress, payload] },
    { name: "submitEncryptedPayload", args: [modelId, userAddress, payload] },
    // fallback: call a generic "setEncryptedPayload" or "setPayload"
    { name: "setEncryptedPayload", args: [userAddress, modelId, payload] },
    { name: "setPayload", args: [userAddress, modelId, payload] },
  ];

  let any = false;
  for (const t of tries) {
    try {
      const ok = await tryCall(contract, t.name, t.args);
      if (ok) { any = true; break; }
    } catch (err) {
      console.error(`Error while attempting ${t.name}():`, err && err.message ? err.message : err);
      // continue trying other candidates
    }
  }

  if (!any) {
    console.log("\nNo matching transaction function found in ABI or all attempts failed.");
    console.log("ABI functions available on the contract (names):");
    const iface = contract.interface;
    console.log(Object.keys(iface.functions).map(k => iface.functions[k].format()).slice(0,200));
    console.log("\nIf you see the correct submission function there, update the script with its exact name/signature and try again.");
  } else {
    console.log("\nDone. Wait a few seconds and then use the frontend 'Reveal my score' to check if the worker picks this up.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
