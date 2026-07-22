import type { Kobo } from "../money";

/**
 * NHIS/NHIA is scheme-defined (`resolveByScheme: true` in the rule set) —
 * there is no single national base/rate. Callers supply the applicable
 * scheme's own resolver rather than the engine assuming one.
 */
export interface NhisScheme {
  id: string;
  resolve: (pensionableOrBase: Kobo) => { employee: Kobo; employer: Kobo };
}

export function calculateNhis(
  base: Kobo,
  scheme: NhisScheme,
): { employee: Kobo; employer: Kobo } {
  return scheme.resolve(base);
}
