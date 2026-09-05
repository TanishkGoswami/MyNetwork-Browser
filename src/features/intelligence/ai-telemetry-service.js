// AI Copilot Telemetry, Token Tracking & Quota Service
const { eventBus } = require('../../shared/events/event-bus');

class AiTelemetryService {
  constructor() {
    this.storageKey = 'mynetwork_ai_telemetry_records';
    this.maxRecords = 500;
    this.records = this.loadRecords();
  }

  loadRecords() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load AI telemetry records from storage:', e.message);
    }
    return [];
  }

  saveRecords() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.records.slice(-this.maxRecords)));
      }
    } catch (e) {
      console.warn('Failed to save AI telemetry records:', e.message);
    }
  }

  /**
   * Estimate token count from text if API doesn't return exact usage.
   * Approx. 1 token = 4 characters (standard heuristic for English/Code).
   */
  estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    return Math.ceil(text.trim().length / 3.8);
  }

  /**
   * Records an AI request event.
   */
  recordEvent({
    provider = 'unknown',
    model = 'default',
    inputTokens = 0,
    outputTokens = 0,
    totalTokens = 0,
    latencyMs = 0,
    status = 'success', // 'success' | 'error'
    statusCode = 200,
    promptSummary = '',
    responseSummary = '',
    errorMessage = ''
  }) {
    const calculatedTotal = totalTokens || (inputTokens + outputTokens);

    const record = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      provider,
      model,
      inputTokens: Math.max(0, inputTokens),
      outputTokens: Math.max(0, outputTokens),
      totalTokens: Math.max(0, calculatedTotal),
      latencyMs: Math.max(0, Math.round(latencyMs)),
      status,
      statusCode,
      promptSummary: (promptSummary || '').substring(0, 120),
      responseSummary: (responseSummary || '').substring(0, 120),
      errorMessage: errorMessage || ''
    };

    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
    this.saveRecords();

    eventBus.emit('ai:telemetry-updated', { record, summary: this.getSummaryStats('all') });
    return record;
  }

  /**
   * Computes aggregated stats for a specified time range ('24h' | '7d' | '14d' | '28d' | 'all')
   */
  getSummaryStats(timeRange = 'all') {
    let now = Date.now();
    let cutoff = 0;

    if (timeRange === '24h') cutoff = now - 24 * 60 * 60 * 1000;
    else if (timeRange === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (timeRange === '14d') cutoff = now - 14 * 24 * 60 * 60 * 1000;
    else if (timeRange === '28d') cutoff = now - 28 * 24 * 60 * 60 * 1000;

    const filtered = cutoff > 0 ? this.records.filter(r => r.timestamp >= cutoff) : [...this.records];

    const totalRequests = filtered.length;
    let successfulRequests = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalLatency = 0;

    const errorsByCode = {};
    const modelDistribution = {};
    const providerDistribution = {};

    filtered.forEach(r => {
      if (r.status === 'success') {
        successfulRequests++;
      } else {
        const code = r.statusCode || 'Error';
        errorsByCode[code] = (errorsByCode[code] || 0) + 1;
      }

      totalInputTokens += (r.inputTokens || 0);
      totalOutputTokens += (r.outputTokens || 0);
      totalLatency += (r.latencyMs || 0);

      const m = r.model || 'Unknown';
      modelDistribution[m] = (modelDistribution[m] || 0) + 1;

      const p = r.provider || 'Unknown';
      providerDistribution[p] = (providerDistribution[p] || 0) + 1;
    });

    const successRate = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 100;
    const avgLatency = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;
    const totalTokens = totalInputTokens + totalOutputTokens;

    return {
      timeRange,
      totalRequests,
      successfulRequests,
      failedRequests: totalRequests - successfulRequests,
      successRate,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      avgLatency,
      errorsByCode,
      modelDistribution,
      providerDistribution,
      recordsCount: filtered.length
    };
  }

  /**
   * Aggregates daily telemetry for time-series charts (past N days)
   */
  getDailyTimeline(days = 14) {
    const timeline = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      // Start & end of day timestamps
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

      const dayRecords = this.records.filter(r => r.timestamp >= startOfDay && r.timestamp <= endOfDay);
      
      let requests = dayRecords.length;
      let successes = dayRecords.filter(r => r.status === 'success').length;
      let errors = requests - successes;
      let inputTokens = dayRecords.reduce((acc, r) => acc + (r.inputTokens || 0), 0);
      let outputTokens = dayRecords.reduce((acc, r) => acc + (r.outputTokens || 0), 0);
      let totalTokens = inputTokens + outputTokens;
      let rate = requests > 0 ? Math.round((successes / requests) * 100) : 100;

      timeline.push({
        date: dateStr,
        label,
        requests,
        successes,
        errors,
        inputTokens,
        outputTokens,
        totalTokens,
        successRate: rate
      });
    }

    return timeline;
  }

  /**
   * Fetches live account balance & rate limit metadata from OpenRouter
   */
  async fetchOpenRouterLiveBalance(apiKey) {
    if (!apiKey || !apiKey.startsWith('sk-or-')) {
      return null;
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`
        }
      });

      if (!res.ok) {
        return { error: `OpenRouter auth check returned status ${res.status}` };
      }

      const json = await res.json();
      const data = json?.data || {};

      return {
        label: data.label || 'OpenRouter Key',
        usage: typeof data.usage === 'number' ? Number(data.usage.toFixed(4)) : 0,
        limit: data.limit !== null ? data.limit : 'Unlimited',
        isFreeTier: !!data.is_free_tier,
        rateLimit: data.rate_limit || { requests: 'Standard', interval: '10s' }
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * Returns Google Gemini Free Tier Quota specifications & current consumption
   */
  getGeminiFreeTierQuotas() {
    const now = Date.now();
    const oneMinAgo = now - 60 * 1000;
    const startOfToday = new Date().setHours(0, 0, 0, 0);

    const geminiRecords = this.records.filter(r => r.provider === 'gemini');
    
    // Requests in last minute
    const rpmCurrent = geminiRecords.filter(r => r.timestamp >= oneMinAgo).length;
    const rpmLimit = 15; // 15 Requests Per Minute (Google AI Studio Free Tier)

    // Tokens in last minute
    const tpmCurrent = geminiRecords
      .filter(r => r.timestamp >= oneMinAgo)
      .reduce((acc, r) => acc + (r.totalTokens || 0), 0);
    const tpmLimit = 1000000; // 1,000,000 Tokens Per Minute

    // Requests today
    const rpdCurrent = geminiRecords.filter(r => r.timestamp >= startOfToday).length;
    const rpdLimit = 1500; // 1,500 Requests Per Day

    return {
      rpm: { current: rpmCurrent, limit: rpmLimit, percent: Math.min(100, Math.round((rpmCurrent / rpmLimit) * 100)) },
      tpm: { current: tpmCurrent, limit: tpmLimit, percent: Math.min(100, Math.round((tpmCurrent / tpmLimit) * 100)) },
      rpd: { current: rpdCurrent, limit: rpdLimit, percent: Math.min(100, Math.round((rpdCurrent / rpdLimit) * 100)) }
    };
  }

  clearHistory() {
    this.records = [];
    this.saveRecords();
    eventBus.emit('ai:telemetry-updated', { summary: this.getSummaryStats('all') });
  }

  exportDataAsJson() {
    const payload = {
      exportTimestamp: new Date().toISOString(),
      summary: this.getSummaryStats('all'),
      records: this.records
    };
    return JSON.stringify(payload, null, 2);
  }
}

const aiTelemetryService = new AiTelemetryService();

module.exports = { AiTelemetryService, aiTelemetryService };
