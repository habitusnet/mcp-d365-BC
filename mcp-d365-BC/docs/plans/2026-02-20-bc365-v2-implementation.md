# bc365 v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform mcp-d365-BC into a secure, distribution-ready npm package with automated upstream dependency monitoring, supply-chain scanning, and smart Entra ID-based tenant onboarding.

**Architecture:** Three GitHub repos — two vendored mirrors of upstream MCP servers (with daily upstream-watch + CI scanning + human-gated PR merge) and the bc365 npm package itself. The package ships a CLI (`bc365 onboard`) that uses an Entra ID app (device code flow) to auto-discover tenants, environments, and companies, then writes `.mcp.json` automatically.

**Tech Stack:** Node.js ≥ 20 ESM, `@azure/msal-node`, `keytar`, `@microsoft/microsoft-graph-client`, `commander`, `chalk`, `inquirer`, `jest`, GitHub Actions (cron + CodeQL + npm audit + license-checker).

---

## Phase 1: Mirror repo — d365bc-admin-mcp

### Task 1: Scaffold `habitusnet/d365bc-admin-mcp`

**Context:** This repo is a vendored mirror of `demiliani/d365bc-admin-mcp`. It must never auto-publish; humans approve every merge via PR.

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `.upstream-version`
- Create: `package.json` (copy from upstream, update name to `@habitusnet/d365bc-admin-mcp`)

**Step 1: Create the repo on GitHub**

```bash
gh repo create habitusnet/d365bc-admin-mcp \
  --private \
  --description "Vendored mirror of demiliani/d365bc-admin-mcp with security scanning" \
  --clone
cd d365bc-admin-mcp
```

Expected: Repo cloned locally.

**Step 2: Copy upstream source**

```bash
# Clone upstream into a temp dir, copy source
git clone https://github.com/demiliani/d365bc-admin-mcp.git /tmp/upstream-admin
cp -r /tmp/upstream-admin/. .
# Remove upstream git history
rm -rf .git
git init
git add .
git commit -m "chore: initial vendor of demiliani/d365bc-admin-mcp"
```

**Step 3: Record upstream version**

```bash
# Get latest upstream tag
UPSTREAM_TAG=$(git -C /tmp/upstream-admin describe --tags --abbrev=0 2>/dev/null || echo "main")
echo "$UPSTREAM_TAG" > .upstream-version
git add .upstream-version
git commit -m "chore: record upstream version $UPSTREAM_TAG"
```

**Step 4: Push to GitHub**

```bash
git remote add origin git@github.com:habitusnet/d365bc-admin-mcp.git
git push -u origin main
```

**Step 5: Verify on GitHub**

Open `https://github.com/habitusnet/d365bc-admin-mcp` — should show source files.

---

### Task 2: CI workflow for `d365bc-admin-mcp`

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Write the CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI — Security Scan

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  audit:
    name: npm audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm audit --audit-level=high

  codeql:
    name: CodeQL
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript
      - uses: github/codeql-action/analyze@v3

  license:
    name: License check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx license-checker --onlyAllow 'MIT;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause' --excludePrivatePackages
```

**Step 2: Commit and push**

```bash
mkdir -p .github/workflows
# write the file above
git add .github/workflows/ci.yml
git commit -m "ci: add security scan workflow (npm audit + CodeQL + license)"
git push
```

**Step 3: Verify CI runs on GitHub**

Go to `Actions` tab — CI should appear. (No npm modules yet so audit may be skipped; that's fine.)

---

### Task 3: Upstream-watch workflow for `d365bc-admin-mcp`

**Files:**
- Create: `.github/workflows/upstream-watch.yml`

**Step 1: Write the upstream-watch workflow**

```yaml
# .github/workflows/upstream-watch.yml
name: Upstream Watch

on:
  schedule:
    - cron: '0 8 * * *'   # 08:00 UTC daily
  workflow_dispatch:

