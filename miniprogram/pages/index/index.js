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
    navHeight: 64 // default fallback
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
        // Open WeChat's native image editor to let the user crop, rotate, or doodle
        wx.editImage({
          src: tempFilePath,
          success: (editRes) => {
            this.processOCR(editRes.tempFilePath);
          },
          fail: (err) => {
            console.log('Edit image cancelled or failed, falling back to original image:', err);
            this.processOCR(tempFilePath);
          }
        });
      },
      fail: (err) => {
        console.log('Failed to choose media:', err);
      }
    });
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
