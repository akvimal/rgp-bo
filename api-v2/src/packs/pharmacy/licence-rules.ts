/** Rules for the drug licence block. Pure: no framework, so it is tested without one. */
/** the licence types a store needs to sell medicines */
export const DRUG_LICENCE_TYPES = ['RETAIL_20_21', 'WHOLESALE_20B_21B'];

/**
 * Whether the drug licences of a store have all ended. A store with none recorded is not judged (nothing to say it has lapsed), and one valid licence is
 * enough. Pure: the days are 'YYYY-MM-DD'.
 */
export function licenceLapsed(validTos: (string | null)[], today: string): boolean {
  const dates = validTos.filter((d): d is string => !!d);
  return dates.length > 0 && dates.every((d) => d < today);
}
