# Project Context

## Current State
The project is a Google Apps Script-based YouTube Subscriptions Manager. 
It uses Google Sheets as a UI and database, fetching new videos from subscriptions via RSS, fetching duration and details via the YouTube Data API, predicting the appropriate playlist using basic keyword logic, and allows the user to process them.

## Completed Features
- Fetching new videos from subscribed channels via RSS feeds.
- Checking API quotas to prevent limits.
- Determining video duration.
- Basic keyword-based prediction for playlist sorting.
- UI for users to select videos in Google Sheets and push them to YouTube Playlists.
- **Deduplicating Playlists:** Added a new menu item to deduplicate YouTube playlists. It uses an HTML dropdown dialog to let the user select a playlist from their configuration, then uses the YouTube Data API to fetch items, preserving the first occurrence of each video and marking subsequent duplicate occurrences for deletion.
- **Subscription Count Guardrail:** Added a pre-check to catch subscription size drops (e.g. YouTube API failing to list all subscriptions/paging limits). Alerts the user with a popup confirmation dialog if the subscription count differs by > 10 from the previous run.
- **Prediction Weights Tuning & Config:** Tuned prediction weights to allow title keywords to override general channel default playlists, and moved weight configuration to settings in the spreadsheet itself (under labels `Weight: Channel`, `Weight: Keyword`, and `Weight: Duration`).

## Architectural Decisions
- **Quota Protection:** Heavy reliance on RSS for initial fetching to save YouTube Data API units.
- **Local Development:** Project is managed locally using clasp, allowing the use of ESLint and Jest for testing pure functions.
- **Deduplication Dialog:** Uses `HtmlService` (`Dialog_Deduplicate.html`) for the deduplication feature to provide a clean, reliable user selection dropdown that queries the latest configured playlists dynamically.
- **Subscription Guardrail Pre-check:** The guardrail is evaluated immediately after fetching the subscription list, preventing any RSS feed scans, video duration lookups, or sheet modifications if the user aborts.
- **Subscription Settings & Layout:** The Settings sheet parsing is completely dynamic and label-driven. Parameters like `"Last Run Time"`, `"Last Subscription Count"`, and the prediction weights are looked up by scanning Column A for their labels. If a setting is missing, it is automatically inserted right above the `"Playlist Name"` / `"Playlist ID"` headers. The playlist configuration table itself is located by searching Columns A and B for the headers, with all config rows parsed directly below them. This makes the layout completely robust to row insertions, additions, or re-ordering.
- **Keyword-First Prediction Bias:** Set default prediction weights such that keyword matches within a channel carry a higher weight (2.0 per word) than the general channel statistical default (1.5). This ensures specific series/shows identified by title keywords can successfully override default playlist sorting. Weights are dynamically parsed from the `Settings` sheet and cached in memory per-run to maximize efficiency.

## Future Plans
- Continued monitoring of quota usage.
- Refinement of the prediction logic.
