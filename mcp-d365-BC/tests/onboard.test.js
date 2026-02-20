import { jest } from '@jest/globals';

jest.unstable_mockModule('../lib/auth.js', () => ({
  getToken: jest.fn().mockResolvedValue({ accessToken: 'tok' }),
}));
jest.unstable_mockModule('../lib/discovery.js', () => ({
  getEnvironments: jest.fn(),
  getCompanies: jest.fn(),
  getPermissions: jest.fn(),
}));
jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: jest.fn() },
}));

const writeMock = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('node:fs/promises', () => ({
  writeFile: writeMock,
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
}));

const { buildMcpConfig, onboard } = await import('../lib/onboard.js');
const { getEnvironments, getCompanies, getPermissions } = await import('../lib/discovery.js');
const inquirer = (await import('inquirer')).default;

describe('buildMcpConfig', () => {
  test('generates correct bc-data server config', () => {
    const ctx = {
      tenantId: 'tenant-123',
      envName: 'Production',
      companyId: 'company-guid-1',
    };
    const config = buildMcpConfig(ctx);
    expect(config.mcpServers['bc-data'].env.BC_URL_SERVER).toContain('tenant-123');
    expect(config.mcpServers['bc-data'].env.BC_URL_SERVER).toContain('Production');
    expect(config.mcpServers['bc-data'].env.BC_COMPANY).toBe('company-guid-1');
  });

  test('generates correct bc-admin server config', () => {
    const ctx = { tenantId: 'tenant-abc', envName: 'Production', companyId: 'co-1' };
    const config = buildMcpConfig(ctx);
    expect(config.mcpServers['bc-admin'].env.BC_TENANT_ID).toBe('tenant-abc');
  });
});

describe('onboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    writeMock.mockResolvedValue(undefined);
  });

  test('writes .mcp.json when single env and company (no prompts needed)', async () => {
    getEnvironments.mockResolvedValue([
      { name: 'Production', type: 'Production', aadTenantId: 'tenant-123' },
    ]);
    getCompanies.mockResolvedValue([{ id: 'co-guid', name: 'Contoso' }]);
    getPermissions.mockResolvedValue({ present: ['D365 BUS FULL ACCESS'], missing: [] });

    await onboard({ tenantId: 'tenant-123', output: '.mcp.json' });

    expect(writeMock).toHaveBeenCalledWith(
      '.mcp.json',
      expect.stringContaining('bc-data'),
      'utf8'
    );
    // Should NOT prompt when there's only one option
    expect(inquirer.prompt).not.toHaveBeenCalled();
  });

  test('prompts for env when multiple environments exist', async () => {
    getEnvironments.mockResolvedValue([
      { name: 'Production', type: 'Production', aadTenantId: 'tenant-123' },
      { name: 'Staging', type: 'Production', aadTenantId: 'tenant-123' },
    ]);
    getCompanies.mockResolvedValue([{ id: 'co-guid', name: 'Contoso' }]);
    getPermissions.mockResolvedValue({ present: ['D365 BUS FULL ACCESS'], missing: [] });
    inquirer.prompt.mockResolvedValueOnce({ envName: 'Production' });

    await onboard({ tenantId: 'tenant-123', output: '.mcp.json' });
    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
  });

  test('throws when no environments found', async () => {
    getEnvironments.mockResolvedValue([]);
    await expect(onboard({ tenantId: 'tenant-123' })).rejects.toThrow(
      'No Production environments found'
    );
  });
});
