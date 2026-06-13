import type {Handler, HandlerEvent} from '@netlify/functions';
import {handleGeminiRequest, type GeminiRequest} from '../lib/gemini-handler';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return {statusCode: 204, headers, body: ''};
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({error: 'Method not allowed'}),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({error: 'GEMINI_API_KEY is not configured'}),
    };
  }

  try {
    const request = JSON.parse(event.body || '{}') as GeminiRequest;
    if (request.type !== 'text' && request.type !== 'image') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({error: 'Invalid request type'}),
      };
    }

    const result = await handleGeminiRequest(apiKey, request);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({result}),
    };
  } catch (error) {
    console.error('Gemini function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Gemini request failed',
      }),
    };
  }
};