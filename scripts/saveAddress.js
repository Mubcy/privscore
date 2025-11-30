// scripts/saveAddress.js
const fs = require("fs");
const path = require("path");

async function main() {
  const addr = process.env.CONTRACT_ADDR;
  if (!addr) throw new Error("Set CONTRACT_ADDR env var first");
  const outPath = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outPath)) fs.mkdirSync(outPath);
  const file = path.join(outPath, "local.json");
  fs.writeFileSync(file, JSON.stringify({ PrivScore: addr }, null, 2));
  console.log("Saved to", file);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
