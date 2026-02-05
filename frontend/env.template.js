// Environment configuration template
// This file will be populated during Railway build with actual environment variables
(function(window) {
  window.__env = window.__env || {};

  // API URL - will be replaced during build
  window.__env.API_URL = '${API_URL}';
}(this));
