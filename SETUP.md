# Setup Guide

## Prerequisites

- Node.js ≥ 20
- [Claude Code](https://docs.anthropic.com/claude-code) installed
- A Microsoft 365 tenant with Business Central
- `D365 BUS FULL ACCESS` permission in Business Central

## Quick Start

```bash
npm install -g @habitusnet/bc365
bc365 onboard
claude plugin install habitusnet/bc365-skills
```

Follow the device code flow: the CLI prints a URL — open it, enter the code, and sign in with your Microsoft account. It will auto-discover your tenant, environments, and companies, then register both MCP servers with Claude Code.

## Scope Options

By default `bc365 onboard` registers servers at **local scope** (`.claude/settings.local.json`, gitignored). To share config with your team, use project scope:

```bash
bc365 onboard --scope project   # writes .mcp.json — commit this to git
```

## Multi-Tenant Usage (Agencies)

Each `onboard` run saves a named profile. Switch between clients without re-authenticating:

```bash
# First client — profile saved automatically as <tenantId>/<envName>
bc365 onboard

# Onboard a second client
bc365 onboard

# List all profiles
bc365 profiles

# Switch to a different client (re-registers MCP servers)
bc365 switch <profile-name>
bc365 switch <profile-name> --scope project   # re-register at project scope
```

## Check Package Versions

```bash
bc365 check
```

Shows the latest published version of `@habitusnet/bc365` from npm.

## Permission Errors

If onboarding warns about missing permissions, ask your BC admin to assign the permission set in the BC UI (Settings → Users → select user → Permission Sets):

- `D365 BUS FULL ACCESS` — general read/write (recommended)
- `SUPER` — full access (development/sandbox only)

## Required Entra ID Permissions

The `bc365 CLI` Azure app requires:
- **Microsoft Dynamics ERP** → `user_impersonation` (delegated)
- **Microsoft Graph** → `User.Read` + `Directory.Read.All` (delegated)

Users consent on first sign-in — no admin pre-consent required for most tenants.
