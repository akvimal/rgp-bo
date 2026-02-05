#!/bin/bash

# Generate environment configuration for Railway deployment
# This script should run before Angular build

echo "🔧 Generating environment configuration..."

# Check if API_URL is set
if [ -z "$API_URL" ]; then
    echo "⚠️  Warning: API_URL not set, using default"
    API_URL="http://localhost:3002"
fi

# Generate env.js file
cat > src/assets/env.js << EOF
(function(window) {
  window.__env = window.__env || {};
  window.__env.API_URL = '${API_URL}';
}(this));
EOF

echo "✅ Environment configuration generated with API_URL: ${API_URL}"
