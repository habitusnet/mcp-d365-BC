import { createRequire } from 'node:module';
import { Command } from 'commander';
import chalk from 'chalk';
import { onboard } from './onboard.js';
import { listProfiles, loadProfile } from './profiles.js';
import { checkVersions } from './versions.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

export const program = new Command();

program
  .name('bc365')
  .description('Business Central MCP onboarding and management CLI')
  .version(version);

program
  .command('onboard')
  .description('Auto-discover tenant/environment/company and register MCP servers with Claude Code')
  .option('-t, --tenant-id <id>', 'Azure AD tenant ID (skip Graph lookup)')
  .option('-s, --scope <scope>', 'Configuration scope: local, user, or project (default: local)', 'local')
  .option('-p, --profile <name>', 'Profile name to save (default: tenantId/envName)')
  .action(async (opts) => {
    try {
      await onboard({ tenantId: opts.tenantId, scope: opts.scope, profileName: opts.profile });
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('switch <profile>')
  .description('Switch active profile (re-registers MCP servers from saved profile)')
  .option('-s, --scope <scope>', 'Configuration scope: local, user, or project (default: local)', 'local')
  .action(async (profileName, opts) => {
    try {
      const profile = await loadProfile(profileName);
      if (!profile) {
        console.error(chalk.red(`✗ Profile '${profileName}' not found. Run 'bc365 onboard' first.`));
        process.exit(1);
      }
      const { execFile: _execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFile = promisify(_execFile);
      const { buildMcpConfig } = await import('./onboard.js');
      const config = buildMcpConfig(profile);
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        await execFile('claude', ['mcp', 'add-json', '-s', opts.scope, name, JSON.stringify(serverConfig)]);
      }
      console.log(chalk.green(`✓ Switched to profile '${profileName}' (scope: ${opts.scope})`));
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('profiles')
  .description('List saved tenant profiles')
  .action(async () => {
    const profiles = await listProfiles();
    if (profiles.length === 0) {
      console.log('No profiles saved yet. Run bc365 onboard to create one.');
      return;
    }
    profiles.forEach((p) => console.log(`  ${p.name}  (${p.tenantId})`));
  });

program
  .command('check')
  .description('Check latest versions of bc365 packages from npm registry')
  .action(async () => {
    console.log('Checking npm registry...');
    const results = await checkVersions();
    results.forEach((r) => {
      const status = r.latest ? chalk.green(r.latest) : chalk.yellow('unknown');
      console.log(`  ${r.package}  latest: ${status}`);
    });
  });
