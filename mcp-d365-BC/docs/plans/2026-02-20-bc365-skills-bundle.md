# bc365 Skills Bundle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `habitusnet/bc365-skills` GitHub repo as a Claude Code plugin with three skills (bc-query, bc-admin, bc-diagnose), bundle the same skill files into the `@habitusnet/bc365` npm package, and add a post-onboard install hint.

**Architecture:** Skills-only plugin (no commands/hooks). `habitusnet/bc365-skills` is the source of truth — CI syncs changed skills to `mcp-d365-BC` via PR. Skills ship in the npm package via the `skills/` directory already reserved in `package.json#files`. A lightweight validator script (not shipped) checks that every `SKILL.md` has valid frontmatter.

**Tech Stack:** Claude Code plugin format (`plugin.json` + `SKILL.md`), GitHub Actions, `gh` CLI, Jest (for onboard hint test).

---

## Context you need

**Repos involved:**
- `mcp-d365-BC` lives at `/Users/auge2u/github/habitusnet/mcp-d365-BC` (working dir for this plan)
- `bc365-skills` is a **new** GitHub repo to create at `habitusnet/bc365-skills`
- Create `bc365-skills` in a temp dir (e.g. `/tmp/bc365-skills`), push to GitHub, then return to `mcp-d365-BC`

**MCP tool names Claude will use in skills (from live deferred tools list):**

bc-data tools:
- `mcp__bc-data__list_items(entity, filter?, select?, top?, skip?)`
- `mcp__bc-data__get_items_by_field(entity, field, value)`
- `mcp__bc-data__get_schema(entity)`
- `mcp__bc-data__create_item(entity, data)`
- `mcp__bc-data__update_item(entity, id, data)`
- `mcp__bc-data__delete_item(entity, id)`

bc-admin tools:
- `mcp__bc-admin__get_environment_informations()` — list all environments
- `mcp__bc-admin__get_environment_companies(environment)` — list companies
- `mcp__bc-admin__get_installed_apps(environment)` — installed AL apps
- `mcp__bc-admin__get_available_app_updates(environment)` — pending updates
- `mcp__bc-admin__update_app(environment, appId, appVersion)` — update app
- `mcp__bc-admin__get_available_features(environment)` — BC feature flags
- `mcp__bc-admin__activate_feature(environment, feature)` / `deactivate_feature`
- `mcp__bc-admin__get_active_sessions(environment)` — active user sessions
- `mcp__bc-admin__kill_active_sessions(environment)` — force disconnect
- `mcp__bc-admin__get_usage_storage_for_environment(environment)` — storage stats
- `mcp__bc-admin__clear_cached_token()` — clear stale auth token
- `mcp__bc-admin__get_token_cache_status()` — check token health

**BC API v2.0 entity names** (used as `entity` param in bc-data tools):
`customers`, `vendors`, `items`, `salesOrders`, `salesInvoices`, `purchaseOrders`, `purchaseInvoices`, `generalLedgerEntries`, `accounts`, `companies`, `currencies`, `paymentTerms`, `shipmentMethods`, `countriesRegions`

**`lib/onboard.js` — last two console.log lines to add the hint after** (lines 70-71):
```js
  console.log(`✓ Wrote ${output}`);
  // ...
  console.log(`✓ Saved profile '${name}'`);
  // ADD hint here
```

---

## Phase 1 — bc365-skills GitHub repo

### Task 1: Scaffold bc365-skills repo

**Files:**
- Create: `/tmp/bc365-skills/plugin.json`
- Create: `/tmp/bc365-skills/README.md`
- Push to: `github.com:habitusnet/bc365-skills`

**Step 1: Create the repo on GitHub and clone locally**

```bash
gh repo create habitusnet/bc365-skills --public --description "Claude Code skills for Microsoft Dynamics 365 Business Central" --clone --clone-path /tmp/bc365-skills
```

If `--clone-path` is unsupported, use:
```bash
gh repo create habitusnet/bc365-skills --public --description "Claude Code skills for Microsoft Dynamics 365 Business Central"
git clone git@github.com:habitusnet/bc365-skills.git /tmp/bc365-skills
```

