/** Expense categories have a level (where the cost is paid) and a group (the kind of cost); the same words as the server's rules. */
export const LEVELS = [
  { value: 'STORE', label: 'Store only' },
  { value: 'BUSINESS', label: 'Business only' },
  { value: 'BOTH', label: 'Store or business' },
];
export const GROUPS = ['Premises', 'People', 'Operations', 'Technology', 'Compliance and finance', 'Marketing', 'Other'];
export const EVERY_MONTHS = [
  { value: 1, label: 'Every month' },
  { value: 3, label: 'Every 3 months' },
  { value: 6, label: 'Every 6 months' },
  { value: 12, label: 'Every year' },
];

/** the categories that fit an expense at this store (null = business level) */
export function offered(categories: any[], storeId: number | null): any[] {
  return (categories || []).filter((c) => (storeId ? c.level !== 'BUSINESS' : c.level !== 'STORE'));
}

export const everyLabel = (n: number): string => (EVERY_MONTHS.find((e) => e.value === n)?.label || 'Every month');
