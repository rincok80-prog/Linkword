export async function onRequestOptions(context) {
    // Cloudflare Smart Placement trigger comment
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
        const GEMINI_KEY = env.GEMINI_KEY || "";
        
        if (!GEMINI_KEY) {
            return new Response(JSON.stringify({ error: 'Missing GEMINI_KEY environment variable. Please configure it in your Cloudflare dashboard.' }), {
                status: 400,
                headers: corsHeaders
            });
        }
        
        const prompt = `您是英语教学与联想记忆专家。请使用以下单词：[${words.join(', ')}]。
请用通俗易懂的初中词汇创作一段极简（不超过3句话）、生动有趣的英语小故事，帮助学生快速联想并牢记这几个单词。

请严格以无任何额外文字、无 markdown 包裹的纯 JSON 格式返回：
{
  "story": "小故事内容（在故事中必须出现所有输入的单词，并用 <strong>单词</strong> 标签加粗标出目标词，故事必须极简易懂）",
  "story_translation": "对应故事的中文翻译",
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

注意：
1. 故事必须生动有趣、逻辑通顺，所有英文句子和例句必须非常简单易懂。
2. 为了防止 JSON 解析失败，故事或例句中如需使用引号，请使用单引号（'），绝对不要在 JSON 属性值内直接使用未转义的双引号（"）。`;

        // 1. Primary Engine: WeChat Official Coding Plan AI (Deepseek-v4-flash)
        const WECHAT_TOKEN = env.WECHAT_AI_TOKEN || "eNN5jggBEAEaHwgBEhsxNzg2MzU1NDc2NjQwNjEzODIyWXBBbG9OMEMiGAgDEhQIAxIQbflVtDgf67nkYU9Hlvbr9w==";
        
        try {
            const wechatResp = await fetch("https://chatapi.weixin.qq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${WECHAT_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "Deepseek-v4-flash",
                    messages: [
                        {
                            role: "system",
                            content: "You are a professional assistant that outputs ONLY pure, valid JSON format strings."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.3
                })
            });

            if (wechatResp.ok) {
                const wechatJson = await wechatResp.json();
                let rawText = wechatJson?.choices?.[0]?.message?.content || "";
                rawText = rawText.trim();
                
                if (rawText.startsWith("```")) {
                    rawText = rawText.replace(/^```[a-zA-Z]*\n?/, "");
                }
                if (rawText.endsWith("```")) {
                    rawText = rawText.replace(/```$/, "");
                }
                rawText = rawText.trim();

                const firstBrace = rawText.indexOf('{');
                const lastBrace = rawText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    rawText = rawText.substring(firstBrace, lastBrace + 1);
                }

                JSON.parse(rawText);

                return new Response(rawText, {
                    status: 200,
                    headers: corsHeaders
                });
            }
        } catch (wechatErr) {
            console.error("WeChat AI Engine fallback to Gemini:", wechatErr);
        }

        // 2. Fallback Engine: Google Gemini Flash
        const GEMINI_KEY = env.GEMINI_KEY || "";
        const proxyHost = (env.PROXY_HOST || '').replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
        const apiHost = proxyHost || 'generativelanguage.googleapis.com';

        if (!GEMINI_KEY) {
            return new Response(JSON.stringify({ error: 'AI generation service temporarily unavailable.' }), {
                status: 500,
                headers: corsHeaders
            });
        }

        const response = await fetch(`https://${apiHost}/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_KEY}`, {
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
                            }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.5
                }
            })
        });
        
        const respText = await response.text();
        if (response.status !== 200) {
            throw new Error(`Gemini API error (HTTP ${response.status}): ${respText}`);
        }
        
        const data = JSON.parse(respText);
        let jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        jsonText = jsonText.trim();
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            jsonText = jsonText.substring(firstBrace, lastBrace + 1);
        }
        
        JSON.parse(jsonText);
        
        return new Response(jsonText, {
            status: 200,
            headers: corsHeaders
        });
        
    } catch (e) {
        console.error('Execution failed:', e);
        return new Response(JSON.stringify({ error: e.message || 'Execution failed' }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