**Step 2: Write `plugin.json`**

```json
{
  "name": "bc365-skills",
  "version": "1.0.0",
  "description": "Claude Code skills for Microsoft Dynamics 365 Business Central — query data, manage environments, and diagnose errors using the bc365 MCP servers.",
  "skills": [
    { "name": "bc-query",    "path": "skills/bc-query" },
    { "name": "bc-admin",    "path": "skills/bc-admin" },
    { "name": "bc-diagnose", "path": "skills/bc-diagnose" }
  ]
}
```

Save to `/tmp/bc365-skills/plugin.json`.

**Step 3: Write `README.md`**

```markdown
# bc365-skills

Claude Code skills for [Microsoft Dynamics 365 Business Central](https://dynamics.microsoft.com/business-central/overview/).

Works with the [bc365 CLI](https://www.npmjs.com/package/@habitusnet/bc365) and its two MCP servers:
- **bc-data** — query and update BC data (customers, items, orders, G/L entries, …)
- **bc-admin** — manage environments, companies, apps, and permissions

## Install

```bash
claude plugin install habitusnet/bc365-skills
```

## Skills

| Skill | When to use |
|-------|-------------|
| `bc-query` | Ask Claude to list, filter, or update BC data via the bc-data MCP server |
| `bc-admin` | Ask Claude to inspect environments, companies, apps, and sessions via bc-admin |
| `bc-diagnose` | Ask Claude to explain BC error messages and suggest fixes |

## Setup

Run `bc365 onboard` first to generate `.mcp.json` with the MCP server configuration.
```

**Step 4: Create skills directory stubs**

```bash
mkdir -p /tmp/bc365-skills/skills/bc-query
mkdir -p /tmp/bc365-skills/skills/bc-admin
mkdir -p /tmp/bc365-skills/skills/bc-diagnose
```

**Step 5: Verify plugin.json is valid JSON**

```bash
python3 -c "import json,sys; d=json.load(open('/tmp/bc365-skills/plugin.json')); assert 'skills' in d and len(d['skills'])==3; print('OK')"
```

Expected: `OK`

**Step 6: Commit and push**

```bash
cd /tmp/bc365-skills
git add plugin.json README.md skills/
git commit -m "feat: scaffold bc365-skills plugin"
git push origin main
```

---

### Task 2: bc-query/SKILL.md

**Files:**
- Create: `/tmp/bc365-skills/skills/bc-query/SKILL.md`

**Step 1: Write the skill file**

