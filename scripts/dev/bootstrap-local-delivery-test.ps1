$ErrorActionPreference = "Stop"

$composeFile = "docker-compose.dev.yml"
$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "rgpapp" }
$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "rgpdb" }

Write-Host "Starting local dev stack..."
docker compose -f $composeFile up -d --build postgres api frontend

Write-Host "Waiting for postgres healthcheck..."
docker compose -f $composeFile exec -T postgres sh -lc "until pg_isready -U $dbUser -d $dbName; do sleep 2; done"

Write-Host "Repairing stale dev database role/grants if needed..."
docker compose -f $composeFile exec -T postgres psql -U postgres -d postgres -f /sql/dev/repair_local_role.sql

Write-Host "Applying delivery phase-1 migration..."
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/ddl/005_seed.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/008_delivery_phase1.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/009_delivery_partners.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/010_purchase_payables_phase1.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/011_vendor_payment_audit_columns.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/012_purchase_planning_phase1.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/013_purchase_order_approval_and_settings.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/014_store_shift_cash_handling.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/015_store_cash_threshold.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/016_user_store_assignments.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/017_store_crud.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/018_sale_acting_user.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/019_stock_permissions_and_audit.sql
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /sql/migrations/020_business_master.sql

Write-Host "Loading local delivery and payables demo data..."
docker compose -f $composeFile exec -T postgres psql -U postgres -d $dbName -f /docker-entrypoint-initdb.d/006_dev_test_data.sql

Write-Host "Restarting API to pick up the repaired DB role..."
docker compose -f $composeFile restart api

Write-Host ""
Write-Host "Local delivery and payables test setup is ready."
Write-Host "Login: admin@local.test / admin123"
Write-Host "Frontend: http://localhost:8000"
Write-Host "API: http://localhost:3000"
