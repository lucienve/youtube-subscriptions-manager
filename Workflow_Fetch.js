// Version: 1.4
// Purpose: Main logic for fetching videos via RSS, getting details via API, and running predictions.

/**
 * Main orchestration function.
 * 1. Fetches new video feeds via RSS.
 * 2. Filters for videos newer than the last run.
 * 3. Fetches details (duration) via YouTube API.
 * 4. Predicts destination playlists using the history model.
 * 5. Writes results to the 'Videos' sheet.
 *
 * No parameters.
 * No return value.
 */
function checkNewVideos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  const videoSheet = ss.getSheetByName(SHEET_VIDEOS);

  if (!settingsSheet || !videoSheet) {
    SpreadsheetApp.getUi().alert(`Required sheet(s) "${SHEET_SETTINGS}" or "${SHEET_VIDEOS}" not found.`);
    return;
  }

  const lock = (typeof LockService !== 'undefined') ? LockService.getDocumentLock() : null;
  if (lock && !lock.tryLock(0)) {
    SpreadsheetApp.getUi().alert('Another YouTube Tools operation is currently running. Please wait for it to complete.');
    return;
  }

  try {
    // 1. Refresh Playlist Config
    const playlistMap = refreshPlaylistConfig(settingsSheet);
    const playlistNames = Object.keys(playlistMap);

    if (playlistNames.length === 0) {
      SpreadsheetApp.getUi().alert('No playlists found. Please check Settings.');
      return;
    }

    // --- BUILD PREDICTION MODEL ---
    ss.toast('Analyzing history...', 'Step 0/4');
    const model = buildPredictionModel(ss);

    // 2. Get Last Run Time
    const lastRunVal = getSettingValue(settingsSheet, 'Last Run Time');
    let lastRunDate;

    if (lastRunVal === null || lastRunVal === undefined || String(lastRunVal).trim() === '') {
      lastRunDate = new Date();
      lastRunDate.setDate(lastRunDate.getDate() - 7);
      ss.toast('\'Last Run Time\' empty. Defaulting to fetching videos from the last 7 days.', 'First Run');
    } else if (lastRunVal instanceof Date) {
      lastRunDate = lastRunVal;
    } else {
      lastRunDate = new Date(lastRunVal);
      if (isNaN(lastRunDate.getTime())) {
        SpreadsheetApp.getUi().alert('Invalid date in Settings for \'Last Run Time\'. Please use an ISO format like "YYYY-MM-DDTHH:MM:SS" or leave it blank.');
        return;
      }
    }

    // 3. Get All Subscriptions
    ss.toast('Fetching subscription list...', 'Step 1/4');
    const channels = getAllSubscriptions();
    if (!channels) {
      // Error occurred and was already reported by getAllSubscriptions
      return;
    }
    if (channels.length === 0) {
      SpreadsheetApp.getUi().alert('No subscriptions found.');
      return;
    }

    // --- SUBSCRIPTION GUARDRAIL ---
    const lastSubCountVal = getSettingValue(settingsSheet, 'Last Subscription Count');
    const lastSubCount = parseInt(lastSubCountVal, 10);
    if (!isNaN(lastSubCount) && lastSubCountVal !== '') {
      const subDiff = Math.abs(channels.length - lastSubCount);
      if (subDiff > 10) {
        const ui = SpreadsheetApp.getUi();
        const response = ui.alert(
          'Warning: Subscription Count Discrepancy',
          `The number of fetched subscriptions (${channels.length}) differs from the last run (${lastSubCount}) by ${subDiff}.\n\nDo you wish to proceed?`,
          ui.ButtonSet.YES_NO
        );
        if (response !== ui.Button.YES) {
          ss.toast('Run cancelled by user due to subscription count discrepancy.', 'Cancelled');
          return;
        }
      }
    }

    // --- EXISTING VIDEO IDS IN INBOX (FOR DEDUPLICATION) ---
    const existingIds = new Set();
    const existingLastRow = videoSheet.getLastRow();
    if (existingLastRow >= 2) {
      const colFData = videoSheet.getRange(2, 6, existingLastRow - 1, 1).getValues();
      for (let k = 0; k < colFData.length; k++) {
        const val = String(colFData[k][0] || '').replace(/^'/, '').trim();
        if (val) existingIds.add(val);
      }
    }

    // --- RSS SCANNING ---
    const BATCH_SIZE = 20; 
    const potentialVideos = [];
    const seenScanVideoIds = new Set();
    let newestSeenDate = null;
    
    const ns = XmlService.getNamespace('http://www.w3.org/2005/Atom');
    const ytNs = XmlService.getNamespace('http://www.youtube.com/xml/schemas/2015');
    const mediaNs = XmlService.getNamespace('http://search.yahoo.com/mrss/');

    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
      const currentEnd = Math.min(i + BATCH_SIZE, channels.length);
      ss.toast(`Scanning channels ${i + 1} to ${currentEnd}...`, 'Step 2/4: Scanning');

      const batch = channels.slice(i, i + BATCH_SIZE);
      const requests = batch.map(id => ({
        url: `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`,
        muteHttpExceptions: true
      }));

      try {
        const responses = UrlFetchApp.fetchAll(requests);
        for (let j = 0; j < responses.length; j++) {
          const response = responses[j];

          if (response.getResponseCode() !== 200) {
            const errMsg = `HTTP Error ${response.getResponseCode()} fetching feed for channel ${batch[j]}. Scan aborted.`;
            console.error(errMsg);
            SpreadsheetApp.getUi().alert('Fetch Error: ' + errMsg);
            return;
          }

          try {
            const xml = XmlService.parse(response.getContentText());
            const root = xml.getRootElement();
            const entries = root.getChildren('entry', ns);

            for (const entry of entries) {
              const publishedChild = entry.getChild('published', ns);
              if (!publishedChild) {
                throw new Error(`Entry missing <published> tag for channel ${batch[j]}`);
              }
              const publishedDate = new Date(publishedChild.getText());
              if (isNaN(publishedDate.getTime())) {
                throw new Error(`Invalid <published> date format for channel ${batch[j]}`);
              }

              if (publishedDate > lastRunDate) {
                if (!newestSeenDate || publishedDate > newestSeenDate) {
                  newestSeenDate = publishedDate;
                }

                const videoIdChild = entry.getChild('videoId', ytNs);
                const titleChild = entry.getChild('title', ns);
                const authorChild = entry.getChild('author', ns);
                const nameChild = authorChild ? authorChild.getChild('name', ns) : null;

                if (!videoIdChild || !titleChild || !nameChild) {
                  throw new Error(`Entry missing videoId, title, or author name for channel ${batch[j]}`);
                }

                const videoId = videoIdChild.getText();
                const title = titleChild.getText();
                const channelName = nameChild.getText();

                // Skip videos already present in the inbox or duplicate across feeds
                if (!existingIds.has(videoId) && !seenScanVideoIds.has(videoId)) {
                  seenScanVideoIds.add(videoId);

                  let thumbUrl = '';
                  const group = entry.getChild('group', mediaNs);
                  if (group) {
                    const thumb = group.getChild('thumbnail', mediaNs);
                    if (thumb && thumb.getAttribute('url')) {
                      thumbUrl = thumb.getAttribute('url').getValue();
                    }
                  }

                  potentialVideos.push({
                    channel: channelName,
                    title: title,
                    id: videoId,
                    date: publishedDate,
                    thumb: thumbUrl,
                    duration: '',
                    suggestion: '' // For our AI guess
                  });
                }
              }
            }
          } catch (e) {
            const errMsg = `XML Error parsing feed for channel ${batch[j]}: ${e.message}. Scan aborted.`;
            console.error(errMsg);
            SpreadsheetApp.getUi().alert('Fetch Error: ' + errMsg);
            return;
          }
        }
      } catch (e) {
        const errMsg = `Network/Batch Error: ${e.message}. Scan aborted.`;
        console.error(errMsg);
        SpreadsheetApp.getUi().alert('Fetch Error: ' + errMsg);
        return;
      }

      if (i + BATCH_SIZE < channels.length) {
        Utilities.sleep(1000);
      }
    }

    if (potentialVideos.length === 0) {
      if (newestSeenDate) {
        const formattedNewest = Utilities.formatDate(newestSeenDate, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
        setSettingValue(settingsSheet, 'Last Run Time', formattedNewest);
      }
      setSettingValue(settingsSheet, 'Last Subscription Count', channels.length);
      ss.toast('No new videos found.', 'Complete', 5);
      return;
    }

    // --- FETCH DURATIONS ---
    ss.toast(`Fetching details...`, 'Step 3/4');
    
    const videoIds = potentialVideos.map(v => v.id);
    const durationMap = {};
    
    for (let i = 0; i < videoIds.length; i += 50) {
      const idBatch = videoIds.slice(i, i + 50).join(',');
      try {
        const response = YouTube.Videos.list('contentDetails', { id: idBatch });
        if (response && response.items) {
          response.items.forEach(item => {
            if (item && item.id && item.contentDetails && item.contentDetails.duration) {
              durationMap[item.id] = parseDuration(item.contentDetails.duration);
            }
          });
        }
      } catch (e) {
        console.error('API Error: ' + e.message);
        ss.toast('Error fetching video durations. Some details may be missing.', 'API Error', 5);
      }
    }

    // --- APPLY PREDICTIONS ---
    potentialVideos.forEach(v => {
      v.duration = durationMap[v.id] || 'N/A';
      const rawSuggestion = predictPlaylist(v, model);
      // Validate suggestion against active configured playlists so retired playlists don't pollute cells
      v.suggestion = (rawSuggestion && playlistMap[rawSuggestion]) ? rawSuggestion : '';
    });

    // 4. Sort and Write
    ss.toast('Sorting and writing...', 'Step 4/4');
    potentialVideos.sort((a, b) => a.date - b.date);

    const rows = potentialVideos.map(v => [
      escapeFormula(v.suggestion),
      v.thumb ? SpreadsheetApp.newCellImage().setSourceUrl(v.thumb).build() : '', 
      escapeFormula(v.duration),
      escapeFormula(v.channel),
      escapeFormula(v.title),
      /^[A-Za-z0-9_-]+$/.test(v.id) ? v.id : escapeFormula(v.id),
      v.date      
    ]);

    const startRow = videoSheet.getLastRow() + 1;
    // Format Column F as Plain Text before setting values to prevent numeric coercion of IDs
    videoSheet.getRange(startRow, 6, rows.length, 1).setNumberFormat('@');

    const targetRange = videoSheet.getRange(startRow, 1, rows.length, 7);
    targetRange.setValues(rows);

    // Apply Validation
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(playlistNames, true)
      .setAllowInvalid(false)
      .build();
    videoSheet.getRange(startRow, 1, rows.length, 1).setDataValidation(rule);
    
    // Highlighting Suggestions
    const backgrounds = rows.map(row => {
      const hasSuggestion = (row[0] !== '' && row[0] !== null);
      return hasSuggestion 
        ? ['#fff2cc', null, null, null, null, null, null] 
        : [null, null, null, null, null, null, null];
    });
    targetRange.setBackgrounds(backgrounds);

    videoSheet.setRowHeights(startRow, rows.length, 95);

    const latestDateToRecord = newestSeenDate || potentialVideos[potentialVideos.length - 1].date;
    const formattedDate = Utilities.formatDate(latestDateToRecord, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
    setSettingValue(settingsSheet, 'Last Run Time', formattedDate);
    setSettingValue(settingsSheet, 'Last Subscription Count', channels.length);
    
    ss.toast(`Done! Found ${potentialVideos.length} new videos.`, 'Complete', 5);

    // Select cell A2 so you can start typing immediately
    videoSheet.getRange('A2').activate(); 
  } finally {
    if (lock) {
      lock.releaseLock();
    }
  }
}
