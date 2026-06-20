// Configuration for Pluse Web App
// Resolves to the environment variable VITE_API_URL if set,
// otherwise defaults to empty string (relative API requests) in production or localhost:3001 in development.

const isProd = import.meta.env.PROD;

export const API_BASE_URL = import.meta.env.VITE_API_URL || (isProd ? '' : 'http://localhost:3001');