jobs:
  check-upstream:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4

      - name: Get current vendor version
        id: current
        run: echo "version=$(cat .upstream-version)" >> $GITHUB_OUTPUT

      - name: Get latest upstream release
        id: upstream
        run: |
          LATEST=$(gh release list \
            --repo demiliani/d365bc-admin-mcp \
            --limit 1 \
            --json tagName \
            --jq '.[0].tagName' 2>/dev/null || echo "")
          echo "version=$LATEST" >> $GITHUB_OUTPUT
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Sync and open PR if newer
        if: steps.upstream.outputs.version != '' && steps.upstream.outputs.version != steps.current.outputs.version
        run: |
          NEW_VERSION="${{ steps.upstream.outputs.version }}"
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

          # Fetch upstream at new tag
          git remote add upstream https://github.com/demiliani/d365bc-admin-mcp.git || true
          git fetch upstream --tags

          # Create update branch
          BRANCH="update/upstream-${NEW_VERSION}"
          git checkout -b "$BRANCH"

          # Overwrite with upstream contents (excluding our CI files)
          git checkout upstream/"$NEW_VERSION" -- . 2>/dev/null || \
            git checkout upstream/main -- .

          # Restore our workflow files
          git checkout HEAD -- .github/

          # Update version file
          echo "$NEW_VERSION" > .upstream-version
          git add -A
          git commit -m "chore: update vendor to upstream $NEW_VERSION"
          git push -u origin "$BRANCH"

          # Open PR
          gh pr create \
            --title "chore: update vendor to $NEW_VERSION" \
            --body "Automated upstream sync. CI must pass before merging. Review changelog diff before approving." \
            --base main \
            --head "$BRANCH"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Step 2: Commit and push**

```bash
git add .github/workflows/upstream-watch.yml
git commit -m "ci: add daily upstream-watch workflow"
git push
```

**Step 3: Trigger manually to test**

On GitHub: Actions → Upstream Watch → Run workflow. Verify it either skips (already current) or opens a PR.

---

## Phase 2: Mirror repo — mcp-business-central

### Task 4: Scaffold and wire `habitusnet/mcp-business-central`

**Context:** Mirror of `knowall-ai/mcp-business-central`. Same pattern as Task 1–3.

**Step 1: Create repo**

```bash
gh repo create habitusnet/mcp-business-central \
  --private \
  --description "Vendored mirror of knowall-ai/mcp-business-central with security scanning" \
  --clone
cd mcp-business-central
```

**Step 2: Vendor upstream**

```bash
git clone https://github.com/knowall-ai/mcp-business-central.git /tmp/upstream-data
cp -r /tmp/upstream-data/. .
rm -rf .git
git init
UPSTREAM_TAG=$(git -C /tmp/upstream-data describe --tags --abbrev=0 2>/dev/null || echo "main")
echo "$UPSTREAM_TAG" > .upstream-version
git add .
git commit -m "chore: initial vendor of knowall-ai/mcp-business-central at $UPSTREAM_TAG"
git remote add origin git@github.com:habitusnet/mcp-business-central.git
git push -u origin main
```

**Step 3: Copy CI + upstream-watch from d365bc-admin-mcp**

Same files, only change the upstream repo reference:
- `ci.yml` — identical
- `upstream-watch.yml` — change `demiliani/d365bc-admin-mcp` → `knowall-ai/mcp-business-central`

```bash
mkdir -p .github/workflows
# copy and edit the two workflow files
git add .github/workflows/
git commit -m "ci: add security scan and upstream-watch workflows"
git push
```

**Step 4: Verify**

Check GitHub → Actions for both workflows.

---

## Phase 3: Entra ID App Registration (Manual)

### Task 5: Register Entra ID app

**Context:** This is a one-time manual step in Azure Portal. No code. The output (client ID, tenant ID) feeds into Task 8 (`lib/auth.js`).

**Step 1: Open Azure Portal**

Navigate to: Azure Portal → Azure Active Directory → App registrations → New registration.

