// GitHub Developer Hub Service - OAuth, PRs, Issues, Repos, Gist Sync & Live Contributions
const { eventBus } = require('../../shared/events/event-bus');

class GitHubHubService {
  constructor() {
    this.clientId = (typeof process !== 'undefined' && process.env && process.env.GITHUB_CLIENT_ID) || '';
    this.clientSecret = (typeof process !== 'undefined' && process.env && process.env.GITHUB_CLIENT_SECRET) || '';
    this.token = '';
    this.username = '';
    this.userProfile = null;
    this.pullRequests = [];
    this.assignedIssues = [];
    this.repositories = [];
    this.contributions = null; // { total, currentStreak, longestStreak, weeks }
    this.isLoading = false;
    this.isContributionsLoading = false;
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

      const cachedContribs = localStorage.getItem('github_hub_contribs_cache');
      if (cachedContribs) this.contributions = JSON.parse(cachedContribs);

      if (this.token || this.username) {
        this.fetchData();
        this.fetchContributions(this.username);
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
      if (this.contributions) localStorage.setItem('github_hub_contribs_cache', JSON.stringify(this.contributions));
    } catch (e) {}
  }

  async loginWithOAuth() {
    try {
      const { ipcRenderer } = require('electron');
      if (!ipcRenderer) {
        throw new Error('Electron IPC is unavailable');
      }

      const result = await ipcRenderer.invoke('github-oauth-login', {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        scopes: 'repo read:user gist workflow'
      });

      if (result && result.success && result.accessToken) {
        this.token = result.accessToken;
        this.saveState();
        await this.fetchData();
        await this.fetchContributions(this.username);
        this.startPolling();
        return { success: true, user: this.userProfile };
      } else {
        throw new Error(result?.error || 'Authentication cancelled or failed');
      }
    } catch (err) {
      console.error('[GitHubHubService] OAuth login failed:', err);
      throw err;
    }
  }

  setCredentials(token, username = '') {
    this.token = token ? token.trim() : '';
    this.username = username ? username.trim() : '';
    this.saveState();
    this.fetchData();
    this.fetchContributions(this.username);
    this.startPolling();
  }

