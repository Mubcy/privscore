// node scripts/getCodeLength.js
async function main(){
  const hre = require("hardhat");
  const addr = process.env.CONTRACT_ADDR;
  if(!addr) throw new Error("Export CONTRACT_ADDR env first");
  const code = await hre.ethers.provider.getCode(addr);
  console.log("contract", addr, "code length bytes =", code.length/2);
  console.log("first 40 chars:", code.slice(0,40));
}
main().catch(e=>{ console.error(e); process.exit(1); });