**Step 2: Configure the app**

- Name: `bc365 CLI`
- Supported account types: **Accounts in any organizational directory (Multi-tenant)**
- Redirect URI: leave blank (device code flow doesn't need one)
- Click **Register**

**Step 3: Record the IDs**

After registration, copy:
- **Application (client) ID** → save as `BC365_CLIENT_ID`
- **Directory (tenant) ID** → save as `BC365_TENANT_ID` (for multi-tenant use `organizations`)

**Step 4: Add API permissions**

Go to: API permissions → Add a permission:

1. **Microsoft Dynamics ERP**
   - Delegated: `user_impersonation`
2. **Microsoft Graph**
   - Delegated: `User.Read`
   - Delegated: `Directory.Read.All`

Click **Grant admin consent** for your tenant (optional for multi-tenant; users will consent on first sign-in).

**Step 5: Enable public client flow**

Authentication tab → Advanced settings → Enable "Allow public client flows" → **Yes** → Save.

**Step 6: Record in Doppler (or `.env.example`)**

```bash
doppler secrets set BC365_CLIENT_ID="<your-client-id>"
# BC365_TENANT_ID is 'organizations' for multi-tenant
```

---

## Phase 4: bc365 npm package

### Task 6: Package scaffold

**Context:** Working in `mcp-d365-BC` repo, `main` branch. This task sets up the package structure — no logic yet.

**Files:**
- Modify: `package.json`
- Create: `bin/bc365.js`
- Create: `lib/auth.js` (stub)
- Create: `lib/discovery.js` (stub)
- Create: `lib/onboard.js` (stub)
- Create: `lib/profiles.js` (stub)
- Create: `lib/versions.js` (stub)
- Create: `tests/` directory

**Step 1: Update `package.json`**

```json
{
  "name": "@habitusnet/bc365",
  "version": "2.0.0",
  "description": "Smart onboarding CLI and MCP config manager for Business Central",
  "type": "module",
  "bin": {
    "bc365": "./bin/bc365.js"
  },
  "exports": {
    ".": "./lib/index.js"
  },
  "files": ["bin/", "lib/"],
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/.bin/jest --coverage",
    "lint": "eslint lib/ bin/"
  },
  "dependencies": {
    "@azure/msal-node": "^2.15.0",
    "@microsoft/microsoft-graph-client": "^3.0.7",
    "chalk": "^5.3.0",
    "commander": "^12.1.0",
    "inquirer": "^10.1.5",
    "keytar": "^7.9.0"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

**Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, `package-lock.json` updated.

**Step 3: Create stub entry points**

```javascript
// bin/bc365.js
#!/usr/bin/env node
import { program } from '../lib/cli.js';
program.parse();
```

```javascript
// lib/index.js
export { onboard } from './onboard.js';
export { getToken } from './auth.js';
```

**Step 4: Commit scaffold**

```bash
git add package.json package-lock.json bin/ lib/
git commit -m "feat: scaffold @habitusnet/bc365 package structure"
```

---

### Task 7: `lib/auth.js` — Entra ID device code flow

**Files:**
- Create: `tests/auth.test.js`
- Create: `lib/auth.js`

**Step 1: Write failing tests**

```javascript
// tests/auth.test.js
import { jest } from '@jest/globals';

// Mock keytar before importing auth
jest.unstable_mockModule('keytar', () => ({
  default: {
    getPassword: jest.fn(),
    setPassword: jest.fn(),
  },
}));

jest.unstable_mockModule('@azure/msal-node', () => ({
  PublicClientApplication: jest.fn().mockImplementation(() => ({
    acquireTokenByDeviceCode: jest.fn(),
  })),
}));

const { getToken, clearToken } = await import('../lib/auth.js');
const keytar = (await import('keytar')).default;

describe('getToken', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns cached token when valid', async () => {
    const future = Date.now() + 3600 * 1000;
    keytar.getPassword.mockResolvedValue(
      JSON.stringify({ accessToken: 'cached', expiresOn: future })
    );
    const token = await getToken();
    expect(token.accessToken).toBe('cached');
    expect(keytar.getPassword).toHaveBeenCalledTimes(1);
  });

  test('re-authenticates when cached token is expired', async () => {
    const past = Date.now() - 1000;
    keytar.getPassword.mockResolvedValue(
      JSON.stringify({ accessToken: 'old', expiresOn: past })
    );
    const { PublicClientApplication } = await import('@azure/msal-node');
    const mockAcquire = jest.fn().mockResolvedValue({
      accessToken: 'new',
      expiresOn: new Date(Date.now() + 3600 * 1000),
    });
    PublicClientApplication.mockImplementation(() => ({
      acquireTokenByDeviceCode: mockAcquire,
    }));
    const token = await getToken();
    expect(token.accessToken).toBe('new');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/auth.test.js
```

Expected: FAIL — `../lib/auth.js` not found.

**Step 3: Write `lib/auth.js`**

```javascript
// lib/auth.js
import { PublicClientApplication } from '@azure/msal-node';
import keytar from 'keytar';

const SERVICE = 'bc365';
const ACCOUNT = 'token';
const CLIENT_ID = process.env.BC365_CLIENT_ID ?? 'YOUR_CLIENT_ID';
const AUTHORITY = 'https://login.microsoftonline.com/organizations';
const SCOPES = [
  'https://api.businesscentral.dynamics.com/user_impersonation',
  'User.Read',
  'Directory.Read.All',
];

const pca = new PublicClientApplication({
  auth: { clientId: CLIENT_ID, authority: AUTHORITY },
});

export async function getToken() {
  const cached = await keytar.getPassword(SERVICE, ACCOUNT);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed.expiresOn > Date.now() + 60_000) return parsed;
  }

  const response = await pca.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (info) => {
      console.log(info.message);
    },
  });

  const token = {
    accessToken: response.accessToken,
    expiresOn: response.expiresOn instanceof Date
      ? response.expiresOn.getTime()
      : response.expiresOn,
  };
  await keytar.setPassword(SERVICE, ACCOUNT, JSON.stringify(token));
  return token;
}

