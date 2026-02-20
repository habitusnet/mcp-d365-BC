# Setup Guide

## Prerequisites

- Node.js ≥ 20
- A Microsoft 365 tenant with Business Central
- `D365 BUS FULL ACCESS` permission in Business Central

## Quick Onboard (v2)

```bash
npx @habitusnet/bc365 onboard
```

Follow the device code flow: open the URL displayed in your terminal, enter the code, and sign in with your Microsoft account. The CLI will auto-discover your tenant, environments, and companies.

## Manual Setup (v1 style)

Copy `.mcp.json.example` to `.mcp.json` and fill in your values:

```bash
cp .mcp.json.example .mcp.json
# Edit .mcp.json with your tenant ID, company GUID, and environment name
```

See [.mcp.json.example](.mcp.json.example) for the template.

## Multi-Tenant Usage (Agencies)

After onboarding for a client, save their profile:

```bash
bc365 onboard --output /tmp/client-a-config.json
# Manually copy to .mcp.json, then save profile:
cp /tmp/client-a-config.json .mcp.json
```

Switch between client profiles:

```bash
bc365 profiles          # list saved profiles
bc365 switch client-a   # write client-a's config to .mcp.json
```

## Check Package Versions

```bash
bc365 check
```

Shows the latest published versions of all bc365-related packages from npm.

## Permission Errors

If onboarding warns about missing permissions, ask your BC admin to assign:

- Permission set: `D365 BUS FULL ACCESS`
- Or: `SUPER` (full access — development/sandbox only)

## Required Entra ID Permissions

The `bc365 CLI` Azure app requires:
- **Microsoft Dynamics ERP** → `user_impersonation` (delegated)
- **Microsoft Graph** → `User.Read` + `Directory.Read.All` (delegated)

Users consent on first sign-in (no admin pre-consent required for most tenants).
