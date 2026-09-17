/**
 * Marks for the assets a Skur vault can hold. Devnet tokens have no brand, so each carries a
 * distinct colour and glyph; both interfaces draw the same mark for the same symbol.
 */
export type TokenMark = { name: string; glyph: string; bg: string; fg: string };

const MARKS: Record<string, TokenMark> = {
  sUSD: { name: "Skur Test USD", glyph: "$", bg: "#16a34a", fg: "#ffffff" },
  sEUR: { name: "Skur Test EUR", glyph: "€", bg: "#2563eb", fg: "#ffffff" },
  sBTC: { name: "Skur Test BTC", glyph: "₿", bg: "#f7931a", fg: "#ffffff" },
  sETH: { name: "Skur Test ETH", glyph: "Ξ", bg: "#5b5bd6", fg: "#ffffff" },
  KASH: { name: "Ark KASH", glyph: "◈", bg: "#ffd000", fg: "#101418" },
};

export function tokenMark(symbol: string): TokenMark {
  return MARKS[symbol] ?? { name: symbol, glyph: symbol.replace(/^s/, "").slice(0, 1).toUpperCase(), bg: "#64748b", fg: "#ffffff" };
}
