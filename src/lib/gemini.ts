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

export async function analyzeFoodText(foodName: string): Promise<NutritionalInfo | null> {
  try {
    return await callGeminiApi({type: 'text', foodName});
  } catch (err) {
    console.error('AI Text Error', err);
    return null;
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
    return null;
  }
}