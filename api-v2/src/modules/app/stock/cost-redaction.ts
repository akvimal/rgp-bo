/** the fields that show what the business paid; they are left out of what a person without cost access is sent */
export const COST_FIELDS = ['mrp_cost', 'ptr_cost', 'ptr_value', 'oldprice', 'cost'];

/**
 * A copy of the data without the cost fields. Only plain data is copied field by field: a date (or anything else that turns
 * itself into JSON, like a date does) is kept as it is. Copying a Date field by field gives an empty object, which is what
 * every date in these responses became.
 */
export function redactCostFields(data: any): any {
  const strip = (value: any): any => {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === 'object' && typeof value.toJSON !== 'function' && !Buffer.isBuffer(value)) {
      const clone: any = {};
      Object.entries(value).forEach(([key, entry]) => {
        if (COST_FIELDS.includes(key)) return;
        clone[key] = strip(entry);
      });
      return clone;
    }
    return value;
  };
  return data ? strip(data) : data;
}
