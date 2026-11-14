import { ElementRef } from '@angular/core';
import { RowAction, RowActionsComponent } from './row-actions.component';

const make = (actions: RowAction[]) => {
  const c = new RowActionsComponent(new ElementRef(document.createElement('div')));
  c.actions = actions;
  return c;
};

describe('row actions', () => {
  const all: RowAction[] = [
    { key: 'disable', label: 'Disable', danger: true },
    { key: 'edit', label: 'Edit', link: ['../edit', 1] },
    { key: 'block', label: 'Block' },
    { key: 'view', label: 'View' },
    { key: 'invoices', label: 'Invoices', link: ['/x'] },
  ];

  it('shows view then edit as the icons, whatever order they are given in', () => {
    expect(make(all).inline.map((a) => a.key)).toEqual(['view', 'edit']);
  });
  it('puts the rest in the menu in the order given, destructive last', () => {
    expect(make(all).menu.map((a) => a.key)).toEqual(['block', 'invoices', 'disable']);
  });
  it('leaves out hidden actions and shows no menu when only view and edit remain', () => {
    const c = make([{ key: 'view', label: 'View' }, { key: 'edit', label: 'Edit', hidden: true }, { key: 'x', label: 'X', hidden: true }]);
    expect(c.inline.map((a) => a.key)).toEqual(['view']);
    expect(c.menu).toEqual([]);
  });
  it('has the standard icons and emits the key of an action without a link', () => {
    const c = make(all);
    expect(c.iconOf({ key: 'view', label: '' })).toBe('bi-eye');
    expect(c.iconOf({ key: 'edit', label: '' })).toBe('bi-pencil-square');
    expect(c.iconOf({ key: 'disable', label: '', danger: true })).toBe('bi-trash');
    let got = '';
    c.action.subscribe((k: string) => (got = k));
    c.open = true;
    c.emit({ key: 'block', label: 'Block' });
    expect(got).toBe('block');
    expect(c.open).toBe(false);
  });
});
