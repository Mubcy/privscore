/** hardhat.config.js **/
require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

// Optional FHE plugin (safe try/catch)
try {
  require("@fhevm/hardhat-plugin");
} catch (e) {
  try { require("@fhevm/core/hardhat"); } catch (e2) {}
}

module.exports = {
  solidity: {
    compilers: [
      { version: "0.8.24" },  // required for @fhevm/solidity
      { version: "0.8.19" }
    ],
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },

  networks: {
    hardhat: {},

    localhost: {
      url: "http://127.0.0.1:8545"
    },

    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};
