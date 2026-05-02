// Version: 1.1.1
// Purpose: Configuration constants and Menu setup.

// --- CONFIGURATION ---
const SHEET_VIDEOS = 'Videos';
const SHEET_SETTINGS = 'Settings';

/**
 * Creates the custom menu in the Google Sheets UI when the spreadsheet is opened.
 * No parameters.
 * No return value.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('YouTube Tools')
    .addItem('1. Check New Videos', 'checkNewVideos')
    .addItem('2. Process Selected', 'processSelectedVideos')
    .addToUi();
}