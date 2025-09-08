// backend/src/price.ts

export type TokenMeta = { symbol: string; decimals: number };

// Lowercased addresses
export const TOKENS: Record<string, TokenMeta> = {
  // Native S (Sonic)
  "0x0000000000000000000000000000000000000000": { symbol: "S", decimals: 18 },
  // Optional: Sonic testnet USDC via env
  // If SONIC_USDC is missing, this entry will be ignored at runtime.
  ...(process.env.SONIC_USDC
    ? { [process.env.SONIC_USDC.toLowerCase()]: { symbol: "USDC", decimals: 6 } }
    : {}),
};

function addrKey(a?: string) {
  return (a ?? "").toLowerCase();
}

function fromBaseUnits(raw: string, decimals = 18): number {
  // Convert big-integer string -> decimal number (sufficient for UI & rough USD)
  const s = (raw || "0").replace(/^0+/, "") || "0";
  if (decimals === 0) return Number(s);
  if (s.length <= decimals) {
    const z = "0".repeat(decimals - s.length);
    return Number(`0.${z}${s}`) || 0;
  }
  const i = s.length - decimals;
  const intPart = s.slice(0, i);
  const fracPart = s.slice(i);
  return Number(`${intPart}.${fracPart}`) || 0;
}

export type ToUsdInput = {
  chainId: number;      // not used yet, but kept for future multi-chain pricing
  token: string;        // token address (lowercased or not)
  amount: string;       // base units as string (e.g. "1000000")
  decimals?: number;    // optional override
  symbol?: string;      // optional override
  txHash?: string;      // optional for future timestamped pricing
};

/**
 * Best-effort USD estimate for a token amount.
 * Returns a number (rounded to cents) or null if unknown.
 */
export async function toUsd(input: ToUsdInput): Promise<number | null> {
  try {
    const key = addrKey(input.token);
    const meta: TokenMeta = {
      symbol:
        (input.symbol ??
          TOKENS[key]?.symbol ??
          (key === "0x0000000000000000000000000000000000000000" ? "S" : "TOKEN")),
      decimals: input.decimals ?? TOKENS[key]?.decimals ?? 18,
    };

    // Resolve human amount
    const human = fromBaseUnits(input.amount, meta.decimals);

    // Very simple “pricing”: USDC = $1, native S from env, others unknown.
    if (meta.symbol.toUpperCase() === "USDC") {
      const usd = human * 1.0;
      return Number.isFinite(usd) ? Math.round(usd * 100) / 100 : null;
    }

    if (meta.symbol.toUpperCase() === "S") {
      const nativeUsd = Number(process.env.NATIVE_USD || "0.10"); // demo rate
      const usd = human * nativeUsd;
      return Number.isFinite(usd) ? Math.round(usd * 100) / 100 : null;
    }

    // Unknown token → null (so caller can store null)
    return null;
  } catch {
    return null;
  }
}
