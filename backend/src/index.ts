import "dotenv/config";
import express from "express";
import { toUsd } from "./price";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";
import { qrDataUrl } from "./qr";
import { setupSendgrid, sendEmail } from "./email";

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const {
  SONIC_RPC,
  SONIC_CHAIN_ID,
  PAY_ADDRESS,
  EXPLORER = "https://testnet.sonicscan.org",
  PORT = "4000",
  PUBLIC_BASE = `http://localhost:${PORT}`,
  SENDGRID_KEY,
  FROM_EMAIL = "receipts@echopay.test",
  TEST_RECEIVER
} = process.env;

if (!PAY_ADDRESS) {
  console.warn("⚠️  PAY_ADDRESS missing in backend/.env (your PayAndReceipt address)");
}

const provider = new ethers.JsonRpcProvider(SONIC_RPC, Number(SONIC_CHAIN_ID));

const PAY_ABI = [
  "event ReceiptIssued(uint256 indexed receiptId,address indexed payer,address indexed merchant,address token,uint256 amount,string code,string metaURI)"
];

const pay = PAY_ADDRESS ? new ethers.Contract(PAY_ADDRESS, PAY_ABI, provider) : null;

setupSendgrid(SENDGRID_KEY);

// Health
app.get("/", (_req, res) => res.json({ ok: true, service: "echopay-backend-ts" }));

// Verify JSON
app.get("/verify/:code", async (req, res) => {
  try {
    const code = req.params.code;
    const r = await prisma.receipt.findUnique({ where: { code } });
    if (!r) return res.status(404).json({ ok: false, error: "not_found" });
    const explorer = r.txHash ? `${EXPLORER}/tx/${r.txHash}` : null;
    res.json({ ok: true, receipt: r, explorer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// QR PNG
app.get("/qr/:code", async (req, res) => {
  try {
    const url = `${PUBLIC_BASE}/verify/${req.params.code}`;
    const dataUrl = await qrDataUrl(url);
    const b64 = dataUrl.split(",")[1];
    const buf = Buffer.from(b64, "base64");
    res.setHeader("Content-Type", "image/png");
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).send("QR error");
  }
});

// Simple merchant summary
app.get("/api/merchant/:wallet/summary", async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const count = await prisma.receipt.count({ where: { merchant: wallet } });
    res.json({ ok: true, txCount: count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// Event listener
// --- Event poller (no HTTP filters) ---
async function startListener() {
    if (!PAY_ADDRESS) {
      console.warn("No PAY contract bound (set PAY_ADDRESS). Listener disabled.");
      return;
    }
  
    // Validate and checksum address (prevents ENS lookups)
    if (!ethers.isAddress(PAY_ADDRESS)) {
      console.error(`❌ Invalid PAY_ADDRESS: ${PAY_ADDRESS}`);
      process.exit(1);
    }
    const PAY_ADDR = ethers.getAddress(PAY_ADDRESS);
  
    console.log("🔌 RPC:", SONIC_RPC);
    console.log("📜 Polling logs for PayAndReceipt:", PAY_ADDR);
  
    // Interface + event topic
    const iface = new ethers.Interface([
      "event ReceiptIssued(uint256 indexed receiptId,address indexed payer,address indexed merchant,address token,uint256 amount,string code,string metaURI)"
    ]);
    const topic = ethers.id("ReceiptIssued(uint256,address,address,address,uint256,string,string)");
  
    // Start from a safe block (env override optional)
    const finalityBuffer = 2;
    let last = Number(process.env.START_BLOCK || (await provider.getBlockNumber()) - finalityBuffer);
    if (last < 0) last = 0;
  
    // Helper to process one log -> DB
    const processLog = async (log: any) => {
      const parsed = iface.parseLog(log);
      const { receiptId, payer, merchant, token, amount, code, metaURI } = parsed.args as unknown as {
        receiptId: bigint; payer: string; merchant: string; token: string; amount: bigint; code: string; metaURI: string;
      };
  
      const txHash = log.transactionHash;
  
      const data = {
        chainId: Number(SONIC_CHAIN_ID),
        nftId: Number(receiptId),
        payer: payer.toLowerCase(),
        merchant: merchant.toLowerCase(),
        token: token.toLowerCase(),
        amount: amount.toString(),
        code,
        metaURI,
        txHash,
      };
  
      // idempotent: code is UNIQUE in DB
      await prisma.receipt.upsert({
        where: { code },
        update: {},
        create: data,
      });
  
      console.log("🧾 Stored receipt", code, "tx", txHash);
  
      // Optional email preview
      if (SENDGRID_KEY && TEST_RECEIVER) {
        const verifyUrl = `${PUBLIC_BASE}/verify/${code}`;
        const qr = await (await import("./qr")).qrDataUrl(verifyUrl);
        const isNative = data.token === "0x0000000000000000000000000000000000000000";
        const humanAmt = isNative ? `${ethers.formatEther(amount)} (native)` : `${amount.toString()} (ERC20 base units)`;
        const explorerTx = txHash ? `${EXPLORER}/tx/${txHash}` : "#";
        await (await import("./email")).sendEmail({
          to: TEST_RECEIVER!,
          from: FROM_EMAIL!,
          subject: `Your blockchain receipt ${code}`,
          html: `
            <h2>Payment Receipt</h2>
            <p><b>Code:</b> ${code}</p>
            <p><b>Amount:</b> ${humanAmt}</p>
            <p><b>Payer:</b> ${data.payer}</p>
            <p><b>Merchant:</b> ${data.merchant}</p>
            <p><a href="${verifyUrl}">View Receipt</a> | <a href="${explorerTx}">View on Explorer</a></p>
            <img alt="QR" src="${qr}" />
          `,
        });
      }
    };
  
    // Poll loop
    setInterval(async () => {
      try {
        const latest = (await provider.getBlockNumber()) - finalityBuffer;
        if (latest <= last) return;
  
        // Fetch logs for our event
        const logs = await provider.getLogs({
          address: PAY_ADDR,
          fromBlock: last + 1,
          toBlock: latest,
          topics: [topic], // only ReceiptIssued
        });
  
        for (const log of logs) {
          await processLog(log);
        }
  
        last = latest;
      } catch (err) {
        console.error("Poller error:", err);
      }
    }, 2000); // every 2s; adjust as you like
  }
  

app.listen(Number(PORT), () => {
  console.log(`🚀 API listening on http://localhost:${PORT}`);
  void startListener();
});
