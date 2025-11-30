# PrivScore — Confidential Encrypted Survey Scoring

**PrivScore** is a decentralized system that collects **fully encrypted survey responses**, decrypts them securely off-chain, and publishes **verifiable scores** on-chain without exposing any raw data.  
It demonstrates a practical architecture for privacy-preserving computation using encrypted payloads, off-chain workers/relayers, and on-chain verification.

Live Demo (Frontend Only):  
👉 **https://privscore.vercel.app/**

For the demo, the blockchain and the worker/relayer run locally.  
This is intentional details explained below.

---

## 🌟 Key Features

### ✔ End-to-End Encrypted Submissions  
Users submit encrypted survey payloads directly to the contract via:
submitEncryptedMetrics(address user, uint256 modelId, bytes payload)

Raw answers **never appear on-chain**.

---

### ✔ Secure Off-Chain Decryption  
A local worker fetches encrypted payloads, decrypts them securely (FHE / enclave / simulated), computes scores, and publishes them via:
submitDecryptedScore(address user, uint256 modelId, bytes handles, uint256 score, bytes proof)


---

### ✔ On-Chain Verifiable Scores  
The contract emits:
event ScorePublished(address user, uint256 modelId, uint256 score, bytes proof);

The frontend listens to these events and updates the UI in real time.

---

### ✔ Fallback Relayer Architecture  
If the primary decrypting worker (e.g., Zama worker) fails, the system automatically falls back to a **local relayer**.  
This ensures:

- Reliability  
- No downtime  
- Testing flexibility  

The UI requires **no changes** for either path.

---

### ✔ Full UI for the Entire Workflow  
The frontend (React + Vite):

- Upload encrypted metrics  
- Create confidential surveys  
- Decrypt/publish scores  
- View score history & proofs  
- Read encrypted stored payloads  
- Owner-only settings (FHE verifier, testing mode)  
- Full log panel for developers  

---

## 🏗 Architecture Overview
User (encrypted answers)
↓
submitEncryptedMetrics()
↓
Smart Contract (stores encrypted bytes)
↓
Off-Chain Worker / Relayer (decrypt & score)
↓
submitDecryptedScore()
↓
ScorePublished event emitted
↓
Frontend displays scores + proofs


### Components:
- **Smart contract**: Stores encrypted payloads and score results  
- **Worker/Relayer**: Secure decryption & computation  
- **Fallback Relayer**: Ensures reliability  
- **Frontend UI**: User interaction and event monitoring  
- **Local Hardhat node**: Fast, reliable demo environment  

---

## ⚠ Why the Demo Uses a Local Node & Local Relayer

### ⭐ 1. Stability
Local Hardhat chain provides:

- Instant transactions  
- Deterministic behavior  
- Zero RPC issues  
- No rate limits  
- No network latency  

Perfect for a live demo.

---

### ⭐ 2. Security — The Worker Holds Secrets  
The decrypting worker uses sensitive keys.  
Running it locally ensures:

- No secret leakage  
- No insecure public endpoints  
- Controlled environment  

We avoid exposing worker secrets to the internet.

---

### ⭐ 3. Fallback Relayer Demonstration  
The project includes a **fallback relayer mechanism**.  
To demonstrate both primary and fallback modes smoothly, a local environment is ideal.

---

### ⭐ 4. Simpler Reproduction  
Judges can:

- Clone the repo  
- Run Hardhat locally  
- Run the worker locally  
- Launch the frontend  
- Reproduce every result  

No need for remote servers or hosting.

---

## 📡 Frontend (Deployed)

Live:  
👉 https://privscore.vercel.app/

Only the **static UI** is hosted.  
Blockchain + worker run locally during demo.

The UI includes:
- Connect wallet  
- Submit encrypted metrics  
- Decrypt next submission  
- Decrypted history w/ proofs  
- Logs  
- Owner controls  
- Survey creation modal  

---

## 📦 Project Structure

privscore/
│
├── hardhat/ # smart contracts + deploy scripts
│ └── contracts/
│ └── scripts/
├── frontend/ # React + Vite UI
│ ├── src/App.jsx
│ ├── src/index.css
│ └── ...
│
├── worker/ # decrypting worker / local relayer
│
└── README.md


---

## 🔧 Local Development Setup

1. Clone the repo
```bash
git clone https://github.com/Mubcy/privscore
cd privscore

2. Start local blockchain
npx hardhat node

3. Deploy contracts
npx hardhat run scripts/deploy.js --network localhost
Take note of the deployed address — the UI reads this.

4. start worker / relayer
node worker.js
(or relevant worker entry)
This will:
Fetch encrypted payloads
Decrypt
Compute scores
Publish them on-chain

5. Run frontend locally
cd frontend
npm install
npm run dev -- --host
Open browser:
👉 http://localhost:5173
Set MetaMask to Localhost 8545.

🧪 Testing the Flow
✔ Step 1: Submit Encrypted Metrics

Upload encrypted blob
Or paste hex
UI sends submitEncryptedMetrics()

✔ Step 2: Worker Processes Submission
Worker decrypts data → computes score → sends submitDecryptedScore().

✔ Step 3: ScorePublished Event
Contract emits event, UI updates history panel.

✔ Step 4: View and verify

Score
Model ID
User
Proof
Tx hash

🌐 Deploying Frontend (Vercel)

cd frontend
vercel --prod
Build:
npm run build
Output: dist
Frontend is static → easy to deploy anywhere.

🔐 Security Considerations

Raw responses remain encrypted at all times
Only encrypted bytes stored on-chain
Worker holds secret key locally
Proofs are attached to final scores
UI never handles plaintext
No centralized servers required

🚀 Future Improvements

FHE compute for full survey analytics
Multi-party computation workers
zk-proof-based verifiable decryption
Encrypted IPFS templates
User-side encryption via WebCrypto

📝 License
MIT

🤝 Contributing
Pull requests welcome! Open issues for bugs or suggestions.

🙌 Acknowledgements
Hardhat
ethers.js
Vercel
FHE research ecosystem

---

# ✅ **Yes — You Create the File on Your PC**
Create:
privscore/README.md
Paste the entire block above into it.
Then run:
```bash
git add README.md
git commit -m "Add full project README"
git push origin main
✔ Done.
