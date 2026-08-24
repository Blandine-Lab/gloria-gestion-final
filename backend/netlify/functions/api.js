import serverless from 'serverless-http';
import app from '../../server.js';

// Forcer le framework Express pour serverless-http
export const handler = serverless(app, {
  framework: 'express'
});