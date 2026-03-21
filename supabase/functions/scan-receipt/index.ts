// scan-receipt/index.ts
// Deploy as a Supabase Edge Function. Requires GEMINI_API_KEY secret.

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const DEFAULT_CORS = '*';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? DEFAULT_CORS;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

function corsHeaders(origin = ALLOWED_ORIGIN) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    );
  }
  return btoa(binary);
}

function stripCodeFences(text: string) {
  return text.replace(/```json\s*([\s\S]*?)```/g, '$1').replace(/```/g, '').trim();
}

function safeParseJSON(text: string) {
  const cleaned = stripCodeFences(text);

  try { return JSON.parse(cleaned); } catch { /* fallthrough */ }

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)); } catch { /* fallthrough */ }
  }

  if (first !== -1) {
    let depth = 0;
    for (let i = first; i < cleaned.length; i++) {
      if (cleaned[i] === '{') depth++;
      else if (cleaned[i] === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(cleaned.slice(first, i + 1)); } catch { /* keep scanning */ }
        }
      }
    }
  }

  console.error('Failed to parse model response. Raw text:', text.slice(0, 500));
  throw new Error('Failed to parse JSON from model response');
}

const PROMPT = `You are a receipt scanner. Extract all line items from this receipt image and suggest bill metadata.

Return ONLY valid JSON, no markdown, no explanation:
{
  "suggestedTitle": "string",
  "suggestedCategory": "food"|"transport"|"utilities"|"entertainment"|"shopping"|"other",
  "totalAmount": 0.00,
  "items": [
    {
      "id": "unique_string",
      "name": "item name",
      "quantity": 1,
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "assignedTo": [],
      "splitMethod": "equal",
      "percentages": null
    }
  ]
}

Rules:
- suggestedTitle: short descriptive name for the bill (e.g. "Dinner at McDonald's", "Grocery Run")
- suggestedCategory: pick the most appropriate category from the list
- totalAmount: sum of all item totalPrices, rounded to 2 decimal places
- Extract every distinct item on the receipt
- quantity × unitPrice must equal totalPrice
- Round all prices to 2 decimal places
- Include taxes, fees, and shipping as separate line items
- assignedTo must always be an empty array []
- splitMethod must always be "equal"
- percentages must always be null`;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  if (ALLOWED_ORIGIN !== '*' && origin !== ALLOWED_ORIGIN) {
    return new Response('Origin not allowed', { status: 403, headers: corsHeaders('*') });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not set');
      return new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json().catch(() => null);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const { imageUrl, imageBase64, mimeType: mimeTypeParam } = payload as {
      imageUrl?: string;
      imageBase64?: string;
      mimeType?: string;
    };

    let base64Image: string;
    let mimeType: string;

    if (imageBase64 && typeof imageBase64 === 'string') {
      base64Image = imageBase64;
      mimeType = mimeTypeParam || 'image/jpeg';
    } else if (imageUrl && typeof imageUrl === 'string') {
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        console.error('Failed to fetch image:', imageUrl, imageRes.status);
        return new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }
      mimeType = imageRes.headers.get('content-type') || 'image/jpeg';
      base64Image = arrayBufferToBase64(await imageRes.arrayBuffer());
    } else {
      return new Response(
        JSON.stringify({ error: 'imageBase64 or imageUrl is required' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType, data: base64Image } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('Gemini API error:', res.status, txt);
      return new Response(JSON.stringify({ error: 'Upstream model error' }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof text !== 'string' || !text.trim()) {
      console.error('Unexpected Gemini response shape:', JSON.stringify(data));
      return new Response(JSON.stringify({ error: 'Empty response from model' }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const parsed = safeParseJSON(text);

    if (!parsed || !Array.isArray(parsed.items)) {
      console.error('Parsed response invalid:', parsed);
      return new Response(JSON.stringify({ error: 'Model returned invalid structure' }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      suggestedTitle: parsed.suggestedTitle || 'Scanned Receipt',
      suggestedCategory: parsed.suggestedCategory || 'other',
      totalAmount: parsed.totalAmount || parsed.items.reduce((s: number, i: any) => s + (i.totalPrice || 0), 0),
      items: parsed.items,
    }), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('scan-receipt error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
});
