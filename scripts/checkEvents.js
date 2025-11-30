// scripts/checkEvents.js
const hre = require("hardhat");
async function main(){
  const ethers = hre.ethers;
  const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const contract = await ethers.getContractAt("PrivScore", CONTRACT);
  const events = await contract.queryFilter(contract.filters.MetricsSubmitted(), 0, "latest");
  console.log("MetricsSubmitted events count:", events.length);
  events.forEach((ev, i) => {
    console.log(i+1, { args: ev.args, blockNumber: ev.blockNumber, txHash: ev.transactionHash });
  });
}
main().catch(e=>{ console.error(e); process.exit(1); });
