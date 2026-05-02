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

## Architectural Decisions
- **Quota Protection:** Heavy reliance on RSS for initial fetching to save YouTube Data API units.
- **Local Development:** Project is managed locally using clasp, allowing the use of ESLint and Jest for testing pure functions.
- **Deduplication Dialog:** Uses `HtmlService` (`Dialog_Deduplicate.html`) for the deduplication feature to provide a clean, reliable user selection dropdown that queries the latest configured playlists dynamically.

## Future Plans
- Continued monitoring of quota usage.
- Refinement of the prediction logic.
