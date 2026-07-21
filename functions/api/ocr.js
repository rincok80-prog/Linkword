export async function onRequestOptions(context) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    try {
        const reqData = await request.json().catch(() => ({}));
        const image = reqData.image; // base64 string
        const mime = reqData.mime || 'image/jpeg';
        
        if (!image) {
            return new Response(JSON.stringify({ error: 'Missing image data' }), {
                status: 400,
                headers: corsHeaders
            });
        }
        
        const GEMINI_KEY = env.GEMINI_KEY || "";
        if (!GEMINI_KEY) {
            return new Response(JSON.stringify({ error: 'Missing GEMINI_KEY environment variable. Please configure it in your Cloudflare dashboard.' }), {
                status: 400,
                headers: corsHeaders
            });
        }
        
        const prompt = "You are a professional vocabulary extraction assistant. Analyze the image and extract all the English vocabulary words from the image, focusing especially on those that are highlighted by the yellow brush, bolded, or marked by the user. Return a clean list of extracted unique English words, separated by commas (e.g. nostalgia, obsolete, pristine). Output ONLY the comma-separated list of words, no markdown, no other text. Do not explain anything.";

        // Use stable high-quota gemini-3.1-flash-lite
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            },
                            {
                                inlineData: {
                                    mimeType: mime,
                                    data: image
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.1
                }
            })
        });
        
        const respText = await response.text();
        if (response.status !== 200) {
            return new Response(JSON.stringify({ error: `Gemini API error (HTTP ${response.status}): ${respText}` }), {
                status: response.status,
                headers: corsHeaders
            });
        }
        
        const data = JSON.parse(respText);
        let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        resultText = resultText.trim();
        
        return new Response(JSON.stringify({ text: resultText }), {
            status: 200,
            headers: corsHeaders
        });
        
    } catch (e) {
        console.error('OCR failed:', e);
        return new Response(JSON.stringify({ error: e.message || 'OCR extraction failed' }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
