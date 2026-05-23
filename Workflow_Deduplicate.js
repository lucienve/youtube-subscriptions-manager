// Version: 1.0
// Purpose: Handles the removal of duplicate videos from a specified playlist.

/**
 * Displays the HTML dialog for the user to select a playlist to deduplicate.
 */
function showDeduplicateDialog() {
  const html = HtmlService.createHtmlOutputFromFile('Dialog_Deduplicate')
      .setWidth(400)
      .setHeight(250);
  SpreadsheetApp.getUi().showModalDialog(html, 'Remove Duplicates');
}

/**
 * Called by the HTML dialog to populate the dropdown.
 * Retrieves all playlist names from the Settings tab.
 * 
 * @return {Array<string>} Array of playlist names.
 */
function getPlaylistNames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) return [];
  
  // Reuse existing function from Library.js
  const map = refreshPlaylistConfig(settingsSheet);
  return Object.keys(map);
}

/**
 * Core logic to remove duplicate videos from a playlist.
 * Called from the HTML dialog after a user selects a playlist.
 * 
 * @param {string} playlistName - The name of the playlist to deduplicate.
 */
function deduplicatePlaylist(playlistName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName('Settings');
  
  if (!settingsSheet) {
    throw new Error("Settings sheet not found.");
  }

  const playlistMap = refreshPlaylistConfig(settingsSheet);
  const playlistId = playlistMap[playlistName];
  
  if (!playlistId) {
    throw new Error('Playlist ID not found for: ' + playlistName);
  }

  ss.toast('Fetching playlist items...', 'Deduplicate');
  
  let pageToken = '';
  const seenVideoIds = new Set();
  const toDelete = [];
  
  // 1. Fetch all items and identify duplicates
  do {
    try {
      const response = YouTube.PlaylistItems.list('snippet', {
        playlistId: playlistId,
        maxResults: 50,
        pageToken: pageToken
      });

      if (response && response.items) {
        response.items.forEach(item => {
          const videoId = item.snippet.resourceId.videoId;
          // If we have seen it before, mark this specific playlist item for deletion
          if (seenVideoIds.has(videoId)) {
            toDelete.push(item.id);
          } else {
            // First time seeing this video, keep it
            seenVideoIds.add(videoId);
          }
        });
      }
      pageToken = response ? response.nextPageToken : null;
    } catch (e) {
      console.error(`Failed to list items for deduplication: ${e.message}`);
      SpreadsheetApp.getActiveSpreadsheet().toast(
          `Error fetching playlist items: ${e.message}`,
          'API Error'
      );
      break;
    }
  } while (pageToken);

  // 2. Report if no duplicates
  if (toDelete.length === 0) {
    ss.toast('No duplicates found.', 'Complete', 5);
    return;
  }

  // 3. Delete duplicates
  ss.toast(`Removing ${toDelete.length} duplicates...`, 'Processing');
  let removedCount = 0;
  
  for (let i = 0; i < toDelete.length; i++) {
    try {
      YouTube.PlaylistItems.remove(toDelete[i]);
      removedCount++;
      // Sleep slightly to avoid exceeding API rate limits on fast successive calls
      Utilities.sleep(200); 
    } catch (e) {
      console.error(`Error removing duplicate item ${toDelete[i]}:`, e);
    }
  }

  ss.toast(`Removed ${removedCount} duplicates successfully.`, 'Complete', 10);
}

// Export for testing if needed
if (typeof module !== 'undefined') {
  module.exports = {
    showDeduplicateDialog,
    getPlaylistNames,
    deduplicatePlaylist
  };
}
