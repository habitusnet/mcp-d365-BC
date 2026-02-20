import { execFile as _execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import inquirer from 'inquirer';
import { getToken } from './auth.js';
import { getEnvironments, getCompanies, getPermissions } from './discovery.js';
import { saveProfile } from './profiles.js';

const execFile = promisify(_execFile);
const BC_API_BASE = 'https://api.businesscentral.dynamics.com/v2.0';

export function claudeDesktopConfigPath() {
  if (process.platform === 'win32') {
    return join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
  }
  return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
}

export function buildMcpConfig(ctx) {
  const { tenantId, envName, companyId } = ctx;
  return {
    mcpServers: {
      'bc-admin': {
        type: 'stdio',
        command: 'd365bc-admin-mcp',
        env: { BC_TENANT_ID: tenantId },
      },
      'bc-data': {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@knowall-ai/mcp-business-central'],
        env: {
          BC_URL_SERVER: `${BC_API_BASE}/${tenantId}/${envName}/api/v2.0`,
          BC_COMPANY: companyId,
          BC_AUTH_TYPE: 'azure_cli',
        },
      },
    },
  };
}

export async function registerWithClaudeDesktop(config) {
  const configPath = claudeDesktopConfigPath();
  let existing = {};
  try {
    existing = JSON.parse(await readFile(configPath, 'utf8'));
  } catch {
    // file doesn't exist yet — start fresh
  }
  const merged = {
    ...existing,
    mcpServers: { ...(existing.mcpServers ?? {}), ...config.mcpServers },
  };
  await writeFile(configPath, JSON.stringify(merged, null, 2), 'utf8');
  return configPath;
}

export async function onboard(options = {}) {
  const { tenantId, scope = 'local', target = 'claude-code', profileName } = options;
  const token = await getToken();

  const environments = await getEnvironments(token, { tenantId, type: 'Production' });
  if (environments.length === 0) throw new Error('No Production environments found.');

  const { envName } = environments.length === 1
    ? { envName: environments[0].name }
    : await inquirer.prompt([{
        type: 'list',
        name: 'envName',
        message: 'Select environment:',
        choices: environments.map((e) => e.name),
      }]);

  const selectedEnv = environments.find((e) => e.name === envName);
  const companies = await getCompanies(selectedEnv, token);
  if (companies.length === 0) throw new Error('No companies found in this environment.');

  const { companyId } = companies.length === 1
    ? { companyId: companies[0].id }
    : await inquirer.prompt([{
        type: 'list',
        name: 'companyId',
        message: 'Select company:',
        choices: companies.map((c) => ({ name: c.name, value: c.id })),
      }]);

  const perms = await getPermissions(selectedEnv, token, { companyId });
  if (perms.missing.length > 0) {
    console.warn(`⚠️  Missing permissions: ${perms.missing.join(', ')}`);
  }

  const ctx = { tenantId: selectedEnv.aadTenantId, envName, companyId };
  const config = buildMcpConfig(ctx);

  if (target === 'claude-desktop') {
    const configPath = await registerWithClaudeDesktop(config);
    console.log(`✓ Wrote MCP servers to ${configPath}`);
    console.log('Restart Claude Desktop to apply changes.');
  } else {
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      await execFile('claude', ['mcp', 'add-json', '-s', scope, name, JSON.stringify(serverConfig)]);
    }
    console.log(`✓ Registered MCP servers (scope: ${scope})`);
  }

  const name = profileName ?? `${selectedEnv.aadTenantId}/${envName}`;
  await saveProfile(name, ctx);
  console.log(`✓ Saved profile '${name}'`);
  console.log(`\nTo get BC-aware Claude skills, run:\n  claude plugin install habitusnet/bc365-skills`);
}
