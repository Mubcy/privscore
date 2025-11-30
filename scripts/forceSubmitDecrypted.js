// scripts/forceSubmitDecrypted.js
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
  const CONTRACT = process.env.CONTRACT_ADDR;
  const KEY = process.env.USER_PRIVATE_KEY || process.env.WORKER_PRIVATE_KEY; // use user key to sign tx
  if (!CONTRACT) throw new Error("Set CONTRACT_ADDR in .env");
  if (!KEY) throw new Error("Set USER_PRIVATE_KEY or WORKER_PRIVATE_KEY in .env");

  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(KEY, provider);
  const abi = require(path.join(__dirname, "artifacts", "contracts", "PrivScore.sol", "PrivScore.json")).abi;
  const contract = new ethers.Contract(CONTRACT, abi, signer);

  // read enc payload for user  (use first account if not in .env)
  const user = process.env.TEST_USER || (await provider.listAccounts())[0];
  const modelId = Number(process.env.TEST_MODEL_ID || 1);
  const enc = await contract.getEncryptedPayload(user, modelId);

  console.log("enc payload (on-chain):", enc);

  // Simulated relayer output:
  // - handles: array of bytes32 (simulate one handle). We'll use keccak256(enc) padded.
  const handle = ethers.keccak256(enc);
  const handles = [handle];

  // - proof: for testing, any bytes are accepted by this test script (but NOT by FHE.checkSignatures)
  // For real contract this proof must be valid; for dev-only testing we use a contract that accepts empty proof.
  const proof = "0x00";

  // - value: simulated score (uint256)
  const score = BigInt(510);

  console.log("Simulated handles:", handles);
  console.log("Submitting submitDecryptedScore (simulated proof) ...");

  const tx = await contract.submitDecryptedScore(user, modelId, handles, score, proof);
  console.log("Tx sent:", tx.hash);
  const rcpt = await tx.wait();
  console.log("Tx mined in block:", rcpt.blockNumber);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
