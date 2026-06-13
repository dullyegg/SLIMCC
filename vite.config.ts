import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type {IncomingMessage, ServerResponse} from 'http';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {handleGeminiRequest, type GeminiRequest} from './netlify/lib/gemini-handler';

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function geminiDevApi(apiKey: string): Plugin {
  return {
    name: 'gemini-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/gemini', async (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({error: 'Method not allowed'}));
          return;
        }

        if (!apiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({error: 'GEMINI_API_KEY is not configured'}));
          return;
        }

        try {
          const body = await readRequestBody(req);
          const request = JSON.parse(body) as GeminiRequest;
          const result = await handleGeminiRequest(apiKey, request);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          (res as ServerResponse).end(JSON.stringify({result}));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          (res as ServerResponse).end(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Gemini request failed',
            }),
          );
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), geminiDevApi(env.GEMINI_API_KEY)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});