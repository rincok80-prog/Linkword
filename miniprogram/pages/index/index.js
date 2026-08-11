// pages/index/index.js
const app = getApp();
const { VOCAB_DATABASE } = require('../../utils/vocab_db.js');

let allVocabPool = [];

const loadingTips = [
  "正在用英文构思引人入胜的故事情节...",
  "正在翻阅字典寻找最准确的音标解释...",
  "正在把生词精心编织进简单好懂的句子...",
  "正在优化故事的中文翻译，确保通俗易懂...",
  "AI 老师正在为您生成朗读发音数据..."
];

const LENGTH_MAP = {
  1: { key: 'short', icon: '⚡', title: '极简速记', desc: '1-2 句' },
  2: { key: 'medium', icon: '📖', title: '标准故事', desc: '3-4 句' },
  3: { key: 'long', icon: '🌟', title: '沉浸长篇', desc: '5-6 句' }
};

const RANDOM_WORD_PRESETS = [
  "curious, galaxy, adventure",
  "whisper, dragon, brave",
  "robot, pizza, dancing",
  "magic, guitar, secret",
  "detective, mirror, shadow",
  "pristine, obsolete, digital",
  "benevolent, chaotic, harmony",
  "serendipity, ephemeral, nostalgia",
  "diligent, triumph, achieve",
  "novel, inspire, masterpiece",
  "abrupt, silence, awkward",
  "vulnerable, fortress, protect",
  "meticulous, recipe, delicious",
  "ambiguous, compass, wander",
  "resilient, storm, blossom",
  "plant(工厂), fine(罚款), current(水流)",
  "bank(河岸), spring(弹簧), desert(抛弃)",
  "bark(树皮), train(训练), match(火柴)",
  "bear(忍受), book(预订), light(点燃)",
  "party(聚会), patient(耐心的), rock(岩石)",
  "coffee, alarm, sleepy",
  "luggage, airport, passport",
  "umbrella, rainbow, puddle",
  "popcorn, cinema, laughter",
  "treasure, map, island",
  "camera, sunset, horizon",
  "bicycle, breeze, freedom",
  "candle, mystery, castle",
  "magnet, iron, attraction",
  "courage, leap, champion"
];