```markdown
---
name: bc-query
description: Query and update Microsoft Dynamics 365 Business Central data using the bc-data MCP server. Use when the user asks to list customers, find items, check sales orders, query general ledger entries, or any other BC data operation.
allowed-tools: ["mcp__bc-data__list_items", "mcp__bc-data__get_items_by_field", "mcp__bc-data__get_schema", "mcp__bc-data__create_item", "mcp__bc-data__update_item", "mcp__bc-data__delete_item"]
---

# BC Query Skill

Query and update Business Central data via the `bc-data` MCP server.

## Prerequisites

The `bc-data` MCP server must be configured in `.mcp.json` (run `bc365 onboard` if not). The server uses Azure CLI credentials — run `az login` if you see auth errors.

## Available Tools

| Tool | Purpose |
|------|---------|
| `mcp__bc-data__list_items` | List entities with optional OData filtering |
| `mcp__bc-data__get_items_by_field` | Find records matching a specific field value |
| `mcp__bc-data__get_schema` | Discover available fields for an entity |
| `mcp__bc-data__create_item` | Create a new record |
| `mcp__bc-data__update_item` | Update an existing record by ID |
| `mcp__bc-data__delete_item` | Delete a record by ID |

## Common Entity Names

Use these exact strings as the `entity` parameter:

| Entity | Description |
|--------|-------------|
| `customers` | Customer master records |
| `vendors` | Vendor master records |
| `items` | Item (product/service) master |
| `salesOrders` | Sales order headers |
| `salesInvoices` | Posted sales invoices |
| `purchaseOrders` | Purchase order headers |
| `purchaseInvoices` | Posted purchase invoices |
| `generalLedgerEntries` | G/L ledger entries |
| `accounts` | Chart of accounts |
| `companies` | Companies in this environment |
| `currencies` | Currency codes and exchange rates |
| `paymentTerms` | Payment term codes |

## Querying Patterns

### List all records (with limit)
```
mcp__bc-data__list_items(entity="customers", top=50)
```

### Filter by field value
```
mcp__bc-data__list_items(entity="customers", filter="displayName eq 'Contoso'")
mcp__bc-data__list_items(entity="items", filter="startswith(displayName, 'BIKE')")
mcp__bc-data__list_items(entity="salesOrders", filter="sellToCustomerNumber eq '10000'")
```

### Select specific fields (reduces payload)
```
mcp__bc-data__list_items(entity="customers", select="number,displayName,email,phoneNumber", top=100)
```

### Find by known field value (simpler than filter)
```
mcp__bc-data__get_items_by_field(entity="customers", field="number", value="10000")
mcp__bc-data__get_items_by_field(entity="items", field="number", value="ITEM-001")
```

### Discover available fields before querying
```
mcp__bc-data__get_schema(entity="salesOrders")
```
Always call `get_schema` first when the user asks about a field you haven't seen before.

### Sort results
```
mcp__bc-data__list_items(entity="generalLedgerEntries", filter="postingDate gt 2024-01-01", orderby="postingDate desc", top=200)
```

### Paginate large result sets
If the response contains `@odata.nextLink`, call `list_items` again with a `skip` offset:
```
mcp__bc-data__list_items(entity="generalLedgerEntries", top=200, skip=200)
```

## OData Filter Syntax

BC uses OData v4. Supported operators:
- Equality: `field eq 'value'` or `field eq 12345`
- Comparison: `field gt value`, `field lt value`, `field ge value`, `field le value`
- String: `startswith(field, 'prefix')`, `contains(field, 'substring')`
- Date: `postingDate gt 2024-01-01T00:00:00Z`
- Combine: `field1 eq 'x' and field2 gt 100`

**Common mistake:** Field names are camelCase in the API (`displayName`, `sellToCustomerNumber`), NOT the BC UI names ("Name", "Sell-to Customer No."). Use `get_schema` to find the correct API field name.

## Write Operations (use with care)

Before creating or updating, always call `get_schema` to see required fields and field types.

```
# Create a new customer
mcp__bc-data__create_item(entity="customers", data={"displayName": "New Corp", "currencyCode": "CHF"})

# Update a customer's email
mcp__bc-data__update_item(entity="customers", id="<guid>", data={"email": "new@example.com"})
```

Destructive operations (`delete_item`) require the record's GUID `id`, not its BC number. Always confirm with the user before deleting.
```

**Step 2: Validate frontmatter**

```bash
python3 -c "
import re, sys
text = open('/tmp/bc365-skills/skills/bc-query/SKILL.md').read()
assert text.startswith('---'), 'Missing frontmatter'
fm_end = text.index('---', 3)
fm = text[3:fm_end]
assert 'name:' in fm, 'Missing name'
assert 'description:' in fm, 'Missing description'
print('OK')
"
```

Expected: `OK`

**Step 3: Commit**

```bash
cd /tmp/bc365-skills
git add skills/bc-query/SKILL.md
git commit -m "feat: add bc-query skill"
git push origin main
```

---

### Task 3: bc-admin/SKILL.md

**Files:**
- Create: `/tmp/bc365-skills/skills/bc-admin/SKILL.md`

**Step 1: Write the skill file**

