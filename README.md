# bc365

> Connect Claude Code to Microsoft Dynamics 365 Business Central in two commands.

```bash
npx @habitusnet/bc365 onboard
claude plugin install habitusnet/bc365-skills
```

---

## What It Does

`bc365 onboard` signs you in with Microsoft, discovers your BC environments and companies, and registers two MCP servers directly with Claude Code:

| MCP Server | Purpose |
|------------|---------|
| `bc-data` | Read and write BC data — customers, items, orders, G/L entries via OData |
| `bc-admin` | Manage environments, apps, feature flags, and user sessions |

`claude plugin install habitusnet/bc365-skills` adds three Claude skills that tell Claude how to use those servers effectively.

---

## Prerequisites

- [Claude Code](https://docs.anthropic.com/claude-code) installed
- Node.js ≥ 20
- Microsoft 365 account with access to Business Central
- `D365 BUS FULL ACCESS` permission set in BC

---

## Installation

### Global install (recommended)

```bash
npm install -g @habitusnet/bc365
bc365 onboard
```

### One-off (no install)

```bash
npx @habitusnet/bc365 onboard
```

---

## Onboarding

```bash
bc365 onboard
```

1. A device code URL is printed — open it in your browser and sign in with your Microsoft account
2. The CLI discovers your tenant, environments, and companies
3. Checks your BC permission sets and warns if anything is missing
4. Registers `bc-data` and `bc-admin` with Claude Code

Servers are registered at **local scope** by default — stored in `.claude/settings.local.json`, gitignored, per-user. Use `--scope` to change this:

| Scope | Stored in | Use when |
|-------|-----------|----------|
| `local` *(default)* | `.claude/settings.local.json` | Per-user, gitignored — recommended |
| `user` | `~/.claude.json` | All projects for this user |
| `project` | `.mcp.json` | Shared team config, committed to git |

```bash
bc365 onboard                   # local scope (default)
bc365 onboard --scope project   # writes .mcp.json for the whole team
```

After onboarding, install the skill bundle:

```bash
claude plugin install habitusnet/bc365-skills
```

---

## Claude Skills

The [`habitusnet/bc365-skills`](https://github.com/habitusnet/bc365-skills) plugin teaches Claude how to use the MCP servers:

| Skill | What it covers |
|-------|----------------|
| `bc-query` | OData filters, `$expand` for line items, pagination, write operations |
| `bc-admin` | Environment inspection, app update workflow, feature flags, session management |
| `bc-diagnose` | HTTP/OData error interpretation, permission set reference, diagnostic workflow |

Skills are also bundled in this package under `skills/` for offline access.

---

## Multi-Tenant Usage (Agencies)

Each `bc365 onboard` run saves a profile. Switch between clients without re-authenticating:

```bash
# Onboard client A (saves profile automatically)
bc365 onboard

# Later: switch to client B
bc365 switch client-b-profile

# List all saved profiles
bc365 profiles
```

`bc365 switch` accepts the same `--scope` flag as `onboard`.

---

## All Commands

| Command | Description |
|---------|-------------|
| `bc365 onboard [-s local\|user\|project]` | Discover tenant/env/company and register MCP servers |
| `bc365 switch <profile> [-s local\|user\|project]` | Re-register servers from a saved profile |
| `bc365 profiles` | List saved profiles |
| `bc365 check` | Check latest npm versions of bc365 packages |

---

## MCP Servers

Both servers are vendored mirrors with daily upstream sync and security scanning:

| Server | Upstream | npm command |
|--------|----------|-------------|
| `bc-admin` | [`habitusnet/d365bc-admin-mcp`](https://github.com/habitusnet/d365bc-admin-mcp) | `d365bc-admin-mcp` |
| `bc-data` | [`habitusnet/mcp-business-central`](https://github.com/habitusnet/mcp-business-central) | `npx @habitusnet/mcp-business-central` |

---

## Troubleshooting

**Auth errors (`401`)** — run `az login` to refresh Azure CLI credentials, or re-run `bc365 onboard`.

**Missing permissions warning** — ask your BC admin to assign `D365 BUS FULL ACCESS` in Settings → Users → Permission Sets.

**`claude: command not found`** — Claude Code must be installed and on your PATH before running `bc365 onboard`.

---

## License

MIT
