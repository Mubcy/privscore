// scripts/setTestingModeCli_safe.js
const hre = require("hardhat");

async function main() {
  const addr = process.env.CONTRACT_ADDR;
  if (!addr) throw new Error("Set CONTRACT_ADDR env var first");

  const arg = process.argv[2];
  if (!arg) throw new Error("Provide 'true' or 'false' as first arg");
  const value = arg.toLowerCase() === "true";

  const [signer] = await hre.ethers.getSigners();
  console.log("Using signer:", signer.address, "->", addr, "setting testingMode ->", value);

  // quick sanity
  const code = await hre.ethers.provider.getCode(addr);
  console.log("code length bytes =", code === "0x" ? 0 : (code.length - 2) / 2);

  // contract
  const contract = await hre.ethers.getContractAt("PrivScore", addr, signer);

  // send tx
  const tx = await contract.setTestingMode(value);
  console.log("tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("tx mined, status:", receipt.status);

  // attempt read (with fallback)
  try {
    const tm = await contract.testingMode();
    console.log("testingMode (decoded via ABI) =", tm.toString());
    return;
  } catch (err) {
    console.error("ABI decode failed:", err.message);
  }

  // fallback: raw call + decode attempt / diagnostics
  try {
    const artifact = await hre.artifacts.readArtifact("PrivScore");
    const iface = new hre.ethers.Interface(artifact.abi);
    const data = iface.encodeFunctionData("testingMode", []);
    const raw = await hre.ethers.provider.call({ to: addr, data });
    console.log("raw call result:", raw);

    if (raw && raw !== "0x") {
      try {
        const decoded = iface.decodeFunctionResult("testingMode", raw);
        console.log("decoded fallback:", decoded);
      } catch (dErr) {
        console.error("Could not decode raw result either:", dErr.message);
      }
    } else {
      console.log("raw call returned 0x (empty) — likely transient node state or ABI mismatch.");
    }
  } catch (e) {
    console.error("Fallback raw call failed:", e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
