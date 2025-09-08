// web/src/lib/tokens.ts
import { zeroAddress } from "viem";

export type TokenMeta = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  label: string; // for dropdown
};

// ⛽ Replace USDC address with your Sonic Testnet token (or your MockUSDC)
export const TOKENS: Record<string, TokenMeta> = {
  ETH: { symbol: "S", address: zeroAddress, decimals: 18, label: "S (native)" },
  USDC: { symbol: "USDC", address: "0x0000000000000000000000000000000000000000", decimals: 6, label: "USDC (ERC-20)" }
};

export const TOKEN_OPTIONS = Object.entries(TOKENS).map(([key, t]) => ({
  key,
  label: t.label,
}));
