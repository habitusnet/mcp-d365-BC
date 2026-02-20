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

const writeMock = jest.fn().mockResolvedValue(undefined);
const readMock = jest.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
jest.unstable_mockModule('node:fs/promises', () => ({
  readFile: readMock,
  writeFile: writeMock,
}));

const { buildMcpConfig, onboard, registerWithClaudeDesktop, claudeDesktopConfigPath } = await import('../lib/onboard.js');
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

describe('registerWithClaudeDesktop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    writeMock.mockResolvedValue(undefined);
  });

  test('merges mcpServers into existing config preserving other keys', async () => {
    readMock.mockResolvedValueOnce(JSON.stringify({
      preferences: { sidebarMode: 'task' },
      mcpServers: { 'existing-server': { command: 'foo' } },
    }));
    const config = buildMcpConfig({ tenantId: 't1', envName: 'Production', companyId: 'c1' });
    await registerWithClaudeDesktop(config);

    const written = JSON.parse(writeMock.mock.calls[0][1]);
    expect(written.preferences).toEqual({ sidebarMode: 'task' });
    expect(written.mcpServers['existing-server']).toBeDefined();
    expect(written.mcpServers['bc-data']).toBeDefined();
    expect(written.mcpServers['bc-admin']).toBeDefined();
  });

  test('creates fresh config when file does not exist', async () => {
    readMock.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const config = buildMcpConfig({ tenantId: 't1', envName: 'Production', companyId: 'c1' });
    await registerWithClaudeDesktop(config);

    const written = JSON.parse(writeMock.mock.calls[0][1]);
    expect(written.mcpServers['bc-data']).toBeDefined();
    expect(written.mcpServers['bc-admin']).toBeDefined();
  });

  test('writes to correct path for current platform', () => {
    const p = claudeDesktopConfigPath();
    expect(p).toContain('Claude');
    expect(p).toMatch(/claude_desktop_config\.json$/);
  });
});

describe('onboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    execFileMock.mockImplementation((cmd, args, cb) => cb(null, '', ''));
    readMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    writeMock.mockResolvedValue(undefined);
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

  test('writes to claude_desktop_config.json when target is claude-desktop', async () => {
    getEnvironments.mockResolvedValue([
      { name: 'Production', type: 'Production', aadTenantId: 'tenant-123' },
    ]);
    getCompanies.mockResolvedValue([{ id: 'co-guid', name: 'Contoso' }]);
    getPermissions.mockResolvedValue({ present: [], missing: [] });

    await onboard({ tenantId: 'tenant-123', target: 'claude-desktop' });

    expect(execFileMock).not.toHaveBeenCalled();
    expect(writeMock).toHaveBeenCalledTimes(1);
    const [writtenPath, writtenContent] = writeMock.mock.calls[0];
    expect(writtenPath).toContain('claude_desktop_config.json');
    const parsed = JSON.parse(writtenContent);
    expect(parsed.mcpServers['bc-data']).toBeDefined();
    expect(parsed.mcpServers['bc-admin']).toBeDefined();
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
