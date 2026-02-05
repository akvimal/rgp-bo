// Production environment configuration
// For Railway deployment, set API_URL environment variable during build
export const environment = {
  production: true,
  // Use environment variable if available, otherwise fallback to localhost
  apiHost: (typeof window !== 'undefined' && (window as any).__env?.API_URL)
    || 'http://localhost:3002'
};
