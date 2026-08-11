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
        'Content-Type': 'application/json; charset=utf-8'
    };
    
    try {
        const reqData = await request.json().catch(() => ({}));
        let rawWords = reqData.words || [];
        const wordDefs = reqData.wordDefs || {};

        if (!rawWords || !Array.isArray(rawWords) || rawWords.length === 0) {
            return new Response(JSON.stringify({ error: 'Missing words array in body' }), {
                status: 400,
                headers: corsHeaders
            });
        }

        // Parse polysemous specified meanings if provided in "word (def)", "word:def", "word=def", or wordDefs
        const parsedWords = [];
        const specialDefInstructions = [];

        for (const item of rawWords) {
            if (typeof item === 'string') {
                const match = item.match(/^([a-zA-Z-]+)(?:[\s:：=\(\[（【]+([^,\n;；，\)\]）】]+)?[）\]】\)]?$/);
                if (match) {
                    const w = match[1].toLowerCase().trim();
                    const targetDef = match[2] ? match[2].trim() : (wordDefs[w] || '');
                    parsedWords.push(w);
                    if (targetDef) {
                        specialDefInstructions.push(`对于单词【${w}】，在故事和例句中必须严格使用其【${targetDef}】的含义，不可使用其他义项！词卡释义请写出【${targetDef}】。`);
                    }
                } else {
                    const cleanW = item.replace(/[^a-zA-Z-]/g, '').toLowerCase().trim();
                    if (cleanW) parsedWords.push(cleanW);
                }
            } else if (item && typeof item === 'object' && item.word) {
                const w = item.word.toLowerCase().trim();
                const targetDef = item.targetDef || item.def || wordDefs[w] || '';
                parsedWords.push(w);
                if (targetDef) {
                    specialDefInstructions.push(`对于单词【${w}】，在故事和例句中必须严格使用其【${targetDef}】的含义，不可使用其他义项！词卡释义请写出【${targetDef}】。`);
                }
            }
        }

        const uniqueWords = Array.from(new Set(parsedWords));
        if (uniqueWords.length === 0) {
            return new Response(JSON.stringify({ error: 'No valid words found' }), {
                status: 400,
                headers: corsHeaders
            });
        }
        
        const style = reqData.style || 'humorous';
        let styleDesc = "幽默搞笑、情节反转出人意料，让人忍俊不禁";
        if (style === 'scifi') {
            styleDesc = "未来科幻冒险、充满想象力与奇幻探索感";
        } else if (style === 'mystery') {
            styleDesc = "微悬疑推理、福尔摩斯侦探解谜与线索反转";
        } else if (style === 'warm') {
            styleDesc = "温馨治愈、温暖日常与充满治愈正能量";
        }

        const length = reqData.length || 'medium';
        let lengthDesc = "创作一段通俗易懂的微故事（3-4句话，约50-70词），情节生动、起承转合自然";
        let lengthNote = "故事篇幅要求：【标准故事（严格控制在3-4句话）】";

        if (length === 'short') {
            lengthDesc = "创作极短的一到两句话（1-2句话，不超过35词），极简精炼，直击要点，快速形成记忆联结";
            lengthNote = "故事篇幅要求：【极简速记（严格控制在1-2句话以内）】";
        } else if (length === 'long') {
            lengthDesc = "创作一段生动丰满的沉浸式微小说（5-6句话，约90-130词），包含丰富场景细节、角色对话与出人意料的情节反转";
            lengthNote = "故事篇幅要求：【沉浸长篇（生动丰满，包含5-6句话）】";
        }

        const creativeThemes = [
            "外星人光顾地球时闹出的搞笑乌龙",
            "魔法森林里萌宠动物们的奇妙日常",
            "校园里一次令人捧腹大笑的科学实验",
            "神奇厨房里厨具与食材的搞怪大冒险",
            "时光穿越者在古代闹出的荒诞趣事",
            "大侦探在破解离奇谜案时的意外神反转",
            "超级英雄度假期间啼笑皆非的日常生活",
            "深海王国里海洋生物举办的奇幻派对",
            "未来太空站里宇航员与傲娇机器人的逗趣互动",
            "宠物猫狗秘密策划的拯救零食大行动",
            "午夜奇幻游乐园里发生的不可思议奇遇",
            "神秘古堡探险时发现的搞笑宝藏",
            "魔法学院新生上第一堂飞行课的爆笑瞬间",
            "咖啡馆里一杯神奇饮品引发的连锁奇趣反应",
            "秘密特工执行任务时的滑稽意外"
        ];

        const randomTheme = creativeThemes[Math.floor(Math.random() * creativeThemes.length)];
        const randomSeed = Math.floor(Math.random() * 1000000);

        let specialDefBlock = "";
        if (specialDefInstructions.length > 0) {
            specialDefBlock = `\n【用户特别指定的单词义项要求】：\n` + specialDefInstructions.join('\n') + '\n';
        }

        const prompt = `您是英语教学与联想记忆创意大师。
目标单词列表：[${uniqueWords.join(', ')}]。
整体风格：【${styleDesc}】
本次灵感场景设定：【${randomTheme}】（创作编号: ${randomSeed}）
${lengthNote}
${specialDefBlock}
请用通俗易懂的初中词汇，根据上述要求${lengthDesc}，帮助学生通过场景联想牢固记住这几个单词${specialDefInstructions.length > 0 ? '及其指定含义' : ''}。

【关键要求】：
1. 篇幅长度必须严格符合【${lengthNote}】！
${specialDefInstructions.length > 0 ? '2. 故事必须精准体现用户指定的单词义项，词卡解释和例句也必须针对指定含义！\n' : ''}3. 每次构思必须具备独创性与新鲜感，采用全新的故事角色、情节与视角，绝对不要重复以往的套路！
4. 故事中必须自然包含所有目标词，并用 <strong>目标词</strong> 标签加粗标出。
5. 为每个目标词提供全新的通俗例句（5-8个词，结合当前语境）。

请严格以无任何额外解释、纯 JSON 格式输出：
{
  "story": "微故事英文内容（必须自然包含所有输入单词，并用 <strong>单词</strong> 加粗）",
  "story_translation": "通俗生动的中文对照翻译",
  "words": [
    {
      "word": "目标词",
      "ipa": "美式音标，例如 /'prɪstiːn/",
      "pos": "词性，例如 adj.",
      "definition": "10字以内最常用释义（如有指定义项必须匹配指定义项）",
      "sentence": "5-8个词的极其简单的新例句"
    }
  ]
}

注意：为了防止 JSON 解析失败，字符串内如有引号请使用单引号（'），严禁在 JSON 属性值内直接使用未转义的双引号（"）。`;

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
                            content: "You are a creative English learning assistant. Always generate unique, imaginative, and distinct stories on every single request. Output ONLY pure, valid JSON format strings."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.9,
                    top_p: 0.95
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
        const proxyHost = (env.PROXY_HOST || '').replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
        const apiHost = proxyHost || 'generativelanguage.googleapis.com';
        const GEMINI_KEY = env.GEMINI_KEY || "";

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
                    temperature: 0.92,
                    topP: 0.95
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
