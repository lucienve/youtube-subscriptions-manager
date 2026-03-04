// Version: 1.4
// Purpose: Handles user actions (moving videos to playlists or discarding them) and logging history.

/**
 * Reads user selections from the 'Videos' sheet.
 * - If a playlist is selected: Adds video to YouTube playlist, logs to History, deletes row.
 * - If NO playlist is selected: Logs as _DISCARD_ to History, deletes row.
 * - SAFETY: Stops if daily quota (approx 190 adds) is reached.
 * - MAINTENANCE: Trims History tab if it exceeds 2000 rows.
 *
 * No parameters.
 * No return value.
 */
function processSelectedVideos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const videoSheet = ss.getSheetByName(SHEET_VIDEOS);
  const settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  const historySheet = ss.getSheetByName('History');

  const playlistIds = refreshPlaylistConfig(settingsSheet);

  const lastRow = videoSheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('No videos to process.');
    return;
  }

  // Read 7 columns: [Dest, Thumb, Duration, Channel, Title, ID, Date]
  const range = videoSheet.getRange(2, 1, lastRow - 1, 7);
  const data = range.getValues();

  let videosAdded = 0;
  let videosDiscarded = 0;
  let historyLog = [];
  let rowsToDelete = [];
  let quotaHit = false;

  ss.toast('Processing videos...', 'Step 1/1');

  // Loop forwards to safely process in chronological order
  for (let i = 0; i < data.length; i++) {

    // --- QUOTA BRAKE ---
    if (videosAdded >= 190) {
      quotaHit = true;
      break; // Stop immediately to prevent API ban
    }

    const choice = data[i][0];   // Col A
    const duration = data[i][2]; // Col C
    const channel = data[i][3];  // Col D
    const title = data[i][4];    // Col E
    const videoId = data[i][5];  // Col F

    // Case 1: Playlist Selected
    if (choice && playlistIds[choice]) {
      try {
        addToPlaylist(playlistIds[choice], videoId);

        historyLog.push([
          new Date(), channel, title, duration, choice
        ]);

        rowsToDelete.push(i + 2);
        videosAdded++;
      } catch (e) {
        console.error(`Failed to add: ${e.message}`);
        videoSheet.getRange(i + 2, 1).setNote(`Error: ${e.message}`);
      }
    }
    // Case 2: No Selection (Discard)
    else if (!choice || choice === '') {
      historyLog.push([
        new Date(), channel, title, duration, '_DISCARD_'
      ]);

      rowsToDelete.push(i + 2);
      videosDiscarded++;
    }

    // --- PROGRESS TOAST ---
    const processedCount = i + 1;
    if (processedCount % 10 === 0) {
      ss.toast(`Processed ${processedCount} of ${data.length} videos...`, 'Progress');
    }
  }

  // Delete processed rows in reverse order to avoid shifting issues
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    videoSheet.deleteRow(rowsToDelete[i]);
  }

  // Write History Log
  if (historyLog.length > 0) {
    const startRow = historySheet.getLastRow() + 1;
    historySheet.getRange(startRow, 1, historyLog.length, 5).setValues(historyLog);
  }

  // --- AUTO-TRIM HISTORY ---
  const MAX_HISTORY_ROWS = 2000;
  const currentHistoryRows = historySheet.getLastRow();

  if (currentHistoryRows > MAX_HISTORY_ROWS) {
    const rowsToDelete = currentHistoryRows - MAX_HISTORY_ROWS;
    // Delete oldest rows (after header)
    historySheet.deleteRows(2, rowsToDelete);
    console.log(`Auto-trimmed ${rowsToDelete} old rows from History.`);
  }

  // Final Feedback
  let message = `Processing Complete.\n\nAdded: ${videosAdded}\nDiscarded: ${videosDiscarded}`;

  if (quotaHit) {
    message += `\n\n⚠️ WARNING: DAILY QUOTA LIMIT REACHED (190 Adds).\nProcessing stopped to prevent a 24-hour API ban.\nPlease wait until tomorrow to process more.`;
    SpreadsheetApp.getUi().alert(message);
  } else {
    ss.toast(message, 'Done', 5);
  }
}