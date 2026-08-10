export async function onRequestGet(context) {
    const { request } = context;
    
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8'
    };
    
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    
    if (!q) {
        return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
            status: 400,
            headers: corsHeaders
        });
    }
    
    const isChinese = /[\u4e00-\u9fa5]/.test(q);
    
    try {
        let results = [];
        
        if (isChinese) {
            // 1. Chinese-to-English: Fetch from Youdao suggest and CE dictionary
            const youdaoUrl = `https://dict.youdao.com/suggest?q=${encodeURIComponent(q)}&num=10&doctype=json`;
            const resp = await fetch(youdaoUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            
            if (resp.ok) {
                const data = await resp.json();
                const entries = data?.data?.entries || [];
                
                for (const item of entries) {
                    const entry = item.entry || '';
                    const explain = item.explain || '';
                    
                    // Split explain by comma, semicolon, slash
                    const rawCandidates = explain.split(/[,;；，/、\n]/);
                    for (const cand of rawCandidates) {
                        const cleanWord = cand.replace(/[^a-zA-Z\s-]/g, '').trim();
                        if (cleanWord && cleanWord.length > 1 && !results.some(r => r.word.toLowerCase() === cleanWord.toLowerCase())) {
                            results.push({
                                word: cleanWord,
                                pos: '释义',
                                def: entry || q,
                                phonetic: '',
                                source: 'online_translation',
                                isChineseQuery: true
                            });
                        }
                    }
                }
            }
            
            // Also fetch from CE (Chinese-English) dictionary if results are few
            if (results.length < 5) {
                try {
                    const ceUrl = `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(q)}&dicts=%7B%22count%22%3A1%2C%22dicts%22%3A%5B%5B%22ce%22%5D%5D%7D`;
                    const ceResp = await fetch(ceUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    if (ceResp.ok) {
                        const ceData = await ceResp.json();
                        const ceWords = ceData?.ce?.word || [];
                        for (const witem of ceWords) {
                            const trs = witem?.trs || [];
                            for (const tr of trs) {
                                const iList = tr?.tr?.[0]?.l?.i || [];
                                for (const item of iList) {
                                    if (typeof item === 'string') {
                                        const cleanW = item.replace(/[^a-zA-Z\s-]/g, '').trim();
                                        if (cleanW && cleanW.length > 1 && !results.some(r => r.word.toLowerCase() === cleanW.toLowerCase())) {
                                            results.push({
                                                word: cleanW,
                                                pos: '释义',
                                                def: q,
                                                phonetic: '',
                                                source: 'online_ce_dict',
                                                isChineseQuery: true
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Ignore CE errors
                }
            }
        } else {
            // 2. English-to-Chinese: Fetch English suggest
            const youdaoUrl = `https://dict.youdao.com/suggest?q=${encodeURIComponent(q)}&num=8&doctype=json`;
            const resp = await fetch(youdaoUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            
            if (resp.ok) {
                const data = await resp.json();
                const entries = data?.data?.entries || [];
                
                for (const item of entries) {
                    const entry = item.entry || '';
                    const explain = item.explain || '';
                    
                    let pos = '释义';
                    let def = explain;
                    const posMatch = explain.match(/^([a-z]+\.)\s*(.+)$/i);
                    if (posMatch) {
                        pos = posMatch[1];
                        def = posMatch[2];
                    }
                    
                    results.push({
                        word: entry,
                        pos: pos,
                        def: def,
                        phonetic: '',
                        source: 'online_dict',
                        isChineseQuery: false
                    });
                }
            }
            
            // Fetch detailed phonetic if single word
            if (/^[a-zA-Z-]+$/.test(q) && results.length > 0) {
                try {
                    const detailUrl = `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(q)}&dicts=%7B%22count%22%3A1%2C%22dicts%22%3A%5B%5B%22ec%22%5D%5D%7D`;
                    const detailResp = await fetch(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    if (detailResp.ok) {
                        const detailData = await detailResp.json();
                        const ecWord = detailData?.ec?.word?.[0];
                        const phone = ecWord?.usphone || ecWord?.ukphone || ecWord?.phone || '';
                        if (phone && results[0]) {
                            results[0].phonetic = `/${phone}/`;
                        }
                    }
                } catch (e) {
                    // Ignore detail fetch error
                }
            }
        }
        
        return new Response(JSON.stringify({
            query: q,
            isChinese: isChinese,
            results: results
        }), {
            status: 200,
            headers: corsHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({
            query: q,
            isChinese: isChinese,
            results: [],
            error: err.message
        }), {
            status: 200,
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
