// scripts/fetchScores.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

function readWorkerEnv() {
  try {
    const p = path.join(__dirname, "../worker/.env");
    if (!fs.existsSync(p)) return {};
    return fs.readFileSync(p, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map(l => l.split("="))
      .reduce((acc, [k, ...rest]) => (acc[k] = rest.join("="), acc), {});
  } catch (e) {
    return {};
  }
}

async function main() {
  // prefer CONTRACT_ADDR from process.env, else read worker/.env
  const fallback = readWorkerEnv().CONTRACT_ADDR;
  const CONTRACT_ADDR = process.env.CONTRACT_ADDR || fallback;
  if (!CONTRACT_ADDR) {
    console.error("Set CONTRACT_ADDR in env or ensure worker/.env has CONTRACT_ADDR");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const artifact = require(path.join(__dirname, "../artifacts/contracts/PrivScore.sol/PrivScore.json"));
  const contract = new ethers.Contract(CONTRACT_ADDR, artifact.abi, provider);

  const filter = contract.filters.ScorePublished();
  const logs = await contract.queryFilter(filter, 0, "latest");

  if (!logs.length) {
    console.log("No ScorePublished events found.");
    return;
  }

  for (const log of logs) {
    const parsed = contract.interface.parseLog(log);
    console.log("ScorePublished:", parsed.args);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