Page({
  data: {
    wordsInputValue: "",
    isGenerating: false,
    showEmptyState: true,
    showOutput: false,
    isStorySpeaking: false,
    storyHtml: "",
    storyTranslation: "",
    vocabList: [],
    errorMessage: "",
    speakingWord: "",
    historyList: [],
    showHistory: false,
    currentTip: loadingTips[0],
    tipIntervalId: null,
    audioContext: null,
    navHeight: 64, // default fallback
    showCropEditor: false,
    brushSize: 'medium',
    drawMode: 'brush',
    cropImgSrc: "",
    imageDisplayWidth: 300,
    imageDisplayHeight: 400,
    showFavorites: false,
    favoritesList: [],
    showVocabModal: false,
    vocabSearchQuery: "",
    cleanQueryWord: "",
    isEnglishQuery: false,
    isSearchingOnline: false,
    selectedVocabMap: {},
    selectedVocabCount: 0,
    filteredVocabList: [],
    storyLengthValue: 1,
    storyLength: "short",
    storyLengthInfo: { icon: '⚡', title: '极简速记', desc: '1-2 句' },
    showLengthSlider: false,
    activePolysemyIndex: -1,
    isQuizMode: false,
    clozeTokens: [],
    quizWordBank: [],
    activeBlankIndex: 0,
    quizCompleted: false
  },

  vocabSearchTimer: null,

  onLoad() {
    this.loadHistory();
    this.calculateNavHeight();
    this.loadFavorites();
    this.initVocabList();
    this.initStoryLengthSlider();
  },

  initStoryLengthSlider() {
    try {
      const savedVal = wx.getStorageSync('story_length_slider_val') || 1;
      const numVal = parseInt(savedVal, 10) || 1;
      const info = LENGTH_MAP[numVal] || LENGTH_MAP[1];
      this.setData({
        storyLengthValue: numVal,
        storyLength: info.key,
        storyLengthInfo: info
      });
    } catch (e) {}
  },

  calculateNavHeight() {
    try {
      const sysInfo = wx.getSystemInfoSync();
      const rect = wx.getMenuButtonBoundingClientRect();
      // Navigation bar height = capsule bottom + 8px spacing
      let navHeight = rect.bottom + 8;
      if (!navHeight || navHeight < 40) {
        navHeight = sysInfo.statusBarHeight + 44; 
      }
      this.setData({
        navHeight: navHeight
      });
      console.log('Calculated NavHeight:', navHeight);
    } catch (e) {
      console.error('Failed to get menu button rect:', e);
      this.setData({
        navHeight: 80 // fallback
      });
    }
  },

  onUnload() {
    this.stopLoadingTips();
    this.stopAudio();
  },

  onHide() {
    this.stopAudio();
  },

  // Read input words
  onWordsInput(e) {
    this.setData({
      wordsInputValue: e.detail.value
    });
  },

  // Clear input words
  clearWords() {
    this.setData({
      wordsInputValue: "",
      showEmptyState: true,
      showOutput: false
    });
  },

  // Empty handler for catchtap
  doNothing() {},

  // ==========================================================================
  // Word Index & Chinese Selection Methods
  // ==========================================================================
  initVocabList() {
    try {
      allVocabPool = (VOCAB_DATABASE || []).map(item => ({
        word: item.word,
        phonetic: item.phonetic || '',
        pos: item.pos || '',
        def: item.def || '',
        catName: '核心词'
      }));
    } catch (e) {
      allVocabPool = [];
    }
  },

  openVocabIndex() {
    this.setData({
      showVocabModal: true
    });
    this.filterVocabList();
  },

  closeVocabIndex() {
    this.setData({
      showVocabModal: false
    });
  },

  onVocabSearchInput(e) {
    const val = e.detail.value;
    const isChinese = /[\u4e00-\u9fa5]/.test(val);
    const cleanWord = val.trim();
    const isEng = !isChinese && /^[a-zA-Z\s-]+$/.test(cleanWord) && cleanWord.length >= 1;

    this.setData({
      vocabSearchQuery: val,
      cleanQueryWord: isEng ? cleanWord : "",
      isEnglishQuery: isEng
    });
    this.filterVocabList();

    if (this.vocabSearchTimer) clearTimeout(this.vocabSearchTimer);
    const query = cleanWord;
    if (query.length >= 1) {
      this.vocabSearchTimer = setTimeout(() => {
        this.queryOnlineDict(query);
      }, 200);
    } else {
      this.setData({ isSearchingOnline: false });
    }
  },

  onVocabSearchConfirm() {
    const val = (this.data.vocabSearchQuery || '').trim();
    if (val) {
      if (this.vocabSearchTimer) clearTimeout(this.vocabSearchTimer);
      this.queryOnlineDict(val);
    }
  },

  toggleDirectAddWord(e) {
    const word = e.currentTarget.dataset.word;
    if (!word) return;
    this.toggleSelectVocabItem({ currentTarget: { dataset: { word } } });
  },

  clearVocabSearch() {
    if (this.vocabSearchTimer) clearTimeout(this.vocabSearchTimer);
    this.setData({
      vocabSearchQuery: "",
      cleanQueryWord: "",
      isEnglishQuery: false,
      isSearchingOnline: false
    });
    this.filterVocabList();
  },

  filterVocabList() {
    const query = (this.data.vocabSearchQuery || '').trim().toLowerCase();

    if (!query) {
      this.setData({
        filteredVocabList: allVocabPool.slice(0, 30)
      });
      return;
    }

    const isChinese = /[\u4e00-\u9fa5]/.test(query);

    const filtered = allVocabPool.filter(item => {
      if (isChinese) {
        return item.def && item.def.includes(query);
      }
      return item.word.toLowerCase().includes(query) || (item.def && item.def.includes(query));
    });

    filtered.sort((a, b) => {
      const aWord = a.word.toLowerCase();
      const bWord = b.word.toLowerCase();
      const aStarts = aWord.startsWith(query) ? 0 : 1;
      const bStarts = bWord.startsWith(query) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return aWord.localeCompare(bWord);
    });

    this.setData({
      filteredVocabList: filtered.slice(0, 30)
    });
  },

  queryOnlineDict(query) {
    if (!query) return;
    const isChinese = /[\u4e00-\u9fa5]/.test(query);
    this.setData({ isSearchingOnline: true });

    const handleSuccessData = (data) => {
      const onlineResults = [];

      // 1. Structured results
      if (Array.isArray(data?.results) && data.results.length > 0) {
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

      // 2. Youdao entries format
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

      // 3. Youdao CE Dictionary (handles words like 傻子, 笨蛋, 坚持, 绝望)
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

      return onlineResults;
    };

    wx.request({
      url: `https://linkword.pages.dev/api/dict?q=${encodeURIComponent(query)}`,
      method: 'GET',
      timeout: 5000,
      success: (res) => {
        let results = [];
        if (res.statusCode === 200 && res.data) {
          results = handleSuccessData(res.data);
        }

        if (results.length > 0) {
          const currentFiltered = [...this.data.filteredVocabList];
          const existingWords = new Set(currentFiltered.map(w => w.word.toLowerCase()));
          const newWords = results.filter(w => !existingWords.has(w.word.toLowerCase()));
          const merged = [...newWords, ...currentFiltered].slice(0, 35);
          this.setData({
            filteredVocabList: merged,
            isSearchingOnline: false
          });
        } else if (isChinese) {
          // Fallback directly to CE jsonapi
          wx.request({
            url: `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(query)}&dicts=%7B%22count%22%3A1%2C%22dicts%22%3A%5B%5B%22ce%22%5D%5D%7D`,
            method: 'GET',
            timeout: 5000,
            success: (ceRes) => {
              const ceResults = handleSuccessData(ceRes.data);
              if (ceResults.length > 0) {
                const currentFiltered = [...this.data.filteredVocabList];
                const existingWords = new Set(currentFiltered.map(w => w.word.toLowerCase()));
                const newWords = ceResults.filter(w => !existingWords.has(w.word.toLowerCase()));
                const merged = [...newWords, ...currentFiltered].slice(0, 35);
                this.setData({
                  filteredVocabList: merged,
                  isSearchingOnline: false
                });
              } else {
                this.setData({ isSearchingOnline: false });
              }
            },
            fail: () => {
              this.setData({ isSearchingOnline: false });
            }
          });
        } else {
          this.setData({ isSearchingOnline: false });
        }
      },
      fail: () => {
        if (isChinese) {
          // Direct fallback to CE jsonapi
          wx.request({
            url: `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(query)}&dicts=%7B%22count%22%3A1%2C%22dicts%22%3A%5B%5B%22ce%22%5D%5D%7D`,
            method: 'GET',
            timeout: 5000,
            success: (ceRes) => {
              const ceResults = handleSuccessData(ceRes.data);
              if (ceResults.length > 0) {
                const currentFiltered = [...this.data.filteredVocabList];
                const existingWords = new Set(currentFiltered.map(w => w.word.toLowerCase()));
                const newWords = ceResults.filter(w => !existingWords.has(w.word.toLowerCase()));
                const merged = [...newWords, ...currentFiltered].slice(0, 35);
                this.setData({
                  filteredVocabList: merged,
                  isSearchingOnline: false
                });
              } else {
                this.setData({ isSearchingOnline: false });
              }
            },
            fail: () => {
              this.setData({ isSearchingOnline: false });
            }
          });
        } else {
          this.setData({ isSearchingOnline: false });
        }
      }
    });
  },

  toggleSelectVocabItem(e) {
    const word = e.currentTarget.dataset.word;
    const selectedMap = { ...this.data.selectedVocabMap };

    if (selectedMap[word]) {
      delete selectedMap[word];
    } else {
      selectedMap[word] = true;
    }

    const count = Object.keys(selectedMap).length;
    this.setData({
      selectedVocabMap: selectedMap,
      selectedVocabCount: count
    });
  },

  clearSelectedVocab() {
    this.setData({
      selectedVocabMap: {},
      selectedVocabCount: 0
    });
  },

  applySelectedVocab() {
    const selectedWords = Object.keys(this.data.selectedVocabMap);
    if (selectedWords.length === 0) {
      wx.showToast({
        title: '请先勾选单词',
        icon: 'none'
      });
      return;
    }

    let currentVal = (this.data.wordsInputValue || '').trim();
    let newVal = '';
    if (currentVal) {
      newVal = currentVal + ', ' + selectedWords.join(', ');
    } else {
      newVal = selectedWords.join(', ');
    }

    this.setData({
      wordsInputValue: newVal,
      showVocabModal: false,
      selectedVocabMap: {},
      selectedVocabCount: 0
    });

    wx.showToast({
      title: `已填入 ${selectedWords.length} 个单词`,
      icon: 'success'
    });
  },

  // Toggle history sidebar drawer
  toggleHistory() {
    this.setData({
      showHistory: !this.data.showHistory
    });
  },

  // Start Camera or Album OCR scanning
  startOCR() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          cropImgSrc: tempFilePath,
          showCropEditor: true
        });
      },
      fail: (err) => {
        console.log('Failed to choose media:', err);
      }
    });
  },

  // Custom Crop/Highlight Canvas initialization
  onCropImageLoad(e) {
    const naturalWidth = e.detail.width;
    const naturalHeight = e.detail.height;
    this.naturalWidth = naturalWidth;
    this.naturalHeight = naturalHeight;

    try {
      const sysInfo = wx.getSystemInfoSync();
      // Dynamically calculate the maximum available space for the crop editor body
      const maxContainerWidth = sysInfo.screenWidth - 32; // 16px padding on left/right
      const maxContainerHeight = sysInfo.screenHeight * 0.65; // Occupy up to 65% of screen height

      const imageRatio = naturalWidth / naturalHeight;
      const containerRatio = maxContainerWidth / maxContainerHeight;

      let displayWidth, displayHeight;
      if (imageRatio > containerRatio) {
        // Image is wider than the container aspect ratio, limit by width
        displayWidth = maxContainerWidth;
        displayHeight = maxContainerWidth / imageRatio;
      } else {
        // Image is taller, limit by height
        displayHeight = maxContainerHeight;
        displayWidth = maxContainerHeight * imageRatio;
      }

      this.clientWidth = displayWidth;
      this.clientHeight = displayHeight;

      this.setData({
        imageDisplayWidth: Math.floor(displayWidth),
        imageDisplayHeight: Math.floor(displayHeight)
      });

      // Query Canvas 2D instance
      wx.createSelectorQuery().select('#crop-highlight-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          // Match canvas resolution to displayed dimensions exactly
          canvas.width = displayWidth;
          canvas.height = displayHeight;

          this.canvasNode = canvas;
          this.canvasCtx = ctx;
          this.canvasWidth = displayWidth;
          this.canvasHeight = displayHeight;

          // Reset drawing variables
          this.isDrawing = false;
          this.hasDrawn = false;
          this.drawnBoxes = []; // Store drawn rectangles
          this.minX = Infinity;
          this.minY = Infinity;
          this.maxX = -Infinity;
          this.maxY = -Infinity;
        });

    } catch (err) {
      console.error('Failed to compute crop layout:', err);
    }
  },

  // Drawing touches handlers
  onTouchStart(e) {
    if (!this.canvasCtx) return;
    const touch = e.touches[0];
    this.isDrawing = true;
    this.startX = touch.x;
    this.startY = touch.y;
    this.lastX = touch.x;
    this.lastY = touch.y;
  },

  onTouchMove(e) {
    if (!this.isDrawing || !this.canvasCtx) return;
    const touch = e.touches[0];
    const x = touch.x;
    const y = touch.y;
    const ctx = this.canvasCtx;

    if (this.data.drawMode === 'brush') {
      // Brush Mode (Freehand doodle)
      ctx.beginPath();
      ctx.moveTo(this.lastX, this.lastY);
      ctx.lineTo(x, y);

      ctx.strokeStyle = 'rgba(255, 215, 0, 0.45)';
      const sizeMode = this.data.brushSize;
      const lineWidth = sizeMode === 'thin' ? 8 : (sizeMode === 'thick' ? 32 : 18);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Track bounding box bounds
      const halfWidth = lineWidth / 2;
      this.minX = Math.min(this.minX, x - halfWidth, this.lastX - halfWidth);
      this.minY = Math.min(this.minY, y - halfWidth, this.lastY - halfWidth);
      this.maxX = Math.max(this.maxX, x + halfWidth, this.lastX + halfWidth);
      this.maxY = Math.max(this.maxY, y + halfWidth, this.lastY + halfWidth);

      this.lastX = x;
      this.lastY = y;
      this.hasDrawn = true;
    } else {
      // Box Mode (Rectangle selection) - Support multiple rectangles
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      
      // 1. Draw all previously saved rectangles
      ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      
      if (this.drawnBoxes && this.drawnBoxes.length > 0) {
        this.drawnBoxes.forEach(box => {
          ctx.fillRect(box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1);
          ctx.strokeRect(box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1);
        });
      }
      
      // 2. Draw current active dragging rectangle
      const width = x - this.startX;
      const height = y - this.startY;
      ctx.fillRect(this.startX, this.startY, width, height);
      ctx.strokeRect(this.startX, this.startY, width, height);
    }
  },

  onTouchEnd(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    // In Box Mode, save the finished rectangle when the finger is lifted
    if (this.data.drawMode === 'box') {
      const touch = e.changedTouches[0] || e.touches[0];
      if (touch) {
        const x = touch.x;
        const y = touch.y;
        const x1 = Math.min(this.startX, x);
        const y1 = Math.min(this.startY, y);
        const x2 = Math.max(this.startX, x);
        const y2 = Math.max(this.startY, y);

        // Ensure box isn't a tiny accidental click
        if (x2 - x1 > 6 && y2 - y1 > 6) {
          if (!this.drawnBoxes) this.drawnBoxes = [];
          this.drawnBoxes.push({ x1, y1, x2, y2 });
          this.hasDrawn = true;
        }
      }
    }
  },

  changeBrushSize(e) {
    const size = e.currentTarget.dataset.size;
    this.setData({
      brushSize: size
    });
  },

  changeDrawMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      drawMode: mode
    });
    this.clearCropCanvas(); // Reset canvas state when switching modes
  },

  clearCropCanvas() {
    if (!this.canvasCtx) return;
    this.canvasCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.hasDrawn = false;
    this.drawnBoxes = []; // Clear saved boxes
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    wx.showToast({
      title: '画布已清空',
      icon: 'none'
    });
  },

  cancelCropEditor() {
    this.setData({
      showCropEditor: false
    });
    this.hasDrawn = false;
    this.drawnBoxes = [];
  },

  confirmCropAndRunOCR() {
    if (!this.hasDrawn) {
      // If nothing drawn, process the original full size image
      this.setData({ showCropEditor: false });
      this.processOCR(this.data.cropImgSrc);
      return;
    }

    // In Box Mode, calculate the overall enclosing bounding box for all drawn rectangles
    if (this.data.drawMode === 'box') {
      if (!this.drawnBoxes || this.drawnBoxes.length === 0) {
        this.setData({ showCropEditor: false });
        this.processOCR(this.data.cropImgSrc);
        return;
      }
      
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      
      this.drawnBoxes.forEach(box => {
        minX = Math.min(minX, box.x1);
        minY = Math.min(minY, box.y1);
        maxX = Math.max(maxX, box.x2);
        maxY = Math.max(maxY, box.y2);
      });
      
      this.minX = minX;
      this.minY = minY;
      this.maxX = maxX;
      this.maxY = maxY;
    }

    // Apply bounding box cropping
    const scaleX = this.naturalWidth / this.clientWidth;
    const scaleY = this.naturalHeight / this.clientHeight;
    const padding = 15;

    let cropX = Math.max(0, Math.floor(this.minX * scaleX) - padding);
    let cropY = Math.max(0, Math.floor(this.minY * scaleY) - padding);
    let cropW = Math.min(this.naturalWidth - cropX, Math.ceil((this.maxX - this.minX) * scaleX) + padding * 2);
    let cropH = Math.min(this.naturalHeight - cropY, Math.ceil((this.maxY - this.minY) * scaleY) + padding * 2);

    if (cropW <= 5 || cropH <= 5) {
      wx.showToast({
        title: '涂抹范围过小',
        icon: 'none'
      });
      return;
    }

    this.setData({ showCropEditor: false });
    wx.showLoading({
      title: '正在裁剪...',
      mask: true
    });

    try {
      // Create offscreen canvas to copy the cropped segment cleanly
      const offscreenCanvas = wx.createOffscreenCanvas({
        type: '2d',
        width: cropW,
        height: cropH
      });
      const offCtx = offscreenCanvas.getContext('2d');
      const img = offscreenCanvas.createImage();
      img.src = this.data.cropImgSrc;
      
      img.onload = () => {
        offCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        wx.canvasToTempFilePath({
          canvas: offscreenCanvas,
          x: 0,
          y: 0,
          width: cropW,
          height: cropH,
          destWidth: cropW,
          destHeight: cropH,
          fileType: 'jpg',
          quality: 0.85,
          success: (res) => {
            wx.hideLoading();
            this.processOCR(res.tempFilePath);
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('Canvas export failed:', err);
            this.processOCR(this.data.cropImgSrc);
          }
        });
      };

      img.onerror = (err) => {
        wx.hideLoading();
        console.error('Offscreen load failed:', err);
        this.processOCR(this.data.cropImgSrc);
      };

    } catch (e) {
      wx.hideLoading();
      console.error('Offscreen canvas error:', e);
      this.processOCR(this.data.cropImgSrc);
    }
  },

  // Convert image to Base64 and request OCR endpoint
  processOCR(filePath) {
    wx.showLoading({
      title: '正在提取单词...',
      mask: true
    });

    try {
      const fs = wx.getFileSystemManager();
      const base64 = fs.readFileSync(filePath, 'base64');
      
      // Get file mime type based on extension
      let mime = 'image/jpeg';
      if (filePath.endsWith('.png')) mime = 'image/png';
      else if (filePath.endsWith('.gif')) mime = 'image/gif';

      wx.request({
        url: `${app.globalData.apiHost}/api/ocr`,
        method: 'POST',
        header: {
          'content-type': 'application/json'
        },
        data: {
          image: base64,
          mime: mime
        },
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode !== 200) {
            const errMsg = res.data && res.data.error ? res.data.error : `HTTP ${res.statusCode}`;
            this.showErrorModal('提取失败', errMsg);
            return;
          }

          const rawText = res.data.text || '';
          console.log('OCR Response:', rawText);

          // Clean and extract English words
          const words = rawText
            .split(/[\s,;，；\n\t.()!?"'“”:*-]+/)
            .map(w => w.trim().replace(/[^a-zA-Z-]/g, ''))
            .filter(w => w.length >= 2);

          const uniqueWords = [...new Set(words)];

          if (uniqueWords.length > 0) {
            const recognizedWords = uniqueWords.join(', ');
            const existing = this.data.wordsInputValue.trim();
            const separator = existing ? ', ' : '';
            this.setData({
              wordsInputValue: existing + separator + recognizedWords
            });
            wx.showToast({
              title: `成功提取 ${uniqueWords.length} 个生词`,
              icon: 'success'
            });
          } else {
            this.showErrorModal('识别失败', '未能从照片中提取到有效的英文单词，请确保字迹清晰，且为纯英文。');
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('OCR Request Failed:', err);
          this.showErrorModal('网络失败', '网络请求失败，请确保已在微信后台配置小程序 request 域名。');
        }
      });

    } catch (e) {
      wx.hideLoading();
      console.error('Read file error:', e);
      this.showErrorModal('读取失败', '读取图片数据失败，请重试。');
    }
  },

  toggleLengthSlider() {
    this.setData({
      showLengthSlider: !this.data.showLengthSlider
    });
  },

  onLengthSliderChanging(e) {
    const val = parseInt(e.detail.value, 10) || 2;
    const info = LENGTH_MAP[val] || LENGTH_MAP[2];
    this.setData({
      storyLengthValue: val,
      storyLength: info.key,
      storyLengthInfo: info
    });
  },

  onLengthSliderChange(e) {
    const val = parseInt(e.detail.value, 10) || 2;
    const info = LENGTH_MAP[val] || LENGTH_MAP[2];
    this.setData({
      storyLengthValue: val,
      storyLength: info.key,
      storyLengthInfo: info
    });
    try {
      wx.setStorageSync('story_length_slider_val', val);
      wx.setStorageSync('story_length_pref', info.key);
    } catch (err) {}
  },

  onScaleTap(e) {
    const val = parseInt(e.currentTarget.dataset.val, 10) || 2;
    const info = LENGTH_MAP[val] || LENGTH_MAP[2];
    this.setData({
      storyLengthValue: val,
      storyLength: info.key,
      storyLengthInfo: info
    });
    try {
      wx.setStorageSync('story_length_slider_val', val);
      wx.setStorageSync('story_length_pref', info.key);
    } catch (err) {}
  },

  fillRandomWords() {
    let nextWords = "";
    if (allVocabPool && allVocabPool.length > 50 && Math.random() > 0.45) {
      const idxs = new Set();
      while (idxs.size < 3) {
        idxs.add(Math.floor(Math.random() * allVocabPool.length));
      }
      nextWords = Array.from(idxs).map(i => allVocabPool[i].word).join(', ');
    } else {
      const current = this.data.wordsInputValue.trim();
      const filtered = RANDOM_WORD_PRESETS.filter(p => p !== current);
      nextWords = filtered[Math.floor(Math.random() * filtered.length)];
    }

    this.setData({
      wordsInputValue: nextWords
    });

    wx.showToast({
      title: '🎲 已随机填入单词',
      icon: 'none',
      duration: 1500
    });
  },

  togglePolysemyOptions(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    this.setData({
      activePolysemyIndex: this.data.activePolysemyIndex === idx ? -1 : idx
    });
  },

  selectWordMeaning(e) {
    const word = (e.currentTarget.dataset.word || '').trim();
    const def = (e.currentTarget.dataset.def || '').trim();
    if (!word || !def) return;

    const shortDef = def.split(/[；;,]/)[0].trim();
    const currentInput = this.data.wordsInputValue.trim();
    
    // Split words by commas, semicolons or spaces
    const tokens = currentInput.split(/[,，;；\n]+/).map(t => t.trim()).filter(Boolean);
    let replaced = false;

    const newTokens = tokens.map(token => {
      // match base English word before any parenthesis/colon
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

    const nextInputValue = newTokens.join(', ');
    this.setData({
      wordsInputValue: nextInputValue,
      activePolysemyIndex: -1
    });

    wx.showToast({
      title: `已选定【${word}(${shortDef})】`,
      icon: 'success',
      duration: 1600
    });
  },

  toggleQuizMode() {
    if (!this.data.isQuizMode) {
      this.initQuiz();
    } else {
      this.setData({
        isQuizMode: false
      });
    }
  },

  initQuiz() {
    const rawHtml = this.data.storyHtml || '';
    if (!rawHtml) return;

    // Extract target words from <strong>...</strong> or from vocabList
    const strongRegex = /<strong>(.*?)<\/strong>/gi;
    let tokens = [];
    let lastIdx = 0;
    let blankIdx = 0;
    let targetWords = [];
    let match;

    while ((match = strongRegex.exec(rawHtml)) !== null) {
      const start = match.index;
      const end = strongRegex.lastIndex;
      if (start > lastIdx) {
        tokens.push({ type: 'text', text: rawHtml.substring(lastIdx, start).replace(/<[^>]+>/g, '') });
      }
      const targetWord = match[1].trim();
      targetWords.push(targetWord);
      tokens.push({
        type: 'blank',
        blankIndex: blankIdx,
        targetWord: targetWord,
        filledWord: null,
        isCorrect: false
      });
      blankIdx++;
      lastIdx = end;
    }

    if (lastIdx < rawHtml.length) {
      tokens.push({ type: 'text', text: rawHtml.substring(lastIdx).replace(/<[^>]+>/g, '') });
    }

    // Fallback: If no <strong> tags found, match from vocabList
    if (blankIdx === 0 && this.data.vocabList && this.data.vocabList.length > 0) {
      tokens = [];
      blankIdx = 0;
      targetWords = [];
      const plainText = rawHtml.replace(/<[^>]+>/g, '');
      const wordsToFind = this.data.vocabList.map(v => v.word.trim()).filter(Boolean);
      const pattern = new RegExp(`\\b(${wordsToFind.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
      
      let pLast = 0;
      let pMatch;
      while ((pMatch = pattern.exec(plainText)) !== null) {
        const pStart = pMatch.index;
        const pEnd = pattern.lastIndex;
        if (pStart > pLast) {
          tokens.push({ type: 'text', text: plainText.substring(pLast, pStart) });
        }
        const tw = pMatch[1].trim();
        targetWords.push(tw);
        tokens.push({
          type: 'blank',
          blankIndex: blankIdx,
          targetWord: tw,
          filledWord: null,
          isCorrect: false
        });
        blankIdx++;
        pLast = pEnd;
      }
      if (pLast < plainText.length) {
        tokens.push({ type: 'text', text: plainText.substring(pLast) });
      }
    }

    // Create Shuffled Word Bank
    const bank = targetWords.map((word, i) => ({
      id: i,
      word: word,
      used: false
    })).sort(() => Math.random() - 0.5);

    this.setData({
      isQuizMode: true,
      clozeTokens: tokens,
      quizWordBank: bank,
      activeBlankIndex: 0,
      quizCompleted: false
    });
  },

  onBlankSlotTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    const tokens = [...this.data.clozeTokens];
    const targetToken = tokens.find(t => t.type === 'blank' && t.blankIndex === idx);
    
    if (targetToken && targetToken.filledWord) {
      // Return filled word back to word bank
      const oldWord = targetToken.filledWord;
      targetToken.filledWord = null;
      targetToken.isCorrect = false;

      const bank = this.data.quizWordBank.map(item => {
        if (item.word.toLowerCase() === oldWord.toLowerCase() && item.used) {
          return { ...item, used: false };
        }
        return item;
      });

      this.setData({
        clozeTokens: tokens,
        quizWordBank: bank,
        activeBlankIndex: idx,
        quizCompleted: false
      });
      return;
    }

    this.setData({
      activeBlankIndex: idx
    });
  },

  onSelectQuizOption(e) {
    const id = parseInt(e.currentTarget.dataset.id, 10);
    const word = (e.currentTarget.dataset.word || '').trim();
    if (!word) return;

    const bank = [...this.data.quizWordBank];
    const bankItem = bank.find(b => b.id === id);
    if (!bankItem || bankItem.used) return;

    const tokens = [...this.data.clozeTokens];
    let currentIdx = this.data.activeBlankIndex;

    // Find the blank slot to fill
    let slot = tokens.find(t => t.type === 'blank' && t.blankIndex === currentIdx && !t.filledWord);
    if (!slot) {
      // find first empty blank
      slot = tokens.find(t => t.type === 'blank' && !t.filledWord);
      if (slot) {
        currentIdx = slot.blankIndex;
      }
    }

    if (!slot) return;

    const isMatch = slot.targetWord.toLowerCase() === word.toLowerCase();
    slot.filledWord = word;
    slot.isCorrect = isMatch;
    bankItem.used = true;

    // Check if wrong
    if (!isMatch) {
      try {
        wx.vibrateShort && wx.vibrateShort({ type: 'medium' });
      } catch (err) {}
      wx.showToast({
        title: '位置不对哦，再想想~',
        icon: 'none',
        duration: 1200
      });
      // automatically pop back after 600ms if wrong
      this.setData({
        clozeTokens: tokens,
        quizWordBank: bank,
        activeBlankIndex: currentIdx
      });

      setTimeout(() => {
        slot.filledWord = null;
        slot.isCorrect = false;
        bankItem.used = false;
        this.setData({
          clozeTokens: [...tokens],
          quizWordBank: [...bank]
        });
      }, 700);
      return;
    }

    // Correct! Short haptic feedback
    try {
      wx.vibrateShort && wx.vibrateShort({ type: 'light' });
    } catch (err) {}

    // Find next empty blank
    const nextEmpty = tokens.find(t => t.type === 'blank' && !t.filledWord && t.blankIndex !== currentIdx);
    const nextBlankIdx = nextEmpty ? nextEmpty.blankIndex : -1;

    // Check if all blanks are correctly filled
    const allFilledCorrect = tokens.filter(t => t.type === 'blank').every(t => t.filledWord && t.isCorrect);

    this.setData({
      clozeTokens: tokens,
      quizWordBank: bank,
      activeBlankIndex: nextBlankIdx,
      quizCompleted: allFilledCorrect
    });

    if (allFilledCorrect) {
      wx.showToast({
        title: '🎉 太棒了！全对通关！',
        icon: 'success',
        duration: 2000
      });
    }
  },

  // Main generator trigger
  handleGeneration() {
    if (this.data.isGenerating) return;

    const rawInput = this.data.wordsInputValue.trim();
    if (!rawInput) {
      wx.showToast({
        title: '请输入英文单词',
        icon: 'error'
      });
      return;
    }

    // Split words by common delimiters while preserving (meaning) syntax
    const rawTokens = rawInput
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

    const validWords = words.filter(w => /[a-zA-Z]/.test(w));

    if (validWords.length === 0) {
      wx.showToast({
        title: '请输入有效单词',
        icon: 'error'
      });
      return;
    }

    const cacheKey = 'lw_cache_' + validWords.join('_') + '_' + (this.data.storyLength || 'short') + '_' + (this.data.selectedStyle || 'humorous');
    try {
      const cached = wx.getStorageSync(cacheKey);
      if (cached && cached.story && cached.words) {
        this.renderResult(cached);
        this.setData({
          isGenerating: false,
          showOutput: true
        });
        wx.showToast({
          title: '秒极速加载 (0.01s)',
          icon: 'success'
        });
        return;
      }
    } catch (e) {}

    this.stopAudio();
    this.setData({
      isGenerating: true,
      showEmptyState: false,
      showOutput: false,
      activePolysemyIndex: -1
    });
    this.startLoadingTips();

    wx.request({
      url: `${app.globalData.apiHost}/api/generate`,
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        words: validWords,
        style: this.data.selectedStyle || 'humorous',
        length: this.data.storyLength || 'medium'
      },
      success: (res) => {
        this.stopLoadingTips();
        if (res.statusCode !== 200) {
          const errMsg = res.data && res.data.error ? res.data.error : `HTTP ${res.statusCode}`;
          wx.showModal({
            title: '生成失败',
            content: errMsg,
            showCancel: false
          });
          this.setData({
            isGenerating: false,
            showEmptyState: true
          });
          return;
        }

        const data = res.data;
        try { wx.setStorageSync(cacheKey, data); } catch (e) {}
        this.renderResult(data);
        this.saveHistoryItem(validWords, data);
        this.setData({
          isGenerating: false,
          showOutput: true
        });
        wx.showToast({
          title: '生成成功！',
          icon: 'success'
        });
      },
      fail: (err) => {
        this.stopLoadingTips();
        console.error('Generation Failed:', err);
        wx.showModal({
          title: '网络失败',
          content: '生成接口失败，请检查手机网络配置，或检查小程序后台合法域名配置。',
          showCancel: false
        });
        this.setData({
          isGenerating: false,
          showEmptyState: true
        });
      }
    });
  },

  // Parse result from JSON backend and map to page state
  renderResult(data) {
    const favs = wx.getStorageSync('favoritesList') || [];
    const favMap = new Map(favs.map(f => [f.word.toLowerCase(), true]));

    const words = (data.words || []).map(item => ({
      ...item,
      isFavorite: favMap.has(item.word.toLowerCase())
    }));

    this.setData({
      storyHtml: data.story || "",
      storyTranslation: data.story_translation || "",
      vocabList: words,
      activePolysemyIndex: -1,
      isQuizMode: false,
      quizCompleted: false,
      clozeTokens: [],
      quizWordBank: []
    });
  },

  // Loading tips animation loop
  startLoadingTips() {
    this.stopLoadingTips();
    let index = 0;
    this.setData({
      currentTip: loadingTips[0]
    });

    const intervalId = setInterval(() => {
      index = (index + 1) % loadingTips.length;
      this.setData({
        currentTip: loadingTips[index]
      });
    }, 3000);

    this.setData({
      tipIntervalId: intervalId
    });
  },

  stopLoadingTips() {
    if (this.data.tipIntervalId) {
      clearInterval(this.data.tipIntervalId);
      this.setData({
        tipIntervalId: null
      });
    }
  },

  // Story TTS audio player
  toggleSpeakStory() {
    if (this.data.isStorySpeaking) {
      this.stopAudio();
      return;
    }

    const rawStory = this.data.storyHtml;
    if (!rawStory) return;

    // Remove strong tags or other HTML tags
    const cleanText = rawStory.replace(/<[^>]*>/g, '');
    const ttsUrl = `${app.globalData.apiHost}/api/tts?text=${encodeURIComponent(cleanText)}`;

    const audioContext = wx.createInnerAudioContext();
    audioContext.src = ttsUrl;
    
    audioContext.onPlay(() => {
      this.setData({
        isStorySpeaking: true
      });
    });

    audioContext.onEnded(() => {
      this.setData({
        isStorySpeaking: false
      });
      audioContext.destroy();
    });

    audioContext.onError((res) => {
      console.error('Audio Play Error:', res);
      wx.showToast({
        title: '语音合成播放失败',
        icon: 'none'
      });
      this.setData({
        isStorySpeaking: false
      });
      audioContext.destroy();
    });

    this.setData({
      audioContext: audioContext
    });

    audioContext.play();
  },

  // Play individual word pronunciation
  speakSingleWord(e) {
    const word = e.currentTarget.dataset.word;
    if (!word) return;

    const audioUrl = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(word)}`;
    const wordAudio = wx.createInnerAudioContext();
    wordAudio.src = audioUrl;
    
    wordAudio.onEnded(() => {
      wordAudio.destroy();
    });

    wordAudio.onError((res) => {
      console.error('Word audio failed:', res);
      wordAudio.destroy();
    });

    wordAudio.play();
  },

  // Stop currently playing story audio
  stopAudio() {
    if (this.data.audioContext) {
      try {
        this.data.audioContext.stop();
        this.data.audioContext.destroy();
      } catch (e) {
        console.log('Error destroying audio:', e);
      }
      this.setData({
        audioContext: null,
        isStorySpeaking: false
      });
    }
  },

  // History Management
  loadHistory() {
    const history = wx.getStorageSync('linkword_history') || [];
    // Pre-format words join and display times
    const formattedHistory = history.map(item => ({
      ...item,
      wordsJoin: item.words.join(', '),
      timeFormatted: this.formatTime(new Date(item.timestamp))
    }));

    this.setData({
      historyList: formattedHistory
    });
  },

  saveHistoryItem(words, result) {
    const history = wx.getStorageSync('linkword_history') || [];
    
    // De-duplicate if same word set generated
    const wordKey = words.join(',').toLowerCase();
    const cleanHistory = history.filter(item => item.words.join(',').toLowerCase() !== wordKey);
    
    cleanHistory.unshift({
      words: words,
      result: result,
      timestamp: Date.now()
    });

    // Keep max 50 items
    if (cleanHistory.length > 50) {
      cleanHistory.pop();
    }

    wx.setStorageSync('linkword_history', cleanHistory);
    this.loadHistory();
  },

  selectHistoryItem(e) {
    const index = e.currentTarget.dataset.index;
    const selected = this.data.historyList[index];
    if (!selected) return;

    this.stopAudio();
    this.renderResult(selected.result);
    this.setData({
      wordsInputValue: selected.words.join(', '),
      showOutput: true,
      showEmptyState: false,
      showHistory: false
    });

    wx.showToast({
      title: '已加载历史记录',
      icon: 'none'
    });
  },

  clearHistory() {
    wx.showModal({
      title: '清空历史',
      content: '确定要清空所有的联想历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('linkword_history');
          this.setData({
            historyList: []
          });
          wx.showToast({
            title: '历史记录已清空',
            icon: 'success'
          });
        }
      }
    });
  },

  // Helper formats
  formatTime(date) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  },

  showErrorModal(title, content) {
    wx.showModal({
      title: title,
      content: content,
      showCancel: false
    });
  },

  // 📖 Favorites (生词本) Management
  loadFavorites() {
    try {
      const favs = wx.getStorageSync('favoritesList') || [];
      this.setData({
        favoritesList: favs
      });
    } catch (e) {
      console.error('Failed to load favorites:', e);
    }
  },

  toggleFavorites() {
    this.setData({
      showFavorites: !this.data.showFavorites
    });
  },

  toggleFavoriteWord(e) {
    const index = e.currentTarget.dataset.index;
    const vocabList = this.data.vocabList;
    const item = vocabList[index];
    item.isFavorite = !item.isFavorite;

    let favs = wx.getStorageSync('favoritesList') || [];
    if (item.isFavorite) {
      // Add to favorites if not already present
      if (!favs.some(f => f.word.toLowerCase() === item.word.toLowerCase())) {
        favs.unshift({
          word: item.word,
          pos: item.pos || '',
          definition: item.definition || '',
          sentence: item.sentence || ''
        });
      }
      wx.showToast({
        title: '已加入生词本',
        icon: 'success'
      });
    } else {
      // Remove from favorites
      favs = favs.filter(f => f.word.toLowerCase() !== item.word.toLowerCase());
      wx.showToast({
        title: '已取消收藏',
        icon: 'none'
      });
    }

    wx.setStorageSync('favoritesList', favs);
    this.setData({
      vocabList: vocabList,
      favoritesList: favs
    });
  },

  removeFavorite(e) {
    const word = e.currentTarget.dataset.word;
    let favs = wx.getStorageSync('favoritesList') || [];
    favs = favs.filter(f => f.word.toLowerCase() !== word.toLowerCase());
    wx.setStorageSync('favoritesList', favs);

    // Also sync the current vocab card star state if visible
    const vocabList = this.data.vocabList.map(item => {
      if (item.word.toLowerCase() === word.toLowerCase()) {
        return { ...item, isFavorite: false };
      }
      return item;
    });

    this.setData({
      favoritesList: favs,
      vocabList: vocabList
    });
    
    wx.showToast({
      title: '已移除',
      icon: 'none'
    });
  },

  clearFavorites() {
    wx.showModal({
      title: '确认清空',
      content: '是否清空您的生词本？此操作不可撤销。',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('favoritesList', []);
          const vocabList = this.data.vocabList.map(item => ({ ...item, isFavorite: false }));
          this.setData({
            favoritesList: [],
            vocabList: vocabList
          });
          wx.showToast({
            title: '生词本已清空',
            icon: 'success'
          });
        }
      }
    });
  },

  // 📤 Native WeChat Share Handlers
  onShareAppMessage() {
    const words = this.data.vocabList.map(item => item.word).slice(0, 3).join(', ');
    const shareTitle = words 
      ? `【趣味记忆】我用 AI 趣味记住了：${words} 等单词，快来看看故事吧！`
      : `【LinkWord 联想记忆】输入几个单词，AI 帮您串联成好记的情境小故事！`;
    return {
      title: shareTitle,
      path: '/pages/index/index'
    };
  },

  onShareTimeline() {
    const words = this.data.vocabList.map(item => item.word).slice(0, 3).join(', ');
    return {
      title: words ? `趣味联想记词：${words}` : 'LinkWord AI 联想背单词软件',
      query: ''
    };
  }
});
