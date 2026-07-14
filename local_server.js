const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const SILICONFLOW_KEY = "sk-caucwtkqzlmewpazllitwirjdyvfvqtmyusvwffqvtjhtprm";
const SILICONFLOW_MODEL = "Qwen/Qwen2.5-7B-Instruct";

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    
    // Log incoming requests
    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);
    
    // Enable CORS for all API endpoints
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // API Route 1: Free AI Generation (Proxied to SiliconFlow using native Node fetch)
    if (pathname === '/api/generate' && req.method === 'POST') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        req.on('end', async () => {
            try {
                const reqData = JSON.parse(bodyStr);
                const words = reqData.words;
                if (!words || !Array.isArray(words) || words.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Missing words array' }));
                }
                
                const prompt = `您是一位创意英语名师。请使用以下单词：[${words.join(', ')}]。
请严格按照以下 JSON 结构返回结果，不要带任何 markdown 的包裹标记（如 \`\`\`json），直接输出 raw JSON 字符串。

JSON Schema 结构：
{
  "story": "用这几个单词串联写的一段生动有趣的微型英语故事或场景描述（限 3-4 句话，简单易懂）。在故事中用 <strong>单词</strong> 标签标出这几个目标单词，如 <strong>pristine</strong>。",
  "story_translation": "该英文联想故事的对应中文翻译，帮助理解故事内容。",
  "words": [
    {
      "word": "单词",
      "ipa": "美式音标，例如 /'prɪstiːn/",
      "pos": "词性，例如 adj.",
      "definition": "精炼的中文解释，例如: 崭新的；原始的",
      "sentence": "针对该词的简单实用例句"
    }
  ]
}

注意：
1. 故事必须把用户提供的所有单词合理、符合逻辑地串联起来。
2. 返回格式必须是合法的、可以直接被 JSON.parse 解析的字符串。
3. 故事必须是纯英文，story_translation 为故事的中文翻译，词汇卡片的释义为中文。`;
                
                console.log(`[SiliconFlow] Calling API for words: ${words.join(', ')}`);
                
                // Use Node.js built-in global fetch (stable in Node v18+)
                const apiRes = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SILICONFLOW_KEY}`
                    },
                    body: JSON.stringify({
                        model: SILICONFLOW_MODEL,
                        messages: [
                            { role: 'system', content: 'You are a helpful assistant that outputs only valid JSON strings without code blocks.' },
                            { role: 'user', content: prompt }
                        ],
                        response_format: { type: "json_object" }
                    })
                });
                
                console.log(`[SiliconFlow] HTTP Status: ${apiRes.status}`);
                
                if (!apiRes.ok) {
                    const errorText = await apiRes.text();
                    console.error(`[SiliconFlow] API Error Response: ${errorText}`);
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: `AI provider error: HTTP ${apiRes.status}` }));
                }
                
                const data = await apiRes.json();
                let jsonText = data.choices?.[0]?.message?.content || '';
                
                // Clean markdown wrapper tags if present
                jsonText = jsonText.trim();
                if (jsonText.startsWith('```json')) jsonText = jsonText.substring(7);
                if (jsonText.endsWith('```')) jsonText = jsonText.substring(0, jsonText.length - 3);
                jsonText = jsonText.trim();
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(jsonText);
                
            } catch (err) {
                console.error('[Server Error] Exception inside /api/generate:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }
    
    // API Route 2: Dictionary Proxy (Optional helper if Youdao suggest fails in client)
    if (pathname === '/api/dict') {
        const word = parsedUrl.query.q;
        if (!word) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing word parameter q' }));
        }
        
        const youdaoUrl = `http://dict.youdao.com/suggest?q=${encodeURIComponent(word)}&num=1&doctype=json`;
        
        http.get(youdaoUrl, (proxyRes) => {
            let data = '';
            proxyRes.on('data', chunk => data += chunk);
            proxyRes.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            });
        }).on('error', (err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });
        return;
    }
    
    // Serve Static Files
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(__dirname, pathname);
    
    // Security check to prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Forbidden');
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Not Found');
        }
        
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        res.writeHead(200, { 
            'Content-Type': contentType,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Local server running at: http://localhost:${PORT}/`);
    console.log(`Free AI proxy routing (with native fetch) is ready!`);
});
