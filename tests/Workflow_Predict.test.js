const { getSettingValue, setSettingValue } = require('../Library');
global.getSettingValue = getSettingValue;
global.setSettingValue = setSettingValue;

const { getKeywords, getDurationBucket, predictPlaylist, buildPredictionModel } = require('../Workflow_Predict');

describe('getKeywords', () => {
  it('removes stopwords and special characters', () => {
    const keywords = getKeywords("How to build a New Video App!");
    expect(keywords).toContain('build');
    expect(keywords).toContain('app');
    expect(keywords).not.toContain('how');
    expect(keywords).not.toContain('to');
    expect(keywords).not.toContain('new');
  });
});

describe('getDurationBucket', () => {
  it('buckets new decimal format', () => {
    expect(getDurationBucket(0.5)).toBe('short');
    expect(getDurationBucket(3.5)).toBe('medium');
    expect(getDurationBucket(10.2)).toBe('long');
  });

  it('buckets old colon format', () => {
    expect(getDurationBucket('0:30')).toBe('short');
    expect(getDurationBucket('3:30')).toBe('medium');
    expect(getDurationBucket('10:00')).toBe('long');
  });

  it('handles LIVE/UPCOMING', () => {
    expect(getDurationBucket('LIVE/UPCOMING')).toBe('long');
  });
});

describe('predictPlaylist', () => {
  it('returns empty string if model is null', () => {
    expect(predictPlaylist({}, null)).toBe('');
  });

  it('allows keyword matches to override channel default playlist', () => {
    const model = {
      channelStats: {
        'Channel One': {
          'Playlist A': 9,
          'Playlist B': 1
        }
      },
      channelDurationStats: {
        'Channel One': {}
      },
      channelWordStats: {
        'Channel One': {
          'foobar': {
            'Playlist B': 1
          }
        }
      },
      playlists: new Set(['Playlist A', 'Playlist B'])
    };

    const video = {
      channel: 'Channel One',
      title: 'Something with foobar keyword',
      duration: 5.0
    };

    expect(predictPlaylist(video, model)).toBe('Playlist B');
  });

  it('respects weights defined in model.weights', () => {
    const model = {
      channelStats: {
        'Channel One': {
          'Playlist A': 9,
          'Playlist B': 1
        }
      },
      channelDurationStats: {
        'Channel One': {}
      },
      channelWordStats: {
        'Channel One': {
          'foobar': {
            'Playlist B': 1
          }
        }
      },
      playlists: new Set(['Playlist A', 'Playlist B']),
      weights: {
        channel: 3.0,
        keyword: 0.5,
        duration: 1.0
      }
    };

    const video = {
      channel: 'Channel One',
      title: 'Something with foobar keyword',
      duration: 5.0
    };

    // Under weight channel: 3.0 and keyword: 0.5, Playlist A (0.9 * 3.0 = 2.7) overrides Playlist B (0.1 * 3.0 + 1.0 * 0.5 = 0.8)
    expect(predictPlaylist(video, model)).toBe('Playlist A');
  });
});

describe('buildPredictionModel', () => {
  let mockSs;
  let mockHistorySheet;
  let mockSettingsSheet;

  beforeEach(() => {
    mockHistorySheet = {
      getLastRow: jest.fn(() => 4),
      getRange: jest.fn((_row, _col, _numRows, _numCols) => ({
        getValues: jest.fn(() => [
          ['Channel One', 'foobar video', 5.0, 'Playlist B'],
          ['Channel One', 'regular video', 3.0, 'Playlist A'],
          ['Channel One', 'regular video 2', 4.0, 'Playlist A']
        ])
      }))
    };

    mockSettingsSheet = {
      values: [
        ['Last Run Time', '2026-06-10 12:00:00'],
        ['Playlist Name', 'Playlist ID']
      ],
      getLastRow: jest.fn(function () {
        return this.values.length;
      }),
      getRange: jest.fn(function (row, col, numRows, numCols) {
        const sheet = this;
        return {
          getValue: jest.fn(() => {
            if (row <= sheet.values.length && col <= 2) {
              return sheet.values[row - 1][col - 1];
            }
            return '';
          }),
          setValue: jest.fn((val) => {
            if (row <= sheet.values.length && col <= 2) {
              sheet.values[row - 1][col - 1] = val;
            } else if (row === sheet.values.length + 1 && col <= 2) {
              while (sheet.values.length < row) {
                sheet.values.push(['', '']);
              }
              sheet.values[row - 1][col - 1] = val;
            }
          }),
          getValues: jest.fn(() => {
            return sheet.values.slice(row - 1, row - 1 + numRows).map(r => r.slice(col - 1, col - 1 + numCols));
          })
        };
      }),
      insertRowBefore: jest.fn(function (rowIdx) {
        this.values.splice(rowIdx - 1, 0, ['', '']);
      })
    };

    mockSs = {
      getSheetByName: jest.fn((name) => {
        if (name === 'History') return mockHistorySheet;
        if (name === 'Settings') return mockSettingsSheet;
        return null;
      })
    };
  });

  it('populates default weights and writes them back if missing', () => {
    const model = buildPredictionModel(mockSs);
    expect(model.weights).toEqual({
      channel: 1.5,
      keyword: 2.0,
      duration: 0.5
    });

    // Check if missing settings were written back
    const channelWeightVal = getSettingValue(mockSettingsSheet, 'Weight: Channel');
    const keywordWeightVal = getSettingValue(mockSettingsSheet, 'Weight: Keyword');
    const durationWeightVal = getSettingValue(mockSettingsSheet, 'Weight: Duration');

    expect(channelWeightVal).toBe(1.5);
    expect(keywordWeightVal).toBe(2.0);
    expect(durationWeightVal).toBe(0.5);
  });

  it('reads existing weights from the Settings sheet', () => {
    mockSettingsSheet.values = [
      ['Weight: Channel', '3.5'],
      ['Weight: Keyword', '1.2'],
      ['Weight: Duration', '0.8'],
      ['Playlist Name', 'Playlist ID']
    ];

    const model = buildPredictionModel(mockSs);
    expect(model.weights).toEqual({
      channel: 3.5,
      keyword: 1.2,
      duration: 0.8
    });
  });
});
