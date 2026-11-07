import { MenuAccess } from "./menu";

/**
 * The things people do most, offered from the floating button at the bottom right of every screen. Each shows only for a role that may open it
 * (the same permission keys as the menu), so a counter login sees a short list. Pure of Angular so it can be unit tested.
 */
export interface QuickAction { id: string; label: string; route: string; query?: { [k: string]: any }; icon: string; show: () => boolean; badge?: boolean; }

export function buildQuickActions(a: MenuAccess): QuickAction[] {
  const any = (...keys: string[]) => () => a.has(...keys);
  return [
    { id: 'qa-todo-add', label: 'Add a to-do', route: '/secure/todos', query: { add: 1 }, icon: 'bi-plus-circle', show: any('todos.add') },
    { id: 'qa-todos', label: 'My to-dos', route: '/secure/todos', icon: 'bi-check2-circle', show: any('todos.view'), badge: true },
    { id: 'qa-sale', label: 'New sale', route: '/secure/sales/pos/new', icon: 'bi-cash-coin', show: any('sales') },
    { id: 'qa-purchase', label: 'New purchase invoice', route: '/secure/purchases/invoices/new', icon: 'bi-bag-check', show: any('purchases.add') },
    { id: 'qa-audit', label: 'Stock audits', route: '/secure/stock-audits', icon: 'bi-clipboard-data', show: any('stockaudit.view') },
    { id: 'qa-expense', label: 'Expenses', route: '/secure/expenses', icon: 'bi-wallet2', show: any('expenses.view') },
  ];
}

/** the floating button is not drawn on the billing screens (a stray tap could leave a sale) or when printing */
export function quickActionsHidden(url: string): boolean {
  return /(^|\/)pos(\/|\?|$)/.test(String(url || '').split('#')[0]);
}
