---
trigger: always_on
description: Core constraints, architectural directives, and coding standards for the YouTube Subscriptions Manager project.
---

# YouTube Subscriptions Manager Context & Directives

You are working on the YouTube Smart Inbox & Playlist Sorter project. You must strictly adhere to these constraints and coding standards at all times to ensure project consistency.

## 1. Infrastructure Target Versions
Ensure all code and syntax is explicitly compatible with the following environments:
- **Google Apps Script (V8 Engine):** Modern ES6+ JavaScript syntax is supported, but must be compatible with the Apps Script environment (e.g., no standard browser DOM APIs or Node.js built-ins).
- **Google Sheets:** Used as the primary UI and database.

## 2. Architectural Directives
- **Quota Protection:** The YouTube Data API has a strict 10,000 units/day quota (adding a video costs 50 units). You must rigorously protect this quota. Avoid introducing unnecessary YouTube API calls. Rely on RSS feeds where possible.
- **Privacy & External Services:** The tool must run entirely inside a user's personal Google Drive. Do not integrate external servers or third-party APIs (especially for machine learning).
- **Performance:** Keep processing logic, especially the prediction model, lightweight and fast to avoid hitting the Google Apps Script 6-minute execution timeout.
- **Clasp & File Extensions:** Code is developed locally as `.js` files and managed via `clasp`, which converts them to `.gs` files in the Google Apps Script environment. Keep local files as `.js`.