export async function clearToken() {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
```

**Step 4: Run tests — expect pass**

```bash
npm test -- tests/auth.test.js
```

Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add tests/auth.test.js lib/auth.js
git commit -m "feat: add auth.js with device code flow and keychain caching"
```

---

### Task 8: `lib/discovery.js` — Tenant, environment, company, permission discovery

**Files:**
- Create: `tests/discovery.test.js`
- Create: `lib/discovery.js`

**Step 1: Write failing tests**

```javascript
// tests/discovery.test.js
import { jest } from '@jest/globals';

jest.unstable_mockModule('@microsoft/microsoft-graph-client', () => ({
  Client: {
    initWithMiddleware: jest.fn(),
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const { getEnvironments, getCompanies, getPermissions } = await import('../lib/discovery.js');

const MOCK_TOKEN = { accessToken: 'test-token' };

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
      json: () => Promise.resolve({ value: [] }),  // no permission sets
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
```

**Step 2: Run to verify failure**

```bash
npm test -- tests/discovery.test.js
```

Expected: FAIL — `../lib/discovery.js` not found.

**Step 3: Write `lib/discovery.js`**

```javascript
// lib/discovery.js
const BC_ADMIN_BASE = 'https://api.businesscentral.dynamics.com/admin/v2.21';
const BC_API_BASE = 'https://api.businesscentral.dynamics.com/v2.0';
const REQUIRED_PERMISSIONS = ['D365 BUS FULL ACCESS'];

async function bcFetch(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (!res.ok) throw new Error(`BC API error ${res.status}: ${url}`);
  return res.json();
}

export async function getEnvironments(token, opts = {}) {
  const { tenantId, type } = opts;
  const url = tenantId
    ? `${BC_ADMIN_BASE}/applications/BusinessCentral/environments?aadTenantId=${tenantId}`
    : `${BC_ADMIN_BASE}/applications/BusinessCentral/environments`;
  const data = await bcFetch(url, token);
  const envs = data.value ?? [];
  return type ? envs.filter((e) => e.type === type) : envs;
}

export async function getCompanies(env, token) {
  const url = `${BC_API_BASE}/${env.aadTenantId}/${env.name}/api/v2.0/companies`;
  const data = await bcFetch(url, token);
  return data.value ?? [];
}

export async function getPermissions(env, token, opts = {}) {
  const { companyId } = opts;
  const url = `${BC_API_BASE}/${env.aadTenantId}/${env.name}/api/v2.0/companies(${companyId})/userPermissions`;
  const data = await bcFetch(url, token);
  const grantedRoles = (data.value ?? []).map((p) => p.roleId);
  return {
    present: REQUIRED_PERMISSIONS.filter((r) => grantedRoles.includes(r)),
    missing: REQUIRED_PERMISSIONS.filter((r) => !grantedRoles.includes(r)),
  };
}
```

**Step 4: Run tests — expect pass**

```bash
npm test -- tests/discovery.test.js
```

Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add tests/discovery.test.js lib/discovery.js
git commit -m "feat: add discovery.js for environments, companies, and permissions"
```

---

### Task 9: `lib/onboard.js` — Interactive onboarding flow

**Files:**
- Create: `tests/onboard.test.js`
- Create: `lib/onboard.js`

**Step 1: Write failing tests**

```javascript
// tests/onboard.test.js
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
jest.unstable_mockModule('node:fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue({ code: 'ENOENT' }),
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
});

