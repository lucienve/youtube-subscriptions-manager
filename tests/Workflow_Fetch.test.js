const { SHEET_VIDEOS, SHEET_SETTINGS, SHEET_HISTORY } = require('../Main');
global.SHEET_VIDEOS = SHEET_VIDEOS;
global.SHEET_SETTINGS = SHEET_SETTINGS;
global.SHEET_HISTORY = SHEET_HISTORY;

const {
  formatMaintenanceWindow,
  formatFetchErrorAlert,
  checkNewVideos
} = require('../Workflow_Fetch');

describe('Workflow_Fetch - formatMaintenanceWindow', () => {
  it('formats time window for America/New_York', () => {
    const formatted = formatMaintenanceWindow('America/New_York');
    expect(formatted).toBe('8 PM to 7 AM EST');
  });

  it('formats time window for America/Los_Angeles', () => {
    const formatted = formatMaintenanceWindow('America/Los_Angeles');
    expect(formatted).toBe('5 PM to 4 AM PST');
  });

  it('formats time window for America/Chicago', () => {
    const formatted = formatMaintenanceWindow('America/Chicago');
    expect(formatted).toBe('7 PM to 6 AM CST');
  });

  it('formats time window for UTC', () => {
    const formatted = formatMaintenanceWindow('UTC');
    expect(formatted).toBe('1 AM to 12 PM UTC');
  });

  it('falls back to default ET label when timezone is missing or invalid', () => {
    expect(formatMaintenanceWindow(null)).toBe('8 PM to 7 AM ET');
    expect(formatMaintenanceWindow(undefined)).toBe('8 PM to 7 AM ET');
    expect(formatMaintenanceWindow('')).toBe('8 PM to 7 AM ET');
    expect(formatMaintenanceWindow('   ')).toBe('8 PM to 7 AM ET');
    expect(formatMaintenanceWindow(123)).toBe('8 PM to 7 AM ET');
    expect(formatMaintenanceWindow('Invalid/Timezone_String')).toBe('8 PM to 7 AM ET');
  });
});

describe('Workflow_Fetch - formatFetchErrorAlert', () => {
  it('returns friendly maintenance message for 404', () => {
    const alertMsg = formatFetchErrorAlert(404, 'America/New_York');
    expect(alertMsg).toBe(
      "YouTube servers appear to be undergoing routine overnight maintenance (typically 8 PM to 7 AM EST). No videos were missed. Please try checking again later."
    );
  });

  it('returns friendly maintenance message for 500 and 5xx server errors', () => {
    const alert500 = formatFetchErrorAlert(500, 'America/New_York');
    expect(alert500).toBe(
      "YouTube servers appear to be undergoing routine overnight maintenance (typically 8 PM to 7 AM EST). No videos were missed. Please try checking again later."
    );

    const alert503 = formatFetchErrorAlert(503, 'America/Los_Angeles');
    expect(alert503).toBe(
      "YouTube servers appear to be undergoing routine overnight maintenance (typically 5 PM to 4 AM PST). No videos were missed. Please try checking again later."
    );
  });

  it('returns generic error message for other status codes', () => {
    const alert403 = formatFetchErrorAlert(403, 'America/New_York');
    expect(alert403).toBe('Unable to check for new videos right now (Error 403). Please try again later.');

    const alert400 = formatFetchErrorAlert(400, 'America/New_York');
    expect(alert400).toBe('Unable to check for new videos right now (Error 400). Please try again later.');
  });
});

describe('Workflow_Fetch - checkNewVideos error handling', () => {
  let mockSs;
  let mockVideoSheet;
  let mockSettingsSheet;
  let mockLock;
  let alertMock;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockLock = {
      tryLock: jest.fn(() => true),
      releaseLock: jest.fn()
    };
    global.LockService = {
      getDocumentLock: jest.fn(() => mockLock)
    };

    alertMock = jest.fn();
    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => mockSs),
      getUi: jest.fn(() => ({ alert: alertMock }))
    };

    mockVideoSheet = {
      getLastRow: jest.fn(() => 1),
      getRange: jest.fn(() => ({
        getValues: jest.fn(() => [])
      }))
    };

    mockSettingsSheet = {};

    mockSs = {
      getSheetByName: jest.fn(name => {
        if (name === SHEET_VIDEOS) return mockVideoSheet;
        if (name === SHEET_SETTINGS) return mockSettingsSheet;
        return null;
      }),
      getSpreadsheetTimeZone: jest.fn(() => 'America/New_York'),
      toast: jest.fn()
    };

    global.refreshPlaylistConfig = jest.fn(() => ({ 'Favorites': 'PL_123' }));
    global.buildPredictionModel = jest.fn(() => ({}));
    global.getSettingValue = jest.fn((_sheet, label) => {
      if (label === 'Last Run Time') return '2026-11-01T12:00:00-05:00';
      if (label === 'Last Subscription Count') return 1;
      return '';
    });
    global.setSettingValue = jest.fn();
    global.getAllSubscriptions = jest.fn(() => ['UC_CHAN_1']);
    global.XmlService = {
      getNamespace: jest.fn(() => ({})),
      parse: jest.fn()
    };
    global.UrlFetchApp = {
      fetchAll: jest.fn()
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('displays user-friendly maintenance alert and aborts on 404 without updating Last Run Time', () => {
    global.UrlFetchApp.fetchAll.mockReturnValueOnce([
      {
        getResponseCode: () => 404,
        getContentText: () => '<!DOCTYPE html><html>404 Not Found</html>'
      }
    ]);

    checkNewVideos();

    expect(alertMock).toHaveBeenCalledWith(
      "YouTube servers appear to be undergoing routine overnight maintenance (typically 8 PM to 7 AM EST). No videos were missed. Please try checking again later."
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('HTTP Error 404 fetching feed for channel UC_CHAN_1. Scan aborted.')
    );
    expect(global.setSettingValue).not.toHaveBeenCalled();
    expect(mockLock.releaseLock).toHaveBeenCalled();
  });

  it('displays user-friendly maintenance alert and aborts on 500 without updating Last Run Time', () => {
    global.UrlFetchApp.fetchAll.mockReturnValueOnce([
      {
        getResponseCode: () => 500,
        getContentText: () => '<!DOCTYPE html><html>500 Internal Server Error</html>'
      }
    ]);

    checkNewVideos();

    expect(alertMock).toHaveBeenCalledWith(
      "YouTube servers appear to be undergoing routine overnight maintenance (typically 8 PM to 7 AM EST). No videos were missed. Please try checking again later."
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('HTTP Error 500 fetching feed for channel UC_CHAN_1. Scan aborted.')
    );
    expect(global.setSettingValue).not.toHaveBeenCalled();
    expect(mockLock.releaseLock).toHaveBeenCalled();
  });

  it('displays generic error alert on 403 without updating Last Run Time', () => {
    global.UrlFetchApp.fetchAll.mockReturnValueOnce([
      {
        getResponseCode: () => 403,
        getContentText: () => 'Forbidden'
      }
    ]);

    checkNewVideos();

    expect(alertMock).toHaveBeenCalledWith(
      'Unable to check for new videos right now (Error 403). Please try again later.'
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('HTTP Error 403 fetching feed for channel UC_CHAN_1. Scan aborted.')
    );
    expect(global.setSettingValue).not.toHaveBeenCalled();
    expect(mockLock.releaseLock).toHaveBeenCalled();
  });
});
