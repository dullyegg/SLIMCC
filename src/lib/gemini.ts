export interface NutritionalInfo {
  name: string;
  category?: string;
  calories?: number;
  calories_kcal?: number;
  protein?: number;
  protein_g?: number;
  carbs?: number;
  carbs_g?: number;
  fat?: number;
  fat_g?: number;
  description?: string;
  source?: string;
  sodium_mg?: number;
  sugar_g?: number;
}

type GeminiRequest =
  | {type: 'text'; foodName: string}
  | {type: 'image'; base64Image: string; mimeType: string};

async function callGeminiApi(request: GeminiRequest): Promise<NutritionalInfo | null> {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Gemini request failed');
  }

  const payload = await response.json();
  return payload.result ?? null;
}

function toUserError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Gemini request failed';
  if (message.includes('GEMINI_API_KEY')) {
    return 'AI 服務未設定。請喺 Netlify 加入 GEMINI_API_KEY 環境變數後重新部署。';
  }
  return message;
}

export async function analyzeFoodText(foodName: string): Promise<NutritionalInfo | null> {
  try {
    return await callGeminiApi({type: 'text', foodName});
  } catch (err) {
    console.error('AI Text Error', err);
    throw new Error(toUserError(err));
  }
}

export async function analyzeFoodImage(
  base64Image: string,
  mimeType: string,
): Promise<NutritionalInfo | null> {
  try {
    return await callGeminiApi({type: 'image', base64Image, mimeType});
  } catch (err) {
    console.error('AI Image Error', err);
    throw new Error(toUserError(err));
  }
}