describe('onboard', () => {
  beforeEach(() => jest.clearAllMocks());

  test('writes .mcp.json when onboarding succeeds', async () => {
    getEnvironments.mockResolvedValue([
      { name: 'Production', type: 'Production', aadTenantId: 'tenant-123' },
    ]);
    getCompanies.mockResolvedValue([{ id: 'co-guid', name: 'Contoso' }]);
    getPermissions.mockResolvedValue({ present: ['D365 BUS FULL ACCESS'], missing: [] });
    inquirer.prompt
      .mockResolvedValueOnce({ envName: 'Production' })
      .mockResolvedValueOnce({ companyId: 'co-guid' });

    const { writeFile } = await import('node:fs/promises');
    await onboard({ tenantId: 'tenant-123', output: '.mcp.json' });
    expect(writeFile).toHaveBeenCalledWith(
      '.mcp.json',
      expect.stringContaining('bc-data'),
      'utf8'
    );
  });
});
```

**Step 2: Run to verify failure**

```bash
npm test -- tests/onboard.test.js
```

Expected: FAIL — `../lib/onboard.js` not found.

**Step 3: Write `lib/onboard.js`**

```javascript
// lib/onboard.js
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
```

**Step 4: Run tests — expect pass**

```bash
npm test -- tests/onboard.test.js
```

Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add tests/onboard.test.js lib/onboard.js
git commit -m "feat: add onboard.js with auto-discovery and .mcp.json generation"
```

---

### Task 10: `lib/profiles.js` — Multi-tenant profile management

**Files:**
- Create: `tests/profiles.test.js`
- Create: `lib/profiles.js`

**Step 1: Write failing tests**

```javascript
// tests/profiles.test.js
import { jest } from '@jest/globals';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';

const PROFILE_PATH = join(tmpdir(), `bc365-test-${Date.now()}.json`);

jest.unstable_mockModule('../lib/profiles.js', async () => {
  // Use real implementation but override profile path
  const real = await jest.requireActual('../lib/profiles.js');
  return { ...real, PROFILE_PATH };
});

const { saveProfile, listProfiles, loadProfile, PROFILE_PATH: P } = await import('../lib/profiles.js');

afterAll(async () => {
  await rm(P, { force: true });
});

describe('profiles', () => {
  test('saves and retrieves a profile', async () => {
    await saveProfile('client-a', { tenantId: 'tenant-aaa', envName: 'Production', companyId: 'co-1' });
    const profiles = await listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('client-a');
  });

  test('loads a specific profile', async () => {
    const profile = await loadProfile('client-a');
    expect(profile.tenantId).toBe('tenant-aaa');
  });

  test('returns null for unknown profile', async () => {
    const profile = await loadProfile('unknown');
    expect(profile).toBeNull();
  });
});
```