```markdown
---
name: bc-admin
description: Manage Microsoft Dynamics 365 Business Central environments, companies, installed apps, feature flags, and user sessions using the bc-admin MCP server. Use when the user asks about environment status, app updates, permissions, or wants to perform admin operations.
allowed-tools: ["mcp__bc-admin__get_environment_informations", "mcp__bc-admin__get_environment_companies", "mcp__bc-admin__get_installed_apps", "mcp__bc-admin__get_available_app_updates", "mcp__bc-admin__update_app", "mcp__bc-admin__get_available_features", "mcp__bc-admin__activate_feature", "mcp__bc-admin__deactivate_feature", "mcp__bc-admin__get_active_sessions", "mcp__bc-admin__kill_active_sessions", "mcp__bc-admin__get_usage_storage_for_environment", "mcp__bc-admin__get_usage_storage_for_all_environments", "mcp__bc-admin__clear_cached_token", "mcp__bc-admin__get_token_cache_status"]
---

# BC Admin Skill

Manage Business Central environments and tenant operations via the `bc-admin` MCP server.

## Prerequisites

The `bc-admin` MCP server must be configured in `.mcp.json` (run `bc365 onboard` if not). The `BC_TENANT_ID` environment variable must be set to the tenant's Entra ID GUID.

## Tool Reference

### Environment & Company

| Tool | Purpose |
|------|---------|
| `mcp__bc-admin__get_environment_informations()` | List all environments for the tenant |
| `mcp__bc-admin__get_environment_companies(environment)` | List companies in an environment |
| `mcp__bc-admin__get_usage_storage_for_environment(environment)` | Storage usage for one environment |
| `mcp__bc-admin__get_usage_storage_for_all_environments()` | Storage usage across all environments |

### Apps & Extensions

| Tool | Purpose |
|------|---------|
| `mcp__bc-admin__get_installed_apps(environment)` | List installed AL apps/extensions |
| `mcp__bc-admin__get_available_app_updates(environment)` | List apps with pending updates |
| `mcp__bc-admin__update_app(environment, appId, appVersion)` | Update an app to a specific version |
| `mcp__bc-admin__get_extension_deployment_status(environment, operationId)` | Check app deployment status |

### Feature Flags

| Tool | Purpose |
|------|---------|
| `mcp__bc-admin__get_available_features(environment)` | List all BC feature flags and their state |
| `mcp__bc-admin__activate_feature(environment, feature)` | Enable a feature flag |
| `mcp__bc-admin__deactivate_feature(environment, feature)` | Disable a feature flag |

### Sessions

| Tool | Purpose |
|------|---------|
| `mcp__bc-admin__get_active_sessions(environment)` | List currently active user sessions |
| `mcp__bc-admin__kill_active_sessions(environment)` | Force-disconnect all sessions (e.g. before upgrade) |

### Auth

| Tool | Purpose |
|------|---------|
| `mcp__bc-admin__get_token_cache_status()` | Check if cached token is valid |
| `mcp__bc-admin__clear_cached_token()` | Clear stale auth token (then re-run `bc365 onboard`) |

## Common Workflows

### Inspect environments
```
mcp__bc-admin__get_environment_informations()
# Returns: name, type (Production/Sandbox), applicationVersion, status
```

### List companies in Production
```
mcp__bc-admin__get_environment_companies(environment="Production")
# Returns: id (GUID), name, displayName — use id as BC_COMPANY in .mcp.json
```

### Check for app updates
```
mcp__bc-admin__get_available_app_updates(environment="Production")
# Returns: appId, name, currentVersion, latestVersion
```

### Update an app
```
# 1. Get current installed apps and their IDs
mcp__bc-admin__get_installed_apps(environment="Production")

# 2. Check for available updates
mcp__bc-admin__get_available_app_updates(environment="Production")

# 3. Update (always confirm with user first)
mcp__bc-admin__update_app(environment="Production", appId="<guid>", appVersion="<latestVersion>")

# 4. Monitor deployment
mcp__bc-admin__get_extension_deployment_status(environment="Production", operationId="<operationId from step 3>")
```

### Prepare for maintenance (force logout users)
```
# 1. Check who is logged in
mcp__bc-admin__get_active_sessions(environment="Production")

# 2. Confirm with user before disconnecting
mcp__bc-admin__kill_active_sessions(environment="Production")
```

### Check storage usage
```
mcp__bc-admin__get_usage_storage_for_all_environments()
# Returns: environment name, database size, file size in GB
```

## Auth Troubleshooting

If bc-admin calls return 401 errors:
```
mcp__bc-admin__get_token_cache_status()
# If expired or missing:
mcp__bc-admin__clear_cached_token()
# Then tell user: run `bc365 onboard` to re-authenticate
```

## Profile & Environment Context

The active environment is set by the `BC_TENANT_ID` env var in `.mcp.json`. To switch tenant/environment:
```bash
bc365 switch <profile-name>   # updates .mcp.json to a different profile
bc365 profiles                # list saved profiles
```
```

