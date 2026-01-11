-- Migration 015: Add Sales Intent Permissions
-- This migration adds Sales Intent management permissions to all roles

-- Update Admin role to include Intent management (full access)
UPDATE app_role
SET permissions = '[
  {"resource":"site","path":["/secure/dashboard","/secure/profile"]},
  {"resource":"roles","path":"/secure/roles","policies":[{"action":"read","path":"","properties":["name","permissions"]},{"action":"add","path":"/new","properties":["name","permissions"]},{"action":"edit","path":"/edit","properties":["name","permissions"]},{"action":"delete"}]},
  {"resource":"users","path":"/secure/users","policies":[{"action":"read","path":"","properties":["fullname","email","phone","location"]},{"action":"add","path":"/new","properties":["fullname","email","phone","location","role","password"]},{"action":"edit","path":"/edit","properties":["fullname","email","phone","location","role"]},{"action":"delete"}]},
  {"resource":"products","path":["/secure/products","/secure/products/master","/secure/products/price","/secure/products/hsn"],"policies":[{"action":"price","path":"/price","properties":["title","description"]},{"action":"add","path":"/new","properties":["title","description"]},{"action":"edit","path":"/edit","properties":["title"]},{"action":"delete"},{"action":"hsn.read","path":"/hsn","properties":[]},{"action":"hsn.add","path":"/hsn/new","properties":[]},{"action":"hsn.edit","path":"/hsn/edit","properties":[]},{"action":"hsn.delete","path":"/hsn","properties":[]}]},
  {"resource":"purchases","path":["/secure/purchases","/secure/purchases/vendors"],"policies":[{"action":"read","path":"/list","properties":["name"]},{"action":"add","path":"/new","properties":["name"]},{"action":"edit","path":"/edit","properties":["name"]},{"action":"vendors.edit","path":"vendors/edit","properties":["name"]},{"action":"delete"}]},
  {"resource":"store","path":["/secure/store/stock","/secure/store/cash"],"policies":[{"action":"read","properties":["ptrcost"]},{"action":"adjust"}]},
  {"resource":"customers","path":"/secure/customers","policies":[{"action":"read","properties":[]}]},
  {"resource":"sales","path":["/secure/sales/pos","/secure/sales/pos/new","/secure/sales/list","/secure/sales/view","/secure/sales/new","/secure/sales/edit","/secure/sales/returns","/secure/sales/reminders","/secure/sales/intent","/secure/sales/intent/new","/secure/sales/intent/edit","/secure/sales/intent/view"],"data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]},{"action":"bill","path":"/bill/print"},{"action":"intent.read","path":"/intent","properties":[]},{"action":"intent.add","path":"/intent/new","properties":[]},{"action":"intent.edit","path":"/intent/edit","properties":[]},{"action":"intent.view","path":"/intent/view","properties":[]},{"action":"intent.delete","path":"/intent","properties":[]},{"action":"intent.cancel","path":"/intent","properties":[]}]},
  {"resource":"settings","path":["/secure/settings","/secure/settings/users","/secure/settings/roles","/secure/settings/app"],"data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]}]},
  {"resource":"reports","path":["/secure/reports"]}
]'::json
WHERE id = 1 AND name = 'Admin';

-- Update Store Head role to include Intent management (full access)
UPDATE app_role
SET permissions = '[
  {"resource":"site","path":["/secure/dashboard","/secure/profile"]},
  {"resource":"roles","path":"/secure/roles","policies":[{"action":"read","path":"","properties":["name","permissions"]},{"action":"add","path":"/new","properties":["name","permissions"]},{"action":"edit","path":"/edit","properties":["name","permissions"]},{"action":"delete"}]},
  {"resource":"users","path":"/secure/users","policies":[{"action":"read","path":"","properties":["fullname","email","phone","location"]},{"action":"add","path":"/new","properties":["fullname","email","phone","location","role","password"]},{"action":"edit","path":"/edit","properties":["fullname","email","phone","location","role"]},{"action":"delete"}]},
  {"resource":"products","path":["/secure/products","/secure/products/master","/secure/products/price","/secure/products/hsn"],"policies":[{"action":"price","path":"/price","properties":["title","description"]},{"action":"add","path":"/new","properties":["title","description"]},{"action":"edit","path":"/edit","properties":["title"]},{"action":"delete"},{"action":"hsn.read","path":"/hsn","properties":[]}]},
  {"resource":"purchases","path":["/secure/purchases","/secure/purchases/vendors"],"policies":[{"action":"read","path":"/list","properties":["name"]},{"action":"add","path":"/new","properties":["name"]},{"action":"edit","path":"/edit","properties":["name"]},{"action":"vendors.edit","path":"vendors/edit","properties":["name"]},{"action":"delete"}]},
  {"resource":"store","path":["/secure/store/stock","/secure/store/cash"],"policies":[{"action":"read","properties":["ptrcost"]},{"action":"adjust"}]},
  {"resource":"customers","path":"/secure/customers","policies":[{"action":"read","properties":[]}]},
  {"resource":"sales","path":["/secure/sales/pos","/secure/sales/pos/new","/secure/sales/list","/secure/sales/view","/secure/sales/new","/secure/sales/edit","/secure/sales/returns","/secure/sales/reminders","/secure/sales/intent","/secure/sales/intent/new","/secure/sales/intent/edit","/secure/sales/intent/view"],"data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]},{"action":"bill","path":"/bill/print"},{"action":"intent.read","path":"/intent","properties":[]},{"action":"intent.add","path":"/intent/new","properties":[]},{"action":"intent.edit","path":"/intent/edit","properties":[]},{"action":"intent.view","path":"/intent/view","properties":[]},{"action":"intent.delete","path":"/intent","properties":[]},{"action":"intent.cancel","path":"/intent","properties":[]}]},
  {"resource":"settings","path":["/secure/settings","/secure/settings/users","/secure/settings/roles","/secure/settings/app"],"data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]}]},
  {"resource":"reports","path":["/secure/reports"]}
]'::json
WHERE id = 3 AND name = 'Store Head';

-- Update Sales Staff role to include Intent (read and create only)
UPDATE app_role
SET permissions = '[
  {"resource":"site","path":["/secure/sales","/secure/profile"]},
  {"resource":"stock","path":"/secure/stock","policies":[{"action":"read","properties":["ptrcost"]}]},
  {"resource":"customers","path":"/secure/customers","policies":[{"action":"read","properties":[]}]},
  {"resource":"products","path":["/secure/products/hsn"],"policies":[{"action":"hsn.read","path":"/hsn","properties":[]}]},
  {"resource":"sales","path":["/secure/sales","/secure/sales/intent","/secure/sales/intent/new","/secure/sales/intent/view"],"policies":[{"action":"read","properties":[]},{"action":"add","path":"/new","properties":[]},{"action":"intent.read","path":"/intent","properties":[]},{"action":"intent.add","path":"/intent/new","properties":[]},{"action":"intent.view","path":"/intent/view","properties":[]}]},
  {"resource":"purchases","path":"/secure/purchases","policies":[{"action":"read","path":"/list","properties":["ptrvalue"]}]}
]'::json
WHERE id = 2 AND name = 'Sales Staff';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 015: Sales Intent permissions added successfully';
  RAISE NOTICE 'Admin and Store Head: Full Intent access (read, create, edit, view, delete, cancel)';
  RAISE NOTICE 'Sales Staff: Limited Intent access (read, create, view only)';
END $$;
