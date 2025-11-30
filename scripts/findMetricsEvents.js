// scripts/findMetricsEvents.js
// npx hardhat run --network localhost scripts/findMetricsEvents.js

const hre = require("hardhat");
async function main(){
  const ethers = hre.ethers;
  const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const contract = await ethers.getContractAt("PrivScore", CONTRACT);
  const from = 0;
  const to = "latest";
  console.log("Querying MetricsSubmitted events from", from, "to", to);
  const events = await contract.queryFilter(contract.filters.MetricsSubmitted(), from, to);
  console.log("Found count:", events.length);
  events.forEach((ev, i) => {
    console.log(`#${i+1}`, {
      user: ev.args?.user,
      modelId: ev.args?.modelId?.toString?.(),
      encPayloadLen: ev.args?.encPayload ? (ev.args.encPayload.length - 2)/2 : 0,
      txHash: ev.transactionHash,
      blockNumber: ev.blockNumber
    });
  });
}
main().catch(e=>{ console.error(e); process.exit(1); });
