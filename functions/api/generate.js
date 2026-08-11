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
        
        const GEMINI_KEY = env.GEMINI_KEY || "";
        
        const parsedWords = words.map(item => {
            if (typeof item === 'string') {
                const match = item.match(/^([a-zA-Z\s-]+)(?:[\(（:：](.+?)[\)）]?)?$/);
                if (match) {
                    const rawW = match[1].trim();
                    const rawMeaning = match[2] ? match[2].trim() : '';
                    return { word: rawW, specifiedMeaning: rawMeaning };
                }
                return { word: item.trim(), specifiedMeaning: '' };
            } else if (item && typeof item === 'object') {
                return {
                    word: (item.word || '').trim(),
                    specifiedMeaning: (item.meaning || item.specifiedMeaning || '').trim()
                };
            }
            return { word: String(item).trim(), specifiedMeaning: '' };
        }).filter(w => w.word.length > 0);

        const promptWordItems = parsedWords.map(w => {
            if (w.specifiedMeaning) {
                return `${w.word} (【强制指定含义】: ${w.specifiedMeaning})`;
            }
            return w.word;
        });

        const hasSpecifiedMeanings = parsedWords.some(w => w.specifiedMeaning);

        const style = reqData.style || 'humorous';
        let styleDesc = "幽默搞笑、情节反转出人意料，让人忍俊不禁";
        if (style === 'scifi') {
            styleDesc = "未来科幻冒险、充满想象力与奇幻探索感";
        } else if (style === 'mystery') {
            styleDesc = "微悬疑推理、福尔摩斯侦探解谜与线索反转";
        } else if (style === 'warm') {
            styleDesc = "温馨治愈、温暖日常与充满治愈正能量";
        }

        const length = reqData.length || 'short';
        let lengthDesc = "创作极短的一到两句话（1-2句话，不超过35词），极简精炼，直击要点，快速形成记忆联结";
        let lengthNote = "故事篇幅要求：【极简速记（严格控制在1-2句话以内）】";

        if (length === 'medium') {
            lengthDesc = "创作一段通俗易懂的微故事（3-4句话，约50-70词），情节生动、起承转合自然";
            lengthNote = "故事篇幅要求：【标准故事（严格控制在3-4句话）】";
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
            "宠物猫狗秘密策划的拯救零食大行动"
        ];

        const randomTheme = creativeThemes[Math.floor(Math.random() * creativeThemes.length)];
        const randomSeed = Math.floor(Math.random() * 1000000);

        const maxTokens = length === 'short' ? 190 : length === 'medium' ? 320 : 450;

        const prompt = `您是英语教学大师。请为单词列表: [${promptWordItems.join(', ')}] 创作极简趣味联想微故事。
灵感场景: 【${randomTheme}】（编号: ${randomSeed}）。
要求：
1. 篇幅：【${lengthNote}】，${lengthDesc}。
${hasSpecifiedMeanings ? '2. 强制词义约束：带【强制指定含义】的单词必须100%采用指定释义。' : ''}
3. 故事中目标词用 <strong>单词</strong> 加粗。
4. 提供音标、词性、故事中的含义、5-8词极简例句，以及 2 个该词的其他常用中文释义(alt_meanings)。

必须输出无额外说明的纯 JSON 格式：
{
  "story": "英文微故事（包含 <strong>单词</strong>）",
  "story_translation": "中文对照翻译",
  "words": [
    {
      "word": "plant",
      "ipa": "/plænt/",
      "pos": "n.",
      "definition": "工厂",
      "sentence": "He works in a plant.",
      "alt_meanings": [
        { "pos": "n.", "def": "植物" }
      ]
    }
  ]
}`;

        const SILICON_KEY = env.SILICONFLOW_KEY || "sk-caucwtkqzlmewpazllitwirjdyvfvqtmyusvwffqvtjhtprm";
        const WECHAT_TOKEN = env.WECHAT_AI_TOKEN || "eNN5jggBEAEaHwgBEhsxNzg2MzU1NDc2NjQwNjEzODIyWXBBbG9OMEMiGAgDEhQIAxIQbflVtDgf67nkYU9Hlvbr9w==";
        const proxyHost = (env.PROXY_HOST || '').replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
        const apiHost = proxyHost || 'generativelanguage.googleapis.com';

        const fetchWithTimeout = async (url, options, timeoutMs = 4500) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const resp = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(timer);
                return resp;
            } catch (err) {
                clearTimeout(timer);
                throw err;
            }
        };

        const tasks = [];

        // Engine 1: SiliconFlow Qwen2.5-7B-Instruct (⚡ Ultra-fast 1.8s - 3s response)
        if (SILICON_KEY) {
            tasks.push((async () => {
                const resp = await fetchWithTimeout("https://api.siliconflow.cn/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${SILICON_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "Qwen/Qwen2.5-7B-Instruct",
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.7,
                        max_tokens: maxTokens
                    })
                }, 8000);
                if (!resp.ok) throw new Error(`SiliconFlow HTTP ${resp.status}`);
                const data = await resp.json();
                let raw = data?.choices?.[0]?.message?.content || "";
                raw = raw.trim();
                const firstBrace = raw.indexOf('{');
                const lastBrace = raw.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    raw = raw.substring(firstBrace, lastBrace + 1);
                }
                JSON.parse(raw);
                return raw;
            })());
        }

        // Engine 2: Google Gemini 1.5 Flash (⚡ Ultra-fast)
        if (GEMINI_KEY) {
            tasks.push((async () => {
                const geminiUrl = `https://${apiHost}/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
                const resp = await fetchWithTimeout(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            responseMimeType: "application/json",
                            temperature: 0.75,
                            maxOutputTokens: maxTokens
                        }
                    })
                }, 8000);
                if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}`);
                const data = await resp.json();
                let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                raw = raw.trim();
                const firstBrace = raw.indexOf('{');
                const lastBrace = raw.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    raw = raw.substring(firstBrace, lastBrace + 1);
                }
                JSON.parse(raw);
                return raw;
            })());
        }

        // Engine 3: WeChat AI Deepseek-v4-flash
        if (WECHAT_TOKEN) {
            tasks.push((async () => {
                const resp = await fetchWithTimeout("https://chatapi.weixin.qq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${WECHAT_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "Deepseek-v4-flash",
                        messages: [
                            { role: "system", content: "You are an English learning assistant. Output ONLY valid JSON strings." },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.85,
                        max_tokens: maxTokens
                    })
                }, 10000);
                if (!resp.ok) throw new Error(`WeChat AI HTTP ${resp.status}`);
                const data = await resp.json();
                let raw = data?.choices?.[0]?.message?.content || "";
                raw = raw.trim();
                if (raw.startsWith("```")) raw = raw.replace(/^```[a-zA-Z]*\n?/, "");
                if (raw.endsWith("```")) raw = raw.replace(/```$/, "");
                raw = raw.trim();
                const firstBrace = raw.indexOf('{');
                const lastBrace = raw.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    raw = raw.substring(firstBrace, lastBrace + 1);
                }
                JSON.parse(raw);
                return raw;
            })());
        }

        try {
            const fastestWinnerJson = await Promise.any(tasks);
            return new Response(fastestWinnerJson, {
                status: 200,
                headers: corsHeaders
            });
        } catch (anyErr) {
            console.error("All AI Engines failed:", anyErr);
            return new Response(JSON.stringify({ error: 'AI generation service temporarily unavailable.' }), {
                status: 500,
                headers: corsHeaders
            });
        }
        
    } catch (e) {
        console.error('Execution failed:', e);
        return new Response(JSON.stringify({ error: e.message || 'Execution failed' }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
