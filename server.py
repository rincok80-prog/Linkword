import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import os
import sys
import time

# Force stdout/stderr to use UTF-8 to completely prevent GBK UnicodeEncodeErrors in Windows console
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

PORT = 3000
SILICONFLOW_KEY = "sk-caucwtkqzlmewpazllitwirjdyvfvqtmyusvwffqvtjhtprm"

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching completely
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == '/api/generate':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                words = req_data.get('words', [])
                provider = req_data.get('provider', 'local')
                client_key = req_data.get('apiKey', '').strip()
                client_model = req_data.get('apiModel', '').strip()
                client_endpoint = req_data.get('apiEndpoint', '').strip()
                
                if not words:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Missing words"}).encode('utf-8'))
                    return
                
                print(f"[Python Server] Request received. Provider: {provider}, Words: {words}")
                
                # Setup universal Prompt with single-quote escaping warning
                prompt = f"""您是一位创意英语名师。请使用以下单词：[{', '.join(words)}]。
请用极其简单、好懂的初中词汇写一段3句话的英语小故事。

请严格以无任何 markdown 包裹标记的纯 JSON 字符串返回：
{{
  "story": "小故事内容（在故事中用 <strong>单词</strong> 标签标出目标词，故事必须极简、通俗好懂，避免任何复杂的从句）",
  "story_translation": "故事的中文翻译",
  "words": [
    {{
      "word": "目标词",
      "ipa": "美式音标，例如 /'prɪstiːn/",
      "pos": "词性，例如 adj.",
      "definition": "10字以内最常用的中文解释",
      "sentence": "5-8个词的极其简单的例句"
    }}
  ]
}}

注意：故事必须逻辑通顺，所有英文句子和例句必须非常简单易懂。为了防止 JSON 解析失败，如果英文故事或例句中需要使用引号，请必须使用单引号（'），绝对不要在 JSON 的属性值内直接使用未转义的双引号（"）。"""

                json_text = ""
                last_error = None
                max_retries = 3
                
                # --- AUTO-RETRY LOOP ---
                for attempt in range(max_retries):
                    try:
                        if attempt > 0:
                            print(f"[Python Server] Retrying AI query (attempt {attempt+1}/{max_retries})...")
                        
                        # --- 1. ROUTE TO GEMINI PROVIDER ---
                        if provider == 'gemini':
                            use_key = client_key
                            use_model = client_model if client_model else 'gemini-3.5-flash'
                            if use_model == 'gemini-2.5-flash':
                                use_model = 'gemini-3.5-flash'
                                
                            use_endpoint = client_endpoint if client_endpoint else 'https://generativelanguage.googleapis.com'
                            
                            url = f"{use_endpoint.rstrip('/')}/v1beta/models/{use_model}:generateContent?key={use_key}"
                            body = {
                                "contents": [{
                                    "parts": [{"text": prompt}]
                                }],
                                "generationConfig": {
                                    "responseMimeType": "application/json"
                                }
                            }
                            
                            req = urllib.request.Request(
                                url,
                                data=json.dumps(body).encode('utf-8'),
                                headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'},
                                method='POST'
                            )
                            
                            print(f"[Python Server] Proxying to Gemini API ({use_model})...")
                            with urllib.request.urlopen(req, timeout=40) as response:
                                resp_data = response.read().decode('utf-8')
                                parsed_res = json.loads(resp_data)
                                json_text = parsed_res['candidates'][0]['content']['parts'][0]['text'].strip()

                        # --- 2. ROUTE TO DEEPSEEK OR CUSTOM OPENAI ---
                        elif provider in ('deepseek', 'custom'):
                            use_key = client_key
                            if provider == 'deepseek':
                                use_endpoint = client_endpoint if client_endpoint else 'https://api.deepseek.com/v1'
                                use_model = client_model if client_model else 'deepseek-chat'
                            else:
                                use_endpoint = client_endpoint
                                use_model = client_model

                            url = f"{use_endpoint.rstrip('/')}/chat/completions"
                            body = {
                                "model": use_model,
                                "messages": [
                                    {"role": "system", "content": "You are a helpful assistant that outputs only valid JSON strings."},
                                    {"role": "user", "content": prompt}
                                ]
                            }
                            
                            req = urllib.request.Request(
                                url,
                                data=json.dumps(body).encode('utf-8'),
                                headers={
                                    'Content-Type': 'application/json',
                                    'Authorization': f'Bearer {use_key}',
                                    'User-Agent': 'Mozilla/5.0'
                                },
                                method='POST'
                            )
                            
                            print(f"[Python Server] Proxying to OpenAI compatible API ({use_model})...")
                            with urllib.request.urlopen(req, timeout=40) as response:
                                resp_data = response.read().decode('utf-8')
                                parsed_res = json.loads(resp_data)
                                json_text = parsed_res['choices'][0]['message']['content'].strip()

                        # --- 3. ROUTE TO LOCAL / DEFAULT SILICONFLOW FALLBACK ---
                        else:
                            url = "https://api.siliconflow.cn/v1/chat/completions"
                            headers = {
                                'Content-Type': 'application/json',
                                'Authorization': f'Bearer {SILICONFLOW_KEY}',
                                'User-Agent': 'Mozilla/5.0'
                            }
                            
                            def call_siliconflow(model_name):
                                body = {
                                    "model": model_name,
                                    "messages": [
                                        {"role": "system", "content": "You are a helpful assistant that outputs only valid JSON strings."},
                                        {"role": "user", "content": prompt}
                                    ],
                                    "max_tokens": 800,
                                    "temperature": 0.5
                                }
                                req = urllib.request.Request(
                                    url, 
                                    data=json.dumps(body).encode('utf-8'), 
                                    headers=headers, 
                                    method='POST'
                                )
                                with urllib.request.urlopen(req, timeout=60) as response:
                                    return response.read().decode('utf-8')

                            resp_data = None
                            try:
                                print("[Python Server] Requesting via Qwen-14B channel...")
                                resp_data = call_siliconflow("Qwen/Qwen2.5-14B-Instruct")
                            except urllib.error.HTTPError as e:
                                if e.code == 403:
                                    print("[Python Server] Balance is 0 or Pro restricted. Falling back to free model channel...")
                                    resp_data = call_siliconflow("Qwen/Qwen3-8B")
                                else:
                                    raise e

                            ai_data = json.loads(resp_data)
                            json_text = ai_data['choices'][0]['message']['content'].strip()

                        # --- BULLETPROOF JSON EXTRACTION ---
                        json_text = json_text.strip()
                        first_brace = json_text.find('{')
                        last_brace = json_text.rfind('}')
                        if first_brace != -1 and last_brace != -1:
                            json_text = json_text[first_brace:last_brace+1]
                        
                        # Verify JSON parsing
                        json.loads(json_text)
                        
                        # If reached here, execution was successful
                        break
                    except Exception as e:
                        last_error = e
                        print(f"[Python Server Warning] Attempt {attempt+1} failed: {e}")
                        time.sleep(1.5) # Wait before retry
                else:
                    # If loop finished without breaking, all retries failed
                    raise last_error

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json_text.encode('utf-8'))
                print("[Python Server] AI generation successful!")
                
            except Exception as e:
                print(f"[Python Server Error] {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            super().do_POST()

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == '/api/dict':
            query = urllib.parse.parse_qs(parsed_path.query)
            word = query.get('q', [''])[0]
            if not word:
                self.send_response(400)
                self.end_headers()
                return
            
            try:
                youdao_url = f"http://dict.youdao.com/suggest?q={urllib.parse.quote(word)}&num=1&doctype=json"
                req = urllib.request.Request(youdao_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as response:
                    data = response.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(data)
            except Exception as e:
                self.send_response(500)
                self.end_headers()
        else:
            # Serve static files normally
            super().do_GET()

# Ensure we run in the directory of this script
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Prevent address already in use error on quick restarts
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    print(f"Python Server running at: http://localhost:{PORT}/")
    print("Universal proxy active with auto-retry and encoding-guards.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
