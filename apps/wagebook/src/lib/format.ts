import { toNaira, type Kobo } from "@plutus/compliance";

export function formatKobo(amountKobo: Kobo): string {
  return `₦${Math.round(toNaira(amountKobo)).toLocaleString("en-NG")}`;
}

export function formatPercent(rateScaled: bigint): string {
  return `${(Number(rateScaled) / 10_000).toLocaleString("en-NG")}%`;
}