**Step 2: Validate frontmatter**

```bash
python3 -c "
import re, sys
text = open('/tmp/bc365-skills/skills/bc-admin/SKILL.md').read()
assert text.startswith('---'), 'Missing frontmatter'
fm_end = text.index('---', 3)
fm = text[3:fm_end]
assert 'name:' in fm
assert 'description:' in fm
print('OK')
"
```

Expected: `OK`

**Step 3: Commit**

```bash
cd /tmp/bc365-skills
git add skills/bc-admin/SKILL.md
git commit -m "feat: add bc-admin skill"
git push origin main
```

---

### Task 4: bc-diagnose/SKILL.md

**Files:**
- Create: `/tmp/bc365-skills/skills/bc-diagnose/SKILL.md`

**Step 1: Write the skill file**

```markdown
---
name: bc-diagnose
description: Interpret Microsoft Dynamics 365 Business Central error messages and API failures, and suggest specific fixes. Use when the user receives an HTTP error, OData error, permission error, or unexpected BC behaviour. Cross-references bc-admin skill for permission lookups.
---

# BC Diagnose Skill

Interpret Business Central errors and guide the user to the correct fix.

## HTTP Status Codes

### 401 Unauthorized
**Meaning:** The access token is expired, missing, or invalid.

**Fix steps:**
1. Check token health: `mcp__bc-admin__get_token_cache_status()`
2. Clear the cached token: `mcp__bc-admin__clear_cached_token()`
3. Tell the user: `bc365 logout && bc365 onboard` to re-authenticate

If `bc365 onboard` also fails with 401, the Entra ID app registration may have expired or the user's device code session timed out. Ask the user to run `bc365 onboard` in a terminal with a TTY.

### 403 Forbidden
**Meaning:** Authenticated successfully, but the user lacks a required permission set.

**Fix steps:**
1. List user permissions via bc-admin: `mcp__bc-admin__get_environment_companies(environment="Production")` to confirm the company, then check BC User Card in the BC UI (Settings → Users → select user → Permission Sets)
2. Common missing permission sets:
   - `D365 BUS FULL ACCESS` — general read/write access
   - `D365 BASIC` — minimum access
   - `SUPER` — admin (should only be assigned to admins)
3. A BC administrator must assign the missing permission in the BC UI — this cannot be done via MCP

### 404 Not Found
**Meaning:** The entity or endpoint does not exist. Most common causes:

| Cause | Symptom | Fix |
|-------|---------|-----|
| Wrong company GUID | 404 on any data request | Run `bc365 profiles` and compare `BC_COMPANY` in `.mcp.json` with actual company ID from `mcp__bc-admin__get_environment_companies` |
| Wrong API version | URL has `/v1.0/` instead of `/v2.0/` | Check `BC_URL_SERVER` in `.mcp.json` — should end in `/api/v2.0` |
| Entity name wrong | 404 on specific entity | Use the exact camelCase entity name (e.g. `salesOrders` not `sales_orders`) |
| Record deleted | 404 on specific ID | The record no longer exists — list the entity to confirm |

### 429 Too Many Requests
**Meaning:** BC's API rate limit was hit.

**Fix steps:**
1. Wait 30-60 seconds before retrying
2. Reduce query size: add `top=50` to `list_items` calls
3. Avoid broad queries with no filter on large entities (e.g. `generalLedgerEntries` without a date filter)
4. If hitting limits repeatedly, schedule bulk operations during off-peak hours

### 500 Internal Server Error
**Meaning:** BC server-side error. Usually transient.

**Fix steps:**
1. Retry the same operation after 30 seconds
2. If persistent, check BC service health at [aka.ms/bchealth](https://aka.ms/bchealth)
3. Check environment status: `mcp__bc-admin__get_environment_informations()` — look for `status: Updating` which means BC is mid-upgrade

### 503 Service Unavailable
**Meaning:** BC environment is unavailable (often during scheduled maintenance or upgrade).

**Fix steps:**
1. `mcp__bc-admin__get_environment_informations()` — check `status` field
2. If `status: Updating` — wait for upgrade to complete (check `get_environment_updates` for progress)
3. If unexpected, report to Microsoft via BC Admin Center

## OData Errors

### `BadRequest` / filter parse error
**Symptom:** `An error occurred while reading from the store provider's data reader`

