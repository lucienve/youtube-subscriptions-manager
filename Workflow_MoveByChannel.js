// Version: 1.0
// Purpose: Handles moving videos from a source playlist to a destination playlist filtered by channel.

/**
 * Displays the HTML modal dialog for the user to move videos by channel.
 */
function showMoveByChannelDialog() {
  const html = HtmlService.createHtmlOutputFromFile('Dialog_MoveByChannel')
      .setWidth(520)
      .setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, 'Move Videos by Channel');
}

/**
 * Retrieves all YouTube playlists owned by the authenticated user.
 * Paginates through all results.
 *
 * @return {Array<Object>} Array of playlist objects { id: string, title: string }.
 */
function getUserPlaylists() {
  const playlists = [];
  let pageToken = '';

  try {
    do {
      const response = YouTube.Playlists.list('snippet', {
        mine: true,
        maxResults: 50,
        pageToken: pageToken
      });

      if (response && response.items) {
        response.items.forEach(item => {
          if (item.id && item.snippet && item.snippet.title) {
            playlists.push({
              id: item.id,
              title: item.snippet.title
            });
          }
        });
      }
      pageToken = response ? response.nextPageToken : null;
    } while (pageToken);
  } catch (e) {
    console.error(`Failed to fetch user playlists: ${e.message}`);
    throw new Error(`Failed to fetch playlists: ${e.message}`, { cause: e });
  }

  playlists.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  return playlists;
}

/**
 * Aggregates raw playlist items into channel groups with counts.
 * Pure helper function separated for unit testing.
 *
 * @param {Array<Object>} items - Array of YouTube PlaylistItems.
 * @return {Array<Object>} Array of { channelId, channelTitle, count } sorted descending by count.
 */
function aggregateChannelsFromPlaylistItems(items) {
  if (!items || !Array.isArray(items)) return [];

  const channelsMap = Object.create(null);

  items.forEach(item => {
    const snippet = item && item.snippet;
    const channelId = (snippet && snippet.videoOwnerChannelId) ? String(snippet.videoOwnerChannelId) : 'UNKNOWN_CHANNEL';
    const channelTitle = (snippet && snippet.videoOwnerChannelTitle)
      ? String(snippet.videoOwnerChannelTitle)
      : (channelId === 'UNKNOWN_CHANNEL' ? 'Unknown / Unavailable Channel' : channelId);

    if (!channelsMap[channelId]) {
      channelsMap[channelId] = {
        channelId: channelId,
        channelTitle: channelTitle,
        count: 0
      };
    }
    channelsMap[channelId].count++;
  });

  const result = Object.values(channelsMap);
  result.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.channelTitle.localeCompare(b.channelTitle, undefined, { sensitivity: 'base' });
  });

  return result;
}

/**
 * Filters playlist items that match target channel IDs and slices them to the batch cap.
 * Pure helper function separated for unit testing.
 *
 * @param {Array<Object>} items - Array of playlist items.
 * @param {Array<string>} targetChannelIds - Array of selected channel IDs.
 * @param {number} batchCap - Maximum number of videos to move in one run.
 * @return {Object} Object with { itemsToMove, totalMatching, remainingCount, batchCap }.
 */
function filterPlaylistItemsToMove(items, targetChannelIds, batchCap) {
  if (!items || !Array.isArray(items)) {
    return { itemsToMove: [], totalMatching: 0, remainingCount: 0, batchCap: 50 };
  }

  const effectiveCap = (typeof batchCap === 'number' && batchCap > 0)
    ? Math.min(Math.floor(batchCap), 100)
    : 50;

  const targetSet = new Set((targetChannelIds || []).map(id => String(id)));

  const matching = items.filter(item => {
    const snippet = item && item.snippet;
    const channelId = (snippet && snippet.videoOwnerChannelId) ? String(snippet.videoOwnerChannelId) : 'UNKNOWN_CHANNEL';
    return targetSet.has(channelId);
  });

  const totalMatching = matching.length;
  const itemsToMove = matching.slice(0, effectiveCap);
  const remainingCount = totalMatching - itemsToMove.length;

  return {
    itemsToMove: itemsToMove,
    totalMatching: totalMatching,
    remainingCount: remainingCount,
    batchCap: effectiveCap
  };
}

/**
 * Fetches all items in a playlist and groups them by uploader channel.
 *
 * @param {string} sourcePlaylistId - The YouTube Playlist ID to inspect.
 * @return {Array<Object>} Array of channel summaries { channelId, channelTitle, count }.
 */
function getSourcePlaylistChannels(sourcePlaylistId) {
  if (!sourcePlaylistId) {
    throw new Error('Source playlist ID is required.');
  }

  const allItems = [];
  let pageToken = '';

  try {
    do {
      const response = YouTube.PlaylistItems.list('snippet', {
        playlistId: sourcePlaylistId,
        maxResults: 50,
        pageToken: pageToken
      });

      if (response && response.items) {
        allItems.push(...response.items);
      }
      pageToken = response ? response.nextPageToken : null;
    } while (pageToken);
  } catch (e) {
    console.error(`Failed to fetch playlist items for ${sourcePlaylistId}: ${e.message}`);
    throw new Error(`Error fetching playlist items: ${e.message}`, { cause: e });
  }

  return aggregateChannelsFromPlaylistItems(allItems);
}

