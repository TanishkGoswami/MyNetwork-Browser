// Smart Download Manager - Tracking, Categorization and Shelf Controls
const { eventBus } = require('../../shared/events/event-bus');

class DownloadManager {
  constructor() {
    this.downloads = [];
    this.init();
  }

  init() {
    try {
      const saved = localStorage.getItem('download_history');
      if (saved) {
        this.downloads = JSON.parse(saved).slice(0, 50); // Keep last 50
      }
    } catch (e) {
      this.downloads = [];
    }
  }

  save() {
    try {
      localStorage.setItem('download_history', JSON.stringify(this.downloads));
    } catch (e) {}
  }

  registerDownload({ id, filename, url, savePath = '', totalBytes = 0 }) {
    const download = {
      id: id || 'dl_' + Date.now(),
      filename: filename || 'download',
      url,
      savePath,
      totalBytes,
      receivedBytes: 0,
      percent: 0,
      state: 'progressing', // 'progressing' | 'completed' | 'cancelled' | 'interrupted'
      category: this.detectCategory(filename),
      startTime: Date.now(),
      completedTime: null
    };

    this.downloads.unshift(download);
    this.save();
    eventBus.emit('download:started', { download });
    return download;
  }

  updateProgress(id, { receivedBytes, totalBytes, state }) {
    const dl = this.downloads.find(d => d.id === id);
    if (!dl) return;

    dl.receivedBytes = receivedBytes;
    if (totalBytes) dl.totalBytes = totalBytes;
    if (state) dl.state = state;

    if (dl.totalBytes > 0) {
      dl.percent = Math.min(100, Math.round((dl.receivedBytes / dl.totalBytes) * 100));
    }

    if (dl.state === 'completed' && !dl.completedTime) {
      dl.completedTime = Date.now();
      dl.percent = 100;
    }

    this.save();
    eventBus.emit('download:updated', { download: dl });
  }

  detectCategory(filename = '') {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return 'Image';
    if (['mp4', 'webm', 'mkv', 'mp3', 'wav', 'flac'].includes(ext)) return 'Media';
    if (['zip', 'rar', 'tar', 'gz', '7z', 'iso'].includes(ext)) return 'Archive';
    if (['pdf', 'doc', 'docx', 'txt', 'csv', 'xlsx', 'md'].includes(ext)) return 'Document';
    if (['js', 'ts', 'py', 'json', 'html', 'css', 'cpp', 'rs', 'go'].includes(ext)) return 'Code';
    return 'File';
  }

  getAllDownloads() {
    return [...this.downloads];
  }

  clearHistory() {
    this.downloads = this.downloads.filter(d => d.state === 'progressing');
    this.save();
    eventBus.emit('download:cleared', {});
  }
}

const downloadManager = new DownloadManager();

module.exports = { DownloadManager, downloadManager };
