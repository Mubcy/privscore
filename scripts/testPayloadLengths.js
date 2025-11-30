// scripts/testPayloadLengths.js
const hre = require("hardhat");

async function main(){
  const ethers = hre.ethers;
  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt("PrivScore", "0x5FbDB2315678afecb367f032d93F642f64180aa3", signer);

  const payloads = [
    "0x", // empty
    "0x01", // 1 byte
    "0x" + Buffer.from("long-test-payload-0123456789").toString("hex")
  ];

  for (let i=0;i<payloads.length;i++){
    try {
      console.log("Trying payload", i, payloads[i].slice(0,80));
      const tx = await contract.submitEncryptedMetrics(signer.address, 1, payloads[i], { gasLimit: 800000 });
      console.log(" sent tx:", tx.hash);
      await tx.wait();
      console.log(" mined.");
    } catch (e) {
      console.error(" attempt failed:", e.message || e);
    }
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