/**
 * Moves matching videos from the source playlist to the destination playlist.
 * Uses an insert-first order to prevent video loss.
 * Respects batch size cap and does NOT write to the History sheet.
 *
 * @param {string} sourcePlaylistId - The ID of the playlist to move videos from.
 * @param {string} destinationPlaylistId - The ID of the playlist to receive videos.
 * @param {Array<string>} channelIds - Array of channel IDs whose videos should be moved.
 * @param {number} [batchCap=50] - Maximum number of videos to move in this run.
 * @return {Object} Result summary object.
 */
function moveVideosByChannel(sourcePlaylistId, destinationPlaylistId, channelIds, batchCap) {
  if (!sourcePlaylistId || !destinationPlaylistId) {
    throw new Error('Both source and destination playlists must be specified.');
  }
  if (sourcePlaylistId === destinationPlaylistId) {
    throw new Error('Source and destination playlists cannot be the same playlist.');
  }
  if (!Array.isArray(channelIds) || channelIds.length === 0) {
    throw new Error('At least one channel must be selected.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Fetching playlist items...', 'Move Videos');

  const allItems = [];
  let pageToken = '';
  let scanPages = 0;

  try {
    do {
      const response = YouTube.PlaylistItems.list('snippet', {
        playlistId: sourcePlaylistId,
        maxResults: 50,
        pageToken: pageToken
      });
      scanPages++;

      if (response && response.items) {
        allItems.push(...response.items);
      }
      pageToken = response ? response.nextPageToken : null;
    } while (pageToken);
  } catch (e) {
    console.error(`Error reading source playlist: ${e.message}`);
    throw new Error(`Failed to read source playlist: ${e.message}`, { cause: e });
  }

  const filtered = filterPlaylistItemsToMove(allItems, channelIds, batchCap);
  const itemsToMove = filtered.itemsToMove;
  const totalMatching = filtered.totalMatching;

  if (itemsToMove.length === 0) {
    ss.toast('No matching videos found to move.', 'Move Complete', 5);
    return {
      success: true,
      movedCount: 0,
      totalMatching: 0,
      remainingCount: 0,
      incomplete: false,
      reason: null,
      estimatedQuotaUsed: scanPages
    };
  }

  let movedCount = 0;
  let quotaExceeded = false;
  let abortReason = null;
  const errors = [];

  ss.toast(`Moving ${itemsToMove.length} of ${totalMatching} matching videos...`, 'Processing');

  for (let i = 0; i < itemsToMove.length; i++) {
    const item = itemsToMove[i];
    const videoId = item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId;

    if (!videoId) {
      errors.push(`Item ${item.id} had no valid videoId`);
      continue;
    }

    try {
      // Step 1: Insert into destination playlist
      YouTube.PlaylistItems.insert({
        snippet: {
          playlistId: destinationPlaylistId,
          resourceId: {
            kind: 'youtube#video',
            videoId: videoId
          }
        }
      }, 'snippet');

      if (typeof Utilities !== 'undefined' && Utilities.sleep) {
        Utilities.sleep(150);
      }

      // Step 2: Remove from source playlist
      YouTube.PlaylistItems.remove(item.id);
      movedCount++;

      if (typeof Utilities !== 'undefined' && Utilities.sleep) {
        Utilities.sleep(150);
      }
    } catch (err) {
      console.error(`Error moving item ${item.id} (${videoId}): ${err.message}`);
      errors.push(err.message);

      if (err.message && (err.message.includes('quotaExceeded') || err.message.includes('quota') || err.code === 403)) {
        quotaExceeded = true;
        abortReason = 'quota_exceeded';
        break;
      }
    }

    if ((i + 1) % 5 === 0 || (i + 1) === itemsToMove.length) {
      ss.toast(`Moved ${movedCount} of ${itemsToMove.length} videos...`, 'Progress');
    }
  }

  const remainingCount = totalMatching - movedCount;
  const incomplete = remainingCount > 0;

  if (!abortReason && incomplete) {
    abortReason = 'batch_cap_reached';
  }

  const estimatedQuotaUsed = (movedCount * 100) + scanPages;

  let toastMsg = `Moved ${movedCount} videos.`;
  if (incomplete) {
    toastMsg += ` (Partial move: ${remainingCount} remain)`;
  }
  ss.toast(toastMsg, 'Move Finished', 8);

  return {
    success: true,
    movedCount: movedCount,
    totalMatching: totalMatching,
    remainingCount: remainingCount,
    incomplete: incomplete,
    quotaExceeded: quotaExceeded,
    reason: abortReason,
    errors: errors,
    estimatedQuotaUsed: estimatedQuotaUsed
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    showMoveByChannelDialog,
    getUserPlaylists,
    aggregateChannelsFromPlaylistItems,
    filterPlaylistItemsToMove,
    getSourcePlaylistChannels,
    moveVideosByChannel
  };
}
