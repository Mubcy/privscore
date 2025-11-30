// scripts/checkPayload.js
const hre = require("hardhat");
async function main(){
  const ethers = hre.ethers;
  const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt("PrivScore", CONTRACT);
  const payload = await contract.getEncryptedPayload(signer.address, 1);
  console.log("payload (hex):", payload);
  console.log("payload length:", payload ? payload.length/2 : 0);
}
main().catch(e=>{ console.error(e); process.exit(1); });
