# 🐙 GitHub Developer Ecosystem & Contribution Widget Blueprint

### _Architecture & Feature Breakdown for MyNetwork Developer Browser_

---

## 📌 1. Executive Summary

Transforming MyNetwork Browser into a **GitHub-First Developer Browser** bridges the gap between daily web browsing and developer workflows. By integrating a dedicated **GitHub App / OAuth System** and a **Live Contribution Heatmap Widget**, the browser becomes an intelligent workstation for software engineers.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      MyNetwork Developer Browser                         │
├────────────────────────────────┬─────────────────────────────────────────┤
│        Focus Dashboard         │             Omnibox & Tabs              │
│  ┌──────────────────────────┐  │  ┌───────────────────────────────────┐  │
│  │ 🟩 GitHub Activity Grid  │  │  │ 🐙 @gh tanis/my-project (PR #42) │  │
│  │ 🔥 24-Day Streak Counter │  │  └───────────────────────────────────┘ │
│  └──────────────────────────┘  │                                         │
├────────────────────────────────┼─────────────────────────────────────────┤
│     Claude AI PR Reviewer      │         Live CI/CD Build Watcher        │
│  - Instant Diff Analysis       │  - GitHub Actions status on active tab  │
│  - Automated Code Critique     │  - Passing / Failing badge in toolbar   │
└────────────────────────────────┴─────────────────────────────────────────┘
```

---

## 🔑 2. GitHub App vs. OAuth App vs. Personal Access Token (PAT)

| Capability             | Personal Access Token (PAT)                  | GitHub OAuth App                              | Custom GitHub App                                  |
| :--------------------- | :------------------------------------------- | :-------------------------------------------- | :------------------------------------------------- |
| **Authentication UX**  | Manual copy-paste of long string (`ghp_...`) | 1-Click browser OAuth login button            | 1-Click installation & granular org permissions    |
| **Security & Expiry**  | High risk if token leaked, broad scopes      | Token scoped to app, refresh tokens supported | Short-lived installation tokens (Highest Security) |
| **Real-time Webhooks** | ❌ No                                        | ⚠️ Limited                                    | ✅ Full Webhook events (PRs, Issues, Builds)       |
| **Bot Persona**        | ❌ None                                      | ❌ None                                       | ✅ Can act as `@mynetwork-bot`                     |
| **Recommended Use**    | Quick testing / Read-only fallback           | **Ideal for Desktop Browser Integration**     | Enterprise & Team Workspaces                       |

> **Recommendation**: We use the **GitHub OAuth Flow (PKCE / Deep Link)** for effortless 1-click user login, while supporting **Direct GraphQL Fallback** for instant public username stats.

---

## 🟢 3. Live Contribution Heatmap Widget (New Tab Dashboard)

### 📊 Visual Design & Architecture

The widget renders on the **Focus Dashboard** below the search bar or beside the Scratchpad:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🐙 GitHub Contributions • @tanis                                  🔥 18 Days│
├──────────────────────────────────────────────────────────────────────────────┤
│  Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec       │
│  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░      │
│  ░░█░  ░░█░  ░░██  ░███  ░░░█  ░██░  ░███  ░███  ░███  ░░██  ░███  ░███      │
│  ░███  ░███  ░███  ████  ░███  ████  ████  ████  ████  ░███  ████  ████      │
├──────────────────────────────────────────────────────────────────────────────┤
│  384 contributions in 2026  •  Longest Streak: 32 days  •  Today: 4 commits   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 🛠️ Data Fetching Engine (GraphQL vs REST)

```graphql
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
          }
        }
      }
    }
  }
}
```

### ✨ Core Features of the Widget:

1. **Interactive SVG Grid**: 52 weeks × 7 days with authentic GitHub green gradient levels (`#ebedf0`, `#9be9a8`, `#40c463`, `#30a14e`, `#216e39`).
2. **Live Streak Counter**: Calculates current streak, longest streak, and total contributions this year.
3. **Hover Tooltip**: Displays date and commit count (e.g., _"12 contributions on August 14, 2026"_).
4. **Streak Keeper Notification**: If 0 commits are recorded by 8:00 PM, a subtle macOS notification reminds the developer to make a commit.

---

## 🚀 4. Advanced GitHub Features for MyNetwork Browser

### A. 🚨 Live GitHub Actions CI/CD Watcher

- When you are viewing any GitHub repository tab (e.g. `github.com/facebook/react`), the browser bottom bar displays the live build status:
  - 🟢 `CI: Passing (Build #142)`
  - 🔴 `CI: Failed (Tests failed on Node 20)`
- Clicking the badge opens the failed build logs in a floating developer drawer without leaving your current work.

### B. 🤖 Claude 1-Click PR Reviewer

- When viewing a Pull Request (`/pull/123/files`), a **"Review with Claude"** button appears in the toolbar.
- Claude extracts the PR diff, analyzes:
  - Potential bugs & memory leaks
  - Security vulnerabilities (SQL injection, XSS, exposed secrets)
  - Code readability & performance optimizations
- Generates structured markdown review comments ready to copy-paste.

### C. ☁️ Bidirectional Gist & Scratchpad Sync

- The browser's **Quick Scratchpad** automatically syncs to a private GitHub Gist (`mynetwork-scratchpad.md`).
- Access your scratch notes and code snippets seamlessly across multiple machines.

### D. 📂 1-Click Local Repo Clone & VS Code Launcher

- On any GitHub repository page, an enhanced action button offers:
  - `Clone to ~/Projects`
  - `Open in VS Code / Cursor`
  - `Launch Web Container Sandbox`

### E. ⚡ Omnibox GitHub Commands

- Type `@gh` in the Omnibox to search your repositories, assigned issues, or starred projects:
  - `@gh pr` → Lists all your open Pull Requests
  - `@gh issues` → Lists all issues assigned to you
  - `@gh star <repo>` → Instantly stars a repo

---

## 📝 5. Registered GitHub OAuth App Configuration

- **Application Name**: `MyNetwork Browser`
- **Owner**: `@TanishkGoswami`
- **Homepage URL**: `https://github.com/TanishkGoswami/MyNetwork-Browser`
- **Authorization Callback URL**: `http://localhost:8942/oauth/github/callback`
- **Environment Variables** (`.env` - git-ignored):
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
- **Requested Scopes**: `repo`, `read:user`, `gist`, `workflow`

---

## 🗓️ 6. Phased Implementation Roadmap

```
┌───────────────────────────┐     ┌───────────────────────────┐     ┌───────────────────────────┐
│     PHASE 1 (COMPLETED)   │     │    PHASE 2 (COMPLETED)    │     │          PHASE 3          │
│   Contribution Heatmap    │ ──► │     OAuth & Sync Flow     │ ──► │  Claude PR & CI Watcher   │
│  - 365-day SVG Dashboard  │     │  - 1-Click GitHub login   │     │  - Live Actions build bar │
│  - Streak calculation     │     │  - Gist Scratchpad sync   │     │  - 1-Click Code Reviewer  │
└───────────────────────────┘     └───────────────────────────┘     └───────────────────────────┘
```

---

_Document updated for MyNetwork Browser Architecture._

