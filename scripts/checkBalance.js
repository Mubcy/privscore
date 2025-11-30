// scripts/checkBalance.js
require('dotenv').config();
const { ethers } = require('ethers');

(async () => {
  const url = process.env.SEPOLIA_RPC_URL;
  if (!url) return console.error('Set SEPOLIA_RPC_URL in .env');
  const provider = new ethers.JsonRpcProvider(url);
  const addr = process.env.DEPLOY_ADDR || (process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY).address : null);
  if (!addr) return console.error('Set DEPLOY_ADDR or PRIVATE_KEY in .env');
  const bal = await provider.getBalance(addr);
  console.log(addr, 'balance =', ethers.formatEther(bal), 'ETH');
})();
