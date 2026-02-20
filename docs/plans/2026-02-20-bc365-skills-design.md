# bc365 Skills Bundle — Design

**Goal:** Ship a Claude Code skill bundle for Microsoft Dynamics 365 Business Central that covers querying, admin operations, and error diagnosis — distributed both as a standalone Claude Code plugin repo and bundled inside the `@habitusnet/bc365` npm package.

**Architecture:** Skills-only plugin (no commands, no hooks). Two repos with CI-synced skill files. `bc365 onboard` prints an install hint at the end.

**Tech Stack:** Claude Code plugin format (`plugin.json` + `SKILL.md` files), GitHub Actions for sync, existing `@habitusnet/bc365` CLI.

---

## Repository Structure

### `habitusnet/bc365-skills` (new — Claude Code plugin repo)

```
skills/
  bc-query/
    SKILL.md       # how to query BC data via bc-data MCP server
  bc-admin/
    SKILL.md       # how to use bc-admin MCP for env/company/permission ops
  bc-diagnose/
    SKILL.md       # how to interpret BC errors and API failures
plugin.json        # Claude Code marketplace manifest
README.md
.github/workflows/
  sync-to-bc365.yml   # pushes updated skills to mcp-d365-BC on change
```

### `habitusnet/mcp-d365-BC` (existing — adds skills/ directory)

```
skills/
  bc-query/SKILL.md
  bc-admin/SKILL.md
  bc-diagnose/SKILL.md
```

Already reserved in `package.json` `files` array — ships with `@habitusnet/bc365`.

---

## Skill Content

### `bc-query/SKILL.md`

Teaches Claude to use the `bc-data` MCP server (`mcp__bc-data__*` tools):

- **Entities:** customers, vendors, items, sales orders, purchase orders, G/L entries — exact tool names per entity
- **OData filters:** `$filter`, `$select`, `$top`, `$orderby` syntax BC supports
- **Company context:** read active profile via `bc365 profiles` to get correct company GUID
- **Pagination:** `@odata.nextLink` pattern for large result sets
- **Read-only guidance:** bc-data is read-only; mutations go through AL APIs or BC UI

### `bc-admin/SKILL.md`

Teaches Claude to use the `bc-admin` MCP server (`mcp__bc-admin__*` tools):

- **Environments:** list, describe, compare schemas
- **Companies:** list within an environment, get company GUID
- **Permissions:** check user permissions, identify missing permission sets
- **Auth:** when to run `bc365 logout` to clear a stale token
- **Profile switching:** `bc365 switch <profile>` to change active environment/company

### `bc-diagnose/SKILL.md`

Teaches Claude to interpret BC HTTP and OData errors:

- **401 Unauthorized** → token expired → `bc365 logout && bc365 onboard`
- **403 Forbidden** → missing permission set → use bc-admin to check permissions
- **404 Not Found** → wrong company GUID or endpoint path → verify profile
- **429 Too Many Requests** → BC rate limit → exponential back-off, avoid broad `$top` queries
- **OData error codes** → human-readable explanation and fix
- Cross-references `bc-admin` skill for permission lookup steps

---

## `plugin.json`

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

---

## Sync Mechanism

`bc365-skills/.github/workflows/sync-to-bc365.yml`:
- Triggers on push to `main` when any `skills/**` file changes
- Uses `gh` CLI to open a PR on `mcp-d365-BC` that copies updated `skills/` files
- PR title: `chore: sync skills from bc365-skills vX.Y.Z`
- `mcp-d365-BC` maintainer reviews and merges → triggers npm patch release

---

## `bc365 onboard` Install Hint

After writing `.mcp.json`, print:

```
✓ Wrote .mcp.json
✓ Saved profile 'acme-prod'

To get BC-aware Claude skills, run:
  claude plugin install habitusnet/bc365-skills
```

No `--install-skills` flag — just a hint. Keeps onboard simple.

---

## Out of Scope (v1)

- Slash commands (`/bc365:query`, `/bc365:admin`)
- Hooks
- AL development skill (deferred to v2)
- Automatic skill installation from `bc365 onboard`
