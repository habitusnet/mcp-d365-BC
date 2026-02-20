import { jest } from '@jest/globals';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const { getEnvironments, getCompanies, getPermissions } = await import('../lib/discovery.js');

const MOCK_TOKEN = { accessToken: 'test-token' };

beforeEach(() => mockFetch.mockReset());

describe('getEnvironments', () => {
  test('returns list of environments from BC admin API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        value: [
          { name: 'Production', type: 'Production', aadTenantId: 'tenant-123' },
          { name: 'Sandbox', type: 'Sandbox', aadTenantId: 'tenant-123' },
        ],
      }),
    });
    const envs = await getEnvironments(MOCK_TOKEN, { tenantId: 'tenant-123' });
    expect(envs).toHaveLength(2);
    expect(envs[0].name).toBe('Production');
  });

  test('filters by type when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        value: [
          { name: 'Production', type: 'Production', aadTenantId: 'tenant-123' },
          { name: 'Sandbox', type: 'Sandbox', aadTenantId: 'tenant-123' },
        ],
      }),
    });
    const envs = await getEnvironments(MOCK_TOKEN, { tenantId: 'tenant-123', type: 'Production' });
    expect(envs).toHaveLength(1);
    expect(envs[0].name).toBe('Production');
  });

  test('throws on API error response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(getEnvironments(MOCK_TOKEN)).rejects.toThrow('BC API error 401');
  });
});

describe('getCompanies', () => {
  test('returns companies for an environment', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        value: [
          { id: 'company-guid-1', name: 'Contoso Ltd' },
          { id: 'company-guid-2', name: 'Fabrikam Inc' },
        ],
      }),
    });
    const companies = await getCompanies(
      { name: 'Production', aadTenantId: 'tenant-123' },
      MOCK_TOKEN
    );
    expect(companies).toHaveLength(2);
    expect(companies[0].id).toBe('company-guid-1');
  });
});

describe('getPermissions', () => {
  test('reports missing permissions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: [] }),
    });
    const result = await getPermissions(
      { name: 'Production', aadTenantId: 'tenant-123' },
      MOCK_TOKEN,
      { companyId: 'company-guid-1' }
    );
    expect(result.missing).toContain('D365 BUS FULL ACCESS');
    expect(result.present).toHaveLength(0);
  });

  test('reports present permissions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        value: [{ roleId: 'D365 BUS FULL ACCESS' }],
      }),
    });
    const result = await getPermissions(
      { name: 'Production', aadTenantId: 'tenant-123' },
      MOCK_TOKEN,
      { companyId: 'company-guid-1' }
    );
    expect(result.present).toContain('D365 BUS FULL ACCESS');
    expect(result.missing).toHaveLength(0);
  });
});
