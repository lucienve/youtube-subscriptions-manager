const { SHEET_VIDEOS, SHEET_SETTINGS, SHEET_HISTORY } = require('../Main');
global.SHEET_VIDEOS = SHEET_VIDEOS;
global.SHEET_SETTINGS = SHEET_SETTINGS;
global.SHEET_HISTORY = SHEET_HISTORY;

const {
  isQuotaExceededError,
  refreshPlaylistConfig,
  addToPlaylist,
  escapeFormula,
  getDeleteRanges
} = require('../Library');

global.isQuotaExceededError = isQuotaExceededError;
global.refreshPlaylistConfig = refreshPlaylistConfig;
global.addToPlaylist = addToPlaylist;
global.escapeFormula = escapeFormula;
global.getDeleteRanges = getDeleteRanges;

const { processSelectedVideos } = require('../Workflow_Process');

describe('Workflow_Process - processSelectedVideos', () => {
  let mockSs;
  let mockVideoSheet;
  let mockSettingsSheet;
  let mockHistorySheet;
  let mockLock;
  let alertMock;

  beforeEach(() => {
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
    global.YouTube = {
      PlaylistItems: {
        insert: jest.fn()
      }
    };

    mockVideoSheet = {
      getLastRow: jest.fn(() => 4),
      getMaxRows: jest.fn(() => 10),
      getFrozenRows: jest.fn(() => 1),
      getRange: jest.fn((_row, _col, _numRows) => ({
        getValues: jest.fn(() => [
          ['Favorites', '', '5.00', 'ChanA', 'Title 1', 'vid1', new Date()],
          ['', '', '3.00', 'ChanB', 'Title 2', 'vid2', new Date()],
          ['UnknownPlaylist', '', '2.00', 'ChanC', 'Title 3', 'vid3', new Date()]
        ]),
        setNote: jest.fn(),
        setBackground: jest.fn(() => ({
          clearDataValidations: jest.fn(() => ({
            clearNote: jest.fn()
          }))
        })),
        activate: jest.fn()
      })),
      deleteRows: jest.fn(),
      insertRowsAfter: jest.fn(),
      setRowHeights: jest.fn()
    };

    mockSettingsSheet = {
      getLastRow: jest.fn(() => 2),
      getRange: jest.fn(() => ({
        getValues: jest.fn(() => [
          ['Playlist Name', 'Playlist ID'],
          ['Favorites', 'PL_FAV_123']
        ])
      }))
    };

    mockHistorySheet = {
      getLastRow: jest.fn(() => 1),
      getRange: jest.fn(() => ({
        setValues: jest.fn()
      })),
      deleteRows: jest.fn()
    };

    mockSs = {
      getSheetByName: jest.fn(name => {
        if (name === SHEET_VIDEOS) return mockVideoSheet;
        if (name === SHEET_SETTINGS) return mockSettingsSheet;
        if (name === SHEET_HISTORY) return mockHistorySheet;
        return null;
      }),
      toast: jest.fn()
    };
  });

  it('alerts and exits when a required sheet is missing', () => {
    mockSs.getSheetByName.mockReturnValue(null);
    processSelectedVideos();
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Required sheet(s)'));
  });

  it('alerts and exits when lock cannot be acquired', () => {
    mockLock.tryLock.mockReturnValue(false);
    processSelectedVideos();
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Another YouTube Tools operation is currently running'));
  });

  it('alerts when no videos to process (lastRow < 2)', () => {
    mockVideoSheet.getLastRow.mockReturnValue(1);
    processSelectedVideos();
    expect(alertMock).toHaveBeenCalledWith('No videos to process.');
    expect(mockLock.releaseLock).toHaveBeenCalled();
  });

  it('processes playlist choices, discards, and marks invalid choices with notes', () => {
    processSelectedVideos();

    // Favorites should be added to playlist
    expect(global.YouTube.PlaylistItems.insert).toHaveBeenCalledWith({
      snippet: {
        playlistId: 'PL_FAV_123',
        resourceId: { kind: 'youtube#video', videoId: 'vid1' }
      }
    }, 'snippet');

    // Rows 2 and 3 should be deleted (Favorites and Discard), Row 4 (UnknownPlaylist) kept with note
    expect(mockVideoSheet.deleteRows).toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Failed / Unresolved: 1'));
    expect(mockLock.releaseLock).toHaveBeenCalled();
  });

  it('breaks early on quotaExceeded error', () => {
    global.YouTube.PlaylistItems.insert.mockImplementation(() => {
      throw new Error('The user has exceeded their dailyLimitExceeded quota.');
    });

    processSelectedVideos();

    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('WARNING: DAILY QUOTA LIMIT REACHED'));
    expect(mockLock.releaseLock).toHaveBeenCalled();
  });
});
