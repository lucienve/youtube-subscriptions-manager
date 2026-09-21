const {
  aggregateChannelsFromPlaylistItems,
  filterPlaylistItemsToMove,
  moveVideosByChannel
} = require('../Workflow_MoveByChannel');

describe('aggregateChannelsFromPlaylistItems', () => {
  it('returns an empty array when items is empty, null, or undefined', () => {
    expect(aggregateChannelsFromPlaylistItems([])).toEqual([]);
    expect(aggregateChannelsFromPlaylistItems(null)).toEqual([]);
    expect(aggregateChannelsFromPlaylistItems(undefined)).toEqual([]);
  });

  it('aggregates channels and counts video occurrences correctly', () => {
    const items = [
      {
        snippet: {
          videoOwnerChannelId: 'UC_A',
          videoOwnerChannelTitle: 'Channel Alpha',
          resourceId: { videoId: 'v1' }
        }
      },
      {
        snippet: {
          videoOwnerChannelId: 'UC_B',
          videoOwnerChannelTitle: 'Channel Beta',
          resourceId: { videoId: 'v2' }
        }
      },
      {
        snippet: {
          videoOwnerChannelId: 'UC_A',
          videoOwnerChannelTitle: 'Channel Alpha',
          resourceId: { videoId: 'v3' }
        }
      }
    ];

    const result = aggregateChannelsFromPlaylistItems(items);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      channelId: 'UC_A',
      channelTitle: 'Channel Alpha',
      count: 2
    });
    expect(result[1]).toEqual({
      channelId: 'UC_B',
      channelTitle: 'Channel Beta',
      count: 1
    });
  });

  it('handles items with missing channel snippet fields gracefully', () => {
    const items = [
      { snippet: {} },
      { snippet: null },
      {
        snippet: {
          videoOwnerChannelId: 'UC_C'
        }
      }
    ];

    const result = aggregateChannelsFromPlaylistItems(items);
    expect(result).toHaveLength(2);
    const unknown = result.find(c => c.channelId === 'UNKNOWN_CHANNEL');
    expect(unknown).toBeDefined();
    expect(unknown.count).toBe(2);
    expect(unknown.channelTitle).toBe('Unknown / Unavailable Channel');

    const channelC = result.find(c => c.channelId === 'UC_C');
    expect(channelC).toBeDefined();
    expect(channelC.count).toBe(1);
  });

  it('sorts channels with equal counts alphabetically by title', () => {
    const items = [
      { snippet: { videoOwnerChannelId: '1', videoOwnerChannelTitle: 'Zeta' } },
      { snippet: { videoOwnerChannelId: '2', videoOwnerChannelTitle: 'Alpha' } }
    ];

    const result = aggregateChannelsFromPlaylistItems(items);
    expect(result[0].channelTitle).toBe('Alpha');
    expect(result[1].channelTitle).toBe('Zeta');
  });
});

describe('filterPlaylistItemsToMove', () => {
  const sampleItems = [
    { id: 'item1', snippet: { videoOwnerChannelId: 'UC_A', resourceId: { videoId: 'v1' } } },
    { id: 'item2', snippet: { videoOwnerChannelId: 'UC_B', resourceId: { videoId: 'v2' } } },
    { id: 'item3', snippet: { videoOwnerChannelId: 'UC_A', resourceId: { videoId: 'v3' } } },
    { id: 'item4', snippet: { videoOwnerChannelId: 'UC_C', resourceId: { videoId: 'v4' } } },
    { id: 'item5', snippet: { videoOwnerChannelId: 'UC_A', resourceId: { videoId: 'v5' } } }
  ];

  it('returns empty results when items is null or empty', () => {
    const res = filterPlaylistItemsToMove([], ['UC_A'], 50);
    expect(res.itemsToMove).toEqual([]);
    expect(res.totalMatching).toBe(0);
    expect(res.remainingCount).toBe(0);
  });

  it('filters single channel correctly within batch cap', () => {
    const res = filterPlaylistItemsToMove(sampleItems, ['UC_A'], 50);
    expect(res.totalMatching).toBe(3);
    expect(res.itemsToMove).toHaveLength(3);
    expect(res.remainingCount).toBe(0);
  });

  it('filters multiple channels correctly', () => {
    const res = filterPlaylistItemsToMove(sampleItems, ['UC_A', 'UC_C'], 50);
    expect(res.totalMatching).toBe(4);
    expect(res.itemsToMove).toHaveLength(4);
    expect(res.remainingCount).toBe(0);
  });

  it('enforces batchCap when matching items exceed cap', () => {
    const res = filterPlaylistItemsToMove(sampleItems, ['UC_A'], 2);
    expect(res.totalMatching).toBe(3);
    expect(res.itemsToMove).toHaveLength(2);
    expect(res.remainingCount).toBe(1);
    expect(res.batchCap).toBe(2);
  });

  it('clamps batchCap to 100 maximum and defaults to 50 for invalid input', () => {
    const resOver = filterPlaylistItemsToMove(sampleItems, ['UC_A'], 250);
    expect(resOver.batchCap).toBe(100);

    const resInvalid = filterPlaylistItemsToMove(sampleItems, ['UC_A'], -5);
    expect(resInvalid.batchCap).toBe(50);
  });
});

describe('moveVideosByChannel parameter validation', () => {
  it('throws error when source or destination playlist ID is missing', () => {
    expect(() => moveVideosByChannel('', 'PL_DEST', ['UC_A'], 50))
      .toThrow('Both source and destination playlists must be specified.');
    expect(() => moveVideosByChannel('PL_SRC', '', ['UC_A'], 50))
      .toThrow('Both source and destination playlists must be specified.');
  });

  it('throws error when source and destination are the same playlist', () => {
    expect(() => moveVideosByChannel('PL_SAME', 'PL_SAME', ['UC_A'], 50))
      .toThrow('Source and destination playlists cannot be the same playlist.');
  });

  it('throws error when channelIds is empty or not an array', () => {
    expect(() => moveVideosByChannel('PL_SRC', 'PL_DEST', [], 50))
      .toThrow('At least one channel must be selected.');
    expect(() => moveVideosByChannel('PL_SRC', 'PL_DEST', null, 50))
      .toThrow('At least one channel must be selected.');
  });
});
