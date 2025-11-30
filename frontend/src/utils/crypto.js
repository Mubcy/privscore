// simulation adapter: swap this file when integrating Concrete / Zama
export function generateKeys() {
  return {
    publicKey: "pub-" + Math.random().toString(36).slice(2),
    secretKey: "sec-" + Math.random().toString(36).slice(2)
  };
}

// returns Uint8Array compatible with ethers.toUtf8Bytes
export function encryptMetrics(publicKey, metrics) {
  const plaintext = JSON.stringify(metrics);
  return new TextEncoder().encode(plaintext);
}

export function decryptScore(secretKey, ciphertextBytes) {
  try {
    const txt = new TextDecoder().decode(ciphertextBytes);
    return txt;
  } catch (e) {
    return null;
  }
}
