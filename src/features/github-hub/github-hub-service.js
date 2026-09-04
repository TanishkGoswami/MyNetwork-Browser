// GitHub Developer Hub Service - PRs, Issues, Repos & Fast Gist Creator
const { eventBus } = require('../../shared/events/event-bus');

class GitHubHubService {
  constructor() {
    this.token = '';
    this.username = '';
    this.userProfile = null;
    this.pullRequests = [];
    this.assignedIssues = [];
    this.repositories = [];
    this.isLoading = false;
    this.pollInterval = null;

    this.init();
  }

  init() {
    this.loadState();
  }

  loadState() {
    try {
      const savedToken = localStorage.getItem('github_hub_pat') || '';
      const savedUser = localStorage.getItem('github_hub_user') || '';
      this.token = savedToken;
      this.username = savedUser;

      const cachedProfile = localStorage.getItem('github_hub_profile_cache');
      if (cachedProfile) this.userProfile = JSON.parse(cachedProfile);

      const cachedPRs = localStorage.getItem('github_hub_prs_cache');
      if (cachedPRs) this.pullRequests = JSON.parse(cachedPRs);

      const cachedIssues = localStorage.getItem('github_hub_issues_cache');
      if (cachedIssues) this.assignedIssues = JSON.parse(cachedIssues);

      const cachedRepos = localStorage.getItem('github_hub_repos_cache');
      if (cachedRepos) this.repositories = JSON.parse(cachedRepos);

      if (this.token || this.username) {
        this.fetchData();
        this.startPolling();
      }
    } catch (e) {
      console.warn('[GitHubHubService] Load error:', e);
    }
  }

  saveState() {
    try {
      localStorage.setItem('github_hub_pat', this.token);
      localStorage.setItem('github_hub_user', this.username);
      if (this.userProfile) localStorage.setItem('github_hub_profile_cache', JSON.stringify(this.userProfile));
      localStorage.setItem('github_hub_prs_cache', JSON.stringify(this.pullRequests));
      localStorage.setItem('github_hub_issues_cache', JSON.stringify(this.assignedIssues));
      localStorage.setItem('github_hub_repos_cache', JSON.stringify(this.repositories));
    } catch (e) {}
  }

  setCredentials(token, username = '') {
    this.token = token ? token.trim() : '';
    this.username = username ? username.trim() : '';
    this.saveState();
    this.fetchData();
    this.startPolling();
  }

  clearCredentials() {
    this.token = '';
    this.username = '';
    this.userProfile = null;
    this.pullRequests = [];
    this.assignedIssues = [];
    this.repositories = [];
    this.saveState();
    if (this.pollInterval) clearInterval(this.pollInterval);
    eventBus.emit('github:data-updated', this.getSummary());
  }

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.fetchData();
    }, 60000 * 3); // Every 3 minutes
  }

  async fetchData() {
    if (!this.token && !this.username) return;
    this.isLoading = true;
    eventBus.emit('github:loading-state', { isLoading: true });

    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'MyNetwork-Browser'
    };
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    try {
      // 1. Fetch User Profile
      const userRes = await fetch(this.token ? 'https://api.github.com/user' : `https://api.github.com/users/${this.username}`, { headers });
      if (userRes.ok) {
        this.userProfile = await userRes.json();
        this.username = this.userProfile.login;
      }

      // 2. Fetch User Repositories
      const repoUrl = this.token 
        ? 'https://api.github.com/user/repos?sort=updated&per_page=15' 
        : `https://api.github.com/users/${this.username}/repos?sort=updated&per_page=15`;
      const reposRes = await fetch(repoUrl, { headers });
      if (reposRes.ok) {
        this.repositories = await reposRes.json();
      }

      // 3. Fetch Pull Requests & Assigned Issues
      if (this.token) {
        const prsRes = await fetch('https://api.github.com/search/issues?q=is:pr+is:open+involves:' + this.username + '&per_page=10', { headers });
        if (prsRes.ok) {
          const prData = await prsRes.json();
          this.pullRequests = prData.items || [];
        }

        const issuesRes = await fetch('https://api.github.com/search/issues?q=is:issue+is:open+assignee:' + this.username + '&per_page=10', { headers });
        if (issuesRes.ok) {
          const issueData = await issuesRes.json();
          this.assignedIssues = issueData.items || [];
        }
      }

      this.saveState();
      eventBus.emit('github:data-updated', this.getSummary());
    } catch (err) {
      console.error('[GitHubHubService] Fetch failed:', err);
    } finally {
      this.isLoading = false;
      eventBus.emit('github:loading-state', { isLoading: false });
    }
  }

  async createGist(description, filename, content, isPublic = false) {
    if (!this.token) throw new Error('GitHub PAT required to create Gists.');
    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${this.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MyNetwork-Browser'
      },
      body: JSON.stringify({
        description: description || 'Created from MyNetwork Browser',
        public: isPublic,
        files: {
          [filename || 'snippet.js']: { content: content || '' }
        }
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to create Gist');
    }
    return await res.json();
  }

  getSummary() {
    return {
      connected: !!(this.token || this.username),
      username: this.username,
      profile: this.userProfile,
      prCount: this.pullRequests.length,
      issueCount: this.assignedIssues.length,
      prs: this.pullRequests,
      issues: this.assignedIssues,
      repos: this.repositories
    };
  }
}

const githubHubService = new GitHubHubService();

module.exports = { GitHubHubService, githubHubService };
