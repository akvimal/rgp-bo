-- Migration 011: Add HSN Tax Management Permissions
-- This migration adds HSN management permissions to all roles

-- Update Admin role to include HSN management
UPDATE app_role
SET permissions = '[
  {"resource":"site","path":["/secure/dashboard","/secure/profile"]},
  {"resource":"roles","path":"/secure/roles","policies":[{"action":"read","path":"","properties":["name","permissions"]},{"action":"add","path":"/new","properties":["name","permissions"]},{"action":"edit","path":"/edit","properties":["name","permissions"]},{"action":"delete"}]},
  {"resource":"users","path":"/secure/users","policies":[{"action":"read","path":"","properties":["fullname","email","phone","location"]},{"action":"add","path":"/new","properties":["fullname","email","phone","location","role","password"]},{"action":"edit","path":"/edit","properties":["fullname","email","phone","location","role"]},{"action":"delete"}]},
  {"resource":"products","path":["/secure/products","/secure/products/master","/secure/products/price","/secure/products/hsn"],"policies":[{"action":"price","path":"/price","properties":["title","description"]},{"action":"add","path":"/new","properties":["title","description"]},{"action":"edit","path":"/edit","properties":["title"]},{"action":"delete"},{"action":"hsn.read","path":"/hsn","properties":[]},{"action":"hsn.add","path":"/hsn/new","properties":[]},{"action":"hsn.edit","path":"/hsn/edit","properties":[]},{"action":"hsn.delete","path":"/hsn","properties":[]}]},
  {"resource":"purchases","path":["/secure/purchases","/secure/purchases/vendors"],"policies":[{"action":"read","path":"/list","properties":["name"]},{"action":"add","path":"/new","properties":["name"]},{"action":"edit","path":"/edit","properties":["name"]},{"action":"vendors.edit","path":"vendors/edit","properties":["name"]},{"action":"delete"}]},
  {"resource":"store","path":["/secure/store/stock","/secure/store/cash"],"policies":[{"action":"read","properties":["ptrcost"]},{"action":"adjust"}]},
  {"resource":"customers","path":"/secure/customers","policies":[{"action":"read","properties":[]}]},
  {"resource":"sales","path":["/secure/sales/pos","/secure/sales/pos/new","/secure/sales/list","/secure/sales/view","/secure/sales/new","/secure/sales/edit","/secure/sales/returns","/secure/sales/reminders"],"data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]},{"action":"bill","path":"/bill/print"}]},
  {"resource":"settings","path":["/secure/settings","/secure/settings/users","/secure/settings/roles","/secure/settings/app"],"data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]}]},
  {"resource":"reports","path":["/secure/reports"]}
]'::json
WHERE id = 1 AND name = 'Admin';

-- Update Store Head role to include HSN read-only access
UPDATE app_role
SET permissions = '[
  {"resource":"site","path":["/secure/dashboard","/secure/profile"]},
  {"resource":"roles","path":"/secure/roles","policies":[{"action":"read","path":"","properties":["name","permissions"]},{"action":"add","path":"/new","properties":["name","permissions"]},{"action":"edit","path":"/edit","properties":["name","permissions"]},{"action":"delete"}]},
  {"resource":"users","path":"/secure/users","policies":[{"action":"read","path":"","properties":["fullname","email","phone","location"]},{"action":"add","path":"/new","properties":["fullname","email","phone","location","role","password"]},{"action":"edit","path":"/edit","properties":["fullname","email","phone","location","role"]},{"action":"delete"}]},
  {"resource":"products","path":["/secure/products","/secure/products/master","/secure/products/price","/secure/products/hsn"],"policies":[{"action":"price","path":"/price","properties":["title","description"]},{"action":"add","path":"/new","properties":["title","description"]},{"action":"edit","path":"/edit","properties":["title"]},{"action":"delete"},{"action":"hsn.read","path":"/hsn","properties":[]}]},
  {"resource":"purchases","path":["/secure/purchases","/secure/purchases/vendors"],"policies":[{"action":"read","path":"/list","properties":["name"]},{"action":"add","path":"/new","properties":["name"]},{"action":"edit","path":"/edit","properties":["name"]},{"action":"vendors.edit","path":"vendors/edit","properties":["name"]},{"action":"delete"}]},
  {"resource":"store","path":["/secure/store/stock","/secure/store/cash"],"policies":[{"action":"read","properties":["ptrcost"]},{"action":"adjust"}]},
  {"resource":"customers","path":"/secure/customers","policies":[{"action":"read","properties":[]}]},
  {"resource":"sales","path":["/secure/sales/pos","/secure/sales/pos/new","/secure/sales/list","/secure/sales/view","/secure/sales/new","/secure/sales/edit","/secure/sales/returns","/secure/sales/reminders"],"data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]},{"action":"bill","path":"/bill/print"}]},
  {"resource":"settings","path":["/secure/settings","/secure/settings/users","/secure/settings/roles","/secure/settings/app"],"data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]}]},
  {"resource":"reports","path":["/secure/reports"]}
]'::json
WHERE id = 3 AND name = 'Store Head';

-- Update Sales Staff role (read-only HSN access)
UPDATE app_role
SET permissions = '[
  {"resource":"site","path":["/secure/sales","/secure/profile"]},
  {"resource":"stock","path":"/secure/stock","policies":[{"action":"read","properties":["ptrcost"]}]},
  {"resource":"customers","path":"/secure/customers","policies":[{"action":"read","properties":[]}]},
  {"resource":"products","path":["/secure/products/hsn"],"policies":[{"action":"hsn.read","path":"/hsn","properties":[]}]},
  {"resource":"sales","path":"/secure/sales","policies":[{"action":"read","properties":[]},{"action":"add","path":"/new","properties":[]}]},
  {"resource":"purchases","path":"/secure/purchases","policies":[{"action":"read","path":"/list","properties":["ptrvalue"]}]}
]'::json
WHERE id = 2 AND name = 'Sales Staff';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 011: HSN permissions added successfully';
END $$;
