import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const NFT = await ethers.getContractFactory("ReceiptNFT");
  const nft = await NFT.deploy("RecEthX Receipt", "RXT");
  await nft.waitForDeployment();

  const Pay = await ethers.getContractFactory("PayAndReceipt");
  const pay = await Pay.deploy(await nft.getAddress());
  await pay.waitForDeployment();

  // ⬇️ hand minting rights to the PayAndReceipt contract
  const tx = await nft.transferOwnership(await pay.getAddress());
  await tx.wait();

  console.log("ReceiptNFT:", await nft.getAddress());
  console.log("PayAndReceipt:", await pay.getAddress());
  console.log("Ownership of NFT =>", await pay.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
