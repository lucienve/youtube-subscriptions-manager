// Version: 1.2
// Purpose: Contains the "AI" logic for analyzing history and making predictions.

/**
 * Scans the 'History' tab to build a statistical model of user preferences.
 * Calculates frequency of playlist choices based on Channel, Duration, and Title keywords.
 *
 * @param {Spreadsheet} ss - The active Google Spreadsheet object.
 * @return {Object} model - A complex object containing frequency maps for channels, words, and durations.
 */
function buildPredictionModel(ss) {
  const sheet = ss.getSheetByName('History');
  if (!sheet) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null; // No history

  // Data: [Date, Channel, Title, Duration, Playlist]
  const data = sheet.getRange(2, 2, lastRow - 1, 4).getValues();

  const model = {
    channelStats: Object.create(null),
    channelWordStats: Object.create(null),
    channelDurationStats: Object.create(null),
    playlists: new Set()
  };

  data.forEach(row => {
    // SECURITY FIX: Explicitly cast inputs to strings to prevent object injection/prototype pollution
    const channel = String(row[0]);
    const title = String(row[1]);
    const duration = String(row[2]);
    const playlist = String(row[3]);

    if (!playlist || playlist === "undefined" || playlist === "null" || playlist === "") return;
    model.playlists.add(playlist);

    // 1. Channel Stats
    // SECURITY FIX: Use Object.create(null) for map-like structures to prevent prototype pollution
    if (!model.channelStats[channel]) model.channelStats[channel] = Object.create(null);
    if (!model.channelStats[channel][playlist]) model.channelStats[channel][playlist] = 0;
    model.channelStats[channel][playlist]++;

    // 2. Channel Duration Stats
    const bucket = getDurationBucket(duration);
    if (!model.channelDurationStats[channel]) model.channelDurationStats[channel] = Object.create(null);
    if (!model.channelDurationStats[channel][bucket]) model.channelDurationStats[channel][bucket] = Object.create(null);
    if (!model.channelDurationStats[channel][bucket][playlist]) model.channelDurationStats[channel][bucket][playlist] = 0;
    model.channelDurationStats[channel][bucket][playlist]++;

    // 3. Channel Word Stats
    const words = getKeywords(title);
    words.forEach(w => {
      const wordStr = String(w);
      if (!model.channelWordStats[channel]) model.channelWordStats[channel] = Object.create(null);
      if (!model.channelWordStats[channel][wordStr]) model.channelWordStats[channel][wordStr] = Object.create(null);
      if (!model.channelWordStats[channel][wordStr][playlist]) model.channelWordStats[channel][wordStr][playlist] = 0;
      model.channelWordStats[channel][wordStr][playlist]++;
    });
  });

  return model;
}

/**
 * Predicts the most likely playlist for a specific video using weighted scores.
 * Weights: Channel (High), Title (Medium), Duration (Low).
 * Returns empty string if confidence is low or if '_DISCARD_' is the winner.
 *
 * @param {Object} video - Object containing {channel, title, duration}.
 * @param {Object} model - The prediction model returned by buildPredictionModel.
 * @return {string} - The name of the suggested playlist, or empty string.
 */
function predictPlaylist(video, model) {
  if (!model) return '';

  const playlists = Array.from(model.playlists);
  const scores = {};

  // Initialize scores
  playlists.forEach(p => scores[p] = 0);

  // 1. Channel Score (Weight: 3)
  const cStats = model.channelStats[video.channel];
  if (cStats) {
    const total = Object.values(cStats).reduce((a, b) => a + b, 0);
    for (const pl in cStats) {
      scores[pl] += (cStats[pl] / total) * 3;
    }
  }

  // 2. Duration Score (Weight: 1)
  const bucket = getDurationBucket(video.duration);
  const dStats = model.channelDurationStats[video.channel] ? model.channelDurationStats[video.channel][bucket] : null;
  if (dStats) {
    const total = Object.values(dStats).reduce((a, b) => a + b, 0);
    for (const pl in dStats) {
      scores[pl] += (dStats[pl] / total) * 1;
    }
  }

  // 3. Title Keyword Score (Weight: 0.5 per word)
  // Now tracks keywords internally per-channel.
  const words = getKeywords(video.title);
  words.forEach(w => {
    const wStats = model.channelWordStats[video.channel] ? model.channelWordStats[video.channel][w] : null;
    if (wStats) {
      const total = Object.values(wStats).reduce((a, b) => a + b, 0);
      for (const pl in wStats) {
        scores[pl] += (wStats[pl] / total) * 0.5;
      }
    }
  });

  // Find Winner
  let bestPlaylist = '';
  let highestScore = 0;

  for (const pl in scores) {
    if (scores[pl] > highestScore) {
      highestScore = scores[pl];
      bestPlaylist = pl;
    }
  }

  // Threshold: Only suggest if we have some confidence
  if (highestScore > 0.8) {
    // If the winner is the special "Discard" tag, return blank (don't select anything)
    if (bestPlaylist === '_DISCARD_') {
      return '';
    }
    return bestPlaylist;
  }

  return '';
}

/**
 * Buckets duration into 'short' (<1m), 'medium' (1m-5m), or 'long' (>5m).
 * HANDLES BOTH:
 * 1. New Decimal Format (e.g., 5.5)
 * 2. Old History Format (e.g., "5:30" or "1:05:00")
 *
 * @param {string|number} duration - The duration value from the sheet.
 * @return {string} - The bucket name.
 */
function getDurationBucket(duration) {
  // 1. Handle "LIVE" or empty
  if (!duration || duration === 'LIVE/UPCOMING') return 'long';

  let mins = 0;

  // 2. Check for Old Format (String with Colon, e.g., "5:30")
  if (typeof duration === 'string' && duration.includes(':')) {
    const parts = duration.split(':').map(Number);
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]; // H:M:S
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1]; // M:S

    mins = seconds / 60;
  }
  // 3. Handle New Format (Decimal Number, e.g., 5.5)
  else {
    mins = parseFloat(duration);
  }

  if (isNaN(mins)) return 'medium'; // Fallback

  // Apply Buckets
  if (mins < 1.0) return 'short';      // Less than 1 minute
  if (mins <= 5.0) return 'medium';    // 1 to 5 minutes
  return 'long';                       // Greater than 5 minutes
}

/**
 * Tokenizes a title into key words, removing stop words and special characters.
 *
 * @param {string} title - The raw video title.
 * @return {Array<string>} - Array of clean keywords.
 */
function getKeywords(title) {
  if (!title) return [];
  // Lowercase, remove special chars, split by space
  const clean = title.toString().toLowerCase().replace(/[^\w\s]/g, '');
  const tokens = clean.split(/\s+/);
  // Basic Stopwords
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'my', 'new', 'video', 'how', 'why']);
  return tokens.filter(t => t.length > 2 && !stopWords.has(t));
}