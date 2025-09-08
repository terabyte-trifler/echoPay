// backend/src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";
import { qrDataUrl } from "./qr";
import { setupSendgrid, sendEmail } from "./email";
import { toUsd } from "./price";

// --- INIT ---
const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// --- ENV ---
const {
  SONIC_RPC,
  SONIC_CHAIN_ID,
  PAY_ADDRESS,
  EXPLORER = "https://testnet.sonicscan.org",
  PORT = "4000",
  PUBLIC_BASE = `http://localhost:${PORT}`,
  PAY_WEB_BASE = "http://localhost:3000", // Next.js base for deep links
  SENDGRID_KEY,
  FROM_EMAIL = "receipts@echopay.test",
  TEST_RECEIVER,
  START_BLOCK,
} = process.env;

if (!PAY_ADDRESS) {
  console.warn("⚠️  PAY_ADDRESS missing in backend/.env (your PayAndReceipt address)");
}

// --- ETHERS PROVIDER ---
const provider = new ethers.JsonRpcProvider(SONIC_RPC, Number(SONIC_CHAIN_ID));

// Minimal ABI (event only)
const PAY_ABI = [
  "event ReceiptIssued(uint256 indexed receiptId,address indexed payer,address indexed merchant,address token,uint256 amount,string code,string metaURI)",
];

// Email (optional)
setupSendgrid(SENDGRID_KEY);

// --- Helpers / constants ---
const NATIVE_ZERO = "0x0000000000000000000000000000000000000000" as const;
const toDbAddr = (addr: string) => addr.toLowerCase();
const isAddr = (v: string) => !!v && ethers.isAddress(v);

const TOKEN_DECIMALS: Record<string, number> = {
  [NATIVE_ZERO]: 18, // Sonic native
  // add known ERC-20s by address: decimals
};
const TOKEN_SYMBOLS: Record<string, string> = {
  [NATIVE_ZERO]: "S", // Sonic native display symbol
  // add known ERC-20s by address: symbol
};

// ---------------- ROUTES ----------------

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

// QR PNG for verify page
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

