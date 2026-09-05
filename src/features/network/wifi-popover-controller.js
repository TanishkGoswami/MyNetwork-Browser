// WifiPopoverController - Controls the macOS Wi-Fi & Network Performance Popover and Bar Indicators
const { eventBus } = require('../../shared/events/event-bus');
const { networkMonitorService } = require('./network-monitor-service');

class WifiPopoverController {
  constructor(shell) {
    this.shell = shell;
    this.isOpen = false;
    this.dom = {};
    this.sparklineCanvas = null;
    this.sparklineCtx = null;
    this.init();
  }

  init() {
    this.cacheDom();
    this.bindEvents();
    this.render(networkMonitorService.getStats());
  }

  cacheDom() {
    this.dom = {
      // Topbar & Status Bar Triggers
      topbarBtn: document.getElementById('btn-topbar-wifi'),
      topbarIcon: document.getElementById('topbar-wifi-icon'),
      topbarSpeed: document.getElementById('topbar-wifi-speed'),
      sbBtn: document.getElementById('sb-network-status'),
      sbText: document.getElementById('sb-network-text'),
      sbWifiIcon: document.getElementById('sb-wifi-icon'),
      
      // Popover
      popover: document.getElementById('mac-wifi-popover'),
      popBadge: document.getElementById('wifi-pop-badge'),
      popSubState: document.getElementById('wifi-pop-sub-state'),
      ssidText: document.getElementById('wifi-pop-ssid'),
      statusDot: document.getElementById('wifi-pop-dot'),
      statusText: document.getElementById('wifi-pop-status-text'),
      monitorToggle: document.getElementById('wifi-monitor-toggle'),

      // Metrics
      downlinkVal: document.getElementById('wifi-metric-downlink'),
      pingVal: document.getElementById('wifi-metric-ping'),
      standardVal: document.getElementById('wifi-metric-standard'),
      qualityVal: document.getElementById('wifi-metric-quality'),

      // Canvas & Details
      canvas: document.getElementById('wifi-latency-canvas'),
      ipVal: document.getElementById('wifi-detail-ip'),
      dnsVal: document.getElementById('wifi-detail-dns'),
      protoVal: document.getElementById('wifi-detail-proto'),
      lossVal: document.getElementById('wifi-detail-loss'),

      // Buttons
      btnSpeedTest: document.getElementById('btn-wifi-speedtest'),
      speedTestLabel: document.getElementById('wifi-speedtest-label'),
      btnCopyInfo: document.getElementById('btn-wifi-copy-info')
    };

    if (this.dom.canvas) {
      this.sparklineCtx = this.dom.canvas.getContext('2d');
    }
  }

