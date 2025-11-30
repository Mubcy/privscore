// scripts/readEncryptedPayload.js
// npx hardhat run --network localhost scripts/readEncryptedPayload.js

const hre = require("hardhat");
async function main(){
  const ethers = hre.ethers;
  const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt("PrivScore", CONTRACT);
  const user = signer.address;
  const modelId = 1;
  console.log("Querying encryptedPayload(", user, ",", modelId, ") ...");
  // call the public mapping accessor
  const raw = await contract.encryptedPayload(user, modelId);
  console.log("encryptedPayload (raw):", raw);
  console.log("length (bytes):", raw ? (raw.length - 2) / 2 : 0);
}
main().catch(e=>{ console.error(e); process.exit(1); });
