// scripts/testSubmitVariants.js
const hre = require("hardhat");

async function main() {
  const ethers = hre.ethers;
  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt("PrivScore", "0x5FbDB2315678afecb367f032d93F642f64180aa3", signer);

  const payload = "0x" + Buffer.from("test-encrypted-payload").toString("hex");
  console.log("Using payload:", payload);

  console.log("1) Calling submitEncryptedMetrics with user = signer.address");
  try {
    let tx = await contract.submitEncryptedMetrics(signer.address, 1, payload, { gasLimit: 800000 });
    console.log(" tx1:", tx.hash);
    await tx.wait();
  } catch (e) { console.error(" tx1 failed:", e.message || e); }

  console.log("2) Calling submitEncryptedMetrics with user = ZERO address");
  try {
    let tx = await contract.submitEncryptedMetrics(ethers.constants.AddressZero, 1, payload, { gasLimit: 800000 });
    console.log(" tx2:", tx.hash);
    await tx.wait();
  } catch (e) { console.error(" tx2 failed:", e.message || e); }
}

main().catch(e => { console.error(e); process.exit(1); });
