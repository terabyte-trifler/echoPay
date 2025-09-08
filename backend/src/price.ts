import { ethers } from "ethers";

export type TokenMeta = { symbol: string; decimals: number };
export const TOKENS: Record<string, TokenMeta> = {
  // lowercased addresses
  "0x0000000000000000000000000000000000000000": { symbol: "S", decimals: 18 }, // native
  // Add your Sonic testnet USDC address here:
  [process.env.SONIC_USDC?.toLowerCase() || "0xdead"]: { symbol: "USDC", decimals: 6 },
};

export function addrKey(a: string) { return (a || "").toLowerCase(); }

export function parseHuman(amount: string, decimals: number) {
  // amount is a string of base units
  const bn = BigInt(amount);
  const base = 10n ** BigInt(decimals);
  const integer = Number(bn / base);
  const frac = Number(bn % base) / Number(base);
  return integer + frac;
}

export function toUsd(tokenAddr: string, amountBaseUnits: string): { usd: number; symbol: string } {
  const key = addrKey(tokenAddr);
  const meta = TOKENS[key] || { symbol: "TOKEN", decimals: 18 };
  const human = parseHuman(amountBaseUnits, meta.decimals);

  // Pricing: USDC = $1, Sonic native S uses env fallback
  if (meta.symbol === "USDC") return { usd: human * 1, symbol: meta.symbol };

  const nativeUsd = Number(process.env.NATIVE_USD || "0.10"); // demo rate
  if (key === "0x0000000000000000000000000000000000000000" || meta.symbol === "S") {
    return { usd: human * nativeUsd, symbol: meta.symbol };
  }
  // default: unknown tokens $0 for demo
  return { usd: 0, symbol: meta.symbol };
}
