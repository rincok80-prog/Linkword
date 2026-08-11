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
        
        const WECHAT_TOKEN = env.WECHAT_AI_TOKEN || "eNN5jggBEAEaHwgBEhsxNzg2MzU1NDc2NjQwNjEzODIyWXBBbG9OMEMiGAgDEhQIAxIQbflVtDgf67nkYU9Hlvbr9w==";
        
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

        const prompt = `您是英语教学与联想记忆创意大师。
目标单词列表：[${promptWordItems.join(', ')}]。
整体风格：【${styleDesc}】
本次灵感场景设定：【${randomTheme}】（创作编号: ${randomSeed}）
${lengthNote}
${hasSpecifiedMeanings ? '【强制词义约束】：如果某个单词标注了【强制指定含义】，故事剧情与例句必须 100% 严格采用该指定释义，绝对严禁使用其他无关的常见释义！' : ''}

请用通俗易懂的初中词汇，根据上述要求${lengthDesc}，帮助学生通过场景联想牢固记住这几个单词。

【关键要求】：
1. 篇幅长度必须严格符合【${lengthNote}】！
2. 每次构思必须具备独创性与新鲜感，采用全新的故事角色、情节与视角，绝对不要重复以往的套路！
3. 故事中必须自然包含所有目标词，并用 <strong>目标词</strong> 标签加粗标出。
4. 为每个目标词提供全新的通俗例句（5-8个词，结合当前语境）。
5. 针对每个单词，请在 alt_meanings 中列出 2-3 个该词在考试/日常中的【其他不同常用中文含义】，以便学生学习一词多义。
6. 【真实准确词条要求】：words 数组中每个单词的 ipa（音标）、pos（词性）、definition（中文释义）必须是该单词真实准确的大纲词典信息（如 ignore 必须给出 v. 忽视；不理，IPA 给出真实音标 /ɪɡˈnɔːr/），绝对严禁输出任何类似'核心常用释义'、'n./v./adj.'或'Always practice using'等敷衍性占位字符！

请严格以无任何额外解释、纯 JSON 格式输出：
{
  "story": "微故事英文内容（必须自然包含所有输入单词，并用 <strong>单词</strong> 加粗）",
  "story_translation": "通俗生动的中文对照翻译",
  "words": [
    {
      "word": "单词原形（例如 plant）",
      "ipa": "美式音标，例如 /'prɪstiːn/",
      "pos": "词性，例如 n.",
      "definition": "当前故事中采用的中文释义（若有指定含义请严格使用该含义）",
      "sentence": "5-8个词的极其简单的新例句",
      "alt_meanings": [
        { "pos": "n.", "def": "其他常用释义1" },
        { "pos": "v.", "def": "其他常用释义2" }
      ]
    }
  ]
}

注意：为了防止 JSON 解析失败，字符串内如有引号请使用单引号（'），严禁在 JSON 属性值内直接使用未转义的双引号（"）。`;

        // Sole Engine: WeChat Official Coding Plan AI (Deepseek-v4-flash)
        let lastErr = null;

function repairAndParseJson(str) {
    let clean = (str || "").trim();
    if (clean.startsWith("```")) {
        clean = clean.replace(/^```[a-zA-Z]*\n?/, "");
    }
    if (clean.endsWith("```")) {
        clean = clean.replace(/```$/, "");
    }
    clean = clean.trim();

    const firstBrace = clean.indexOf('{');
    if (firstBrace !== -1) {
        clean = clean.substring(firstBrace);
    }
    const lastBrace = clean.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace > firstBrace) {
        try {
            return JSON.parse(clean.substring(0, lastBrace + 1));
        } catch (e) {}
    }

    try {
        return JSON.parse(clean);
    } catch (e) {
        let repaired = clean.replace(/[,:\s]+$/, "");
        let inString = false;
        for (let i = 0; i < repaired.length; i++) {
            if (repaired[i] === '"' && (i === 0 || repaired[i-1] !== '\\')) {
                inString = !inString;
            }
        }
        if (inString) repaired += '"';
        repaired = repaired.replace(/[,:\s]+$/, "");

        let stack = [];
        inString = false;
        for (let i = 0; i < repaired.length; i++) {
            const ch = repaired[i];
            if (ch === '"' && (i === 0 || repaired[i-1] !== '\\')) {
                inString = !inString;
            } else if (!inString) {
                if (ch === '{' || ch === '[') stack.push(ch);
                else if (ch === '}' && stack[stack.length - 1] === '{') stack.pop();
                else if (ch === ']' && stack[stack.length - 1] === '[') stack.pop();
            }
        }

        while (stack.length > 0) {
            const opening = stack.pop();
            repaired = repaired.replace(/[,:\s]+$/, "");
            if (opening === '{') repaired += '}';
            else if (opening === '[') repaired += ']';
        }

        return JSON.parse(repaired);
    }
}

        for (let attempt = 1; attempt <= 2; attempt++) {
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
                                content: "You are a creative English learning assistant. Output ONLY pure, valid JSON format strings."
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                        temperature: 0.85,
                        top_p: 0.9
                    })
                });

                if (wechatResp.ok) {
                    const wechatJson = await wechatResp.json();
                    let rawText = wechatJson?.choices?.[0]?.message?.content || "";
                    const parsedObj = repairAndParseJson(rawText);

                    return new Response(JSON.stringify(parsedObj), {
                        status: 200,
                        headers: corsHeaders
                    });
                } else {
                    const errText = await wechatResp.text();
                    lastErr = new Error(`WeChat AI API Error (${wechatResp.status}): ${errText}`);
                }
            } catch (err) {
                lastErr = err;
            }
        }

        return new Response(JSON.stringify({ error: lastErr?.message || '微信 AI 引擎生成失败，请稍后重试。' }), {
            status: 500,
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
