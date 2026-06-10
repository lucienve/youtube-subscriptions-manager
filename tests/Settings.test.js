const { getSettingValue, setSettingValue } = require('../Library');

describe('Settings Parsing Functions', () => {
  let mockSheet;

  beforeEach(() => {
    mockSheet = {
      values: [],
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
  });

  it('getSettingValue returns correct value if setting exists', () => {
    mockSheet.values = [
      ['Last Run Time', '2026-06-10 12:00:00'],
      ['Playlist Name', 'Playlist ID']
    ];
    expect(getSettingValue(mockSheet, 'Last Run Time')).toBe('2026-06-10 12:00:00');
    expect(getSettingValue(mockSheet, 'last run time')).toBe('2026-06-10 12:00:00');
    expect(getSettingValue(mockSheet, 'Nonexistent')).toBe('');
  });

  it('setSettingValue updates existing value', () => {
    mockSheet.values = [
      ['Last Run Time', '2026-06-10 12:00:00'],
      ['Playlist Name', 'Playlist ID']
    ];
    setSettingValue(mockSheet, 'Last Run Time', '2026-06-10 13:00:00');
    expect(getSettingValue(mockSheet, 'Last Run Time')).toBe('2026-06-10 13:00:00');
  });

  it('setSettingValue inserts new setting row before playlist headers if setting does not exist', () => {
    mockSheet.values = [
      ['Last Run Time', '2026-06-10 12:00:00'],
      ['Playlist Name', 'Playlist ID'],
      ['My Favorites', 'PL123']
    ];
    
    setSettingValue(mockSheet, 'Last Subscription Count', 290);
    
    expect(mockSheet.values).toEqual([
      ['Last Run Time', '2026-06-10 12:00:00'],
      ['Last Subscription Count', 290],
      ['Playlist Name', 'Playlist ID'],
      ['My Favorites', 'PL123']
    ]);
  });

  it('setSettingValue appends to end if playlist headers do not exist', () => {
    mockSheet.values = [
      ['Last Run Time', '2026-06-10 12:00:00']
    ];
    setSettingValue(mockSheet, 'Last Subscription Count', 290);
    expect(mockSheet.values).toEqual([
      ['Last Run Time', '2026-06-10 12:00:00'],
      ['Last Subscription Count', 290]
    ]);
  });
});