**Cause:** OData `$filter` syntax error.

**Fix:** Common mistakes:
- String values must be in single quotes: `displayName eq 'Contoso'` (not double quotes)
- Date values need full ISO format: `postingDate gt 2024-01-01T00:00:00Z`
- Field names are camelCase: `displayName` not `Display Name`
- Use `get_schema` to verify field names: `mcp__bc-data__get_schema(entity="customers")`

### `Unauthorized` in OData response body
**Cause:** bc-data server uses `azure_cli` auth — `az login` token has expired.

**Fix:** Tell the user: `az login` to refresh Azure CLI credentials.

### `ResourceNotFound` in OData response
**Cause:** Company GUID mismatch or entity not available in this BC version.

**Fix:**
1. Verify company: `mcp__bc-admin__get_environment_companies(environment="Production")`
2. Compare with `BC_COMPANY` in `.mcp.json`
3. If mismatch: `bc365 onboard` to regenerate config

## Permission Set Reference

Common BC permission sets and what they grant:

| Permission Set | Grants |
|----------------|--------|
| `D365 BUS FULL ACCESS` | Full read/write on business data (customers, vendors, items, orders) |
| `D365 BASIC` | Read-only on most business data |
| `D365 ACCOUNTANT` | Full access to finance/G/L |
| `D365 SALES` | Full access to sales |
| `D365 PURCHASING` | Full access to purchasing |
| `SUPER` | Full system access including user management (admin only) |

## Diagnostic Workflow

When a user reports an error:

1. **Identify the HTTP status code** — use the table above
2. **Check token health first** (most errors are auth-related): `mcp__bc-admin__get_token_cache_status()`
3. **Verify the environment is up**: `mcp__bc-admin__get_environment_informations()`
4. **Reproduce with simpler query**: try `mcp__bc-data__list_items(entity="companies", top=1)` as a baseline
5. **Check BC_COMPANY matches**: compare `mcp__bc-admin__get_environment_companies` output with `.mcp.json`
```

**Step 2: Validate frontmatter**

```bash
python3 -c "
text = open('/tmp/bc365-skills/skills/bc-diagnose/SKILL.md').read()
assert text.startswith('---')
fm_end = text.index('---', 3)
fm = text[3:fm_end]
assert 'name:' in fm
assert 'description:' in fm
print('OK')
"
```

Expected: `OK`

**Step 3: Commit and push**

```bash
cd /tmp/bc365-skills
git add skills/bc-diagnose/SKILL.md
git commit -m "feat: add bc-diagnose skill"
git push origin main
```

---

### Task 5: Sync CI workflow

**Files:**
- Create: `/tmp/bc365-skills/.github/workflows/sync-to-bc365.yml`

No TDD here — validate the YAML parses, then commit.

**Step 1: Write the workflow**

```yaml
name: Sync skills to mcp-d365-BC

on:
  push:
    branches: [main]
    paths: ['skills/**']

jobs:
  sync:
    name: Open PR on mcp-d365-BC
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Sync skills via PR
        env:
          GH_TOKEN: ${{ secrets.BC365_SYNC_TOKEN }}
        run: |
          # Clone target repo
          git clone https://x-access-token:${GH_TOKEN}@github.com/habitusnet/mcp-d365-BC.git /tmp/mcp-d365-BC
          cd /tmp/mcp-d365-BC

          BRANCH="chore/sync-skills-$(date +%Y%m%d-%H%M%S)"
          git checkout -b "$BRANCH"

          # Copy skills
          mkdir -p skills
          cp -r $GITHUB_WORKSPACE/skills/. skills/
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add skills/
          git diff --cached --quiet && echo "No changes" && exit 0

          git commit -m "chore: sync skills from bc365-skills"
          git push origin "$BRANCH"

          gh pr create \
            --title "chore: sync skills from bc365-skills" \
            --body "Automated sync of updated skill files from habitusnet/bc365-skills." \
            --base main \
            --head "$BRANCH" \
            --repo habitusnet/mcp-d365-BC
