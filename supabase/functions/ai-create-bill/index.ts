// ai-create-bill/index.ts
// Deploy as a Supabase Edge Function. Requires GEMINI_API_KEY secret.

type Participant = { id: string; name: string };

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

function isUUID(uuid: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

function validateParticipants(participants: unknown): Participant[] | null {
  if (!Array.isArray(participants) || participants.length === 0) return null;
  const out: Participant[] = [];
  for (const p of participants) {
    if (
      typeof p !== 'object' ||
      p === null ||
      typeof (p as any).id !== 'string' ||
      typeof (p as any).name !== 'string'
    )
      return null;
    if (!isUUID((p as any).id)) return null;
    out.push({ id: (p as any).id, name: (p as any).name });
  }
  return out;
}

function buildSystemPrompt(participants: Participant[], userPrompt: string) {
  const participantList = participants
    .map((p) => `- ${p.name} → id: "${p.id}"`)
    .join('\n');

  return `You are a bill-splitting assistant. Analyze the receipt image and follow the user's instructions exactly.

These are the ONLY participants (use their exact IDs in assignedTo):
${participantList}

User's instructions: "${userPrompt}"

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
      "assignedTo": ["userId", ...],
      "splitMethod": "specific"|"equal"|"percentage",
      "percentages": { "userId": 50 } | null
    }
  ]
}

Rules:
- Use ONLY the participant IDs listed above — never invent new IDs
- "everyone" or "all" in the prompt means all participant IDs
- If the prompt doesn't mention an item, split it equally among everyone
- Names in the prompt may be first name only — match to the closest participant
- splitMethod "specific" = one person pays the full item (assignedTo has exactly 1 ID)
- splitMethod "equal" = item split equally among assignedTo
- splitMethod "percentage" = percentages object must be provided and sum to 100
- totalAmount must equal the sum of all item totalPrices
- Round all prices to 2 decimal places`;
}

async function callGemini(
  prompt: string,
  mimeType: string,
  base64Image: string
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Model API key not configured');

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } },
        ],
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error('Gemini API error:', res.status, txt);
    throw new Error('Upstream model error');
  }

  const data = await res.json();

  // Standard Gemini response: candidates[0].content.parts[0].text
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text === 'string' && text.trim().length > 0) return text;

  console.error('Unexpected Gemini response shape:', JSON.stringify(data));
  throw new Error('Empty response from model');
}

function stripCodeFences(text: string) {
  return text.replace(/```json\s*([\s\S]*?)```/g, '$1').replace(/```/g, '').trim();
}

function safeParseJSON(text: string) {
  const cleaned = stripCodeFences(text);

  // 1. Try direct parse
  try { return JSON.parse(cleaned); } catch { /* fallthrough */ }

  // 2. Find outermost {...} and try parsing that
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)); } catch { /* fallthrough */ }
  }

  // 3. Scan forward finding the largest valid JSON object
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

    const { imageUrl, imageBase64, mimeType: mimeTypeParam, participants, prompt } = payload as {
      imageUrl?: string;
      imageBase64?: string;
      mimeType?: string;
      participants?: unknown;
      prompt?: string;
    };

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'prompt (string) is required' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    const validParticipants = validateParticipants(participants);
    if (!validParticipants) {
      return new Response(
        JSON.stringify({ error: 'participants must be a non-empty array of {id: uuid, name: string}' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    let base64Image: string;
    let mimeType: string;

    if (imageBase64 && typeof imageBase64 === 'string') {
      // Direct base64 from client
      base64Image = imageBase64;
      mimeType = mimeTypeParam || 'image/jpeg';
    } else if (imageUrl && typeof imageUrl === 'string') {
      // Fetch from URL (used for dashboard testing)
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        console.error('Failed to fetch image:', imageUrl, imageRes.status);
        return new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }
      mimeType = imageRes.headers.get('content-type') || 'image/jpeg';
      const ab = await imageRes.arrayBuffer();
      base64Image = arrayBufferToBase64(ab);
    } else {
      return new Response(
        JSON.stringify({ error: 'imageBase64 or imageUrl is required' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = buildSystemPrompt(validParticipants, prompt);
    const modelText = await callGemini(systemPrompt, mimeType, base64Image);
    const parsed = safeParseJSON(modelText);

    if (!parsed || !Array.isArray(parsed.items)) {
      console.error('Parsed response invalid', parsed);
      return new Response(JSON.stringify({ error: 'Model returned invalid structure' }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ai-create-bill error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
});
