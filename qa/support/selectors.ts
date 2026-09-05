/**
 * Single source of truth for the data-testid values added to the Angular app.
 * Each key here corresponds to a `data-testid="..."` attribute on a template
 * element (see frontend/src/app/**). Specs use `page.getByTestId(TID.x)`.
 *
 * Anything NOT listed here is targeted in specs by role/label/text directly
 * (PrimeNG internals, one-off elements).
 */
export const TID = {
  // --- login (@core/auth/login/login.component.html) ---
  loginEmail: 'login-email',
  loginPassword: 'login-password',
  loginSubmit: 'login-submit',
  loginError: 'login-error',

  // --- change password (@core/auth/changepwd/changepwd.component.html) ---
  cpEmail: 'cp-email',
  cpCurrent: 'cp-current',
  cpNew: 'cp-new',
  cpSubmit: 'cp-submit',
  cpError: 'cp-error',

  // --- app shell (secured/secured.component.html) ---
  storeSwitcher: 'store-switcher',
  sidebarToggle: 'sidebar-toggle',
  userMenu: 'user-menu',
  navItem: (key: string) => `nav-${key}`,            // nav-dashboard, nav-store, nav-settings ...
  settingsSub: (key: string) => `nav-settings-${key}`, // nav-settings-users, -roles, -businesses, -store, -delivery-partners

  // --- shifts (secured/store/shifts/components/shifts.component.html) ---
  shiftTemplate: 'shift-template',
  shiftAssignee: 'shift-assignee',
  shiftDate: 'shift-date',
  shiftOpeningCash: 'shift-opening-cash',
  shiftOpen: 'shift-open',
  shiftNoStore: 'shift-no-store',
  shiftMessage: 'shift-message',
  shiftRow: 'shift-row',                    // one per row; data-shift-id + data-shift-status attrs
  shiftAction: 'shift-action',              // Close / View button in a row
  shiftCounted: 'shift-counted',
  shiftCloseConfirm: 'shift-close-confirm',
  shiftReportBody: 'shift-report-body',

  // --- cash (secured/store/cash/components/cash.component.html) ---
  cashCategory: 'cash-category',
  cashDescription: 'cash-description',
  cashDeposit: 'cash-deposit',
  cashWithdraw: 'cash-withdraw',
  cashAdd: 'cash-add',
  cashBalance: 'cash-balance',
  cashDepositBadge: 'cash-deposit-badge',
  cashThreshold: 'cash-threshold',
  cashExcess: 'cash-excess',
  cashMessage: 'cash-message',
  cashLedgerRow: 'cash-ledger-row',

  // --- settings > users ---
  userAdd: 'user-add',
  userRow: 'user-row',
  userEmail: 'user-f-email',
  userPassword: 'user-f-password',
  userConfirm: 'user-f-confirm',
  userFullname: 'user-f-fullname',
  userPhone: 'user-f-phone',
  userLocation: 'user-f-location',
  userRole: 'user-f-role',
  userBusiness: 'user-f-business',
  userStoreCheck: (id: number | string) => `user-f-store-${id}`,
  userSubmit: 'user-f-submit',

  // --- settings > roles ---
  roleAdd: 'role-add',
  roleRow: 'role-row',
  roleName: 'role-f-name',
  roleResourceSwitch: (key: string) => `role-f-res-${key}`,
  roleSubmit: 'role-f-submit',

  // --- settings > businesses ---
  bizName: 'biz-f-name',
  bizActive: 'biz-f-active',
  bizSave: 'biz-f-save',
  bizRow: 'biz-row',
  bizMessage: 'biz-message',

  // --- settings > store (store-settings.component.html) ---
  storeSelect: 'store-s-select',
  storeTab: (key: string) => `store-s-tab-${key}`,       // master | policy | templates
  storeFBusiness: 'store-s-business',
  storeFLocation: 'store-s-location',
  storeFThreshold: 'store-s-threshold',
  storeFActive: 'store-s-active',
  storeFSave: 'store-s-save',
  storeRow: 'store-s-row',
  policyThreshold: 'store-s-policy-threshold',
  policySave: 'store-s-policy-save',
  tplName: 'store-s-tpl-name',
  tplStart: 'store-s-tpl-start',
  tplEnd: 'store-s-tpl-end',
  tplThreshold: 'store-s-tpl-threshold',
  tplAssignee: 'store-s-tpl-assignee',
  tplSave: 'store-s-tpl-save',

  // --- dashboard (secured/dashboard.component.html) ---
  dashRoot: 'dash-root',
  dashKpis: 'dash-kpis',
  dashSalesToday: 'dash-sales-today',
  dashError: 'dash-error',

  // --- purchase orders (Phase 2) ---
  poCreate: 'po-create',
  poRow: 'po-row',
  poLink: 'po-link',
  poStatus: 'po-status',
  poApprovalBadge: 'po-approval',
  poFVendor: 'po-f-vendor',
  poFSave: 'po-f-save',
  poDetail: 'po-detail',
  poAddRequest: 'po-add-request',
  poProceed: 'po-proceed',
  poApprove: 'po-approve',
  poRejectOpen: 'po-reject-open',
  poRejectReason: 'po-reject-reason',
  poRejectConfirm: 'po-reject-confirm',

  // --- vendors (Phase 2) ---
  vendorFName: 'vendor-f-name',
  vendorFGstn: 'vendor-f-gstn',
  vendorFContact: 'vendor-f-contact',
  vendorFPhone: 'vendor-f-phone',
  vendorFSubmit: 'vendor-f-submit',

  // --- invoices (Phase 2) ---
  invAdd: 'inv-add',
  invTabInvoices: 'inv-tab-invoices',
  invTabOutstanding: 'inv-tab-outstanding',
  invRow: 'inv-row',
  invBalance: 'inv-balance',

  // --- stock adjust (Phase 2) ---
  stkAdjustRow: 'stk-adjust-row',

  // --- customers / delivery partners (Phase 3) ---
  custFName: 'cust-f-name',
  custFMobile: 'cust-f-mobile',
  custFEmail: 'cust-f-email',
  custFSrctype: 'cust-f-srctype',
  custFSave: 'cust-f-save',
  dpFName: 'dp-f-name',
  dpFSubmit: 'dp-f-submit',
} as const;
