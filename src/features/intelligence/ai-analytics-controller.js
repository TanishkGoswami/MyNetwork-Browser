// Dedicated macOS AI Analytics & Model Telemetry Controller
// Powers the 'mynetwork://ai-analytics' dashboard view
const { eventBus } = require('../../shared/events/event-bus');
const { aiTelemetryService } = require('./ai-telemetry-service');
const { claudeService } = require('./claude-service');
const { aiProviderEngine } = require('./ai-provider-engine');

class AiAnalyticsController {
  constructor(shell) {
    this.shell = shell;
    this.timeRange = '14d';
    this.searchFilter = '';
    this.statusFilter = 'all';
    this.providerFilter = 'all';
    this.dom = {};
  }

  init() {
    this.cacheDom();
    this.bindEvents();
  }

  cacheDom() {
    this.dom = {
      view: document.getElementById('dedicated-ai-analytics-view'),
      btnBack: document.getElementById('btn-analytics-back'),
      // Header stats & pill
      activeModelPill: document.getElementById('ai-analytics-active-model'),
      liveBalancePill: document.getElementById('ai-analytics-live-balance'),
      btnRefresh: document.getElementById('btn-ai-analytics-refresh'),
      btnExport: document.getElementById('btn-ai-analytics-export'),
      btnClear: document.getElementById('btn-ai-analytics-clear'),
      timeRangeSelect: document.getElementById('ai-analytics-time-range'),
      
      // 4 Stat Metric Cards
      statTotalRequests: document.getElementById('stat-total-requests'),
      statSuccessRate: document.getElementById('stat-success-rate'),
      statSuccessRateBadge: document.getElementById('stat-success-rate-badge'),
      statTotalTokens: document.getElementById('stat-total-tokens'),
      statTokensBreakdown: document.getElementById('stat-tokens-breakdown'),
      statAvgLatency: document.getElementById('stat-avg-latency'),
      statLatencySpeed: document.getElementById('stat-latency-speed'),
      statTotalErrors: document.getElementById('stat-total-errors'),
      statErrorBreakdown: document.getElementById('stat-error-breakdown'),

      // Quotas / Balance Card
      quotaGeminiRpmBar: document.getElementById('quota-gemini-rpm-bar'),
      quotaGeminiRpmLabel: document.getElementById('quota-gemini-rpm-label'),
      quotaGeminiTpmBar: document.getElementById('quota-gemini-tpm-bar'),
      quotaGeminiTpmLabel: document.getElementById('quota-gemini-tpm-label'),
      quotaGeminiRpdBar: document.getElementById('quota-gemini-rpd-bar'),
      quotaGeminiRpdLabel: document.getElementById('quota-gemini-rpd-label'),
      openrouterCard: document.getElementById('ai-openrouter-quota-card'),
      openrouterBalanceText: document.getElementById('openrouter-balance-text'),
      openrouterLimitText: document.getElementById('openrouter-limit-text'),

      // Charts Containers
      chartRequestsTimeline: document.getElementById('chart-requests-timeline'),
      chartTokensVolume: document.getElementById('chart-tokens-volume'),
      chartModelDonut: document.getElementById('chart-model-donut'),
      chartModelLegend: document.getElementById('chart-model-legend'),

      // Logs Table & Filter
      logSearchInput: document.getElementById('ai-log-search-input'),
      logStatusSelect: document.getElementById('ai-log-status-filter'),
      logProviderSelect: document.getElementById('ai-log-provider-filter'),
      logTableBody: document.getElementById('ai-telemetry-log-tbody'),
      logCountLabel: document.getElementById('ai-log-count-label')
    };
  }

