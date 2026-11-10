# Project Context

## Current State

The project is a Google Apps Script-based YouTube Subscriptions Manager. It uses
Google Sheets as a UI and database, fetching new videos from subscriptions via
RSS feeds, fetching duration and details via the YouTube Data API v3, predicting
the appropriate playlist using title keywords, channel history, and duration
bucketing, and allows the user to process them into playlists.

## Completed Features

- Fetching new videos from subscribed channels via RSS feeds.
- Checking API quotas to prevent limits.
- Determining video duration (including day-duration ISO formats >= 24 hours).
- Keyword, duration, and channel-based prediction for playlist sorting.
- UI for users to select videos in Google Sheets and push them to YouTube
  Playlists.
- **Deduplicating Playlists:** Menu item to deduplicate YouTube playlists
  configured in the Settings tab. It uses an HTML dropdown dialog to let the
  user select a configured playlist, then uses the YouTube Data API to fetch
  items, preserving the first occurrence of each video and removing duplicates.
- **Subscription Count Guardrail:** Pre-check to catch subscription size drops
  (e.g., YouTube API failing to list all subscriptions or paging limits).
  Alerts the user with a confirmation dialog if the subscription count differs
  by > 10 from the previous run.
- **Prediction Weights Tuning & Config:** Allows title keywords to override
  general channel default playlists, and stores weight configuration in the
  `Settings` sheet under labels `Weight: Channel`, `Weight: Keyword`, and
  `Weight: Duration`.
- **Move Videos by Channel:** Tool to reorganize videos between playlists by
  uploader channel. Opens a modal dialog (`Dialog_MoveByChannel.html`) allowing
  the user to select any playlist owned by their account, scan and aggregate
  videos grouped by creator channel with video counts, multi-select channels,
  set a destination playlist (or the special 'Trash' destination to remove from
  source without re-adding), configure a batch size cap (default 50), and
  move/remove matching videos with clear quota budgeting and feedback.
- **User-Friendly Overnight Maintenance Alert:** Clear, non-technical alert
  dialog when YouTube's feed servers return 404 or 500 during routine
  maintenance windows, localizing the expected outage timeframe (8 PM to 7 AM
  ET) to the user's spreadsheet timezone while preserving strict abort
  guarantees.

## Architectural Decisions

- **Quota Protection:** Heavy reliance on RSS for initial fetching to save
  YouTube Data API units. Added `isQuotaExceededError` helper to halt batch
  processing immediately if quota is exhausted, preventing 24-hour API bans.
- **Concurrency Protection (`LockService`):** All mutating workflows
  (`checkNewVideos`, `processSelectedVideos`, `deduplicatePlaylist`, and
  `moveVideosByChannel`) acquire `LockService.getDocumentLock()` to prevent
  simultaneous runs from causing duplicate insertions, corrupting sheets, or
  burning quota.
- **Strict RSS Error Abort:** Per intended design, any HTTP error, malformed
  XML structure, or unparseable timestamp during RSS feed scanning aborts the
  entire fetch run without advancing `Last Run Time`, guaranteeing no videos are
  permanently missed.
- **Nightly RSS Maintenance & Fail-Closed Safety:** YouTube's legacy Atom/RSS
  feed infrastructure regularly experiences overnight maintenance and server
  timeouts between roughly 8 PM and 7 AM ET, producing intermittent HTTP 404
  and 500 responses on origin cache misses. The fetch workflow maintains strict
  fail-closed safety by aborting immediately without updating `Last Run Time`
  so no published videos are ever missed. The user-facing error dialog presents
  a friendly, localized maintenance message (`formatFetchErrorAlert` and
  `formatMaintenanceWindow`) while preserving detailed technical logs in
  `console.error`.
- **Timestamp & Timezone Safety:** `Last Run Time` is formatted and parsed
  using the spreadsheet's timezone with an ISO-8601 offset
  (`"yyyy-MM-dd'T'HH:mm:ssXXX"`), ensuring DST transitions or differences
  between spreadsheet and script timezones do not shift fetch windows.
- **Inbox Deduplication & Column F Plain Text:** Incoming videos are
  deduplicated against existing IDs in Column F of `Videos`. Column F is
  explicitly formatted as Plain Text (`'@'`) before setting values so leading
  zeros or symbols in base64url IDs are never coerced into numeric values.
- **Local Development & CI/CD:** Project is managed locally using clasp,
  enforcing ESLint and Jest for testing pure functions. CI is configured on
  Node 24 LTS with serialized `clasp push` runs via GitHub Actions concurrency
  groups.
- **Deduplication Dialog:** Uses `HtmlService` (`Dialog_Deduplicate.html`)
  strictly scoped to playlists configured in the `Settings` sheet.
- **Subscription Guardrail Pre-check:** Evaluated immediately after fetching
  the subscription list. `getAllSubscriptions` returns `null` on pagination
  failure to avoid proceeding with partial lists or corrupting baseline counts.
- **Subscription Settings & Layout:** Settings sheet parsing is dynamic and
  label-driven. Lookups scan Column A and B in a single RPC. New settings are
  inserted directly above the `"Playlist Name"` / `"Playlist ID"` headers.
- **Move Videos by Channel Guardrails & Reliability:**
  - **Ownership Scope:** Queries
    `YouTube.Playlists.list('snippet', { mine: true })` to dynamically list
    all playlists owned by the authenticated account.
  - **Insert-First Transactional Pattern:** Inserts into destination playlist
    before removing from source to prevent video loss.
  - **Trash Destination:** Supports a 'Trash' action that removes matching
    videos from source without adding them anywhere else (50 units/video).
  - **Error Differentiation:** Distinguishes item-level failures
    (`reason = 'item_errors'`) from `batch_cap_reached` so private/deleted video
    failures are surfaced transparently.
  - **History Bypass:** Out-of-band reorganizing bypasses the `History` sheet to
    avoid polluting the inbox prediction model.

## Future Plans

- Continued monitoring of quota usage.
- Refinement of the prediction logic if requested.