```

Save to `/tmp/bc365-skills/.github/workflows/sync-to-bc365.yml`.

**Step 2: Validate YAML parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('/tmp/bc365-skills/.github/workflows/sync-to-bc365.yml')); print('OK')"
```

Expected: `OK` (install `pyyaml` with `pip install pyyaml` if missing)

**Step 3: Commit and push**

```bash
cd /tmp/bc365-skills
git add .github/
git commit -m "ci: add sync-to-bc365 workflow"
git push origin main
```

**Step 4: Add `BC365_SYNC_TOKEN` secret to bc365-skills repo**

The workflow needs a PAT with `repo` scope on `habitusnet/mcp-d365-BC`. Create one at GitHub → Settings → Developer Settings → Personal access tokens → Fine-grained → `habitusnet/mcp-d365-BC` → Contents (write) + Pull requests (write).

```bash
# Add the secret (user provides the token value)
gh secret set BC365_SYNC_TOKEN --repo habitusnet/bc365-skills
```

---

## Phase 2 — mcp-d365-BC integration

### Task 6: Copy skills into mcp-d365-BC npm package

**Files:**
- Create: `skills/bc-query/SKILL.md` (in `mcp-d365-BC`)
- Create: `skills/bc-admin/SKILL.md`
- Create: `skills/bc-diagnose/SKILL.md`

Work in `/Users/auge2u/github/habitusnet/mcp-d365-BC`.

**Step 1: Copy skill files from bc365-skills**

```bash
mkdir -p /Users/auge2u/github/habitusnet/mcp-d365-BC/skills/bc-query
mkdir -p /Users/auge2u/github/habitusnet/mcp-d365-BC/skills/bc-admin
mkdir -p /Users/auge2u/github/habitusnet/mcp-d365-BC/skills/bc-diagnose

cp /tmp/bc365-skills/skills/bc-query/SKILL.md /Users/auge2u/github/habitusnet/mcp-d365-BC/skills/bc-query/SKILL.md
cp /tmp/bc365-skills/skills/bc-admin/SKILL.md /Users/auge2u/github/habitusnet/mcp-d365-BC/skills/bc-admin/SKILL.md
cp /tmp/bc365-skills/skills/bc-diagnose/SKILL.md /Users/auge2u/github/habitusnet/mcp-d365-BC/skills/bc-diagnose/SKILL.md
```

**Step 2: Verify `package.json` already includes `skills/` in files**

```bash
node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.assert(p.files.includes('skills/'), 'skills/ missing from files'); console.log('OK')"
```

Run from `/Users/auge2u/github/habitusnet/mcp-d365-BC`.

