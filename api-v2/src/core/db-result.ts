/**
 * How many rows an UPDATE or DELETE ... RETURNING touched. With this driver, `manager.query` gives back `[rows, count]` for those statements (and the rows
 * alone for a SELECT or INSERT), so `result.length` is 2 whatever happened. Use this instead of `.length` when the question is "did it change anything?".
 */
export function affectedRows(res: any): number {
  if (!Array.isArray(res)) return 0;
  if (res.length === 2 && Array.isArray(res[0]) && typeof res[1] === 'number') return res[0].length;
  return res.length;
}