**Step 2: Run to verify failure**

```bash
npm test -- tests/profiles.test.js
```

Expected: FAIL.

**Step 3: Write `lib/profiles.js`**

```javascript
// lib/profiles.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const PROFILE_PATH = join(homedir(), '.bc365', 'profiles.json');

async function readProfiles() {
  try {
    const data = await readFile(PROFILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeProfiles(profiles) {
  await mkdir(join(homedir(), '.bc365'), { recursive: true });
  await writeFile(PROFILE_PATH, JSON.stringify(profiles, null, 2), 'utf8');
}

export async function saveProfile(name, config) {
  const profiles = await readProfiles();
  profiles[name] = { ...config, savedAt: new Date().toISOString() };
  await writeProfiles(profiles);
}

export async function listProfiles() {
  const profiles = await readProfiles();
  return Object.entries(profiles).map(([name, cfg]) => ({ name, ...cfg }));
}

export async function loadProfile(name) {
  const profiles = await readProfiles();
  return profiles[name] ?? null;
}
```

**Step 4: Run tests — expect pass**

```bash
npm test -- tests/profiles.test.js
```

Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add tests/profiles.test.js lib/profiles.js
git commit -m "feat: add profiles.js for multi-tenant profile persistence"
```

---

### Task 11: `lib/versions.js` — Version check

**Files:**
- Create: `tests/versions.test.js`
- Create: `lib/versions.js`

**Step 1: Write failing tests**

```javascript
// tests/versions.test.js
import { jest } from '@jest/globals';

// Mock npm registry fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const { getLatestVersion, checkVersions } = await import('../lib/versions.js');

describe('getLatestVersion', () => {
  test('returns latest version from npm registry', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ 'dist-tags': { latest: '2.1.0' } }),
    });
    const version = await getLatestVersion('@habitusnet/bc365');
    expect(version).toBe('2.1.0');
  });

  test('returns null on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const version = await getLatestVersion('@habitusnet/bc365');
    expect(version).toBeNull();
  });
});

describe('checkVersions', () => {
  test('returns version status for all packages', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ 'dist-tags': { latest: '2.1.0' } }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ 'dist-tags': { latest: '1.5.0' } }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ 'dist-tags': { latest: '3.0.0' } }) });

    const results = await checkVersions();
    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r).toHaveProperty('package');
      expect(r).toHaveProperty('latest');
    });
  });
});
```

**Step 2: Run to verify failure**

```bash
npm test -- tests/versions.test.js
```

Expected: FAIL — `../lib/versions.js` not found.

**Step 3: Write `lib/versions.js`**

Note: Version check uses the npm registry API (`fetch`) — no shell execution needed.

```javascript
// lib/versions.js
const NPM_REGISTRY = 'https://registry.npmjs.org';

const PACKAGES = [
  '@habitusnet/bc365',
  '@habitusnet/d365bc-admin-mcp',
  '@habitusnet/mcp-business-central',
];

export async function getLatestVersion(pkg) {
  try {
    const res = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(pkg)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data['dist-tags']?.latest ?? null;
  } catch {
    return null;
  }
}

export async function checkVersions() {
  return Promise.all(
    PACKAGES.map(async (pkg) => ({
      package: pkg,
      latest: await getLatestVersion(pkg),
    }))
  );
}
```

**Step 4: Run tests — expect pass**

```bash
npm test -- tests/versions.test.js
```

Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add tests/versions.test.js lib/versions.js
git commit -m "feat: add versions.js for npm registry version checking"
```