  bindEvents() {
    // Topbar Wi-Fi Button Click
    if (this.dom.topbarBtn) {
      this.dom.topbarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePopover();
      });
    }

    // Status Bar Network Button Click
    if (this.dom.sbBtn) {
      this.dom.sbBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePopover();
      });
    }

    // Monitor Switch
    if (this.dom.monitorToggle) {
      this.dom.monitorToggle.addEventListener('change', (e) => {
        networkMonitorService.toggleMonitoring(e.target.checked);
      });
    }

    // Speed Test Button
    if (this.dom.btnSpeedTest) {
      this.dom.btnSpeedTest.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (this.dom.speedTestLabel) {
          this.dom.speedTestLabel.textContent = 'Testing Speed...';
        }
        this.dom.btnSpeedTest.classList.add('running');
        await networkMonitorService.runSpeedTest();
        this.dom.btnSpeedTest.classList.remove('running');
        if (this.dom.speedTestLabel) {
          this.dom.speedTestLabel.textContent = 'Run Live Speed Test';
        }
        if (this.shell && typeof this.shell.showToast === 'function') {
          const stats = networkMonitorService.getStats();
          this.shell.showToast(`Speed Test Complete: ${stats.downlink} Mbps • ${stats.ping}ms Ping`);
        }
      });
    }

    // Copy Diagnostics Button
    if (this.dom.btnCopyInfo) {
      this.dom.btnCopyInfo.addEventListener('click', (e) => {
        e.stopPropagation();
        const s = networkMonitorService.getStats();
        const report = `MyNetwork macOS Network Diagnostic:\n• Status: ${s.isOnline ? 'Online' : 'Offline'} (${s.qualityLabel})\n• Speed: ${s.downlink} Mbps\n• Latency: ${s.ping} ms\n• Quality Score: ${s.qualityScore}/100\n• Protocol: ${s.protocol}\n• Packet Loss: ${s.packetLoss}%`;
        navigator.clipboard.writeText(report).then(() => {
          if (this.shell && typeof this.shell.showToast === 'function') {
            this.shell.showToast('Network diagnostics copied to clipboard');
          }
        });
      });
    }

    // Click outside to close
    window.addEventListener('click', (e) => {
      if (this.isOpen && this.dom.popover && !this.dom.popover.contains(e.target) && !this.dom.topbarBtn?.contains(e.target) && !this.dom.sbBtn?.contains(e.target)) {
        this.togglePopover(false);
      }
    });

    // Listen to live stats updates
    eventBus.on('network:stats-updated', (stats) => {
      this.render(stats);
    });
  }

  togglePopover(force = null) {
    this.isOpen = typeof force === 'boolean' ? force : !this.isOpen;
    if (this.dom.popover) {
      this.dom.popover.style.display = this.isOpen ? 'block' : 'none';
      if (this.isOpen) {
        this.dom.popover.classList.add('animate-pop-in');
        this.render(networkMonitorService.getStats());
      }
    }
    if (this.dom.topbarBtn) {
      this.dom.topbarBtn.classList.toggle('active', this.isOpen);
    }
  }

  render(stats) {
    if (!stats) return;

    const isOnline = stats.isOnline;
    const speedStr = `${stats.downlink} Mbps`;
    const pingStr = `${stats.ping} ms`;

    // 1. Top Bar Wi-Fi Icon (Show when connected, hide when offline)
    if (this.dom.topbarBtn) {
      if (isOnline) {
        this.dom.topbarBtn.style.display = 'flex';
        this.dom.topbarBtn.title = `Wi-Fi: Connected (${stats.networkName})\nSpeed: ${speedStr} • Ping: ${pingStr}\nQuality: ${stats.qualityLabel} (${stats.qualityScore}/100)`;
        this.dom.topbarBtn.classList.remove('offline');
      } else {
        this.dom.topbarBtn.style.display = 'none';
        this.dom.topbarBtn.classList.add('offline');
        if (this.isOpen) this.togglePopover(false);
      }
    }

    // 2. Status Bar Elements
    if (this.dom.sbText) {
      this.dom.sbText.textContent = isOnline ? `${speedStr} • ${pingStr}` : 'Offline';
    }
    if (this.dom.sbBtn) {
      this.dom.sbBtn.classList.toggle('offline', !isOnline);
    }

    // 3. Popover Elements (if open or rendered)
    if (this.dom.popSubState) {
      this.dom.popSubState.textContent = isOnline ? 'On' : 'Off';
    }
    if (this.dom.ssidText) {
      this.dom.ssidText.textContent = isOnline ? stats.networkName : 'No Wi-Fi Connection';
    }
    if (this.dom.statusDot) {
      this.dom.statusDot.className = `wifi-status-dot ${isOnline ? 'online' : 'offline'}`;
    }
    if (this.dom.statusText) {
      this.dom.statusText.textContent = isOnline ? `Connected • ${stats.qualityLabel}` : 'Disconnected';
    }

    if (this.dom.downlinkVal) this.dom.downlinkVal.textContent = isOnline ? speedStr : '0 Mbps';
    if (this.dom.pingVal) this.dom.pingVal.textContent = isOnline ? pingStr : '—';
    if (this.dom.standardVal) this.dom.standardVal.textContent = isOnline ? (stats.effectiveType ? stats.effectiveType.toUpperCase() + ' / Fiber' : 'Broadband') : 'None';
    if (this.dom.qualityVal) this.dom.qualityVal.textContent = isOnline ? `${stats.qualityScore} / 100` : '0 / 100';

    if (this.dom.ipVal) this.dom.ipVal.textContent = isOnline ? `${stats.localIp} (Active LAN)` : 'Not Connected';
    if (this.dom.dnsVal) this.dom.dnsVal.textContent = isOnline ? 'Encrypted DNS • Active' : 'Unreachable';
    if (this.dom.protoVal) this.dom.protoVal.textContent = isOnline ? stats.protocol : '—';
    if (this.dom.lossVal) this.dom.lossVal.textContent = isOnline ? `${stats.packetLoss}% (Stable)` : '100% (Offline)';

    // Render Canvas Sparkline
    this.renderSparkline(stats.history || []);
  }

  renderSparkline(history) {
    if (!this.sparklineCtx || !this.dom.canvas) return;

    const ctx = this.sparklineCtx;
    const width = this.dom.canvas.width;
    const height = this.dom.canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!history || history.length < 2) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Measuring latency history...', width / 2, height / 2 + 3);
      return;
    }

    const pings = history.map(h => h.ping || 20);
    const minPing = Math.max(0, Math.min(...pings) - 5);
    const maxPing = Math.max(minPing + 20, Math.max(...pings) + 5);
    const range = maxPing - minPing || 1;

    const stepX = width / (pings.length - 1);

    // Draw Gradient Background Fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let i = 0; i < pings.length; i++) {
      const x = i * stepX;
      const y = height - ((pings[i] - minPing) / range) * (height - 10) - 5;
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        const prevX = (i - 1) * stepX;
        const prevY = height - ((pings[i - 1] - minPing) / range) * (height - 10) - 5;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Smooth Line
    ctx.beginPath();
    for (let i = 0; i < pings.length; i++) {
      const x = i * stepX;
      const y = height - ((pings[i] - minPing) / range) * (height - 10) - 5;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * stepX;
        const prevY = height - ((pings[i - 1] - minPing) / range) * (height - 10) - 5;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw dot on latest point
    const lastIdx = pings.length - 1;
    const lastX = lastIdx * stepX;
    const lastY = height - ((pings[lastIdx] - minPing) / range) * (height - 10) - 5;

    ctx.beginPath();
    ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

module.exports = { WifiPopoverController };
