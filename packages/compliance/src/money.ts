export type Kobo = bigint;

/** Rates are stored scaled by RATE_SCALE (parts-per-million) so calculations
 * never touch a float — money and rates are both integer-only in this package. */
export const RATE_SCALE = 1_000_000n;

export function rate(percent: number): bigint {
  return BigInt(Math.round(percent * 10_000));
}

export function naira(amount: number): Kobo {
  return BigInt(Math.round(amount * 100));
}

export function toNaira(amount: Kobo): number {
  return Number(amount) / 100;
}

export function applyRate(amountKobo: Kobo, rateScaled: bigint): Kobo {
  const numerator = amountKobo * rateScaled;
  const half = RATE_SCALE / 2n;
  const sign = numerator < 0n ? -1n : 1n;
  return (sign * (sign * numerator + half)) / RATE_SCALE;
}

export function sumKobo(amounts: Kobo[]): Kobo {
  return amounts.reduce((total, amount) => total + amount, 0n);
}

export function clampNonNegative(amountKobo: Kobo): Kobo {
  return amountKobo < 0n ? 0n : amountKobo;
}
