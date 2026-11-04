# Vitals ⚡

> A precision activity, productivity, and project analytics dashboard for [Obsidian](https://obsidian.md).

**Vitals** scans your vault's YAML frontmatter to deliver real-time visual metrics, interactive trend analysis, productivity heatmaps, and customizable theme profiles without third-party dependencies or cloud tracking.

---

## ✨ Features

- **📊 Comprehensive Metric Cards**
  - Instant high-level summaries: Total Time, Active Days, Distinct Categories, and Daily Averages.
  - Automatic percentage comparison deltas (`+18%`, `-5%`) comparing the current window against previous periods.
- **📅 Flexible Timeframe Filtering**
  - Filter by **Day**, **30D**, **Month**, **Year**, or **All Time**.
  - Stepped navigation controls (`‹` and `›`) to traverse days, months, and years chronologically.
- **🎯 Project Breakdown & Filtering (`@project`)**
  - Native Obsidian menu popover to scope the entire dashboard to a specific project or view aggregate metrics across all projects.
- **🟩 Consistency Heatmap**
  - GitHub-style contribution matrix displaying daily intensity levels.
  - Switch between rolling **Last 52 Weeks** and dedicated calendar years (**2026**, **2025**, etc.).
  - Click any square to view an itemized modal list of notes and session durations logged on that day.
- **🕒 24-Hour Time-of-Day Punch Card**
  - A 7×24 productivity matrix (Sunday through Saturday across hours 00:00–23:00).
  - Automatically identifies peak deep-work hours and optimal work intervals.
- **📈 Trends & Category Distribution**
  - Interactive line chart for week-over-week and day-over-day progression.
  - Multi-view category distribution: switch between a **Ring (Donut)** chart and a **Horizontal Bar** chart for clear label readability.
- **📝 In-Place Activity Feed**
  - Detailed tabular view of logged sessions with direct note navigation.
  - Date stepping and pagination (15 items per page) that updates in-place without resetting scroll position.
- **📤 One-Click Data Export**
  - Export filtered dashboard views to structured **CSV** or summarized **Markdown** tables.
- **🎨 Built-in Theme Engine**
  - Native theme variable integration featuring 5 presets:
    - **Vitals Stealth** (signature dark palette with teal accents)
    - **GitHub Dark** (classic GitHub dark interface with contribution greens)
    - **GitHub Light** (clean paper-white contrast)
    - **Nord Frost** (cool arctic slate and blue tones)
    - **Obsidian Native** (automatically synchronizes with your active vault theme)

---

## 🚀 Getting Started

### Tracking Activities in Frontmatter

Vitals automatically identifies notes containing valid YAML frontmatter properties. Simply add a duration, and optionally a date, category, project, or start time:

```yaml
---
duration: 1h 30m
type: Writing
project: novel-draft
date: 2026-11-04
time: 09:30
---
```