---

### Task 12: `lib/cli.js` — Commander CLI wiring

**Files:**
- Create: `lib/cli.js`

**Step 1: Write `lib/cli.js`**

No unit tests needed for Commander wiring — covered by integration test in Task 15.

```javascript
// lib/cli.js
import { Command } from 'commander';
import chalk from 'chalk';
import { onboard } from './onboard.js';
import { listProfiles, loadProfile } from './profiles.js';
import { checkVersions } from './versions.js';

export const program = new Command();

program
  .name('bc365')
  .description('Business Central MCP onboarding and management CLI')
  .version('2.0.0');

program
  .command('onboard')
  .description('Auto-discover tenant/environment/company and write .mcp.json')
  .option('-t, --tenant-id <id>', 'Azure AD tenant ID (skip Graph lookup)')
  .option('-o, --output <path>', 'Output path for .mcp.json', '.mcp.json')
  .action(async (opts) => {
    try {
      await onboard({ tenantId: opts.tenantId, output: opts.output });
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('switch <profile>')
  .description('Switch active profile (writes .mcp.json from saved profile)')
  .option('-o, --output <path>', 'Output path', '.mcp.json')
  .action(async (profileName, opts) => {
    const profile = await loadProfile(profileName);
    if (!profile) {
      console.error(chalk.red(`✗ Profile '${profileName}' not found. Run 'bc365 onboard' first.`));
      process.exit(1);
    }
    const { writeFile } = await import('node:fs/promises');
    const { buildMcpConfig } = await import('./onboard.js');
    const config = buildMcpConfig(profile);
    await writeFile(opts.output, JSON.stringify(config, null, 2), 'utf8');
    console.log(chalk.green(`✓ Switched to profile '${profileName}'`));
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
  .description('Check installed vs latest versions of bc365 packages')
  .action(async () => {
    const results = await checkVersions();
    results.forEach((r) => {
      const status = r.latest ? chalk.green(r.latest) : chalk.yellow('unknown');
      console.log(`  ${r.package}  latest: ${status}`);
    });
  });
```

**Step 2: Commit**

```bash
git add lib/cli.js
git commit -m "feat: add CLI commands (onboard, switch, profiles, check)"
```

---

## Phase 5: CI/CD for mcp-d365-BC

### Task 13: CI and publish workflows

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/publish.yml`

**Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage

  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm audit --audit-level=high

  codeql:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript
      - uses: github/codeql-action/analyze@v3
```

**Step 2: Write `.github/workflows/publish.yml`**

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Step 3: Add NPM_TOKEN secret to GitHub repo**

1. Generate a granular npm access token at npmjs.com (scoped to `@habitusnet/bc365`, `publish` only)
2. Add to repo: Settings → Secrets → Actions → New repository secret → `NPM_TOKEN`

**Step 4: Commit workflows**

```bash
mkdir -p .github/workflows
git add .github/workflows/ci.yml .github/workflows/publish.yml
git commit -m "ci: add test/audit/CodeQL CI and npm publish workflow"
git push
```

---

## Phase 6: Documentation update

### Task 14: Update README, SETUP.md, CHANGELOG

**Files:**
- Modify: `README.md`
- Create: `SETUP.md`
- Modify: `CHANGELOG.md`

**Step 1: Update `README.md`**

Add a "v2 — Smart Onboarding" section above the Quick Start:

```markdown
## v2 — Smart Onboarding

Instead of manually editing `.mcp.json`, use the CLI:

```bash
npx @habitusnet/bc365 onboard
```

Sign in with your Microsoft account. The CLI discovers your tenant, environments, and companies automatically, checks your BC permissions, and writes `.mcp.json`.

**Prerequisites:**
- Microsoft 365 / Azure AD account with access to Business Central
- Business Central environment with `D365 BUS FULL ACCESS` permission set
```

