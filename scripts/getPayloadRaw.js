// scripts/getPayloadRaw.js
const hre = require("hardhat");
async function main(){
  const ethers = hre.ethers;
  const CONTRACT = process.env.CONTRACT_ADDR || "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
  const [signer] = await ethers.getSigners();
  const iface = (await ethers.getContractAt("PrivScore", CONTRACT)).interface;
  const data = iface.encodeFunctionData("getEncryptedPayload", [signer.address, 1]);
  const raw = await hre.ethers.provider.call({ to: CONTRACT, data });
  console.log("raw getEncryptedPayload:", raw);
}
main().catch(e=>{ console.error(e); process.exit(1); });
