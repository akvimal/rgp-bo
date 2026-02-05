#!/bin/bash

# RGP Back Office - Railway Deployment Setup Script
# This script helps initialize the database on Railway

echo "🚀 RGP Back Office - Railway Setup"
echo "=================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set it using: export DATABASE_URL='your-railway-postgres-url'"
    exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Extract connection details
echo "📊 Initializing database schema..."
echo ""

# Run DDL scripts
echo "1️⃣ Creating tables..."
psql "$DATABASE_URL" -f sql/ddl/tables.sql
if [ $? -ne 0 ]; then
    echo "❌ Failed to create tables"
    exit 1
fi
echo "✅ Tables created"

echo "2️⃣ Creating sequences..."
psql "$DATABASE_URL" -f sql/ddl/sequences.sql
if [ $? -ne 0 ]; then
    echo "❌ Failed to create sequences"
    exit 1
fi
echo "✅ Sequences created"

echo "3️⃣ Creating functions..."
psql "$DATABASE_URL" -f sql/ddl/functions.sql
if [ $? -ne 0 ]; then
    echo "❌ Failed to create functions"
    exit 1
fi
echo "✅ Functions created"

echo "4️⃣ Creating views..."
psql "$DATABASE_URL" -f sql/ddl/views.sql
if [ $? -ne 0 ]; then
    echo "❌ Failed to create views"
    exit 1
fi
echo "✅ Views created"

echo ""
echo "📝 Initializing data..."
psql "$DATABASE_URL" -f sql/init.sql
if [ $? -ne 0 ]; then
    echo "❌ Failed to initialize data"
    exit 1
fi
echo "✅ Initial data loaded (admin user, roles)"

echo ""
echo "🔄 Running migrations..."

# Run migrations in order
for migration in sql/migrations/*.sql; do
    # Skip rollback files
    if [[ $migration == *"rollback"* ]]; then
        continue
    fi

    echo "   Running: $(basename $migration)"
    psql "$DATABASE_URL" -f "$migration"
    if [ $? -ne 0 ]; then
        echo "⚠️  Warning: Migration $(basename $migration) failed"
    fi
done

echo "✅ Migrations completed"
echo ""
echo "🎉 Database setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Test login with: admin@rgp.com / admin123"
echo "   2. Change default credentials"
echo "   3. Configure file upload storage (Railway volumes or cloud)"
echo ""
