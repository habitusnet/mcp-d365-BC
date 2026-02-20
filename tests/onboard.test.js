import { jest } from '@jest/globals';

jest.unstable_mockModule('../lib/auth.js', () => ({
  getToken: jest.fn().mockResolvedValue({ accessToken: 'tok' }),
}));
jest.unstable_mockModule('../lib/discovery.js', () => ({
  getEnvironments: jest.fn(),
  getCompanies: jest.fn(),
  getPermissions: jest.fn(),
}));
jest.unstable_mockModule('../lib/profiles.js', () => ({
  saveProfile: jest.fn().mockResolvedValue(undefined),
}));
jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: jest.fn() },
}));

const execFileMock = jest.fn((cmd, args, cb) => cb(null, '', ''));
jest.unstable_mockModule('node:child_process', () => ({
  execFile: execFileMock,
}));

const { buildMcpConfig, onboard } = await import('../lib/onboard.js');
const { getEnvironments, getCompanies, getPermissions } = await import('../lib/discovery.js');
const { saveProfile } = await import('../lib/profiles.js');
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
    execFileMock.mockImplementation((cmd, args, cb) => cb(null, '', ''));
    saveProfile.mockResolvedValue(undefined);
  });

  test('registers both MCP servers via claude mcp add-json with local scope', async () => {
    getEnvironments.mockResolvedValue([
      { name: 'Production', type: 'Production', aadTenantId: 'tenant-123' },
    ]);
    getCompanies.mockResolvedValue([{ id: 'co-guid', name: 'Contoso' }]);
    getPermissions.mockResolvedValue({ present: ['D365 BUS FULL ACCESS'], missing: [] });

    await onboard({ tenantId: 'tenant-123' });

    expect(execFileMock).toHaveBeenCalledTimes(2);
    const calls = execFileMock.mock.calls;

    // Both calls use claude mcp add-json -s local
    for (const [cmd, args] of calls) {
      expect(cmd).toBe('claude');
      expect(args).toContain('add-json');
      expect(args).toContain('-s');
      expect(args).toContain('local');
    }

    // Server names are passed as the fourth arg (after add-json -s local)
    const serverNames = calls.map(([, args]) => args[args.indexOf('local') + 1]);
    expect(serverNames).toContain('bc-admin');
    expect(serverNames).toContain('bc-data');

    // bc-data JSON contains the tenant
    const dataCall = calls.find(([, args]) => args.includes('bc-data'));
    const dataJson = JSON.parse(dataCall[1].at(-1));
    expect(dataJson.env.BC_URL_SERVER).toContain('tenant-123');

    // Should NOT prompt when there's only one option
    expect(inquirer.prompt).not.toHaveBeenCalled();
    // Should save profile
    expect(saveProfile).toHaveBeenCalledWith(
      expect.stringContaining('tenant-123'),
      expect.objectContaining({ tenantId: 'tenant-123', envName: 'Production', companyId: 'co-guid' })
    );
  });

  test('respects custom scope option', async () => {
    getEnvironments.mockResolvedValue([
      { name: 'Production', type: 'Production', aadTenantId: 'tenant-123' },
    ]);
    getCompanies.mockResolvedValue([{ id: 'co-guid', name: 'Contoso' }]);
    getPermissions.mockResolvedValue({ present: [], missing: [] });

    await onboard({ tenantId: 'tenant-123', scope: 'project' });

    const calls = execFileMock.mock.calls;
    expect(calls.every(([, args]) => args.includes('project'))).toBe(true);
  });

  test('prompts for env when multiple environments exist', async () => {
    getEnvironments.mockResolvedValue([
      { name: 'Production', type: 'Production', aadTenantId: 'tenant-123' },
      { name: 'Staging', type: 'Production', aadTenantId: 'tenant-123' },
    ]);
    getCompanies.mockResolvedValue([{ id: 'co-guid', name: 'Contoso' }]);
    getPermissions.mockResolvedValue({ present: ['D365 BUS FULL ACCESS'], missing: [] });
    inquirer.prompt.mockResolvedValueOnce({ envName: 'Production' });

    await onboard({ tenantId: 'tenant-123' });
    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
  });

  test('throws when no environments found', async () => {
    getEnvironments.mockResolvedValue([]);
    await expect(onboard({ tenantId: 'tenant-123' })).rejects.toThrow(
      'No Production environments found'
    );
  });

  test('prints plugin install hint after registering servers', async () => {
    getEnvironments.mockResolvedValue([
      { name: 'Production', type: 'Production', aadTenantId: 'tenant-123' },
    ]);
    getCompanies.mockResolvedValue([{ id: 'co-guid', name: 'Contoso' }]);
    getPermissions.mockResolvedValue({ present: ['D365 BUS FULL ACCESS'], missing: [] });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await onboard({ tenantId: 'tenant-123' });

    const calls = consoleSpy.mock.calls.map(c => c[0]);
    consoleSpy.mockRestore();

    expect(calls.some(m => m.includes('claude plugin install'))).toBe(true);
    expect(calls.some(m => m.includes('habitusnet/bc365-skills'))).toBe(true);
  });
});
