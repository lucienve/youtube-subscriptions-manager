// Version: 1.1
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
  const settingsSheetName = (typeof SHEET_SETTINGS !== 'undefined') ? SHEET_SETTINGS : 'Settings';
  const settingsSheet = ss.getSheetByName(settingsSheetName);
  if (!settingsSheet) return [];
  
  // Reuse existing function from Library.js with silentUi to avoid blocking alerts during dialog load
  const map = refreshPlaylistConfig(settingsSheet, { silentUi: true });
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
  const settingsSheetName = (typeof SHEET_SETTINGS !== 'undefined') ? SHEET_SETTINGS : 'Settings';
  const settingsSheet = ss.getSheetByName(settingsSheetName);
  
  if (!settingsSheet) {
    throw new Error('Settings sheet not found.');
  }

  const lock = (typeof LockService !== 'undefined') ? LockService.getDocumentLock() : null;
  if (lock && !lock.tryLock(0)) {
    throw new Error('Another YouTube Tools operation is currently running. Please wait for it to complete.');
  }

  try {
    const playlistMap = refreshPlaylistConfig(settingsSheet, { silentUi: true });
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
      let response;
      try {
        response = YouTube.PlaylistItems.list('snippet', {
          playlistId: playlistId,
          maxResults: 50,
          pageToken: pageToken
        });
      } catch (e) {
        console.error(`Failed to list items for deduplication: ${e.message}`);
        throw new Error(`Error fetching playlist items: ${e.message}`, { cause: e });
      }

      if (response && response.items) {
        response.items.forEach(item => {
          const videoId = item && item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId;
          if (!videoId) return;

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
    } while (pageToken);

    // 2. Report if no duplicates
    if (toDelete.length === 0) {
      ss.toast('No duplicates found.', 'Complete', 5);
      return;
    }

    // 3. Delete duplicates
    ss.toast(`Removing ${toDelete.length} duplicates...`, 'Processing');
    let removedCount = 0;
    let failedCount = 0;
    let quotaHit = false;
    
    for (let i = 0; i < toDelete.length; i++) {
      try {
        YouTube.PlaylistItems.remove(toDelete[i]);
        removedCount++;
        // Sleep slightly to avoid exceeding API rate limits on fast successive calls
        if (typeof Utilities !== 'undefined' && Utilities.sleep) {
          Utilities.sleep(200); 
        }
      } catch (e) {
        console.error(`Error removing duplicate item ${toDelete[i]}: ${e.message}`);
        failedCount++;

        if (isQuotaExceededError(e)) {
          quotaHit = true;
          break;
        }
      }
    }

    if (failedCount > 0) {
      let msg = `Removed ${removedCount} duplicates, but ${failedCount} removal(s) failed.`;
      if (quotaHit) {
        msg += ' YouTube API quota limit reached.';
      }
      ss.toast(msg, 'Incomplete', 10);
      throw new Error(msg);
    }

    ss.toast(`Removed ${removedCount} duplicates successfully.`, 'Complete', 10);
  } finally {
    if (lock) {
      lock.releaseLock();
    }
  }
}

// Export for testing if needed
if (typeof module !== 'undefined') {
  module.exports = {
    showDeduplicateDialog,
    getPlaylistNames,
    deduplicatePlaylist
  };
}