  clearCredentials() {
    this.token = '';
    this.username = '';
    this.userProfile = null;
    this.pullRequests = [];
    this.assignedIssues = [];
    this.repositories = [];
    this.contributions = null;
    this.saveState();
    if (this.pollInterval) clearInterval(this.pollInterval);
    eventBus.emit('github:data-updated', this.getSummary());
    eventBus.emit('github:contributions-updated', null);
  }

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.fetchData();
      if (this.username) this.fetchContributions(this.username);
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
      if (this.token && this.username) {
        const prsRes = await fetch(`https://api.github.com/search/issues?q=is:pr+is:open+involves:${this.username}&per_page=10`, { headers });
        if (prsRes.ok) {
          const prData = await prsRes.json();
          this.pullRequests = prData.items || [];
        }

        const issuesRes = await fetch(`https://api.github.com/search/issues?q=is:issue+is:open+assignee:${this.username}&per_page=10`, { headers });
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

  async fetchContributions(targetUser = '') {
    const userToFetch = targetUser || this.username;
    if (!userToFetch) return;

    this.isContributionsLoading = true;
    eventBus.emit('github:contributions-loading', { isLoading: true });

    try {
      let data = null;

      // Method A: Authenticated GraphQL API
      if (this.token) {
        try {
          const gqlQuery = `
            query getUserContributions($username: String!) {
              user(login: $username) {
                contributionsCollection {
                  contributionCalendar {
                    totalContributions
                    weeks {
                      contributionDays {
                        contributionCount
                        date
                        color
                        weekday
                      }
                    }
                  }
                }
              }
            }
          `;

          const gqlRes = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
              'Authorization': `bearer ${this.token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'MyNetwork-Browser'
            },
            body: JSON.stringify({ query: gqlQuery, variables: { username: userToFetch } })
          });

          if (gqlRes.ok) {
            const gqlJson = await gqlRes.json();
            const cal = gqlJson?.data?.user?.contributionsCollection?.contributionCalendar;
            if (cal && cal.weeks) {
              const allDays = [];
              cal.weeks.forEach(w => {
                if (w.contributionDays) {
                  w.contributionDays.forEach(d => allDays.push(d));
                }
              });

              const streaks = this.calculateStreaks(allDays);
              data = {
                username: userToFetch,
                totalContributions: cal.totalContributions || 0,
                currentStreak: streaks.currentStreak,
                longestStreak: streaks.longestStreak,
                todayCount: streaks.todayCount,
                weeks: cal.weeks
              };
            }
          }
        } catch (gqlErr) {
          console.warn('[GitHubHubService] GraphQL fetch error, trying fallback:', gqlErr);
        }
      }

      // Method B: Fast Public API Fallback
      if (!data) {
        const publicRes = await fetch(`https://github-contributions-api.jogruber.de/v4/${userToFetch}?y=last`);
        if (publicRes.ok) {
          const pubJson = await publicRes.json();
          if (pubJson.contributions) {
            // Group 365 days into weeks of 7 days
            const days = pubJson.contributions;
            const weeks = [];
            let currentWeek = { contributionDays: [] };

            days.forEach((d) => {
              const dayObj = {
                date: d.date,
                contributionCount: d.count,
                color: this.getLevelColor(d.level),
                level: d.level
              };
              currentWeek.contributionDays.push(dayObj);
              if (currentWeek.contributionDays.length === 7) {
                weeks.push(currentWeek);
                currentWeek = { contributionDays: [] };
              }
            });
            if (currentWeek.contributionDays.length > 0) {
              weeks.push(currentWeek);
            }

            const streaks = this.calculateStreaks(days.map(d => ({ date: d.date, contributionCount: d.count })));
            data = {
              username: userToFetch,
              totalContributions: pubJson.total?.['lastYear'] || days.reduce((acc, cur) => acc + (cur.count || 0), 0),
              currentStreak: streaks.currentStreak,
              longestStreak: streaks.longestStreak,
              todayCount: streaks.todayCount,
              weeks
            };
          }
        }
      }

      if (data) {
        this.contributions = data;
        this.saveState();
        eventBus.emit('github:contributions-updated', data);
      }
    } catch (err) {
      console.warn('[GitHubHubService] Failed to load contributions:', err);
    } finally {
      this.isContributionsLoading = false;
      eventBus.emit('github:contributions-loading', { isLoading: false });
    }
  }

  getLevelColor(level) {
    switch (level) {
      case 1: return '#9be9a8';
      case 2: return '#40c463';
      case 3: return '#30a14e';
      case 4: return '#216e39';
      default: return '#ebedf0';
    }
  }

  calculateStreaks(days) {
    if (!days || days.length === 0) return { currentStreak: 0, longestStreak: 0, todayCount: 0 };

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let todayCount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    // Find today's count
    const todayItem = days.find(d => d.date === todayStr);
    if (todayItem) todayCount = todayItem.contributionCount || 0;

    // Calculate Longest Streak
    for (let i = 0; i < days.length; i++) {
      if (days[i].contributionCount > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    // Calculate Current Streak (Iterate backwards from latest day)
    let startIndex = days.length - 1;
    if (days[startIndex] && days[startIndex].date === todayStr && days[startIndex].contributionCount === 0) {
      startIndex--;
    }

    for (let i = startIndex; i >= 0; i--) {
      if (days[i] && days[i].contributionCount > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    return { currentStreak, longestStreak, todayCount };
  }

  async syncScratchpadToGist(notesContent) {
    if (!this.token) throw new Error('GitHub Login / PAT required to sync Scratchpad.');
    
    // Check if mynetwork-scratchpad gist exists
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${this.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'MyNetwork-Browser'
    };

    const gistsRes = await fetch('https://api.github.com/gists?per_page=30', { headers });
    let existingGistId = null;

    if (gistsRes.ok) {
      const gists = await gistsRes.json();
      const match = gists.find(g => g.files && g.files['mynetwork-scratchpad.md']);
      if (match) existingGistId = match.id;
    }

    const gistPayload = {
      description: 'MyNetwork Browser Scratchpad Sync (Auto-generated)',
      public: false,
      files: {
        'mynetwork-scratchpad.md': {
          content: notesContent || '# MyNetwork Scratchpad\n\n(Empty note)'
        }
      }
    };

    let saveRes;
    if (existingGistId) {
      saveRes = await fetch(`https://api.github.com/gists/${existingGistId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(gistPayload)
      });
    } else {
      saveRes = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers,
        body: JSON.stringify(gistPayload)
      });
    }

    if (!saveRes.ok) {
      const err = await saveRes.json();
      throw new Error(err.message || 'Failed to sync Gist');
    }

    const savedGist = await saveRes.json();
    return {
      success: true,
      htmlUrl: savedGist.html_url,
      updatedAt: savedGist.updated_at
    };
  }

  async createGist(description, filename, content, isPublic = false) {
    if (!this.token) throw new Error('GitHub Login / PAT required to create Gists.');
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
      isOAuth: !!this.token,
      username: this.username,
      profile: this.userProfile,
      prCount: this.pullRequests.length,
      issueCount: this.assignedIssues.length,
      prs: this.pullRequests,
      issues: this.assignedIssues,
      repos: this.repositories,
      contributions: this.contributions
    };
  }
}

const githubHubService = new GitHubHubService();

module.exports = { GitHubHubService, githubHubService };
