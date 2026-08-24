import { Handler } from '@netlify/functions';
import express from 'express';
import serverless from 'serverless-http';
import app from '../../server.js';

// Créer un handler compatible Netlify
const handler = serverless(app);

export { handler };