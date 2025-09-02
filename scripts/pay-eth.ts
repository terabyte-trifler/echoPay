import { ethers } from "hardhat";

const PAY_ADDRESS = "0x5A9BD73AA4792607773942A60317e8D547eb20C5";
const MERCHANT = "0x7d0C411f75a2Fe775776807d4d01D9074F2119f4"; // can be the same as deployer for test

const ABI = [
  "function payETH(address merchant, string code, string metaURI) payable"
];

async function main() {
  const [payer] = await ethers.getSigners();
  console.log("Payer:", payer.address);

  const pay = new ethers.Contract(PAY_ADDRESS, ABI, payer);

  const code = "ABC12345";      // placeholder; backend will generate later
  const metaURI = "";           // placeholder

  const tx = await pay.payETH(MERCHANT, code, metaURI, {
    value: ethers.parseEther("0.01")   // send 0.01 S (native on testnet)
  });
  console.log("Tx sent:", tx.hash);
  const rec = await tx.wait();
  console.log("Mined in block", rec?.blockNumber);
}

main().catch((e) => { console.error(e); process.exit(1); });
