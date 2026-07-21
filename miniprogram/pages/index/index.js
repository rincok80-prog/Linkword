// pages/index/index.js
const app = getApp();

const loadingTips = [
  "正在用英文构思引人入胜的故事情节...",
  "正在翻阅字典寻找最准确的音标解释...",
  "正在把生词精心编织进简单好懂的句子...",
  "正在优化故事的中文翻译，确保通俗易懂...",
  "AI 老师正在为您生成朗读发音数据..."
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
    imageDisplayHeight: 400
  },

  onLoad() {
    this.loadHistory();
    this.calculateNavHeight();
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
      wordsInputValue: ""
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

    // Split words by common delimiters
    const words = rawInput
      .split(/[\s,;，；\n\t]+/)
      .map(w => w.trim().replace(/[^a-zA-Z-]/g, ''))
      .filter(w => w.length > 0);

    if (words.length === 0) {
      wx.showToast({
        title: '请输入有效单词',
        icon: 'error'
      });
      return;
    }

    this.stopAudio();
    this.setData({
      isGenerating: true,
      showEmptyState: false,
      showOutput: false
    });
    this.startLoadingTips();

    wx.request({
      url: `${app.globalData.apiHost}/api/generate`,
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        words: words
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
        this.renderResult(data);
        this.saveHistoryItem(words, data);
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
    this.setData({
      storyHtml: data.story || "",
      storyTranslation: data.story_translation || "",
      vocabList: data.words || []
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
  }
});
