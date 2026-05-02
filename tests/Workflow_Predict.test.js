const { getKeywords, getDurationBucket, predictPlaylist } = require('../Workflow_Predict');

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
});
