# UI standard

The look is set in one place: `frontend/src/theme.css`, loaded last so it wins over the admin template
(`assets/css/style.css`), Bootstrap and the PrimeNG theme. Change a value there, not in a page. Checked by `qa/specs/ui-standards.spec.ts`.

| Thing | Standard |
|---|---|
| Brand colour | `#4154f1` (primary buttons, links, active tab, focus). Green only means success, amber warning, red danger |
| Font | Nunito everywhere; body 14.4px, page title 24px, section title 17px, captions 12.8px |
| Page title | `<div class="pagetitle"><h1>…</h1></div>`; a page inside a section says where it is ("Settings · Users") |
| Tabs | One underlined style at every level (`nav.navbar` / `nav.page-menu` / `.nav-tabs` / PrimeNG tabs). Active = brand colour with a 2px underline |
| Buttons | Page actions in the default size, row actions `btn-sm` or icons. "Add X", "Save", "Cancel". Primary action once per page |
| Row action icons | Edit = pencil (brand blue), delete = bin (red), deactivate = slashed circle, archive = archive box |
| Tables | Light header, 0.55rem cell padding, right-aligned numbers, hover tint. Bootstrap and PrimeNG tables look alike |
| Forms | In a card or on the page, label above (600 weight, 13.6px), required marker `*` after the label, error under the field |
| Alerts | One padding and radius; success, warning, danger, info as Bootstrap |
| Dates | `dd MMM yyyy` (21 Oct 2026); with time `dd MMM yyyy, h:mm a` |
| Money | `₹` on cards and totals, whole rupees on dashboard cards; plain numbers with two decimals in table columns |
| Links | Brand colour, underline on hover only |

Not yet moved onto the standard: the placement of the primary "Add" button (left on most lists, right on Products), the mix of
PrimeNG and Bootstrap tables, and the longer forms' own spacing. A shared page header and action-icon component would finish that.
