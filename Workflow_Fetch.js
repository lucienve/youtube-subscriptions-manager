// Version: 1.3
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
  let lastRunStr = settingsSheet.getRange('B1').getValue();
  let lastRunDate = new Date(lastRunStr);
  
  if (isNaN(lastRunDate.getTime())) {
    SpreadsheetApp.getUi().alert('Invalid date in Settings!B1.');
    return;
  }

  // 3. Get All Subscriptions
  ss.toast('Fetching subscription list...', 'Step 1/4');
  const channels = getAllSubscriptions();
  if (channels.length === 0) {
    SpreadsheetApp.getUi().alert('No subscriptions found.');
    return;
  }

  // --- RSS SCANNING ---
  const BATCH_SIZE = 20; 
  let potentialVideos = [];
  
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
      responses.forEach(response => {
        if (response.getResponseCode() === 200) {
          try {
            const xml = XmlService.parse(response.getContentText());
            const root = xml.getRootElement();
            const entries = root.getChildren('entry', ns);

            for (const entry of entries) {
              const publishedStr = entry.getChild('published', ns).getText();
              const publishedDate = new Date(publishedStr);

              if (publishedDate > lastRunDate) {
                const videoId = entry.getChild('videoId', ytNs).getText();
                const title = entry.getChild('title', ns).getText();
                const channelName = entry.getChild('author', ns).getChild('name', ns).getText();
                
                let thumbUrl = '';
                const group = entry.getChild('group', mediaNs);
                if (group) {
                  const thumb = group.getChild('thumbnail', mediaNs);
                  if (thumb) thumbUrl = thumb.getAttribute('url').getValue();
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
          } catch (e) { console.log('XML Error: ' + e.message); }
        }
      });
    } catch (e) { console.log('Batch Error: ' + e.message); }
    Utilities.sleep(1000); 
  }

  if (potentialVideos.length === 0) {
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
      if (response.items) {
        response.items.forEach(item => {
          durationMap[item.id] = parseDuration(item.contentDetails.duration);
        });
      }
    } catch (e) { console.log('API Error: ' + e.message); }
  }

  // --- APPLY PREDICTIONS ---
  potentialVideos.forEach(v => {
    v.duration = durationMap[v.id] || 'N/A';
    v.suggestion = predictPlaylist(v, model);
  });

  // 4. Sort and Write
  ss.toast('Sorting and writing...', 'Step 4/4');
  potentialVideos.sort((a, b) => a.date - b.date);

  const rows = potentialVideos.map(v => [
    v.suggestion, 
    v.thumb ? SpreadsheetApp.newCellImage().setSourceUrl(v.thumb).build() : '', 
    v.duration, 
    v.channel,  
    v.title,    
    v.id,       
    v.date      
  ]);

  const startRow = videoSheet.getLastRow() + 1;
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

  const newestDate = potentialVideos[potentialVideos.length - 1].date;
  settingsSheet.getRange('B1').setValue(Utilities.formatDate(newestDate, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"));
  
  ss.toast(`Done! Found ${potentialVideos.length} new videos.`, 'Complete', 5);

  // NEW LINE: Select cell A2 so you can start typing immediately
  videoSheet.getRange('A2').activate(); 
}