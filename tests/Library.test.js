const {
  parseDuration,
  escapeFormula,
  getDeleteRanges,
  isQuotaExceededError,
  getAllSubscriptions,
  refreshPlaylistConfig
} = require('../Library');

describe('parseDuration', () => {
  it('converts standard ISO duration correctly', () => {
    expect(parseDuration('PT1M30S')).toBe('1.50');
    expect(parseDuration('PT5M')).toBe('5.00');
    expect(parseDuration('PT1H2M10S')).toBe('62.17');
  });

  it('handles durations >= 24 hours with day component', () => {
    expect(parseDuration('P1D')).toBe('1440.00');
    expect(parseDuration('P1DT2H15M')).toBe('1575.00');
    expect(parseDuration('P2DT30S')).toBe('2880.50');
  });

  it('handles LIVE/UPCOMING properly', () => {
    expect(parseDuration('P0D')).toBe('LIVE/UPCOMING');
    expect(parseDuration('')).toBe('LIVE/UPCOMING');
    expect(parseDuration(null)).toBe('LIVE/UPCOMING');
    expect(parseDuration('INVALID')).toBe('LIVE/UPCOMING');
  });
});

describe('escapeFormula', () => {
  it('escapes strings starting with operators', () => {
    expect(escapeFormula('=SUM(A1:A2)')).toBe("'=" + "SUM(A1:A2)");
    expect(escapeFormula('+123')).toBe("'+123");
    expect(escapeFormula('-123')).toBe("'-123");
    expect(escapeFormula('@var')).toBe("'@var");
  });

  it('ignores normal strings', () => {
    expect(escapeFormula('Hello World')).toBe('Hello World');
    expect(escapeFormula('1234')).toBe('1234');
  });
});

describe('getDeleteRanges', () => {
  it('returns empty array when input is empty or null', () => {
    expect(getDeleteRanges([])).toEqual([]);
    expect(getDeleteRanges(null)).toEqual([]);
  });

  it('handles a single row deletion', () => {
    expect(getDeleteRanges([5])).toEqual([{ start: 5, count: 1 }]);
  });

  it('handles a single contiguous range', () => {
    expect(getDeleteRanges([2, 3, 4])).toEqual([{ start: 2, count: 3 }]);
  });

  it('handles multiple disjoint contiguous ranges', () => {
    expect(getDeleteRanges([2, 3, 4, 6, 7, 9])).toEqual([
      { start: 2, count: 3 },
      { start: 6, count: 2 },
      { start: 9, count: 1 }
    ]);
  });
});

describe('isQuotaExceededError', () => {
  it('detects quota error in message', () => {
    expect(isQuotaExceededError(new Error('The user has exceeded their dailyLimitExceeded quota.'))).toBe(true);
    expect(isQuotaExceededError({ message: 'quotaExceeded' })).toBe(true);
    expect(isQuotaExceededError('YouTube quota exceeded')).toBe(true);
  });

  it('detects quota error in error.cause', () => {
    const rootErr = new Error('quotaExceeded');
    const outerErr = new Error('Playlist insertion failed', { cause: rootErr });
    expect(isQuotaExceededError(outerErr)).toBe(true);
  });

  it('detects quota error in details.errors array', () => {
    const apiErr = {
      message: 'Request failed',
      details: {
        errors: [{ reason: 'quotaExceeded' }]
      }
    };
    expect(isQuotaExceededError(apiErr)).toBe(true);
  });

  it('returns false for non-quota errors and falsy inputs', () => {
    expect(isQuotaExceededError(null)).toBe(false);
    expect(isQuotaExceededError(undefined)).toBe(false);
    expect(isQuotaExceededError(new Error('videoNotFound'))).toBe(false);
    expect(isQuotaExceededError(new Error('Invalid credentials'))).toBe(false);
  });
});

describe('getAllSubscriptions', () => {
  let alertMock;

  beforeEach(() => {
    alertMock = jest.fn();
    global.SpreadsheetApp = {
      getUi: jest.fn(() => ({
        alert: alertMock
      }))
    };
    global.YouTube = {
      Subscriptions: {
        list: jest.fn()
      }
    };
  });

  it('returns array of channel IDs when successful', () => {
    global.YouTube.Subscriptions.list
      .mockReturnValueOnce({
        items: [
          { snippet: { resourceId: { channelId: 'UC_1' } } },
          { snippet: { resourceId: { channelId: 'UC_2' } } }
        ],
        nextPageToken: 'page2'
      })
      .mockReturnValueOnce({
        items: [
          { snippet: { resourceId: { channelId: 'UC_3' } } }
        ],
        nextPageToken: null
      });

    const channels = getAllSubscriptions();
    expect(channels).toEqual(['UC_1', 'UC_2', 'UC_3']);
  });

  it('returns null on error rather than returning a partial list', () => {
    global.YouTube.Subscriptions.list
      .mockReturnValueOnce({
        items: [{ snippet: { resourceId: { channelId: 'UC_1' } } }],
        nextPageToken: 'page2'
      })
      .mockImplementationOnce(() => {
        throw new Error('Backend error');
      });

    const channels = getAllSubscriptions();
    expect(channels).toBeNull();
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Error fetching subscriptions: Backend error'));
  });
});

describe('refreshPlaylistConfig', () => {
  it('trims names and IDs from Settings sheet', () => {
    const mockSheet = {
      getLastRow: jest.fn(() => 3),
      getRange: jest.fn(() => ({
        getValues: jest.fn(() => [
          ['Playlist Name', 'Playlist ID'],
          ['  Favorites  ', '  PL_123  '],
          ['Podcasts', 'PL_456']
        ])
      }))
    };

    const map = refreshPlaylistConfig(mockSheet);
    expect(map).toEqual({
      'Favorites': 'PL_123',
      'Podcasts': 'PL_456'
    });
  });
});
