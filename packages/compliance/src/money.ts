/**
 * NGN minor-unit money. All amounts in this package are integer kobo
 * (bigint), never floats. 1 naira = 100 kobo.
 */
export type Kobo = bigint;

const KOBO_PER_NAIRA = 100n;

export function nairaToKobo(naira: number): Kobo {
  if (!Number.isFinite(naira)) {
    throw new RangeError(`nairaToKobo: not a finite number: ${naira}`);
  }
  return BigInt(Math.round(naira * 100));
}

export function koboToNaira(kobo: Kobo): number {
  return Number(kobo) / 100;
}

export function zero(): Kobo {
  return 0n;
}

export function sum(amounts: readonly Kobo[]): Kobo {
  return amounts.reduce((total, amount) => total + amount, 0n);
}

export function max(a: Kobo, b: Kobo): Kobo {
  return a > b ? a : b;
}

export function min(a: Kobo, b: Kobo): Kobo {
  return a < b ? a : b;
}

export function clampNonNegative(amount: Kobo): Kobo {
  return amount < 0n ? 0n : amount;
}

/**
 * Applies a fractional rate (e.g. 0.08 for 8%) to a kobo amount, rounding
 * half-up. Rate is converted to an integer per-million scale internally
 * so the multiplication stays in bigint arithmetic throughout — no float
 * ever touches a money value.
 */
export function applyRate(amount: Kobo, rate: number): Kobo {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new RangeError(`applyRate: invalid rate: ${rate}`);
  }
  const scale = 1_000_000n;
  const scaledRate = BigInt(Math.round(rate * 1_000_000));
  const numerator = amount * scaledRate;
  const half = scale / 2n;
  return (numerator + half) / scale;
}

export { KOBO_PER_NAIRA };
