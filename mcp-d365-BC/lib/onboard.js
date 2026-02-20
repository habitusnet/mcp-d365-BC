import { writeFile } from 'node:fs/promises';
import inquirer from 'inquirer';
import { getToken } from './auth.js';
import { getEnvironments, getCompanies, getPermissions } from './discovery.js';

const BC_API_BASE = 'https://api.businesscentral.dynamics.com/v2.0';

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
        args: ['-y', '@habitusnet/mcp-business-central'],
        env: {
          BC_URL_SERVER: `${BC_API_BASE}/${tenantId}/${envName}/api/v2.0`,
          BC_COMPANY: companyId,
          BC_AUTH_TYPE: 'azure_cli',
        },
      },
    },
  };
}

export async function onboard(options = {}) {
  const { tenantId, output = '.mcp.json' } = options;
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

  const config = buildMcpConfig({ tenantId: selectedEnv.aadTenantId, envName, companyId });
  await writeFile(output, JSON.stringify(config, null, 2), 'utf8');
  console.log(`✓ Wrote ${output}`);
}
