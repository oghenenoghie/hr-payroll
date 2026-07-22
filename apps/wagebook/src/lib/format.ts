/** Formats a kobo amount (as returned by Postgres/PostgREST, a plain number) as whole-naira currency. */
export function formatKobo(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}
