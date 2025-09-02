import { config as dotenv } from "dotenv";
dotenv();

import { HardhatUserConfig } from "hardhat/config";
// Toolbox pulls in hardhat-ethers, chai-matchers, gas-reporter, etc.
import "@nomicfoundation/hardhat-toolbox";

const SONIC_TN_RPC =
  process.env.SONIC_TESTNET_RPC || "https://rpc.testnet.soniclabs.com";
const PK = process.env.PRIVATE_KEY || "";
const CHAIN_ID = Number(process.env.SONIC_TESTNET_CHAIN_ID || 14601);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    sonicTestnet: {
      url: SONIC_TN_RPC,
      accounts: PK ? [PK] : [],
      chainId: CHAIN_ID,
    },
  },
  mocha: { timeout: 60000 },
};

export default config;
