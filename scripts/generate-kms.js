/*
 scripts/generate-kms.js
 Purpose: detect installed tkms/node-tkms package and try common keygen APIs.
 Usage: node scripts/generate-kms.js
*/
const fs = require('fs');
const path = require('path');

async function main() {
  const candidates = ['node-tkms', 'tkms', '@zama-fhe/tkms', 'node-tkms/index', 'tkms/index'];
  let tkms = null;
  let pkgName = null;

  for (const name of candidates) {
    try {
      tkms = require(name);
      pkgName = name;
      break;
    } catch (e) {
      // ignore
    }
  }

  if (!tkms) {
    console.error("No tkms-like package found as 'node-tkms' or 'tkms'. Installed packages may not expose an API.");
    console.error("Try running: dir node_modules | findstr tkms  (on Windows) or ls node_modules | grep tkms (on WSL)");
    process.exit(2);
  }

  console.log("Loaded package:", pkgName);
  console.log("Export keys (top-level):", Object.keys(tkms));

  // If the package exports a 'generateKey' or similar, try it:
  const possibleFns = ['generateKey', 'generate_key', 'keygen', 'createKey', 'create_key', 'generateKeypair', 'generateKeyPair'];
  for (const fn of possibleFns) {
    if (typeof tkms[fn] === 'function') {
      try {
        console.log(`\nFound function: ${fn}() — attempting to call it (no args).`);
        const result = await Promise.resolve(tkms[fn]());
        const outDir = path.join(process.cwd(), 'kms_keys');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
        const privPath = path.join(outDir, 'private.json');
        const pubPath = path.join(outDir, 'public.json');
        fs.writeFileSync(privPath, JSON.stringify(result.private || result.sk || result.secret || result, null, 2));
        fs.writeFileSync(pubPath, JSON.stringify(result.public || result.pk || result.publicKey || {}, null, 2));
        console.log("Wrote keys to:", outDir);
        console.log("private:", privPath);
        console.log("public :", pubPath);
        process.exit(0);
      } catch (err) {
        console.warn(`Calling ${fn}() failed:`, err && (err.message || err));
        // continue to try other functions
      }
    }
  }

  console.log("\nNo common keygen function auto-called. Here are the available exports again:");
  console.log(Object.keys(tkms));
  console.log("\nIf you see an export that looks like a generator, tell me its name and I will adapt the script.");
  process.exit(3);
}

main().catch(e => {
  console.error("Script error:", e && (e.stack || e.message || e));
  process.exit(1);
});
