/* ==========================================================================
   LinkWord Application Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        // Inputs & Actions
        wordsInput: document.getElementById('words-input'),
        generateBtn: document.getElementById('generate-btn'),
        clearWordsBtn: document.getElementById('clear-words-btn'),
        openScanBtn: document.getElementById('open-scan-btn'),
        emptyState: document.getElementById('empty-state'),
        loadingSkeleton: document.getElementById('loading-skeleton'),
        outputPanel: document.getElementById('output-panel'),
        
        // Output Elements
        storyContent: document.getElementById('story-content'),
        storyTranslation: document.getElementById('story-translation'),
        speakStoryBtn: document.getElementById('speak-story-btn'),
        vocabGrid: document.getElementById('vocab-grid'),
        
        // Navigation / Modals
        toggleHistoryBtn: document.getElementById('toggle-history-btn'),
        historySidebar: document.getElementById('history-sidebar'),
        sidebarBackdrop: document.getElementById('sidebar-backdrop'),
        clearHistoryBtn: document.getElementById('clear-history-btn'),
        historyList: document.getElementById('history-list'),
        
        // Settings Modal
        openSettingsBtn: document.getElementById('open-settings-btn'),
        closeSettingsBtn: document.getElementById('close-settings-btn'),
        settingsModal: document.getElementById('settings-modal'),
        apiProvider: document.getElementById('api-provider'),
        apiKey: document.getElementById('api-key'),
        toggleKeyVisibility: document.getElementById('toggle-key-visibility'),
        apiEndpoint: document.getElementById('api-endpoint'),
        apiModel: document.getElementById('api-model'),
        testConnectionBtn: document.getElementById('test-connection-btn'),
        saveSettingsBtn: document.getElementById('save-settings-btn'),
        
        // Scan Modal
        openScanModalBtn: document.getElementById('open-scan-btn'), // shared
        closeScanModalBtn: document.getElementById('close-scan-modal-btn'),
        scanModal: document.getElementById('scan-modal'),
        tabCamera: document.getElementById('tab-camera'),
        tabUpload: document.getElementById('tab-upload'),
        cameraView: document.getElementById('camera-view'),
        uploadView: document.getElementById('upload-view'),
        webcam: document.getElementById('webcam'),
        captureCanvas: document.getElementById('capture-canvas'),
        captureBtn: document.getElementById('capture-btn'),
        dropzone: document.getElementById('dropzone'),
        fileInput: document.getElementById('file-input'),
        previewContainer: document.getElementById('preview-container'),
        imagePreview: document.getElementById('image-preview'),
        reselectBtn: document.getElementById('reselect-btn'),
        analyzeUploadBtn: document.getElementById('analyze-upload-btn'),
        scanStatus: document.getElementById('scan-status'),
        statusText: document.getElementById('status-text'),
        globalPlayer: document.getElementById('global-player'),
        
        // Crop/Highlight Editor
        scanTabs: document.querySelector('.scan-tabs'),
        cropEditorContainer: document.getElementById('crop-editor-container'),
        cropSourceImg: document.getElementById('crop-source-img'),
        cropHighlightCanvas: document.getElementById('crop-highlight-canvas'),
        cropClearBtn: document.getElementById('crop-clear-btn'),
        cropCancelBtn: document.getElementById('crop-cancel-btn'),
        cropConfirmBtn: document.getElementById('crop-confirm-btn'),

        // Word Index Modal Elements
        openVocabModalBtn: document.getElementById('open-vocab-modal-btn'),
        closeVocabModalBtn: document.getElementById('close-vocab-modal-btn'),
        vocabModal: document.getElementById('vocab-modal'),
        vocabSearchInput: document.getElementById('vocab-search-input'),
        clearVocabSearchBtn: document.getElementById('clear-vocab-search-btn'),
        vocabListContainer: document.getElementById('vocab-list-container'),
        vocabSelectedBadge: document.getElementById('vocab-selected-badge'),
        vocabClearSelectedBtn: document.getElementById('vocab-clear-selected-btn'),
        vocabApplyBtn: document.getElementById('vocab-apply-btn'),
    };

    // App State
    const state = {
        apiProvider: 'local',
        apiKey: '',
        apiEndpoint: '',
        apiModel: '',
        history: [],
        currentStory: '',
        activeTab: 'camera', // 'camera' or 'upload'
        stream: null,
        selectedImageBase64: null,
        selectedImageMime: null,
        selectedVocabMap: {},
        vocabSearchQuery: '',
        storyLength: localStorage.getItem('storyLength') || 'short'
    };

    // Initialize Application
    init();

    function init() {
        loadSettings();
        loadHistory();
        setupEventListeners();
        setupVoiceSynthesis();
        updateProviderUIFields();
        checkProtocol();
        initVocabDatabaseWeb();
    }

    // Check if running on file:// protocol and show user warning
    function checkProtocol() {
        if (window.location.protocol === 'file:') {
            const warningBanner = document.getElementById('protocol-warning');
            if (warningBanner) {
                warningBanner.classList.remove('hidden');
                
                const copyBtn = document.getElementById('copy-url-btn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', () => {
                        // Attempt to copy server URL to clipboard
                        navigator.clipboard.writeText('http://localhost:3000').then(() => {
                            showToast('服务器地址已复制！请在地址栏粘贴并访问', 'success');
                        }).catch(() => {
                            showToast('请手动在浏览器地址栏输入: http://localhost:3000', 'info');
                        });
                    });
                }
            }
        }
    }

    // Load configurations from LocalStorage
    function loadSettings() {
        state.apiProvider = localStorage.getItem('apiProvider') || 'local';
        state.apiKey = localStorage.getItem('apiKey') || '';
        state.apiEndpoint = localStorage.getItem('apiEndpoint') || '';
        state.apiModel = localStorage.getItem('apiModel') || '';
        
        // Apply to inputs
        elements.apiProvider.value = state.apiProvider;
        elements.apiKey.value = state.apiKey;
        elements.apiEndpoint.value = state.apiEndpoint;
        elements.apiModel.value = state.apiModel;
    }

    // Load word generation history
    function loadHistory() {
        try {
            state.history = JSON.parse(localStorage.getItem('generationHistory')) || [];
            renderHistoryList();
        } catch (e) {
            state.history = [];
        }
    }

    // Save history
    function saveHistoryItem(words, result) {
        const item = {
            id: Date.now(),
            words: words.join(', '),
            date: new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
            result: result
        };
        // Remove duplicates of same word combinations
        state.history = state.history.filter(h => h.words.toLowerCase() !== item.words.toLowerCase());
        state.history.unshift(item);
        if (state.history.length > 20) state.history.pop(); // limit to 20
        localStorage.setItem('generationHistory', JSON.stringify(state.history));
        renderHistoryList();
    }

    // Setup voice synthesis list
    function setupVoiceSynthesis() {
        // Chrome loads voices asynchronously
        if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => {};
        }
    }

    // Update settings form visible fields based on selected provider
    function updateProviderUIFields() {
        const provider = elements.apiProvider.value;
        const keyGroup = document.getElementById('api-key-group');
        const endpointGroup = document.getElementById('api-endpoint-group');
        const modelGroup = document.getElementById('api-model-group');
        const endpointDesc = document.getElementById('endpoint-desc');

        if (provider === 'local') {
            keyGroup.classList.add('hidden');
            endpointGroup.classList.add('hidden');
            modelGroup.classList.add('hidden');
        } else {
            keyGroup.classList.remove('hidden');
            endpointGroup.classList.remove('hidden');
            modelGroup.classList.remove('hidden');
            
            if (provider === 'gemini') {
                elements.apiEndpoint.placeholder = '默认: https://generativelanguage.googleapis.com';
                endpointDesc.textContent = '中国大陆用户如果无法直连，可填写自定义反向代理服务地址。';
                if (!elements.apiModel.value || elements.apiModel.value === 'deepseek-chat' || elements.apiModel.value === 'gemini-2.5-flash') {
                    elements.apiModel.value = 'gemini-3.5-flash';
                }
            } else if (provider === 'deepseek') {
                elements.apiEndpoint.placeholder = '默认: https://api.deepseek.com/v1';
                endpointDesc.textContent = '官方直连端点。国内网络畅通无阻。';
                if (!elements.apiModel.value || elements.apiModel.value === 'gemini-2.5-flash') {
                    elements.apiModel.value = 'deepseek-chat';
                }
            } else if (provider === 'custom') {
                elements.apiEndpoint.placeholder = '输入符合 OpenAI 标准的接口端点';
                endpointDesc.textContent = '用于其他兼容大模型服务（如智谱、通义、火山等）。';
            }
        }
    }

    // Add Event Listeners
    function setupEventListeners() {
        // Autoplay Unlock on first touch/click
        document.addEventListener('click', () => {
            const player = elements.globalPlayer;
            if (player) {
                player.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA';
                player.play().then(() => {
                    player.pause();
                    player.src = '';
                }).catch(e => console.log('Audio unlock deferred:', e));
            }
        }, { once: true });

        // Toggle Sidebar Drawer
        elements.toggleHistoryBtn.addEventListener('click', () => {
            elements.historySidebar.classList.toggle('active');
            elements.sidebarBackdrop.classList.toggle('active');
        });

        // Close Sidebar when clicking backdrop overlay
        elements.sidebarBackdrop.addEventListener('click', () => {
            elements.historySidebar.classList.remove('active');
            elements.sidebarBackdrop.classList.remove('active');
        });

        // Settings Modal Controls
        elements.openSettingsBtn.addEventListener('click', () => {
            elements.settingsModal.classList.remove('hidden');
        });
        
        elements.closeSettingsBtn.addEventListener('click', () => {
            elements.settingsModal.classList.add('hidden');
        });

        elements.apiProvider.addEventListener('change', updateProviderUIFields);

        elements.toggleKeyVisibility.addEventListener('click', () => {
            if (elements.apiKey.type === 'password') {
                elements.apiKey.type = 'text';
                elements.toggleKeyVisibility.textContent = '隐藏';
            } else {
                elements.apiKey.type = 'password';
                elements.toggleKeyVisibility.textContent = '显示';
            }
        });

        // Test connection
        elements.testConnectionBtn.addEventListener('click', testAPIConnection);

        // Save Settings
        elements.saveSettingsBtn.addEventListener('click', () => {
            localStorage.setItem('apiProvider', elements.apiProvider.value);
            localStorage.setItem('apiKey', elements.apiKey.value.trim());
            localStorage.setItem('apiEndpoint', elements.apiEndpoint.value.trim());
            localStorage.setItem('apiModel', elements.apiModel.value.trim());
            
            state.apiProvider = elements.apiProvider.value;
            state.apiKey = elements.apiKey.value.trim();
            state.apiEndpoint = elements.apiEndpoint.value.trim();
            state.apiModel = elements.apiModel.value.trim();
            
            elements.settingsModal.classList.add('hidden');
            showToast('配置已保存', 'success');
        });

        // Word Action Buttons
        elements.clearWordsBtn.addEventListener('click', () => {
            elements.wordsInput.value = '';
            elements.wordsInput.focus();
        });

        // Example tags click
        document.querySelectorAll('.example-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                elements.wordsInput.value = tag.textContent;
                elements.wordsInput.focus();
            });
        });

        // Word Index & Chinese Selector Modal Listeners
        if (elements.openVocabModalBtn) {
            elements.openVocabModalBtn.addEventListener('click', openVocabModal);
        }
        if (elements.closeVocabModalBtn) {
            elements.closeVocabModalBtn.addEventListener('click', closeVocabModal);
        }
        if (elements.vocabModal) {
            elements.vocabModal.addEventListener('click', (e) => {
                if (e.target === elements.vocabModal) closeVocabModal();
            });
        }
        if (elements.vocabSearchInput) {
            elements.vocabSearchInput.addEventListener('input', onVocabSearch);
        }
        if (elements.clearVocabSearchBtn) {
            elements.clearVocabSearchBtn.addEventListener('click', () => {
                elements.vocabSearchInput.value = '';
                onVocabSearch();
            });
        }
        if (elements.vocabClearSelectedBtn) {
            elements.vocabClearSelectedBtn.addEventListener('click', clearSelectedVocab);
        }
        if (elements.vocabApplyBtn) {
            elements.vocabApplyBtn.addEventListener('click', applySelectedVocab);
        }

        // Story Length Range Slider Listeners
        const lengthSlider = document.getElementById('story-length-slider');
        const sliderBadge = document.getElementById('slider-current-badge');
        const scaleLabels = document.querySelectorAll('.slider-scale-labels .scale-item');
        const lengthConfig = {
            1: { key: 'short', icon: '⚡', title: '极简速记', desc: '1-2 句' },
            2: { key: 'medium', icon: '📖', title: '标准故事', desc: '3-4 句' },
            3: { key: 'long', icon: '🌟', title: '沉浸长篇', desc: '5-6 句' }
        };

        function updateSliderUI(val) {
            const numVal = parseInt(val, 10) || 2;
            const info = lengthConfig[numVal] || lengthConfig[2];
            state.storyLength = info.key;
            localStorage.setItem('storyLength', info.key);
            localStorage.setItem('storyLengthSliderVal', numVal);

            if (sliderBadge) {
                sliderBadge.innerHTML = `<span class="badge-icon">${info.icon}</span><span class="badge-text">${info.title} · ${info.desc}</span>`;
            }
            if (lengthSlider) {
                lengthSlider.value = numVal;
            }
            scaleLabels.forEach(label => {
                const labelVal = parseInt(label.getAttribute('data-val'), 10);
                if (labelVal === numVal) {
                    label.classList.add('scale-active');
                } else {
                    label.classList.remove('scale-active');
                }
            });
        }

        const savedSliderVal = localStorage.getItem('storyLengthSliderVal') || (state.storyLength === 'long' ? 3 : state.storyLength === 'medium' ? 2 : 1);
        updateSliderUI(savedSliderVal);

        if (lengthSlider) {
            lengthSlider.addEventListener('input', (e) => {
                updateSliderUI(e.target.value);
            });
        }

        scaleLabels.forEach(label => {
            label.addEventListener('click', () => {
                const val = label.getAttribute('data-val');
                updateSliderUI(val);
            });
        });

        // Toggle Slider Visibility
        const sliderToggleHeader = document.getElementById('slider-toggle-header');
        const sliderExpandBody = document.getElementById('slider-expand-body');
        const sliderToggleText = document.getElementById('slider-toggle-text');
        const sliderToggleArrow = document.getElementById('slider-toggle-arrow');

        if (sliderToggleHeader && sliderExpandBody) {
            sliderToggleHeader.addEventListener('click', () => {
                const isHidden = sliderExpandBody.classList.toggle('hidden');
                if (sliderToggleText) sliderToggleText.textContent = isHidden ? '调节' : '收起';
                if (sliderToggleArrow) sliderToggleArrow.textContent = isHidden ? '▼' : '▲';
            });
        }

        // Main generation trigger
        elements.generateBtn.addEventListener('click', handleGeneration);

        // Speak Story
        elements.speakStoryBtn.addEventListener('click', () => {
            if (state.currentStory) {
                // Strips HTML tags for reading
                const plainText = state.currentStory.replace(/<\/?[^>]+(>|$)/g, "");
                speakText(plainText);
            }
        });

        // History list selection
        elements.historyList.addEventListener('click', (e) => {
            const item = e.target.closest('.history-item');
            if (item) {
                const historyId = parseInt(item.dataset.id);
                const historyItem = state.history.find(h => h.id === historyId);
                if (historyItem) {
                    elements.wordsInput.value = historyItem.words;
                    renderResult(historyItem.result);
                    // close sidebar after clicking
                    elements.historySidebar.classList.remove('active');
                    elements.sidebarBackdrop.classList.remove('active');
                }
            }
        });

        // Clear history
        elements.clearHistoryBtn.addEventListener('click', () => {
            if (confirm('确定要清空所有历史记录吗？')) {
                state.history = [];
                localStorage.setItem('generationHistory', JSON.stringify([]));
                renderHistoryList();
                showToast('历史记录已清空');
            }
        });

        // Scan Modal Tabs
        elements.tabCamera.addEventListener('click', () => switchScanTab('camera'));
        elements.tabUpload.addEventListener('click', () => switchScanTab('upload'));

        // Scan Modal Trigger & Close
        elements.openScanBtn.addEventListener('click', openScanModal);
        elements.closeScanModalBtn.addEventListener('click', closeScanModal);

        // Camera Capture
        elements.captureBtn.addEventListener('click', capturePhoto);

        // Drag & Drop / File selection
        elements.dropzone.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', handleFileSelect);
        
        // Drag events for dropzone
        elements.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.dropzone.classList.add('dragover');
        });

        elements.dropzone.addEventListener('dragleave', () => {
            elements.dropzone.classList.remove('dragover');
        });

        elements.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                processUploadedFile(e.dataTransfer.files[0]);
            }
        });

        elements.reselectBtn.addEventListener('click', resetUploadView);
        elements.analyzeUploadBtn.addEventListener('click', analyzeUploadedImage);

        // Crop/Highlight Editor Events
        elements.cropClearBtn.addEventListener('click', clearCropHighlightCanvas);
        elements.cropCancelBtn.addEventListener('click', cancelCropEditor);
        elements.cropConfirmBtn.addEventListener('click', confirmCropAndRunOCR);

        // Canvas drawing handlers (mouse and touch)
        const canvas = elements.cropHighlightCanvas;
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);

        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing, { passive: false });
    }

    // Helper: Show Toast notifications
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Basic toast styling injected via JS if not standard in css
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#1f2937',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            fontSize: '14px',
            zIndex: '2000',
            opacity: '0',
            transform: 'translateY(10px)',
            transition: 'all 0.3s ease'
        });
        
        document.body.appendChild(toast);
        
        // Trigger reflow & fade in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        // Remove after 3s
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // TTS Reader using secure serverless proxy (falls back to native WebSpeech)
    function speakText(text) {
        if (!text) return;
        
        try {
            window.speechSynthesis.cancel();
        } catch(e) {}
        
        // Clean text (remove HTML tags) and limit to 200 chars for Google Translate
        const cleanText = text.replace(/<\/?[^>]+(>|$)/g, "").trim().substring(0, 200);
        
        // Use our high-quality, China-accessible serverless TTS proxy
        const proxyTtsUrl = `/api/tts?text=${encodeURIComponent(cleanText)}`;
        
        const audio = new Audio();
        audio.src = proxyTtsUrl;
        
        audio.play().catch(err => {
            console.warn("Proxy TTS failed, trying native WebSpeech...", err);
            // Fallback to native WebSpeech
            fallbackWebSpeech(cleanText, `Proxy:[${err.message}]`);
        });
    }

    // Native Web Speech fallback if Youdao and Baidu both fail
    function fallbackWebSpeech(text, originalError = '') {
        try {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.onerror = (e) => {
                const speechErr = e.error ? `SpeechError: ${e.error}` : 'SpeechSynthesis failed';
                showToast(`朗读失败。网络引擎拦截信息:\n[${originalError}] | 系统语音: [${speechErr}]`, 'error');
            };
            window.speechSynthesis.speak(utterance);
        } catch(err) {
            showToast(`系统不支持语音引擎: ${err.message}`, 'error');
        }
    }

    // Clean and parse text area input into list of unique words (preserving word(meaning) syntax)
    function parseInputWords() {
        const text = elements.wordsInput.value;
        if (!text.trim()) return [];
        
        const rawTokens = text
            .split(/[,;，；\n\t]+/)
            .map(w => w.trim())
            .filter(Boolean);

        const words = [];
        rawTokens.forEach(token => {
            if (!token.includes('(') && !token.includes('（') && !token.includes(':') && !token.includes('：')) {
                const subWords = token.split(/\s+/).filter(Boolean);
                words.push(...subWords);
            } else {
                words.push(token);
            }
        });

        return words.filter(w => /[a-zA-Z]/.test(w));
    }

    let loadingTipInterval = null;
    const loadingTips = [
        "💡 单词们正在悄悄开会，准备合演一出大戏...",
        "🐱 正在命令 AI 老师用最简单的词汇写小作文...",
        "✨ 小贴士：联想记忆法比死记硬背牢固 3 倍哦！",
        "📚 翻书声沙沙沙，故事马上就编好了...",
        "🥑 正在给您的单词卡片配置标准美式音标...",
        "🦄 正在为您打磨例句，保证简单又通俗易懂...",
        "🌟 静待数秒，大脑正处于最佳联想记忆状态...",
        "🍩 AI 正在做深呼吸，马上为您献上精彩故事..."
    ];

    function startLoadingTips() {
        const tipEl = document.getElementById('loading-tip-text');
        if (!tipEl) return;
        
        let index = 0;
        tipEl.textContent = loadingTips[0];
        tipEl.style.transition = 'opacity 0.3s ease';
        
        if (loadingTipInterval) clearInterval(loadingTipInterval);
        
        loadingTipInterval = setInterval(() => {
            index = (index + 1) % loadingTips.length;
            tipEl.style.opacity = '0';
            setTimeout(() => {
                tipEl.textContent = loadingTips[index];
                tipEl.style.opacity = '1';
            }, 300);
        }, 3000);
    }

    function stopLoadingTips() {
        if (loadingTipInterval) {
            clearInterval(loadingTipInterval);
            loadingTipInterval = null;
        }
    }

    // Main logic for handling word memory generation
    async function handleGeneration() {
        const words = parseInputWords();
        if (words.length === 0) {
            showToast('请输入一些英文单词', 'error');
            return;
        }

        // Show loading state
        elements.emptyState.classList.add('hidden');
        elements.outputPanel.classList.add('hidden');
        elements.loadingSkeleton.classList.remove('hidden');
        startLoadingTips();
        elements.generateBtn.disabled = true;
        elements.generateBtn.querySelector('.spinner').classList.remove('hidden');
        elements.generateBtn.querySelector('span').textContent = '正在联想...';

        try {
            let result;
            if (state.apiProvider === 'local') {
                if (window.location.protocol === 'file:') {
                    result = generateLocalMockResult(words);
                    // simulate short network latency for better experience
                    await new Promise(resolve => setTimeout(resolve, 800));
                } else {
                    result = await fetchSharedAIResult(words);
                }
            } else {
                result = await fetchAIResult(words);
            }

            renderResult(result);
            saveHistoryItem(words, result);
            showToast('生成成功!', 'success');
        } catch (error) {
            console.error(error);
            showToast(error.message || '生成失败，请检查网络和 API 配置', 'error');
            // Revert back
            if (elements.outputPanel.classList.contains('hidden')) {
                elements.emptyState.classList.remove('hidden');
            }
        } finally {
            elements.loadingSkeleton.classList.add('hidden');
            stopLoadingTips();
            elements.generateBtn.disabled = false;
            elements.generateBtn.querySelector('.spinner').classList.add('hidden');
            elements.generateBtn.querySelector('span').textContent = '串联记忆';
        }
    }

    // Fetch result from our own backend proxy (runs when provider is local/default on live server)
    async function fetchSharedAIResult(words) {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                words: words,
                style: state.selectedStyle || 'humorous',
                length: state.storyLength || 'medium'
            })
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error || `HTTP ${response.status}`;
            throw new Error(`AI 服务异常: ${errMsg}`);
        }
        
        return await response.json();
    }

    // Fetch result from Gemini / DeepSeek / Custom endpoint
    async function fetchAIResult(words) {
        // If running on a local server, we route ALL requests through our local python server proxy
        // to automatically benefit from its VPN routing and bypass browser network blocks.
        if (window.location.protocol !== 'file:') {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    words: words,
                    style: state.selectedStyle || 'humorous',
                    length: state.storyLength || 'medium',
                    provider: state.apiProvider,
                    apiKey: state.apiKey,
                    apiModel: state.apiModel,
                    apiEndpoint: state.apiEndpoint
                })
            });
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error || `HTTP ${response.status}`;
                throw new Error(`AI 服务异常: ${errMsg}`);
            }
            
            return await response.json();
        }

        if (!state.apiKey) {
            throw new Error('API 密钥未配置，请先点击右上角齿轮进行配置！');
        }

        const prompt = `您是一位创意英语名师。请请严格按照以下 JSON 结构返回结果，不要带任何 markdown 的包裹标记（如 \`\`\`json），直接输出 raw JSON 字符串。

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

        let url = '';
        let headers = { 'Content-Type': 'application/json' };
        let body = {};

        if (state.apiProvider === 'gemini') {
            const endpoint = state.apiEndpoint || 'https://generativelanguage.googleapis.com';
            const model = state.apiModel || 'gemini-3.5-flash';
            url = `${endpoint.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${state.apiKey}`;
            body = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            };
        } else { // deepseek or custom OpenAI compatibility API
            const defaultEndpoint = state.apiProvider === 'deepseek' ? 'https://api.deepseek.com/v1' : '';
            const endpoint = state.apiEndpoint || defaultEndpoint;
            if (!endpoint) {
                throw new Error('请配置 API 端点/代理地址！');
            }
            const model = state.apiModel || (state.apiProvider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo');
            
            url = `${endpoint.replace(/\/$/, '')}/chat/completions`;
            headers['Authorization'] = `Bearer ${state.apiKey}`;
            body = {
                model: model,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that outputs only valid JSON strings without code blocks.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: "json_object" }
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `HTTP ${response.status}`;
            throw new Error(`API 错误: ${errMsg}`);
        }

        const data = await response.json();
        
        let jsonText = '';
        if (state.apiProvider === 'gemini') {
            jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else { // OpenAI style
            jsonText = data.choices?.[0]?.message?.content || '';
        }

        // Clean output in case models output markdown tags despite instruction
        jsonText = jsonText.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.substring(7);
        }
        if (jsonText.endsWith('```')) {
            jsonText = jsonText.substring(0, jsonText.length - 3);
        }
        jsonText = jsonText.trim();

        try {
            return JSON.parse(jsonText);
        } catch (e) {
            console.error('Failed to parse model JSON:', jsonText);
            throw new Error('模型返回的不是标准 JSON 格式，请重试！');
        }
    }

    // Local Mock Generator - when user runs offline / no API key
    function generateLocalMockResult(words) {
        // Simple local database for phonetic symbols and basic translations to make fallback useful
        const localDict = {
            pristine: { ipa: "/'prɪstiːn/", pos: "adj.", def: "崭新的；原始的；未受污染的" },
            obsolete: { ipa: "/ˌɒbsə'liːt/", pos: "adj.", def: "废弃的；陈旧的；过时的" },
            digital: { ipa: "/'dɪdʒɪtl/", pos: "adj.", def: "数字的；数码的" },
            benevolent: { ipa: "/bə'nevələnt/", pos: "adj.", def: "仁慈的；慈善的" },
            serendipity: { ipa: "/ˌserən'dɪpəti/", pos: "n.", def: "缘分；意外发现珍奇事物的本领" },
            chaotic: { ipa: "/keɪ'ɒtɪk/", pos: "adj.", def: "混乱的；无秩序的" },
            novel: { ipa: "/'nɒvl/", pos: "adj. / n.", def: "新颖的；小说" },
            diligent: { ipa: "/'dɪlɪdʒənt/", pos: "adj.", def: "勤奋的；刻苦的" },
            exemplary: { ipa: "/ɪɡ'zempləri/", pos: "adj.", def: "模范的；可作楷模的；典型的" },
            instance: { ipa: "/'ɪnstəns/", pos: "n. / v.", def: "例子，实例；举例说明" },
            ephemeral: { ipa: "/ɪ'femərəl/", pos: "adj.", def: "短暂的；瞬息即逝的" },
            ubiquitous: { ipa: "/juː'bɪkwɪtəs/", pos: "adj.", def: "无所不在的；普遍存在的" },
            nostalgia: { ipa: "/nɒ'stældʒə/", pos: "n.", def: "怀旧；念旧；乡愁" }
        };

        const parsedWords = words.map(w => {
            const lower = w.toLowerCase();
            const dictVal = localDict[lower] || { ipa: "/.../", pos: "n./v./adj.", def: "本地备用释义，请联网获取AI准确释义" };
            return {
                word: w,
                ipa: dictVal.ipa,
                pos: dictVal.pos,
                definition: dictVal.def,
                sentence: `This is a local fallback sentence showing how to use the word [${w}].`
            };
        });

        // Create a simple mockup story linking them
        let storyStr = 'This is a **Local Offline Mock Story** because you are using the Local Fallback Mode. ';
        storyStr += 'In a digital world, we often find that some tech becomes ';
        
        const highlightedWords = words.map(w => `<strong>${w}</strong>`);
        storyStr = `Here is a local mock scenario connecting your words: we want to keep things ${highlightedWords.join(' and ')} in our memories so that we don't forget their meanings. Configure an API key in settings to unlock full AI story generation!`;

        return {
            story: storyStr,
            story_translation: "这是本地离线模拟故事的中文翻译。一旦您在设置中配置了 API 密钥，AI 将自动为您生成真实的创意英文故事和中文翻译！",
            words: parsedWords
        };
    }

    // Helper to select polysemy meaning into input box
    function selectMeaning(word, def) {
        const shortDef = def.split(/[；;,]/)[0].trim();
        const currentInput = elements.wordsInput.value.trim();
        const tokens = currentInput.split(/[,，;；\n]+/).map(t => t.trim()).filter(Boolean);
        let replaced = false;

        const newTokens = tokens.map(token => {
            const match = token.match(/^([a-zA-Z\s-]+)/);
            if (match && match[1].trim().toLowerCase() === word.toLowerCase() && !replaced) {
                replaced = true;
                return `${match[1].trim()}(${shortDef})`;
            }
            return token;
        });

        if (!replaced) {
            newTokens.push(`${word}(${shortDef})`);
        }

        elements.wordsInput.value = newTokens.join(', ');
        showToast(`已选定【${word}(${shortDef})】，点击「串联记忆」即可生成！`, 'success');
    }

    // Render results dashboard
    function renderResult(result) {
        if (!result) return;
        
        state.currentStory = result.story;
        elements.storyContent.innerHTML = result.story;
        elements.storyTranslation.innerHTML = result.story_translation || '暂无中文翻译';
        
        // Clean vocab grid
        elements.vocabGrid.innerHTML = '';
        
        result.words.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'vocab-card';

            const hasAltMeanings = item.alt_meanings && item.alt_meanings.length > 0;
            
            let altMeaningsHtml = '';
            if (hasAltMeanings) {
                altMeaningsHtml = `
                    <div class="polysemy-drawer hidden" id="polysemy-drawer-${index}">
                        <div class="polysemy-drawer-header">💡 选择其他释义填入输入框，点击上方「串联记忆」即可生成：</div>
                        <div class="polysemy-list">
                            ${item.alt_meanings.map(alt => `
                                <div class="polysemy-option" data-word="${item.word}" data-def="${alt.def}">
                                    <div class="alt-left">
                                        ${alt.pos ? `<span class="alt-pos">${alt.pos}</span>` : ''}
                                        <span class="alt-def">${alt.def}</span>
                                    </div>
                                    <button class="alt-action-btn">换用此义</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            card.innerHTML = `
                <div class="vocab-word-info">
                    <div>
                        <span class="vocab-word-title">${item.word}</span>
                        <div class="vocab-word-meta">
                            <span class="vocab-pos">${item.pos}</span>
                            <span class="vocab-ipa">${item.ipa || ''}</span>
                        </div>
                    </div>
                    <div class="vocab-card-actions">
                        ${hasAltMeanings ? `
                            <button class="polysemy-tag-btn" data-index="${index}" title="查看该词的其他含义">
                                <span>🔄 多义词 ▾</span>
                            </button>
                        ` : ''}
                        <button class="tts-btn play-word-btn" title="朗读单词">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="vocab-definition">${item.definition}</div>
                ${altMeaningsHtml}
                <div class="vocab-sentence">${item.sentence || ''}</div>
            `;
            
            // Add click to speak voice for specific word card
            card.querySelector('.play-word-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                speakText(item.word);
            });

            const polyBtn = card.querySelector('.polysemy-tag-btn');
            const drawer = card.querySelector(`#polysemy-drawer-${index}`);
            if (polyBtn && drawer) {
                polyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isHidden = drawer.classList.toggle('hidden');
                    polyBtn.innerHTML = isHidden ? '<span>🔄 多义词 ▾</span>' : '<span>🔄 多义词 ▲</span>';
                });
            }

            card.querySelectorAll('.polysemy-option').forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const word = opt.getAttribute('data-word');
                    const def = opt.getAttribute('data-def');
                    selectMeaning(word, def);
                });
            });
            
            elements.vocabGrid.appendChild(card);
        });

        elements.emptyState.classList.add('hidden');
        elements.outputPanel.classList.remove('hidden');
    }

    // Render historical lists in sidebar
    function renderHistoryList() {
        elements.historyList.innerHTML = '';
        if (state.history.length === 0) {
            elements.historyList.innerHTML = '<li class="info-tip" style="text-align:center; padding:20px 0;">暂无历史</li>';
            return;
        }

        state.history.forEach(item => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.dataset.id = item.id;
            
            li.innerHTML = `
                <div class="history-words">${item.words}</div>
                <div class="history-date">${item.date}</div>
            `;
            
            elements.historyList.appendChild(li);
        });
    }

    // Test API connection helper
    async function testAPIConnection() {
        const provider = elements.apiProvider.value;
        const key = elements.apiKey.value.trim();
        const endpoint = elements.apiEndpoint.value.trim();
        const model = elements.apiModel.value.trim();

        if (provider === 'local') {
            showToast('本地模式无需进行连接测试！', 'success');
            return;
        }

        if (!key) {
            showToast('请先输入 API 密钥！', 'error');
            return;
        }

        elements.testConnectionBtn.disabled = true;
        elements.testConnectionBtn.textContent = '测试中...';

        try {
            let testUrl = '';
            let headers = { 'Content-Type': 'application/json' };
            let body = {};

            if (provider === 'gemini') {
                const ep = endpoint || 'https://generativelanguage.googleapis.com';
                const md = model || 'gemini-3.5-flash';
                testUrl = `${ep.replace(/\/$/, '')}/v1beta/models/${md}:generateContent?key=${key}`;
                body = {
                    contents: [{ parts: [{ text: "ping" }] }],
                    generationConfig: { maxOutputTokens: 5 }
                };
            } else { // deepseek/custom
                const ep = endpoint || (provider === 'deepseek' ? 'https://api.deepseek.com/v1' : '');
                if (!ep) throw new Error('未指定端点/代理地址');
                const md = model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo');
                testUrl = `${ep.replace(/\/$/, '')}/chat/completions`;
                headers['Authorization'] = `Bearer ${key}`;
                body = {
                    model: md,
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 5
                };
            }

            const response = await fetch(testUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });

            if (response.ok) {
                showToast('测试连接成功！', 'success');
            } else {
                throw new Error(`连接失败 (HTTP ${response.status})`);
            }
        } catch (e) {
            showToast(`连接测试失败: ${e.message}`, 'error');
        } finally {
            elements.testConnectionBtn.disabled = false;
            elements.testConnectionBtn.textContent = '测试连接';
        }
    }

    /* ==========================================================================
       Camera and Image OCR Logic
       ========================================================================== */

    function switchScanTab(tabName) {
        state.activeTab = tabName;
        if (tabName === 'camera') {
            elements.tabCamera.classList.add('active');
            elements.tabUpload.classList.remove('active');
            elements.cameraView.classList.add('active');
            elements.uploadView.classList.remove('active');
            startCamera();
        } else {
            elements.tabCamera.classList.remove('active');
            elements.tabUpload.classList.add('active');
            elements.cameraView.classList.remove('active');
            elements.uploadView.classList.add('active');
            stopCamera();
        }
    }

    async function openScanModal() {
        elements.scanModal.classList.remove('hidden');
        switchScanTab('camera'); // default tab
    }

    function closeScanModal() {
        elements.scanModal.classList.add('hidden');
        stopCamera();
        resetUploadView();
    }

    async function startCamera() {
        stopCamera(); // Stop any existing streams first
        elements.statusText.textContent = '正在获取相机权限...';
        elements.scanStatus.classList.remove('hidden');
        
        try {
            state.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            elements.webcam.srcObject = state.stream;
            elements.scanStatus.classList.add('hidden');
        } catch (e) {
            console.error('Camera access error:', e);
            elements.statusText.textContent = '无法启动相机。请允许相机权限，或使用“本地图片”上传。';
            // keep status overlay but show error (hide loading spinner)
            elements.scanStatus.querySelector('.spinner-large').style.display = 'none';
        }
    }

    function stopCamera() {
        if (state.stream) {
            state.stream.getTracks().forEach(track => track.stop());
            state.stream = null;
        }
        elements.webcam.srcObject = null;
        // Restore loading spinner style
        elements.scanStatus.querySelector('.spinner-large').style.display = 'block';
    }

    // Capture image from Video stream
    function capturePhoto() {
        if (!state.stream) {
            showToast('相机未开启', 'error');
            return;
        }

        const width = elements.webcam.videoWidth;
        const height = elements.webcam.videoHeight;
        
        elements.captureCanvas.width = width;
        elements.captureCanvas.height = height;
        
        const context = elements.captureCanvas.getContext('2d');
        context.drawImage(elements.webcam, 0, 0, width, height);
        
        const dataUrl = elements.captureCanvas.toDataURL('image/jpeg', 0.85);
        
        // Stop camera stream to free resources and launch highlighting editor
        stopCamera();
        openCropEditor(dataUrl, 'image/jpeg');
    }

    // Handle Upload Dropzone/File input selection
    function handleFileSelect(e) {
        if (e.target.files.length > 0) {
            processUploadedFile(e.target.files[0]);
        }
    }

    function processUploadedFile(file) {
        if (!file.type.startsWith('image/')) {
            showToast('请选择有效的图片文件', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            elements.imagePreview.src = dataUrl;
            
            // Show preview
            elements.dropzone.classList.add('hidden');
            elements.previewContainer.classList.remove('hidden');
            
            // Set state
            state.selectedImageBase64 = dataUrl.split(',')[1];
            state.selectedImageMime = file.type;
            
            elements.analyzeUploadBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    function resetUploadView() {
        elements.dropzone.classList.remove('hidden');
        elements.previewContainer.classList.add('hidden');
        elements.imagePreview.src = '';
        state.selectedImageBase64 = null;
        state.selectedImageMime = null;
        elements.analyzeUploadBtn.disabled = true;
        elements.fileInput.value = '';
    }

    function analyzeUploadedImage() {
        if (!state.selectedImageBase64) return;
        const dataUrl = `data:${state.selectedImageMime};base64,${state.selectedImageBase64}`;
        openCropEditor(dataUrl, state.selectedImageMime);
    }

    // High-accuracy AI Vision OCR using Qwen3-VL
    async function processImageOCR(base64Data, mimeType) {
        elements.scanStatus.classList.remove('hidden');
        elements.statusText.textContent = '正在通过 AI 提取书籍单词...';
        
        try {
            let ocrUrl = '/api/ocr';
            if (window.location.protocol === 'file:') {
                ocrUrl = 'https://linkword.pages.dev/api/ocr';
            }
            
            const response = await fetch(ocrUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: base64Data,
                    mime: mimeType
                })
            });
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const rawText = data.text || '';
            console.log('AI OCR raw response:', rawText);
            
            // Extract clean English words
            const words = rawText
                .split(/[\s,;，；\n\t.()!?"'“”:*-]+/)
                .map(w => w.trim().replace(/[^a-zA-Z-]/g, '')) // keep only letters and hyphens
                .filter(w => w.length >= 2);
                
            const uniqueWords = [...new Set(words)];
            
            if (uniqueWords.length > 0) {
                const recognizedWords = uniqueWords.join(', ');
                const existing = elements.wordsInput.value.trim();
                const separator = existing ? ', ' : '';
                elements.wordsInput.value = existing + separator + recognizedWords;
                showToast(`AI 识别提取成功！提取了 ${uniqueWords.length} 个单词`, 'success');
                closeScanModal();
            } else {
                throw new Error('未能在图片中提取到任何英文单词，请确保字迹清晰。');
            }
            
        } catch (e) {
            console.error('OCR Error:', e);
            showToast(`识别失败: ${e.message}`, 'error');
        } finally {
            elements.scanStatus.classList.add('hidden');
        }
    }

    // Crop/Highlight Editor state & drawing functions
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let cropMime = 'image/jpeg';
    let hasDrawn = false;

    function openCropEditor(imageSrc, mimeType) {
        cropMime = mimeType;
        hasDrawn = false;
        isDrawing = false;
        minX = Infinity;
        minY = Infinity;
        maxX = -Infinity;
        maxY = -Infinity;
        
        // Hide standard camera and upload views
        elements.cameraView.classList.remove('active');
        elements.uploadView.classList.remove('active');
        elements.scanTabs.classList.add('hidden');
        
        // Show crop editor
        elements.cropEditorContainer.classList.remove('hidden');
        elements.cropSourceImg.src = imageSrc;
        
        // Setup canvas when image loads
        elements.cropSourceImg.onload = () => {
            // Wait 120ms to allow mobile browsers to finish layout reflow
            setTimeout(() => {
                const img = elements.cropSourceImg;
                const canvas = elements.cropHighlightCanvas;
                
                canvas.width = img.clientWidth;
                canvas.height = img.clientHeight;
                canvas.style.width = img.clientWidth + 'px';
                canvas.style.height = img.clientHeight + 'px';
                canvas.style.left = '0px';
                canvas.style.top = '0px';
                
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }, 120);
        };
    }

    function clearCropHighlightCanvas() {
        const canvas = elements.cropHighlightCanvas;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
        minX = Infinity;
        minY = Infinity;
        maxX = -Infinity;
        maxY = -Infinity;
        showToast('画板已清除，现在可以重新涂抹', 'info');
    }

    function cancelCropEditor() {
        elements.cropEditorContainer.classList.add('hidden');
        elements.scanTabs.classList.remove('hidden');
        
        if (state.activeTab === 'camera') {
            elements.cameraView.classList.add('active');
            startCamera();
        } else {
            elements.uploadView.classList.add('active');
        }
    }

    // Drawing Logic
    function getDrawCoords(e) {
        const canvas = elements.cropHighlightCanvas;
        const rect = canvas.getBoundingClientRect();
        
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDrawing(e) {
        e.preventDefault();
        isDrawing = true;
        const coords = getDrawCoords(e);
        lastX = coords.x;
        lastY = coords.y;
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        
        const coords = getDrawCoords(e);
        const canvas = elements.cropHighlightCanvas;
        const ctx = canvas.getContext('2d');
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(coords.x, coords.y);
        
        // Yellow semi-transparent highlighter brush
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.45)';
        ctx.lineWidth = Math.max(16, canvas.width * 0.05); // dynamic line width
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        // Track bounding box bounds
        const halfWidth = ctx.lineWidth / 2;
        minX = Math.min(minX, coords.x - halfWidth, lastX - halfWidth);
        minY = Math.min(minY, coords.y - halfWidth, lastY - halfWidth);
        maxX = Math.max(maxX, coords.x + halfWidth, lastX + halfWidth);
        maxY = Math.max(maxY, coords.y + halfWidth, lastY + halfWidth);
        
        lastX = coords.x;
        lastY = coords.y;
        hasDrawn = true;
    }

    function stopDrawing(e) {
        if (!isDrawing) return;
        e.preventDefault();
        isDrawing = false;
    }

    function confirmCropAndRunOCR() {
        const img = elements.cropSourceImg;
        const canvas = elements.cropHighlightCanvas;
        
        // If they did not draw anything, send the full source image
        if (!hasDrawn) {
            const base64 = img.src.split(',')[1];
            processImageOCR(base64, cropMime);
            return;
        }
        
        // Apply bounding box cropping
        const scaleX = img.naturalWidth / img.clientWidth;
        const scaleY = img.naturalHeight / img.clientHeight;
        
        const padding = 15;
        
        let cropX = Math.max(0, Math.floor(minX * scaleX) - padding);
        let cropY = Math.max(0, Math.floor(minY * scaleY) - padding);
        let cropW = Math.min(img.naturalWidth - cropX, Math.ceil((maxX - minX) * scaleX) + padding * 2);
        let cropH = Math.min(img.naturalHeight - cropY, Math.ceil((maxY - minY) * scaleY) + padding * 2);
        
        if (cropW <= 5 || cropH <= 5) {
            showToast('涂抹范围过小，请重新涂抹要识别的区域！', 'warning');
            return;
        }
        
        // Draw cropped sub-rect onto a temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cropW;
        tempCanvas.height = cropH;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        
        const croppedDataUrl = tempCanvas.toDataURL(cropMime, 0.85);
        const croppedBase64 = croppedDataUrl.split(',')[1];
        
        // Close editor and send
        elements.cropEditorContainer.classList.add('hidden');
        elements.scanTabs.classList.remove('hidden');
        
        processImageOCR(croppedBase64, cropMime);
    }

    // ==========================================================================
    // Word Index & Chinese Selection Helper Functions (Web)
    // ==========================================================================
    let allVocabListWeb = [];
    let vocabSearchTimer = null;
    let onlineVocabResults = [];

    function initVocabDatabaseWeb() {
        if (!window.VOCAB_DATABASE) return;
        allVocabListWeb = window.VOCAB_DATABASE.map(item => ({
            ...item,
            catName: '核心词'
        }));
        renderVocabList();
    }

    function openVocabModal() {
        if (!elements.vocabModal) return;
        elements.vocabModal.classList.remove('hidden');
        renderVocabList();
        if (elements.vocabSearchInput) {
            setTimeout(() => elements.vocabSearchInput.focus(), 100);
        }
    }

    function closeVocabModal() {
        if (!elements.vocabModal) return;
        elements.vocabModal.classList.add('hidden');
    }

    function onVocabSearch() {
        state.vocabSearchQuery = (elements.vocabSearchInput.value || '').trim();
        if (state.vocabSearchQuery) {
            elements.clearVocabSearchBtn.classList.remove('hidden');
        } else {
            elements.clearVocabSearchBtn.classList.add('hidden');
            onlineVocabResults = [];
        }
        renderVocabList();

        if (vocabSearchTimer) clearTimeout(vocabSearchTimer);
        const query = state.vocabSearchQuery;
        if (query.length >= 1) {
            vocabSearchTimer = setTimeout(() => {
                queryOnlineVocab(query);
            }, 200);
        }
    }

    async function queryOnlineVocab(query) {
        if (!query) return;
        const isChinese = /[\u4e00-\u9fa5]/.test(query);
        try {
            const resp = await fetch(`/api/dict?q=${encodeURIComponent(query)}`);
            if (resp.ok) {
                const data = await resp.json();
                const onlineResults = [];

                if (Array.isArray(data.results) && data.results.length > 0) {
                    for (const item of data.results) {
                        if (item && item.word) {
                            onlineResults.push({
                                word: item.word,
                                phonetic: item.phonetic || '',
                                pos: item.pos || (isChinese ? '对应英文' : '释义'),
                                def: item.def || query,
                                catName: item.pos === '实时整句/短语翻译' ? '🌟 实时翻译' : (isChinese ? '🌐 中译英' : '📖 词典释义'),
                                isOnline: true
                            });
                        }
                    }
                }

                const entries = data?.data?.entries || data?.entries || [];
                if (Array.isArray(entries) && entries.length > 0) {
                    for (const item of entries) {
                        const entry = item.entry || '';
                        const explain = item.explain || '';
                        if (isChinese) {
                            const rawCands = explain.split(/[,;；，/、\n]/);
                            for (const cand of rawCands) {
                                const cleanW = cand.replace(/[^a-zA-Z\s-]/g, '').trim();
                                if (cleanW && cleanW.length > 1 && !onlineResults.some(r => r.word.toLowerCase() === cleanW.toLowerCase())) {
                                    onlineResults.push({
                                        word: cleanW,
                                        phonetic: '',
                                        pos: '对应英文',
                                        def: entry || query,
                                        catName: '🌐 实时翻译',
                                        isOnline: true
                                    });
                                }
                            }
                        } else {
                            if (entry && !onlineResults.some(r => r.word.toLowerCase() === entry.toLowerCase())) {
                                let pos = '释义';
                                let defText = explain;
                                const posMatch = explain.match(/^([a-z]+\.)\s*(.+)$/i);
                                if (posMatch) {
                                    pos = posMatch[1];
                                    defText = posMatch[2];
                                }
                                onlineResults.push({
                                    word: entry,
                                    phonetic: '',
                                    pos: pos,
                                    def: defText,
                                    catName: '📖 词典释义',
                                    isOnline: true
                                });
                            }
                        }
                    }
                }

                // 3. Youdao CE Dictionary
                const ceWords = data?.ce?.word || [];
                if (Array.isArray(ceWords) && ceWords.length > 0) {
                    for (const witem of ceWords) {
                        const trs = witem?.trs || [];
                        for (const tr of trs) {
                            for (const item of (tr?.tr || [])) {
                                const lObj = item?.l;
                                const pos = lObj?.pos || '对应英文';
                                const tran = lObj?.['#tran'] || query;
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
                                    if (cleanW && cleanW.length > 1 && !onlineResults.some(r => r.word.toLowerCase() === cleanW.toLowerCase())) {
                                        onlineResults.push({
                                            word: cleanW,
                                            phonetic: '',
                                            pos: pos,
                                            def: tran || query,
                                            catName: '📖 中英词典',
                                            isOnline: true
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                if (onlineResults.length > 0) {
                    onlineVocabResults = onlineResults;
                    renderVocabList();
                }
            }
        } catch(e) {
            // Ignore online error
        }
    }

    function renderVocabList() {
        if (!elements.vocabListContainer) return;
        const query = (state.vocabSearchQuery || '').toLowerCase();
        const rawQuery = (state.vocabSearchQuery || '').trim();
        const isChinese = /[\u4e00-\u9fa5]/.test(query);
        const isEng = !isChinese && /^[a-zA-Z\s-]+$/.test(rawQuery) && rawQuery.length >= 1;
        let list = allVocabListWeb;

        if (query) {
            list = list.filter(w => w.word.toLowerCase().includes(query) || (w.def && w.def.includes(query)));
            
            list.sort((a, b) => {
                const aWord = a.word.toLowerCase();
                const bWord = b.word.toLowerCase();
                const aStarts = aWord.startsWith(query) ? 0 : 1;
                const bStarts = bWord.startsWith(query) ? 0 : 1;
                if (aStarts !== bStarts) return aStarts - bStarts;
                return aWord.localeCompare(bWord);
            });

            if (onlineVocabResults && onlineVocabResults.length > 0) {
                const existingWords = new Set(list.map(w => w.word.toLowerCase()));
                const newOnline = onlineVocabResults.filter(w => !existingWords.has(w.word.toLowerCase()));
                list = [...newOnline, ...list];
            }
        }

        let directAddHtml = '';
        if (isEng && rawQuery) {
            const isDirectSelected = !!state.selectedVocabMap[rawQuery];
            directAddHtml = `
                <div class="vocab-direct-add-card" data-word="${rawQuery}">
                    <div class="direct-add-left">
                        <span class="direct-add-badge">✨ 快捷添加</span>
                        <span class="direct-add-word">${rawQuery}</span>
                    </div>
                    <div class="vocab-check-circle ${isDirectSelected ? 'selected' : ''}">${isDirectSelected ? '✓' : ''}</div>
                </div>
            `;
        }

        if (list.length === 0 && !directAddHtml) {
            elements.vocabListContainer.innerHTML = `
                <div style="padding: 40px 0; text-align: center; color: var(--text-muted);">
                    <div style="font-size: 32px; margin-bottom: 8px;">💡</div>
                    <p>输入任意英文单词或中文，全网词典实时检索并智能联想！</p>
                </div>
            `;
            return;
        }

        const itemsHtml = list.map(item => {
            const isSelected = !!state.selectedVocabMap[item.word];
            return `
                <div class="vocab-db-row ${isSelected ? 'selected' : ''}" data-word="${item.word}">
                    <div class="vocab-row-left">
                        <div class="vocab-word-title-row">
                            <span class="vocab-word-name">${item.word}</span>
                            ${item.pos ? `<span class="vocab-word-pos">${item.pos}</span>` : ''}
                            ${item.phonetic ? `<span class="vocab-word-ipa">${item.phonetic}</span>` : ''}
                        </div>
                        <div class="vocab-word-def">${item.def}</div>
                    </div>
                    <div class="vocab-row-right">
                        ${item.catName ? `<span class="vocab-cat-tag">${item.catName}</span>` : ''}
                        <div class="vocab-check-circle">${isSelected ? '✓' : ''}</div>
                    </div>
                </div>
            `;
        }).join('');

        elements.vocabListContainer.innerHTML = directAddHtml + itemsHtml;

        elements.vocabListContainer.querySelectorAll('.vocab-db-row, .vocab-direct-add-card').forEach(row => {
            row.addEventListener('click', () => {
                const word = row.dataset.word;
                toggleSelectVocab(word);
            });
        });

        updateVocabSelectedUI();
    }

    function toggleSelectVocab(word) {
        if (state.selectedVocabMap[word]) {
            delete state.selectedVocabMap[word];
        } else {
            state.selectedVocabMap[word] = true;
        }
        renderVocabList();
    }

    function updateVocabSelectedUI() {
        const count = Object.keys(state.selectedVocabMap).length;
        if (count > 0) {
            elements.vocabSelectedBadge.textContent = `已选 ${count} 词`;
            elements.vocabSelectedBadge.classList.remove('hidden');
            elements.vocabClearSelectedBtn.classList.remove('hidden');
            elements.vocabApplyBtn.disabled = false;
            elements.vocabApplyBtn.textContent = `一键填入 (${count})`;
        } else {
            elements.vocabSelectedBadge.classList.add('hidden');
            elements.vocabClearSelectedBtn.classList.add('hidden');
            elements.vocabApplyBtn.disabled = true;
            elements.vocabApplyBtn.textContent = `一键填入 (0)`;
        }
    }

    function clearSelectedVocab() {
        state.selectedVocabMap = {};
        renderVocabList();
    }

    function applySelectedVocab() {
        const selected = Object.keys(state.selectedVocabMap);
        if (selected.length === 0) return;
        const currentVal = (elements.wordsInput.value || '').trim();
        if (currentVal) {
            elements.wordsInput.value = currentVal + ', ' + selected.join(', ');
        } else {
            elements.wordsInput.value = selected.join(', ');
        }
        closeVocabModal();
        state.selectedVocabMap = {};
        showToast(`已填入 ${selected.length} 个单词`, 'success');
        elements.wordsInput.focus();
    }
});
