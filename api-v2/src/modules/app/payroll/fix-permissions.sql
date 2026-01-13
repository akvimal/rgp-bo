-- Fix Payroll Permissions - Remove old and add new comprehensive permissions

-- For Admin role (id: 1)
UPDATE app_role
SET permissions = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(permissions::jsonb) elem
  WHERE elem->>'resource' != 'payroll'
) || '[{
  "resource": "payroll",
  "path": ["/secure/payroll", "/secure/payroll/create", "/secure/payroll/salary-structures"],
  "policies": [
    {"action": "read", "properties": []},
    {"action": "view", "properties": []},
    {"action": "view.list", "properties": []},
    {"action": "view.details", "properties": []},
    {"action": "view.payslip", "properties": []},
    {"action": "create", "properties": []},
    {"action": "create.run", "properties": []},
    {"action": "edit", "properties": []},
    {"action": "delete", "properties": []},
    {"action": "calculate", "properties": []},
    {"action": "approve", "properties": []},
    {"action": "reject", "properties": []},
    {"action": "request.payment", "properties": []},
    {"action": "process.payment", "properties": []},
    {"action": "salary.read", "properties": []},
    {"action": "salary.view", "properties": []},
    {"action": "salary.view.all", "properties": []},
    {"action": "salary.create", "properties": []},
    {"action": "salary.edit", "properties": []},
    {"action": "salary.delete", "properties": []},
    {"action": "salary.manage", "properties": []},
    {"action": "export", "properties": []},
    {"action": "print", "properties": []}
  ]
}]'::jsonb,
updated_on = CURRENT_TIMESTAMP
WHERE id = 1;

-- For Store Head role (id: 3)
UPDATE app_role
SET permissions = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(permissions::jsonb) elem
  WHERE elem->>'resource' != 'payroll'
) || '[{
  "resource": "payroll",
  "path": ["/secure/payroll", "/secure/payroll/create", "/secure/payroll/salary-structures"],
  "policies": [
    {"action": "read", "properties": []},
    {"action": "view", "properties": []},
    {"action": "view.list", "properties": []},
    {"action": "view.details", "properties": []},
    {"action": "view.payslip", "properties": []},
    {"action": "create", "properties": []},
    {"action": "create.run", "properties": []},
    {"action": "edit", "properties": []},
    {"action": "calculate", "properties": []},
    {"action": "approve", "properties": []},
    {"action": "reject", "properties": []},
    {"action": "salary.read", "properties": []},
    {"action": "salary.view", "properties": []},
    {"action": "salary.view.all", "properties": []},
    {"action": "salary.create", "properties": []},
    {"action": "salary.edit", "properties": []},
    {"action": "salary.manage", "properties": []},
    {"action": "export", "properties": []},
    {"action": "print", "properties": []}
  ]
}]'::jsonb,
updated_on = CURRENT_TIMESTAMP
WHERE id = 3;

-- For Sales Staff role (id: 2)
UPDATE app_role
SET permissions = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(permissions::jsonb) elem
  WHERE elem->>'resource' != 'payroll'
) || '[{
  "resource": "payroll",
  "path": ["/secure/payroll"],
  "policies": [
    {"action": "read", "properties": []},
    {"action": "view", "properties": []},
    {"action": "view.payslip", "properties": []},
    {"action": "payslip.view.own", "properties": []},
    {"action": "print", "properties": []}
  ]
}]'::jsonb,
updated_on = CURRENT_TIMESTAMP
WHERE id = 2;

-- Verify
SELECT id, name,
       jsonb_pretty((
         SELECT elem
         FROM jsonb_array_elements(permissions::jsonb) elem
         WHERE elem->>'resource' = 'payroll'
       )) as payroll_permissions
FROM app_role
WHERE id IN (1, 2, 3)
ORDER BY id;
