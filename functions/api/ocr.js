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
        
        const SILICONFLOW_KEY = env.SILICONFLOW_KEY || "sk-caucwtkqzlmewpazllitwirjdyvfvqtmyusvwffqvtjhtprm";
        
        const prompt = "You are a professional vocabulary extraction assistant. Analyze the image and extract only the target vocabulary words (bolded words, vocabulary list words, new words, or highlighted words on the page). Avoid common grammar words (like 'the', 'is', 'and', 'of', 'to', 'in', 'it', 'he', 'she', 'they', etc.) and simple daily words. Return a clean list of extracted unique English vocabulary words, sorted, separated by commas (e.g. nostalgia, obsolete, pristine). Output ONLY the comma-separated list of words, no markdown, no other text.";

        const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SILICONFLOW_KEY}`
            },
            body: JSON.stringify({
                model: 'Qwen/Qwen3-VL-8B-Instruct',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mime};base64,${image}`
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.1
            })
        });
        
        const respText = await response.text();
        if (response.status !== 200) {
            return new Response(JSON.stringify({ error: `SiliconFlow API error: ${respText}` }), {
                status: response.status,
                headers: corsHeaders
            });
        }
        
        const data = JSON.parse(respText);
        let resultText = data.choices?.[0]?.message?.content || '';
        
        // Clean up any extra text
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
