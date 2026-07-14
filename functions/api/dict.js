export async function onRequestGet(context) {
    const { request } = context;
    
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    const url = new URL(request.url);
    const word = url.searchParams.get('q');
    
    if (!word) {
        return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
            status: 400,
            headers: corsHeaders
        });
    }
    
    const youdaoUrl = `http://dict.youdao.com/suggest?q=${encodeURIComponent(word)}&num=1&doctype=json`;
    
    try {
        const response = await fetch(youdaoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        const data = await response.text();
        return new Response(data, {
            status: 200,
            headers: corsHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: corsHeaders
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
