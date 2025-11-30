/*
 scripts/explore-tkms.js
 Purpose: safely try common node-tkms API calls and write keys if found.
 Run: node scripts/explore-tkms.js
*/
const fs = require("fs");
const path = require("path");

function safeWrite(dir, name, obj) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

async function main(){
  let tkms = null;
  try { tkms = require("node-tkms"); } catch(e) { console.error("node-tkms not found"); process.exit(2); }

  console.log("Loaded node-tkms; exports:", Object.keys(tkms).slice(0,200));

  // 1) Try ml_kem_pke_keygen (encryption keys)
  try {
    if (typeof tkms.ml_kem_pke_keygen === "function") {
      console.log("\nCalling ml_kem_pke_keygen()...");
      const res = await Promise.resolve(tkms.ml_kem_pke_keygen());
      console.log("ml_kem_pke_keygen -> type:", typeof res);
      console.log("Sample keys (if object):", Object.keys(res || {}).slice(0,20));
      // try to extract pk/sk
      const pk = res && (res.publicKey || res.pk || res.ml_kem_pke_pk || res.public);
      const sk = res && (res.privateKey || res.sk || res.ml_kem_pke_sk || res.secret);
      if (pk) {
        console.log("Found public encryption key; writing kms_keys/public_enc.json");
        safeWrite("./kms_keys", "public_enc.json", pk);
      }
      if (sk) {
        console.log("Found private encryption key; writing kms_keys/private_enc.json (keep this secret!)");
        safeWrite("./kms_keys", "private_enc.json", sk);
      }
    } else {
      console.log("ml_kem_pke_keygen not available");
    }
  } catch (e) {
    console.warn("ml_kem_pke_keygen call failed:", e && e.message);
  }

  // 2) Try new_client() (client creation may hold secret keys)
  try {
    if (typeof tkms.new_client === "function") {
      console.log("\nCalling new_client()...");
      const c = await Promise.resolve(tkms.new_client());
      console.log("new_client -> type:", typeof c);
      // some libs return an object with get_client_secret_key/get_client_address
      if (typeof tkms.get_client_secret_key === "function") {
        try {
          const sec = tkms.get_client_secret_key(c);
          console.log("get_client_secret_key returned (len/preview):", sec && sec.length ? sec.length : typeof sec);
          safeWrite("./kms_keys", "private_client_secret.json", sec || {});
        } catch(err){ console.warn("get_client_secret_key failed:", err && err.message); }
      }
      if (typeof tkms.get_client_address === "function") {
        try {
          const addr = tkms.get_client_address(c);
          console.log("get_client_address:", addr);
          safeWrite("./kms_keys", "client_address.json", addr || {});
        } catch(err){ console.warn("get_client_address failed:", err && err.message); }
      }
    } else {
      console.log("new_client not available");
    }
  } catch(e) {
    console.warn("new_client call failed:", e && e.message);
  }

  // 3) Try signature key helpers (u8vec <-> private/public)
  try {
    if (typeof tkms.private_sig_key_to_u8vec === "function") {
      console.log("\nprivate_sig_key_to_u8vec available");
      console.log("Also checking public_sig_key_to_u8vec availability:", typeof tkms.public_sig_key_to_u8vec);
    } else {
      console.log("no private_sig_key_to_u8vec");
    }
  } catch(e){}

  // 4) Try ml_kem_pke_get_pk (if keygen stored something)
  try {
    if (typeof tkms.ml_kem_pke_get_pk === "function") {
      console.log("\nTrying ml_kem_pke_get_pk()...");
      try {
        const pk2 = tkms.ml_kem_pke_get_pk();
        console.log("ml_kem_pke_get_pk returned:", typeof pk2, (pk2 && pk2.length) ? `len ${pk2.length}` : pk2);
        if (pk2) safeWrite("./kms_keys", "public_enc_get_pk.json", pk2);
      } catch(err){ console.warn("ml_kem_pke_get_pk threw:", err && err.message); }
    }
  } catch(e){}

  // 5) Show helpful functions for decrypt flow
  console.log("\nUseful functions to implement relayer sign/decrypt flow:");
  const helpful = [
    "ml_kem_pke_encrypt","ml_kem_pke_decrypt",
    "process_user_decryption_resp_from_js",
    "process_user_decryption_resp",
    "TypedCiphertext","TypedPlaintext","TypedSigncryptedCiphertext"
  ];
  console.log("Check presence:", helpful.map(f => ({[f]: !!tkms[f]})));

  console.log("\nDone exploration. Check ./kms_keys for any files written. Paste this output into the chat so I can suggest the relayer wiring.");
}

main().catch(e=>{ console.error("explore script error:", e && (e.stack||e.message||e)); process.exit(1); });