  bindEvents() {
    if (this.dom.btnBack) {
      this.dom.btnBack.addEventListener('click', () => {
        if (typeof this.shell.returnFromInternalPage === 'function') {
          this.shell.returnFromInternalPage();
        } else {
          this.shell.navigateCurrentTab('mynetwork://newtab');
        }
      });
    }

    // Live update when an AI call finishes
    eventBus.on('ai:telemetry-updated', () => {
      if (this.isVisible()) {
        this.renderAll();
      }
    });

    if (this.dom.timeRangeSelect) {
      this.dom.timeRangeSelect.addEventListener('change', (e) => {
        this.timeRange = e.target.value;
        this.renderAll();
      });
    }

    if (this.dom.btnRefresh) {
      this.dom.btnRefresh.addEventListener('click', () => {
        this.renderAll();
        this.shell.showToast('AI Analytics refreshed.');
      });
    }

    if (this.dom.btnExport) {
      this.dom.btnExport.addEventListener('click', () => {
        const json = aiTelemetryService.exportDataAsJson();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mynetwork-ai-telemetry-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.shell.showToast('Telemetry report exported as JSON.');
      });
    }

    if (this.dom.btnClear) {
      this.dom.btnClear.addEventListener('click', () => {
        if (confirm('Clear all AI Telemetry & Token usage history?')) {
          aiTelemetryService.clearHistory();
          this.renderAll();
          this.shell.showToast('Telemetry records cleared.');
        }
      });
    }

    if (this.dom.logSearchInput) {
      this.dom.logSearchInput.addEventListener('input', (e) => {
        this.searchFilter = e.target.value.toLowerCase().trim();
        this.renderLogTable();
      });
    }

    if (this.dom.logStatusSelect) {
      this.dom.logStatusSelect.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.renderLogTable();
      });
    }

    if (this.dom.logProviderSelect) {
      this.dom.logProviderSelect.addEventListener('change', (e) => {
        this.providerFilter = e.target.value;
        this.renderLogTable();
      });
    }
  }

  isVisible() {
    return this.dom.view && this.dom.view.style.display !== 'none';
  }

  renderAll() {
    this.renderHeaderPills();
    this.renderStatCards();
    this.renderQuotas();
    this.renderCharts();
    this.renderLogTable();
  }

  renderHeaderPills() {
    if (this.dom.activeModelPill) {
      const activeKey = claudeService.apiKey || '';
      const provider = aiProviderEngine.detectProvider(activeKey);
      let label = 'No Key Configured';
      if (provider === 'gemini') label = `Google Gemini (${claudeService.model || 'gemini-flash-latest'})`;
      else if (provider === 'openrouter') label = `OpenRouter (${claudeService.model || 'deepseek-r1'})`;
      else if (provider === 'anthropic') label = `Anthropic Direct (${claudeService.model || 'claude-3.5-sonnet'})`;
      
      this.dom.activeModelPill.textContent = label;
    }

    // Check OpenRouter live balance asynchronously
    if (this.dom.liveBalancePill) {
      const activeKey = claudeService.apiKey || '';
      if (activeKey.startsWith('sk-or-')) {
        aiTelemetryService.fetchOpenRouterLiveBalance(activeKey).then(bal => {
          if (bal && !bal.error) {
            this.dom.liveBalancePill.textContent = `OpenRouter: $${bal.usage} used (${bal.isFreeTier ? 'Free Tier' : 'Credits Active'})`;
            this.dom.liveBalancePill.style.display = 'inline-flex';
          }
        });
      } else if (activeKey.startsWith('AQ.') || activeKey.startsWith('AIza')) {
        this.dom.liveBalancePill.textContent = 'Google AI Studio: 100% Free Tier (15 RPM / 1M TPM)';
        this.dom.liveBalancePill.style.display = 'inline-flex';
      } else {
        this.dom.liveBalancePill.style.display = 'none';
      }
    }
  }

  renderStatCards() {
    const stats = aiTelemetryService.getSummaryStats(this.timeRange);

    // 1. Total Requests
    if (this.dom.statTotalRequests) {
      this.dom.statTotalRequests.textContent = stats.totalRequests.toLocaleString();
    }
    if (this.dom.statSuccessRate) {
      this.dom.statSuccessRate.textContent = `${stats.successRate}% Success`;
    }
    if (this.dom.statSuccessRateBadge) {
      this.dom.statSuccessRateBadge.className = `stat-badge ${stats.successRate >= 95 ? 'badge-success' : (stats.successRate >= 80 ? 'badge-warning' : 'badge-danger')}`;
      this.dom.statSuccessRateBadge.textContent = `${stats.successfulRequests} ok / ${stats.failedRequests} err`;
    }

    // 2. Tokens Consumed
    if (this.dom.statTotalTokens) {
      this.dom.statTotalTokens.textContent = stats.totalTokens > 1000 ? `${(stats.totalTokens / 1000).toFixed(1)}k` : stats.totalTokens.toLocaleString();
    }
    if (this.dom.statTokensBreakdown) {
      const inK = stats.totalInputTokens > 1000 ? `${(stats.totalInputTokens / 1000).toFixed(1)}k` : stats.totalInputTokens;
      const outK = stats.totalOutputTokens > 1000 ? `${(stats.totalOutputTokens / 1000).toFixed(1)}k` : stats.totalOutputTokens;
      this.dom.statTokensBreakdown.textContent = `In: ${inK} • Out: ${outK}`;
    }

    // 3. Latency
    if (this.dom.statAvgLatency) {
      this.dom.statAvgLatency.textContent = stats.avgLatency > 0 ? `${stats.avgLatency} ms` : '—';
    }
    if (this.dom.statLatencySpeed) {
      let speedText = 'Ultra Fast';
      let speedClass = 'badge-success';
      if (stats.avgLatency > 3000) {
        speedText = 'High Reasoning';
        speedClass = 'badge-purple';
      } else if (stats.avgLatency > 1500) {
        speedText = 'Moderate';
        speedClass = 'badge-warning';
      }
      this.dom.statLatencySpeed.className = `stat-badge ${speedClass}`;
      this.dom.statLatencySpeed.textContent = stats.avgLatency > 0 ? speedText : 'Ready';
    }

    // 4. Errors
    if (this.dom.statTotalErrors) {
      this.dom.statTotalErrors.textContent = stats.failedRequests.toString();
    }
    if (this.dom.statErrorBreakdown) {
      const errorKeys = Object.keys(stats.errorsByCode);
      if (errorKeys.length === 0) {
        this.dom.statErrorBreakdown.textContent = '0 API errors recorded';
      } else {
        const errorStrings = errorKeys.map(code => `${code}: ${stats.errorsByCode[code]}`);
        this.dom.statErrorBreakdown.textContent = errorStrings.join(', ');
      }
    }
  }

  renderQuotas() {
    const quotas = aiTelemetryService.getGeminiFreeTierQuotas();

    if (this.dom.quotaGeminiRpmBar) {
      this.dom.quotaGeminiRpmBar.style.width = `${quotas.rpm.percent}%`;
    }
    if (this.dom.quotaGeminiRpmLabel) {
      this.dom.quotaGeminiRpmLabel.textContent = `${quotas.rpm.current} / ${quotas.rpm.limit} RPM (${quotas.rpm.percent}%)`;
    }

    if (this.dom.quotaGeminiTpmBar) {
      this.dom.quotaGeminiTpmBar.style.width = `${quotas.tpm.percent}%`;
    }
    if (this.dom.quotaGeminiTpmLabel) {
      const tpmK = (quotas.tpm.current / 1000).toFixed(1);
      this.dom.quotaGeminiTpmLabel.textContent = `${tpmK}k / 1,000k TPM`;
    }

    if (this.dom.quotaGeminiRpdBar) {
      this.dom.quotaGeminiRpdBar.style.width = `${quotas.rpd.percent}%`;
    }
    if (this.dom.quotaGeminiRpdLabel) {
      this.dom.quotaGeminiRpdLabel.textContent = `${quotas.rpd.current} / ${quotas.rpd.limit} RPD Today`;
    }
  }

  renderCharts() {
    const days = this.timeRange === '24h' ? 7 : (this.timeRange === '7d' ? 7 : (this.timeRange === '28d' ? 28 : 14));
    const timeline = aiTelemetryService.getDailyTimeline(days);

    this.renderTimelineChart(timeline);
    this.renderTokensVolumeChart(timeline);
    this.renderModelDonut();
  }

  /**
   * macOS SVG Timeline Area & Line Chart
   */
  renderTimelineChart(timeline) {
    if (!this.dom.chartRequestsTimeline) return;

    const width = 580;
    const height = 160;
    const padding = { top: 20, right: 30, bottom: 30, left: 40 };

    const maxRequests = Math.max(5, ...timeline.map(t => t.requests));
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const points = timeline.map((item, index) => {
      const x = padding.left + (index / (timeline.length - 1 || 1)) * innerWidth;
      const y = padding.top + innerHeight - (item.requests / maxRequests) * innerHeight;
      return { x, y, item };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height - padding.bottom} L ${points[0].x.toFixed(1)} ${height - padding.bottom} Z`;

    // SVG generation
    let svg = `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0071e3" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#0071e3" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <!-- Grid Lines -->
        <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="rgba(0,0,0,0.06)" stroke-dasharray="3,3"/>
        <line x1="${padding.left}" y1="${padding.top + innerHeight / 2}" x2="${width - padding.right}" y2="${padding.top + innerHeight / 2}" stroke="rgba(0,0,0,0.06)" stroke-dasharray="3,3"/>
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgba(0,0,0,0.1)"/>

        <!-- Y Axis Labels -->
        <text x="${padding.left - 8}" y="${padding.top + 4}" font-size="10" fill="#8e8e93" text-anchor="end">${maxRequests}</text>
        <text x="${padding.left - 8}" y="${padding.top + innerHeight / 2 + 4}" font-size="10" fill="#8e8e93" text-anchor="end">${Math.round(maxRequests / 2)}</text>
        <text x="${padding.left - 8}" y="${height - padding.bottom + 4}" font-size="10" fill="#8e8e93" text-anchor="end">0</text>

        <!-- Area & Stroke Line -->
        <path d="${areaD}" fill="url(#areaGradient)"/>
        <path d="${pathD}" fill="none" stroke="#0071e3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

        <!-- Interactive Points -->
        ${points.map(p => `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#ffffff" stroke="#0071e3" stroke-width="2">
            <title>${p.item.label}: ${p.item.requests} requests (${p.item.successes} ok, ${p.item.errors} err)</title>
          </circle>
        `).join('')}

        <!-- X Axis Labels (Every few points) -->
        ${points.filter((_, i) => i === 0 || i === Math.floor(points.length / 2) || i === points.length - 1).map(p => `
          <text x="${p.x.toFixed(1)}" y="${height - 10}" font-size="10" fill="#8e8e93" text-anchor="middle">${p.item.label}</text>
        `).join('')}
      </svg>
    `;

    this.dom.chartRequestsTimeline.innerHTML = svg;
  }

  /**
   * macOS SVG Token Volume Stacked Bar Chart
   */
  renderTokensVolumeChart(timeline) {
    if (!this.dom.chartTokensVolume) return;

    const width = 580;
    const height = 160;
    const padding = { top: 20, right: 30, bottom: 30, left: 45 };

    const maxTokens = Math.max(100, ...timeline.map(t => t.totalTokens));
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const barWidth = Math.max(8, Math.min(24, (innerWidth / timeline.length) * 0.65));

    let bars = timeline.map((item, index) => {
      const centerX = padding.left + (index + 0.5) * (innerWidth / timeline.length);
      const x = centerX - barWidth / 2;
      
      const totalH = (item.totalTokens / maxTokens) * innerHeight;
      const inH = (item.inputTokens / maxTokens) * innerHeight;
      const outH = (item.outputTokens / maxTokens) * innerHeight;

      const yBottom = height - padding.bottom;
      const inY = yBottom - inH;
      const outY = inY - outH;

      return `
        <g class="chart-bar-group">
          <!-- Input Tokens (Blue) -->
          <rect x="${x.toFixed(1)}" y="${inY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${inH.toFixed(1)}" fill="#0071e3" rx="2">
            <title>${item.label} Input Tokens: ${item.inputTokens}</title>
          </rect>
          <!-- Output Tokens (Purple Gradient) -->
          <rect x="${x.toFixed(1)}" y="${outY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${outH.toFixed(1)}" fill="#8b5cf6" rx="2">
            <title>${item.label} Output Tokens: ${item.outputTokens}</title>
          </rect>
        </g>
      `;
    }).join('');

    const maxLabel = maxTokens > 1000 ? `${(maxTokens / 1000).toFixed(1)}k` : maxTokens;

    let svg = `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <!-- Grid -->
        <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="rgba(0,0,0,0.06)" stroke-dasharray="3,3"/>
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgba(0,0,0,0.1)"/>

        <!-- Y Axis -->
        <text x="${padding.left - 8}" y="${padding.top + 4}" font-size="10" fill="#8e8e93" text-anchor="end">${maxLabel}</text>
        <text x="${padding.left - 8}" y="${height - padding.bottom + 4}" font-size="10" fill="#8e8e93" text-anchor="end">0</text>

        ${bars}

        <!-- X Axis Labels -->
        ${timeline.filter((_, i) => i % Math.ceil(timeline.length / 5) === 0 || i === timeline.length - 1).map((item, i, arr) => {
          const idx = timeline.indexOf(item);
          const cx = padding.left + (idx + 0.5) * (innerWidth / timeline.length);
          return `<text x="${cx.toFixed(1)}" y="${height - 10}" font-size="10" fill="#8e8e93" text-anchor="middle">${item.label}</text>`;
        }).join('')}
      </svg>
    `;

    this.dom.chartTokensVolume.innerHTML = svg;
  }

  /**
   * macOS SVG Model Distribution Donut Chart
   */
  renderModelDonut() {
    if (!this.dom.chartModelDonut) return;

    const stats = aiTelemetryService.getSummaryStats(this.timeRange);
    const models = Object.keys(stats.modelDistribution);
    const total = stats.totalRequests;

    if (total === 0 || models.length === 0) {
      this.dom.chartModelDonut.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #8e8e93; font-size: 12px;">
          No request telemetry recorded yet
        </div>
      `;
      if (this.dom.chartModelLegend) this.dom.chartModelLegend.innerHTML = '';
      return;
    }

    const colors = ['#0071e3', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
    let cumulativePercent = 0;

    const slices = models.map((model, idx) => {
      const count = stats.modelDistribution[model];
      const percent = count / total;
      const color = colors[idx % colors.length];

      const startAngle = cumulativePercent * 2 * Math.PI;
      cumulativePercent += percent;
      const endAngle = cumulativePercent * 2 * Math.PI;

      const x1 = 70 + 50 * Math.cos(startAngle);
      const y1 = 70 + 50 * Math.sin(startAngle);
      const x2 = 70 + 50 * Math.cos(endAngle);
      const y2 = 70 + 50 * Math.sin(endAngle);
      const largeArc = percent > 0.5 ? 1 : 0;

      const pathData = `M 70 70 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 50 50 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
      return `<path d="${pathData}" fill="${color}"><title>${model}: ${count} calls (${Math.round(percent * 100)}%)</title></path>`;
    });

    const svg = `
      <svg width="140" height="140" viewBox="0 0 140 140">
        ${slices.join('')}
        <circle cx="70" cy="70" r="32" fill="#ffffff"/>
        <text x="70" y="68" font-size="15" font-weight="600" text-anchor="middle" fill="#1d1d1f">${total}</text>
        <text x="70" y="80" font-size="9" fill="#8e8e93" text-anchor="middle">Calls</text>
      </svg>
    `;

    this.dom.chartModelDonut.innerHTML = svg;

    if (this.dom.chartModelLegend) {
      this.dom.chartModelLegend.innerHTML = models.map((m, idx) => {
        const count = stats.modelDistribution[m];
        const percent = Math.round((count / total) * 100);
        const color = colors[idx % colors.length];
        return `
          <div class="legend-item" style="display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; display: inline-block;"></span>
              <span style="max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m}</span>
            </div>
            <strong style="color: #1d1d1f;">${percent}%</strong>
          </div>
        `;
      }).join('');
    }
  }

  /**
   * Searchable, Filterable Request Inspector Table
   */
  renderLogTable() {
    if (!this.dom.logTableBody) return;

    let records = [...aiTelemetryService.records].reverse();

    if (this.searchFilter) {
      records = records.filter(r => 
        (r.model && r.model.toLowerCase().includes(this.searchFilter)) ||
        (r.provider && r.provider.toLowerCase().includes(this.searchFilter)) ||
        (r.promptSummary && r.promptSummary.toLowerCase().includes(this.searchFilter)) ||
        (r.errorMessage && r.errorMessage.toLowerCase().includes(this.searchFilter))
      );
    }

    if (this.statusFilter !== 'all') {
      records = records.filter(r => r.status === this.statusFilter);
    }

    if (this.providerFilter !== 'all') {
      records = records.filter(r => r.provider === this.providerFilter);
    }

    if (this.dom.logCountLabel) {
      this.dom.logCountLabel.textContent = `Showing ${records.length} records`;
    }

    if (records.length === 0) {
      this.dom.logTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #8e8e93; padding: 24px;">
            No telemetry records match current filters.
          </td>
        </tr>
      `;
      return;
    }

    this.dom.logTableBody.innerHTML = records.slice(0, 100).map(r => {
      const timeStr = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const statusBadge = r.status === 'success' 
        ? `<span class="stat-badge badge-success">200 OK</span>` 
        : `<span class="stat-badge badge-danger">${r.statusCode || 500} Err</span>`;

      return `
        <tr>
          <td style="font-family: monospace; font-size: 11px; color: #8e8e93;">${timeStr}</td>
          <td>
            <span class="provider-pill pill-${r.provider}">${r.provider.toUpperCase()}</span>
          </td>
          <td style="font-weight: 500; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${r.model}
          </td>
          <td style="font-family: monospace; font-size: 11.5px; color: ${r.latencyMs > 3000 ? '#e11d48' : '#1d1d1f'};">
            ${r.latencyMs} ms
          </td>
          <td style="font-family: monospace; font-size: 11.5px;">
            ${r.inputTokens} / ${r.outputTokens} <span style="color: #8e8e93;">(${r.totalTokens})</span>
          </td>
          <td>${statusBadge}</td>
          <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; color: ${r.errorMessage ? '#e11d48' : '#6e6e73'};">
            ${r.errorMessage ? r.errorMessage : (r.promptSummary || '—')}
          </td>
        </tr>
      `;
    }).join('');
  }
}

module.exports = { AiAnalyticsController };
