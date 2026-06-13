import {GoogleGenAI} from '@google/genai';

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

const SYSTEM_INSTRUCTION = `
You are a nutritionist assistant. Provide nutritional information for the following food item.
If the input is an image, identify the food in the image first and then provide nutritional info.
Respond strictly in JSON format matching this schema:
{
  "name": "Exact food name",
  "calories": 100,
  "protein": 10,
  "carbs": 20,
  "fat": 5,
  "description": "A brief description of this food and typical serving size."
}
If you absolutely cannot identify any food, respond with standard JSON but set calories/macros to 0 and explain why in description.
`;

export type GeminiRequest =
  | {type: 'text'; foodName: string}
  | {type: 'image'; base64Image: string; mimeType: string};

function getClient(apiKey: string) {
  return new GoogleGenAI({apiKey});
}

export async function handleGeminiRequest(
  apiKey: string,
  request: GeminiRequest,
): Promise<NutritionalInfo | null> {
  const ai = getClient(apiKey);

  if (request.type === 'text') {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [request.foodName],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as NutritionalInfo;
  }

  const base64Data = request.base64Image.split(',')[1] ?? request.base64Image;
  if (!base64Data) {
    throw new Error('Invalid base64 string');
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        inlineData: {
          data: base64Data,
          mimeType: request.mimeType,
        },
      },
      'What food is in this image? Provide its nutritional data.',
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text;
  if (!text) return null;
  return JSON.parse(text) as NutritionalInfo;
}