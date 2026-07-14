export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const text = url.searchParams.get('text') || '';
    
    // Set CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'audio/mpeg'
    };
    
    if (!text.trim()) {
        return new Response(JSON.stringify({ error: 'Missing text parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    try {
        // Fetch from Google Translate TTS (limited to 200 characters)
        const cleanText = text.trim().substring(0, 200);
        const targetUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
        
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Google TTS fetch failed with status ${response.status}`);
        }
        
        // Stream the MP3 binary back to the client
        return new Response(response.body, {
            status: 200,
            headers: corsHeaders
        });
        
    } catch (e) {
        console.error('TTS Proxy failed:', e);
        return new Response(JSON.stringify({ error: e.message || 'TTS generation failed' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestOptions(context) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}