**Step 2: Create `SETUP.md`**

```markdown
# Setup Guide

## Prerequisites

- Node.js ≥ 20
- A Microsoft 365 tenant with Business Central
- `D365 BUS FULL ACCESS` permission in Business Central

## Quick Onboard

```bash
npx @habitusnet/bc365 onboard
```

Follow the device code flow: open the URL, enter the code, sign in with your Microsoft account.

## Manual Setup (v1 style)

Copy `.mcp.json.example` to `.mcp.json` and fill in your tenant values. See [.mcp.json.example](.mcp.json.example).

## Multi-tenant (Agencies)

Save profiles for each client after onboarding:

```bash
bc365 onboard --output /tmp/client-a.json
# Then switch between clients:
bc365 switch client-a
```

## Permission Errors

If onboarding reports missing permissions, ask your BC admin to assign:
- Permission set: `D365 BUS FULL ACCESS`
- Or: `SUPER` (full access)
```

**Step 3: Update `CHANGELOG.md`**

Add v2.0.0 entry at top:

```markdown
## [2.0.0] — Unreleased

### Added
- `bc365 onboard` CLI: auto-discovers tenant, environments, companies, writes `.mcp.json`
- `bc365 switch <profile>` for multi-tenant management
- Entra ID multi-tenant app with device code flow authentication
- Token caching via OS keychain (`keytar`)
- Vendored mirror repos with daily upstream-watch and security scanning
- npm package: `@habitusnet/bc365`
- CI: npm audit, CodeQL, license check on every PR
```

**Step 4: Commit**

```bash
git add README.md SETUP.md CHANGELOG.md
git commit -m "docs: update README, add SETUP.md, add v2.0.0 CHANGELOG entry"
git push
```

---

## Phase 7: Integration smoke test

### Task 15: End-to-end smoke test

**Context:** Manual test with real credentials. No automated test (requires live M365 tenant).

**Step 1: Install the package locally**

```bash
npm link   # or: npm install -g .
bc365 --version
```

Expected: `2.0.0`

**Step 2: Run onboard (dry run)**

```bash
bc365 onboard --output /tmp/test-mcp.json
```

Expected:
1. Prints a device code URL + code
2. After sign-in: lists environments → prompts selection
3. Lists companies → prompts selection
4. Checks permissions — reports OK or warns about missing
5. Writes `/tmp/test-mcp.json`

**Step 3: Inspect output**

```bash
cat /tmp/test-mcp.json
```

Expected: Valid JSON with `bc-admin` and `bc-data` server configs containing real tenant ID, env name, company GUID.

**Step 4: Test `bc365 check`**

```bash
bc365 check
```

Expected: Lists 3 packages with latest npm versions (or `unknown` if not yet published).

**Step 5: Tag and push v2.0.0**

```bash
git tag v2.0.0
git push origin v2.0.0
```

Expected: `publish.yml` workflow triggers → npm package published.

**Step 6: Verify npm publish**

```bash
npm info @habitusnet/bc365 version
```

Expected: `2.0.0`

---

## Summary: Task Order & Dependencies

| Task | Phase | Depends on |
|------|-------|------------|
| 1 | Mirror 1 | — |
| 2 | Mirror 1 | 1 |
| 3 | Mirror 1 | 2 |
| 4 | Mirror 2 | — (parallel with 1–3) |
| 5 | Entra App | — (parallel, manual) |
| 6 | Package scaffold | — |
| 7 | auth.js | 6, 5 |
| 8 | discovery.js | 6 |
| 9 | onboard.js | 7, 8 |
| 10 | profiles.js | 6 |
| 11 | versions.js | 6 |
| 12 | cli.js | 9, 10, 11 |
| 13 | CI/CD | 12 |
| 14 | Docs | 12 |
| 15 | Smoke test | 13, 14 |

**Parallelizable:** Tasks 1–4 (mirror repos) can run concurrently. Tasks 6–11 are sequential within the package phase.
