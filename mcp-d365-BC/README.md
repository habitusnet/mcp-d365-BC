# bc365 — MCP Config Manager for Business Central

`@habitusnet/bc365` is a CLI that connects Claude Code to Microsoft Dynamics 365 Business Central — auto-discovering your environments, registering MCP servers, and installing BC-aware Claude skills.

## Quick Start

```bash
npx @habitusnet/bc365 onboard
```

Sign in with your Microsoft account. The CLI discovers your tenant, environments, and companies automatically, checks your BC permissions, and registers both MCP servers with Claude Code.

Then install the Claude Code skill bundle:

```bash
claude plugin install habitusnet/bc365-skills
```

**Prerequisites:**
- Claude Code installed (`npm install -g @anthropic-ai/claude-code`)
- Microsoft 365 / Azure AD account with access to Business Central
- Business Central environment with `D365 BUS FULL ACCESS` permission set

---

## Installation

```bash
npm install -g @habitusnet/bc365
```

Or use without installing:

```bash
npx @habitusnet/bc365 onboard
```

## What `bc365 onboard` Does

1. Opens a Microsoft device code login in your browser
2. Discovers your BC environments and companies
3. Checks your permission sets
4. Registers two MCP servers with Claude Code (`claude mcp add-json -s local`):
   - **`bc-data`** — query and update BC data via OData (customers, items, orders, G/L entries)
   - **`bc-admin`** — manage environments, apps, feature flags, and sessions

Servers are registered at local scope (`.claude/settings.local.json`, gitignored and per-user). Pass `--scope` to override:

| Scope | Stored in | Use when |
|-------|-----------|----------|
| `local` (default) | `.claude/settings.local.json` | Per-user, gitignored — recommended |
| `user` | `~/.claude.json` | All projects for this user |
| `project` | `.mcp.json` | Shared team config, committed to git |

```bash
bc365 onboard                        # local scope (default)
bc365 onboard --scope project        # writes .mcp.json
bc365 switch habitusnet-prod         # re-register saved profile at local scope
bc365 switch habitusnet-prod --scope user  # re-register at user scope
```

## Claude Code Skills

After onboarding, install the companion skill bundle:

```bash
claude plugin install habitusnet/bc365-skills
```

This gives Claude three skills:

| Skill | Description |
|-------|-------------|
| `bc-query` | Query and update BC data — OData filters, expand for line items, pagination |
| `bc-admin` | Manage environments, apps, feature flags, sessions |
| `bc-diagnose` | Interpret BC HTTP/OData errors and suggest fixes |

Skills are also bundled in this package under `skills/` for offline use.

## Commands

| Command | Description |
|---------|-------------|
| `bc365 onboard [-s local\|user\|project]` | Discover and register MCP servers |
| `bc365 switch <profile> [-s local\|user\|project]` | Re-register servers from a saved profile |
| `bc365 profiles` | List saved profiles |
| `bc365 check` | Check latest npm versions of bc365 packages |

## Multi-Tenant Usage

For agencies managing multiple clients, see [SETUP.md](SETUP.md#multi-tenant-usage-agencies).

## MCP Servers

| Server | Package | Purpose |
|--------|---------|---------|
| `bc-data` | [`@habitusnet/mcp-business-central`](https://github.com/habitusnet/mcp-business-central) | OData read/write on BC entities |
| `bc-admin` | [`habitusnet/d365bc-admin-mcp`](https://github.com/habitusnet/d365bc-admin-mcp) | BC Admin Center API |

Both are vendored mirrors with daily upstream sync and security scanning.

## License

MIT
