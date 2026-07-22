import { sum, type Kobo } from "../money";
import type { PayComponent, PayComponents } from "../types";

/** Sums whichever pay components a scheme's rule declares as its base. */
export function sumPayComponents(components: PayComponents, keys: readonly PayComponent[]): Kobo {
  return sum(keys.map((key) => components[key]));
}
