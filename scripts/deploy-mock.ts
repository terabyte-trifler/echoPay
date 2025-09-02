// scripts/deploy-mock.ts
import { ethers } from "hardhat";
async function main(){
  const M = await ethers.getContractFactory("MockUSDC");
  const musdc = await M.deploy();
  await musdc.waitForDeployment();
  console.log("MockUSDC:", await musdc.getAddress());
}
main().catch(console.error);
