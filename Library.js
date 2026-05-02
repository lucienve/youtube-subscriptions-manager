// Version: 1.2
// Purpose: Reusable helper functions for API calls and configuration.

/**
 * Reads the 'Settings' sheet to map Playlist Names to IDs.
 * If IDs are missing, it searches YouTube and updates the sheet.
 *
 * @param {Sheet} settingsSheet - The 'Settings' sheet object.
 * @return {Object} - A map of { 'PlaylistName': 'PlaylistId' }.
 */
function refreshPlaylistConfig(settingsSheet) {
  const lastRow = settingsSheet.getLastRow();
  if (lastRow < 3) return {};

  const range = settingsSheet.getRange(3, 1, lastRow - 2, 2);
  const data = range.getValues();
  
  let map = {};
  let missingIds = [];

  data.forEach((row, index) => {
    const name = row[0];
    const id = row[1];
    if (name && name !== '') {
      if (id && id !== '') {
        map[name] = id;
      } else {
        missingIds.push({ name: name, rowIndex: index + 3 });
      }
    }
  });

  if (missingIds.length > 0) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Looking up missing IDs...');
    const myPlaylists = {};
    let pageToken = '';
    try {
      do {
        const response = YouTube.Playlists.list('snippet', {
          mine: true,
          maxResults: 50,
          pageToken: pageToken
        });
        response.items.forEach(pl => {
          myPlaylists[pl.snippet.title] = pl.id;
        });
        pageToken = response.nextPageToken;
      } while (pageToken);
    } catch (e) {
      if (e.message.includes('Channel not found') || e.message.includes('channelNotFound')) {
        console.error('YouTube channel not found. Ensure the Google Account has a linked YouTube channel.');
        SpreadsheetApp.getUi().alert('YouTube Channel Required: Your Google Account does not have an active YouTube channel. A channel is required to look up playlists. Please check the "Ensure You Have a YouTube Channel" section in the README for instructions, or enter Playlist IDs manually.');
      } else {
        console.error('Error fetching playlists: ' + e.message);
      }
    }

    missingIds.forEach(item => {
      const foundId = myPlaylists[item.name];
      if (foundId) {
        map[item.name] = foundId;
        settingsSheet.getRange(item.rowIndex, 2).setValue(foundId);
      }
    });
  }
  return map;
}

/**
 * Adds a video to a specific YouTube playlist via the API.
 *
 * @param {string} playlistId - The YouTube Playlist ID.
 * @param {string} videoId - The YouTube Video ID.
 * @return {void}
 */
function addToPlaylist(playlistId, videoId) {
  const resource = {
    snippet: {
      playlistId: playlistId,
      resourceId: { kind: 'youtube#video', videoId: videoId }
    }
  };
  YouTube.PlaylistItems.insert(resource, 'snippet');
}

/**
 * Fetches ALL subscribed channels for the authenticated user.
 * Handles pagination automatically.
 *
 * @return {Array<string>} - Array of Channel IDs.
 */
function getAllSubscriptions() {
  let channels = [];
  let pageToken = '';
  try {
    do {
      const response = YouTube.Subscriptions.list('snippet', {
        mine: true,
        maxResults: 50,
        pageToken: pageToken
      });
      if (response.items) {
        response.items.forEach(item => channels.push(item.snippet.resourceId.channelId));
      }
      pageToken = response.nextPageToken;
    } while (pageToken);
  } catch (e) {
    if (e.message.includes('Channel not found') || e.message.includes('channelNotFound')) {
      console.error('YouTube channel not found. Cannot fetch subscriptions.');
      SpreadsheetApp.getUi().alert('YouTube Channel Required: Your Google Account does not have an active YouTube channel. A channel is required to fetch your subscriptions. Please check the "Ensure You Have a YouTube Channel" section in the README for instructions.');
    } else {
      console.error('Error fetching subscriptions: ' + e.message);
      SpreadsheetApp.getUi().alert('Error fetching subscriptions: ' + e.message);
    }
  }
  return channels;
}

/**
 * Converts ISO 8601 duration (PT1H2M10S) to decimal minutes (e.g., 1.50).
 * Handles LIVE/Upcoming events by checking for zero duration.
 *
 * @param {string} isoDuration - The raw duration string from YouTube API.
 * @return {string|number} - Decimal minutes (e.g. 5.50) or "LIVE/UPCOMING".
 */
function parseDuration(isoDuration) {
  if (!isoDuration || isoDuration === 'P0D') return 'LIVE/UPCOMING';
  
  const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 'LIVE/UPCOMING';

  const hours = parseInt((match[1] || '').replace('H', '')) || 0;
  const mins = parseInt((match[2] || '').replace('M', '')) || 0;
  const secs = parseInt((match[3] || '').replace('S', '')) || 0;

  // Calculate total minutes
  const totalMinutes = (hours * 60) + mins + (secs / 60);

  if (totalMinutes === 0) return 'LIVE/UPCOMING';

  // Return formatted to 2 decimal places (e.g., "1.25")
  return totalMinutes.toFixed(2);
}
/**
 * Escapes a string to prevent formula injection in Google Sheets.
 * If the string starts with =, +, -, or @, it prefixes it with a single quote.
 *
 * @param {any} value - The value to escape.
 * @return {any} - The escaped value.
 */
function escapeFormula(value) {
  if (typeof value === 'string' && /^[\s\u200B\uFEFF\xA0]*[=+\-@]/.test(value)) {
    return "'" + value;
  }
  return value;
}

if (typeof module !== 'undefined') {
  module.exports = { parseDuration, escapeFormula };
}
