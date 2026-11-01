const { refreshPlaylistConfig, isQuotaExceededError } = require('../Library');
global.refreshPlaylistConfig = refreshPlaylistConfig;
global.isQuotaExceededError = isQuotaExceededError;

const { getPlaylistNames, deduplicatePlaylist } = require('../Workflow_Deduplicate');

describe('Workflow_Deduplicate', () => {
  let mockSs;
  let mockSettingsSheet;
  let mockLock;

  beforeEach(() => {
    mockLock = {
      tryLock: jest.fn(() => true),
      releaseLock: jest.fn()
    };
    global.LockService = {
      getDocumentLock: jest.fn(() => mockLock)
    };
    mockSettingsSheet = {
      getLastRow: jest.fn(() => 3),
      getRange: jest.fn(() => ({
        getValues: jest.fn(() => [
          ['Playlist Name', 'Playlist ID'],
          ['Favorites', 'PL_123'],
          ['Watch Next', 'PL_456']
        ])
      }))
    };
    mockSs = {
      getSheetByName: jest.fn(name => {
        if (name === 'Settings') return mockSettingsSheet;
        return null;
      }),
      toast: jest.fn()
    };
    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => mockSs),
      getUi: jest.fn(() => ({ alert: jest.fn() }))
    };
    global.YouTube = {
      PlaylistItems: {
        list: jest.fn(),
        remove: jest.fn()
      }
    };
    global.Utilities = {
      sleep: jest.fn()
    };
  });

  describe('getPlaylistNames', () => {
    it('returns array of playlist names from Settings sheet', () => {
      const names = getPlaylistNames();
      expect(names).toEqual(['Favorites', 'Watch Next']);
    });

    it('returns empty array if Settings sheet does not exist', () => {
      mockSs.getSheetByName.mockReturnValue(null);
      expect(getPlaylistNames()).toEqual([]);
    });
  });

  describe('deduplicatePlaylist', () => {
    it('throws error when Settings sheet is not found', () => {
      mockSs.getSheetByName.mockReturnValue(null);
      expect(() => deduplicatePlaylist('Favorites')).toThrow('Settings sheet not found.');
    });

    it('throws error when playlist ID is not found in Settings', () => {
      expect(() => deduplicatePlaylist('Unknown Playlist')).toThrow('Playlist ID not found for: Unknown Playlist');
    });

    it('throws error when lock cannot be acquired', () => {
      mockLock.tryLock.mockReturnValue(false);
      expect(() => deduplicatePlaylist('Favorites')).toThrow('Another YouTube Tools operation is currently running');
    });

    it('throws error if YouTube.PlaylistItems.list fails', () => {
      global.YouTube.PlaylistItems.list.mockImplementation(() => {
        throw new Error('API failure');
      });
      expect(() => deduplicatePlaylist('Favorites')).toThrow('Error fetching playlist items: API failure');
      expect(mockLock.releaseLock).toHaveBeenCalled();
    });

    it('does nothing when no duplicates exist', () => {
      global.YouTube.PlaylistItems.list.mockReturnValue({
        items: [
          { id: 'item1', snippet: { resourceId: { videoId: 'v1' } } },
          { id: 'item2', snippet: { resourceId: { videoId: 'v2' } } }
        ],
        nextPageToken: null
      });

      deduplicatePlaylist('Favorites');
      expect(global.YouTube.PlaylistItems.remove).not.toHaveBeenCalled();
      expect(mockSs.toast).toHaveBeenCalledWith('No duplicates found.', 'Complete', 5);
      expect(mockLock.releaseLock).toHaveBeenCalled();
    });

    it('removes duplicate occurrences while preserving first occurrence', () => {
      global.YouTube.PlaylistItems.list.mockReturnValue({
        items: [
          { id: 'item1', snippet: { resourceId: { videoId: 'v1' } } },
          { id: 'item2', snippet: { resourceId: { videoId: 'v2' } } },
          { id: 'item3', snippet: { resourceId: { videoId: 'v1' } } }, // dup of v1
          { id: 'item4', snippet: { resourceId: { videoId: 'v2' } } }  // dup of v2
        ],
        nextPageToken: null
      });

      deduplicatePlaylist('Favorites');
      expect(global.YouTube.PlaylistItems.remove).toHaveBeenCalledWith('item3');
      expect(global.YouTube.PlaylistItems.remove).toHaveBeenCalledWith('item4');
      expect(global.YouTube.PlaylistItems.remove).toHaveBeenCalledTimes(2);
      expect(mockSs.toast).toHaveBeenCalledWith('Removed 2 duplicates successfully.', 'Complete', 10);
      expect(mockLock.releaseLock).toHaveBeenCalled();
    });

    it('throws error and reports partial progress if removals fail', () => {
      global.YouTube.PlaylistItems.list.mockReturnValue({
        items: [
          { id: 'item1', snippet: { resourceId: { videoId: 'v1' } } },
          { id: 'item2', snippet: { resourceId: { videoId: 'v1' } } }
        ],
        nextPageToken: null
      });
      global.YouTube.PlaylistItems.remove.mockImplementation(() => {
        throw new Error('quotaExceeded');
      });

      expect(() => deduplicatePlaylist('Favorites')).toThrow(/0 duplicates, but 1 removal\(s\) failed/);
      expect(mockLock.releaseLock).toHaveBeenCalled();
    });
  });
});
