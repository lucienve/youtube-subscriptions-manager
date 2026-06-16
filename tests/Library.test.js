const { parseDuration, escapeFormula, getDeleteRanges } = require('../Library');

describe('parseDuration', () => {
  it('converts standard ISO duration correctly', () => {
    expect(parseDuration('PT1M30S')).toBe('1.50');
    expect(parseDuration('PT5M')).toBe('5.00');
    expect(parseDuration('PT1H2M10S')).toBe('62.17');
  });

  it('handles LIVE/UPCOMING properly', () => {
    expect(parseDuration('P0D')).toBe('LIVE/UPCOMING');
    expect(parseDuration('')).toBe('LIVE/UPCOMING');
    expect(parseDuration(null)).toBe('LIVE/UPCOMING');
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
