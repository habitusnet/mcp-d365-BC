import { jest } from '@jest/globals';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const { getLatestVersion, checkVersions } = await import('../lib/versions.js');

beforeEach(() => mockFetch.mockReset());

describe('getLatestVersion', () => {
  test('returns latest version from npm registry', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ 'dist-tags': { latest: '2.1.0' } }),
    });
    const version = await getLatestVersion('@habitusnet/bc365');
    expect(version).toBe('2.1.0');
    // Verify the URL was encoded correctly
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('%40habitusnet%2Fbc365')
    );
  });

  test('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const version = await getLatestVersion('@habitusnet/bc365');
    expect(version).toBeNull();
  });

  test('returns null on fetch error (network failure)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const version = await getLatestVersion('@habitusnet/bc365');
    expect(version).toBeNull();
  });

  test('returns null when dist-tags.latest is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ 'dist-tags': {} }),
    });
    const version = await getLatestVersion('@habitusnet/bc365');
    expect(version).toBeNull();
  });
});

describe('checkVersions', () => {
  test('returns version status for all 3 packages', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ 'dist-tags': { latest: '2.1.0' } }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ 'dist-tags': { latest: '1.5.0' } }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ 'dist-tags': { latest: '3.0.0' } }) });

    const results = await checkVersions();
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.package)).toContain('@habitusnet/bc365');
    expect(results.map((r) => r.package)).toContain('@habitusnet/d365bc-admin-mcp');
    expect(results.map((r) => r.package)).toContain('@habitusnet/mcp-business-central');
    results.forEach((r) => {
      expect(r).toHaveProperty('package');
      expect(r).toHaveProperty('latest');
    });
  });

  test('handles partial failures gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ 'dist-tags': { latest: '2.1.0' } }) })
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ ok: false, status: 404 });

    const results = await checkVersions();
    expect(results).toHaveLength(3);
    expect(results[0].latest).toBe('2.1.0');
    expect(results[1].latest).toBeNull();
    expect(results[2].latest).toBeNull();
  });
});