// Merchant summary: totals + last7d sparkline
app.get("/api/merchant/:wallet/summary", async (req, res) => {
  try {
    const wallet = req.params.wallet;
    if (!isAddr(wallet)) return res.status(400).json({ ok: false, error: "bad_wallet" });
    const m = toDbAddr(wallet);

    // counts
    const txCount = await prisma.receipt.count({ where: { merchant: m } });

    // total USD (only rows that captured usdAtTx)
    const allRows = await prisma.receipt.findMany({
      where: { merchant: m },
      select: { usdAtTx: true },
    });
    const totalUSD = allRows.reduce<number>(
      (sum, r) => sum + (r.usdAtTx ?? 0),
      0
    );
    

    // last 7 days sparkline
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows7d = await prisma.receipt.findMany({
      where: { merchant: m, createdAt: { gte: since } },
      select: { usdAtTx: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // group by YYYY-MM-DD
    const byDay = new Map<string, number>();
    for (const r of rows7d) {
      const k = r.createdAt.toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + (r.usdAtTx ?? 0));
    }
    // ensure continuity for last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (!byDay.has(d)) byDay.set(d, 0);
    }
    const last7d = Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, usd]) => ({ date, usd: Number(usd.toFixed(2)) }));

    res.json({ ok: true, txCount, totalUSD: Number(totalUSD.toFixed(2)), last7d });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Merchant receipts (paginated)
app.get("/api/merchant/:wallet/receipts", async (req, res) => {
  try {
    const wallet = req.params.wallet;
    if (!isAddr(wallet)) return res.status(400).json({ ok: false, error: "bad_wallet" });
    const m = toDbAddr(wallet);

    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize ?? "20"), 10) || 20, 1), 100);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.receipt.findMany({
        where: { merchant: m },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.receipt.count({ where: { merchant: m } }),
    ]);

    res.json({
      ok: true,
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
      items,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Dynamic payment link + QR (for the frontend /pay page)
app.post("/api/merchant/:wallet/qr", async (req, res) => {
  try {
    const wallet = req.params.wallet;
    if (!isAddr(wallet)) return res.status(400).json({ ok: false, error: "bad_wallet" });
    const { amount, token } = req.body ?? {};
    if (!amount || !token) return res.status(400).json({ ok: false, error: "bad_body" });

    // Build link the web app understands: /pay?mid=&amt=&t=
    const link = `${PAY_WEB_BASE}/pay?mid=${wallet}&amt=${encodeURIComponent(amount)}&t=${encodeURIComponent(token)}`;

    const png = await qrDataUrl(link);
    res.json({ ok: true, link, qr: png });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// --------------- EVENT POLLER (reliable over HTTP) -----------------
async function startListener() {
  if (!PAY_ADDRESS) {
    console.warn("No PAY contract bound (set PAY_ADDRESS). Listener disabled.");
    return;
  }
  if (!ethers.isAddress(PAY_ADDRESS)) {
    console.error(`❌ Invalid PAY_ADDRESS: ${PAY_ADDRESS}`);
    process.exit(1);
  }
  const PAY_ADDR = ethers.getAddress(PAY_ADDRESS);

  console.log("🔌 RPC:", SONIC_RPC);
  console.log("📜 Polling logs for PayAndReceipt:", PAY_ADDR);

  const iface = new ethers.Interface(PAY_ABI);
  const topic = ethers.id("ReceiptIssued(uint256,address,address,address,uint256,string,string)");

  const finalityBuffer = 2;
  let last = Number(START_BLOCK || (await provider.getBlockNumber()) - finalityBuffer) || 0;
  if (last < 0) last = 0;

  // Minimal ABI for ERC-20 metadata
  const ERC20_MIN_ABI = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const processLog = async (log: ethers.Log) => {
    // parseLog throws on mismatch; wrap in try/catch instead of nullable type
    let parsed: ethers.LogDescription | null = null;
    try {
      parsed = iface.parseLog(log);
    } catch {
      return; // skip unrelated logs
    }
    
    if (!parsed) return; // safeguard

    const { receiptId, payer, merchant, token, amount, code, metaURI } = parsed.args as unknown as {
      receiptId: bigint;
      payer: string;
      merchant: string;
      token: string;
      amount: bigint;
      code: string;
      metaURI: string;
    };

    const txHash = log.transactionHash;
    const tokenAddr = token.toLowerCase();
    const isNative = tokenAddr === NATIVE_ZERO;

    // resolve symbol/decimals
    let tokenSymbol: string | undefined = TOKEN_SYMBOLS[tokenAddr] || (isNative ? "S" : undefined);
    let decimals: number | undefined = TOKEN_DECIMALS[tokenAddr] ?? (isNative ? 18 : undefined);

    if (!isNative && (!tokenSymbol || decimals == null)) {
      try {
        const erc20 = new ethers.Contract(tokenAddr, ERC20_MIN_ABI, provider);
        const [decRaw, symRaw] = await Promise.allSettled([erc20.decimals(), erc20.symbol()]);
        if (decRaw.status === "fulfilled") decimals = Number(decRaw.value);
        if (symRaw.status === "fulfilled" && typeof symRaw.value === "string") tokenSymbol = symRaw.value;
      } catch {
        // leave best-effort defaults
      }
    }

    // USD-at-tx (optional; your toUsd should be resilient and can return null)
    let usdAtTx: number | null = null;
    try {
      usdAtTx = await toUsd({
        chainId: Number(SONIC_CHAIN_ID),
        token: tokenAddr,
        amount: amount.toString(),
        decimals: decimals ?? 18,
        symbol: tokenSymbol,
        txHash,
      });
      if (typeof usdAtTx === "number" && !Number.isFinite(usdAtTx)) usdAtTx = null;
    } catch {
      usdAtTx = null;
    }

    const data = {
      chainId: Number(SONIC_CHAIN_ID),
      nftId: Number(receiptId),
      payer: toDbAddr(payer),
      merchant: toDbAddr(merchant),
      token: tokenAddr,
      amount: amount.toString(),
      code,
      metaURI,
      txHash,
      tokenSymbol: tokenSymbol ?? null,
      usdAtTx: usdAtTx ?? null,
    };

    // idempotent write
    await prisma.receipt.upsert({
      where: { code },
      update: {},
      create: data,
    });

    console.log(
      "🧾 Stored receipt",
      code,
      "tx",
      txHash,
      usdAtTx != null ? `(~$${usdAtTx.toFixed(2)})` : ""
    );

    // Optional: email preview to yourself
    if (SENDGRID_KEY && TEST_RECEIVER) {
      const verifyUrl = `${PUBLIC_BASE}/verify/${code}`;
      const qr = await qrDataUrl(verifyUrl);
      const humanAmt = isNative
        ? `${ethers.formatEther(amount)} ${tokenSymbol ?? ""}`.trim()
        : `${amount.toString()}${tokenSymbol ? " " + tokenSymbol : ""} (base units)`;
      const explorerTx = txHash ? `${EXPLORER}/tx/${txHash}` : "#";
      const usdLine = usdAtTx != null ? `<p><b>USD (at tx):</b> ~$${usdAtTx.toFixed(2)}</p>` : "";

      await sendEmail({
        to: TEST_RECEIVER!,
        from: FROM_EMAIL!,
        subject: `Your blockchain receipt ${code}`,
        html: `
          <h2>Payment Receipt</h2>
          <p><b>Code:</b> ${code}</p>
          <p><b>Amount:</b> ${humanAmt}</p>
          ${usdLine}
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

      const logs = await provider.getLogs({
        address: PAY_ADDR,
        fromBlock: last + 1,
        toBlock: latest,
        topics: [topic],
      });

      for (const log of logs) {
        await processLog(log);
      }
      last = latest;
    } catch (err) {
      console.error("Poller error:", err);
    }
  }, 2000);
}

// --- START ---
app.listen(Number(PORT), () => {
  console.log(`🚀 API listening on http://localhost:${PORT}`);
  void startListener();
});
