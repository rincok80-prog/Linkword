export async function onRequestOptions(context) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    
    // Set CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    try {
        const reqData = await request.json().catch(() => ({}));
        const words = reqData.words;
        if (!words || !Array.isArray(words) || words.length === 0) {
            return new Response(JSON.stringify({ error: 'Missing words array in body' }), {
                status: 400,
                headers: corsHeaders
            });
        }
        
        // Environment Variable priority
        const SILICONFLOW_KEY = env.SILICONFLOW_KEY || "sk-caucwtkqzlmewpazllitwirjdyvfvqtmyusvwffqvtjhtprm";
        
        const prompt = `您是英语老师。请使用以下单词：[${words.join(', ')}]。
请用极其简单、好懂的初中词汇写一段3句话的英语小故事。

请严格以无任何 markdown 包裹标记的纯 JSON 字符串返回：
{
  "story": "小故事内容（在故事中用 <strong>单词</strong> 标签标出目标词，故事必须极简、通俗好懂，避免任何复杂的从句）",
  "story_translation": "故事的中文翻译",
  "words": [
    {
      "word": "目标词",
      "ipa": "美式音标，例如 /'prɪstiːn/",
      "pos": "词性，例如 adj.",
      "definition": "10字以内最常用的中文解释",
      "sentence": "5-8个词的极其简单的例句"
    }
  ]
}

注意：故事必须逻辑通顺，所有英文句子和例句必须非常简单易懂。为了防止 JSON 解析失败，如果英文故事或例句中需要使用引号，请必须使用单引号（'），绝对不要在 JSON 的属性值内直接使用未转义的双引号（"）。`;

        async function callAPI(modelName) {
            const body = JSON.stringify({
                model: modelName,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that outputs only valid JSON strings.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 800,
                temperature: 0.5
            });
            
            const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SILICONFLOW_KEY}`
                },
                body: body
            });
            
            if (response.status === 200) {
                return await response.text();
            } else {
                const errText = await response.text();
                throw { statusCode: response.status, body: errText };
            }
        }
        
        let responseData;
        try {
            console.log("Trying Pro high-speed channel...");
            responseData = await callAPI("Qwen/Qwen2.5-14B-Instruct");
        } catch (err) {
            if (err && err.statusCode === 403) {
                console.log("Balance is 0. Falling back to free model Qwen3-8B...");
                responseData = await callAPI("Qwen/Qwen3-8B");
            } else {
                throw err;
            }
        }
        
        const data = JSON.parse(responseData);
        let jsonText = data.choices?.[0]?.message?.content || '';
        
        jsonText = jsonText.trim();
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            jsonText = jsonText.substring(firstBrace, lastBrace + 1);
        }
        
        // Verify JSON parse
        JSON.parse(jsonText);
        
        return new Response(jsonText, {
            status: 200,
            headers: corsHeaders
        });
        
    } catch (e) {
        console.error('Execution failed:', e);
        const errorDetail = e.body || e.message || JSON.stringify(e);
        return new Response(JSON.stringify({ error: `Execution failed: ${errorDetail}` }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
