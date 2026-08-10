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
            // 1. Real-time Machine Translation (Google Translate engine on Cloudflare edge)
            try {
                const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(q)}`;
                const gtxResp = await fetch(gtxUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (gtxResp.ok) {
                    const gtxData = await gtxResp.json();
                    const fullTrans = (gtxData?.[0] || []).map(x => x?.[0]).join('').trim();
                    if (fullTrans && fullTrans.length > 1) {
                        results.push({
                            word: fullTrans,
                            pos: '实时整句/短语翻译',
                            def: q,
                            phonetic: '',
                            source: 'realtime_translator',
                            isChineseQuery: true,
                            isFullTranslation: true
                        });

                        // Extract individual keywords (words > 2 chars)
                        const words = fullTrans.split(/\s+/).map(w => w.replace(/[^a-zA-Z-]/g, '').trim()).filter(w => w.length > 2);
                        for (const singleWord of words) {
                            if (!results.some(r => r.word.toLowerCase() === singleWord.toLowerCase())) {
                                results.push({
                                    word: singleWord,
                                    pos: '重点单词',
                                    def: `源自: "${q}"`,
                                    phonetic: '',
                                    source: 'realtime_translator_word',
                                    isChineseQuery: true
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore translation error
            }

            // 2. Chinese-to-English: Fetch from Youdao suggest dictionary
            try {
                const youdaoUrl = `https://dict.youdao.com/suggest?q=${encodeURIComponent(q)}&num=12&doctype=json`;
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
                                    pos: '对应英文',
                                    def: entry || q,
                                    phonetic: '',
                                    source: 'online_translation',
                                    isChineseQuery: true
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore suggest error
            }
            
            // 3. Also fetch from CE (Chinese-English) dictionary
            try {
                const ceUrl = `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(q)}&dicts=%7B%22count%22%3A1%2C%22dicts%22%3A%5B%5B%22ce%22%5D%5D%7D`;
                const ceResp = await fetch(ceUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (ceResp.ok) {
                    const ceData = await ceResp.json();
                    const ceWords = ceData?.ce?.word || [];
                    for (const witem of ceWords) {
                        const trs = witem?.trs || [];
                        for (const tr of trs) {
                            for (const item of (tr?.tr || [])) {
                                const lObj = item?.l;
                                const pos = lObj?.pos || '对应英文';
                                const tran = lObj?.['#tran'] || q;
                                let iList = lObj?.i || [];
                                if (!Array.isArray(iList)) iList = [iList];
                                for (const iItem of iList) {
                                    let wordStr = '';
                                    if (typeof iItem === 'string') {
                                        wordStr = iItem;
                                    } else if (iItem && typeof iItem === 'object') {
                                        wordStr = iItem['#text'] || iItem.i || '';
                                    }
                                    const cleanW = wordStr.replace(/[^a-zA-Z\s-]/g, '').trim();
                                    if (cleanW && cleanW.length > 1 && !results.some(r => r.word.toLowerCase() === cleanW.toLowerCase())) {
                                        results.push({
                                            word: cleanW,
                                            pos: pos,
                                            def: tran || q,
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

            // 4. Attach phonetics to the top single-word candidates
            for (let i = 0; i < Math.min(results.length, 3); i++) {
                const w = results[i].word;
                if (/^[a-zA-Z-]+$/.test(w)) {
                    try {
                        const detailUrl = `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(w)}&dicts=%7B%22count%22%3A1%2C%22dicts%22%3A%5B%5B%22ec%22%5D%5D%7D`;
                        const detailResp = await fetch(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                        if (detailResp.ok) {
                            const detailData = await detailResp.json();
                            const ecWord = detailData?.ec?.word?.[0];
                            const phone = ecWord?.usphone || ecWord?.ukphone || ecWord?.phone || '';
                            if (phone) {
                                results[i].phonetic = `/${phone}/`;
                            }
                        }
                    } catch (e) {}
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
            
            // Fetch detailed phonetic or fallback for rare/uncommon words
            if (/^[a-zA-Z\s-]+$/.test(q)) {
                try {
                    const detailUrl = `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(q)}&dicts=%7B%22count%22%3A1%2C%22dicts%22%3A%5B%5B%22ec%22%2C%22web_trans%22%5D%5D%7D`;
                    const detailResp = await fetch(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    if (detailResp.ok) {
                        const detailData = await detailResp.json();
                        const ecWord = detailData?.ec?.word?.[0];
                        const phone = ecWord?.usphone || ecWord?.ukphone || ecWord?.phone || '';
                        
                        if (phone && results.length > 0 && results[0]) {
                            results[0].phonetic = `/${phone}/`;
                        }

                        // If suggest returned nothing, build from ec or web_trans
                        if (results.length === 0 && ecWord) {
                            const trs = ecWord?.trs || [];
                            let defs = [];
                            for (const tr of trs) {
                                for (const item of (tr?.tr || [])) {
                                    for (const l of (item?.l?.i || [])) {
                                        if (typeof l === 'string') defs.push(l);
                                    }
                                }
                            }
                            if (defs.length > 0) {
                                results.push({
                                    word: ecWord?.return_phrase || q,
                                    pos: '释义',
                                    def: defs.join('； '),
                                    phonetic: phone ? `/${phone}/` : '',
                                    source: 'online_full_dict',
                                    isChineseQuery: false
                                });
                            }
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