Expected: `OK` (it's already there from the v2 plan)

**Step 3: Verify skills will be included in npm pack**

```bash
cd /Users/auge2u/github/habitusnet/mcp-d365-BC
npm pack --dry-run 2>&1 | grep "skills/"
```

Expected: lines like `skills/bc-query/SKILL.md`, `skills/bc-admin/SKILL.md`, `skills/bc-diagnose/SKILL.md`

**Step 4: Commit to monorepo**

```bash
cd /Users/auge2u/github/habitusnet
git add mcp-d365-BC/skills/
git commit -m "feat: bundle bc365-skills skill files in npm package"
```

---

### Task 7: Add install hint to onboard.js

**Files:**
- Modify: `lib/onboard.js` (last two lines of `onboard()`)
- Modify: `tests/onboard.test.js` (add assertion)

**Step 1: Write the failing test first**

In `tests/onboard.test.js`, add this test inside the `describe('onboard', ...)` block (after the existing tests):

```js
test('prints plugin install hint after writing config', async () => {
  getEnvironments.mockResolvedValue([
    { name: 'Production', type: 'Production', aadTenantId: 'tenant-123' },
  ]);
  getCompanies.mockResolvedValue([{ id: 'co-guid', name: 'Contoso' }]);
  getPermissions.mockResolvedValue({ present: ['D365 BUS FULL ACCESS'], missing: [] });

  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  await onboard({ tenantId: 'tenant-123', output: '.mcp.json' });
  consoleSpy.mockRestore();

  const calls = consoleSpy.mock.calls.map(c => c[0]);
  expect(calls.some(m => m.includes('claude plugin install'))).toBe(true);
  expect(calls.some(m => m.includes('habitusnet/bc365-skills'))).toBe(true);
});
```

**Step 2: Run the test to verify it fails**

```bash
cd /Users/auge2u/github/habitusnet/mcp-d365-BC
node --experimental-vm-modules node_modules/.bin/jest tests/onboard.test.js -t "prints plugin install hint" 2>&1 | tail -20
```

Expected: FAIL — the hint is not printed yet.

**Step 3: Add the hint to `lib/onboard.js`**

After the last `console.log` in `onboard()` (the `✓ Saved profile` line), add:

```js
  console.log(`\nTo get BC-aware Claude skills, run:\n  claude plugin install habitusnet/bc365-skills`);
```

The full end of `onboard()` after the change:

```js
  const name = profileName ?? `${selectedEnv.aadTenantId}/${envName}`;
  await saveProfile(name, ctx);
  console.log(`✓ Saved profile '${name}'`);
  console.log(`\nTo get BC-aware Claude skills, run:\n  claude plugin install habitusnet/bc365-skills`);
}
```

**Step 4: Run all tests to verify they pass**

```bash
cd /Users/auge2u/github/habitusnet/mcp-d365-BC
node --experimental-vm-modules node_modules/.bin/jest --coverage 2>&1 | tail -30
```

Expected: all tests pass, no regressions.

**Step 5: Commit to monorepo**

```bash
cd /Users/auge2u/github/habitusnet
git add mcp-d365-BC/lib/onboard.js mcp-d365-BC/tests/onboard.test.js
git commit -m "feat: print claude plugin install hint after onboard"
```

---

## Phase 3 — Publish

### Task 8: Bump version and publish v2.1.0

**Files:**
- Modify: `mcp-d365-BC/package.json` (version field only)

**Step 1: Bump the version**

In `/Users/auge2u/github/habitusnet/mcp-d365-BC/package.json`, change:

```json
"version": "2.0.0",
```
to:
```json
"version": "2.1.0",
```

**Step 2: Run tests one final time**

```bash
cd /Users/auge2u/github/habitusnet/mcp-d365-BC
node --experimental-vm-modules node_modules/.bin/jest 2>&1 | tail -10
```

Expected: all tests pass.

**Step 3: Commit version bump**

```bash
cd /Users/auge2u/github/habitusnet
git add mcp-d365-BC/package.json
git commit -m "chore: bump to v2.1.0"
```

**Step 4: Extract clean subtree, force-push main, tag, and push tag**

This is the same monorepo-path-prefix dance used for v2.0.0:

```bash
cd /Users/auge2u/github/habitusnet

TREE=$(git write-tree --prefix=mcp-d365-BC/)
COMMIT=$(git commit-tree "$TREE" -m "feat: bc365 v2.1.0 — skills bundle + onboard hint")
echo "Clean commit: $COMMIT"

git push origin "${COMMIT}:refs/heads/main" --force

git tag -f v2.1.0 "$COMMIT"
git push origin v2.1.0 --force
```

**Step 5: Verify GitHub Actions triggered**

```bash
sleep 8
gh run list --repo habitusnet/mcp-d365-BC --limit 3
```

Expected: a new `Publish to npm` run `in_progress` triggered by the `v2.1.0` tag push.

**Step 6: Watch the publish run**

```bash
gh run watch --repo habitusnet/mcp-d365-BC $(gh run list --repo habitusnet/mcp-d365-BC --json databaseId --jq '.[0].databaseId')
```

Expected: all steps green, `✓ Run npm publish --provenance --access public`.
