# bc365 — MCP Config Manager for Business Central

`@habitusnet/bc365` is a CLI that auto-discovers your Microsoft Dynamics 365 Business Central environments and writes `.mcp.json` for use with Claude / MCP-compatible AI tools.

## v2 — Smart Onboarding

Instead of manually editing `.mcp.json`, use the CLI:

```bash
npx @habitusnet/bc365 onboard
```

Sign in with your Microsoft account. The CLI discovers your tenant, environments, and companies automatically, checks your BC permissions, and writes `.mcp.json`.

**Prerequisites:**
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

## Commands

| Command | Description |
|---|---|
| `bc365 onboard` | Auto-discover tenant, environments, companies; write `.mcp.json` |
| `bc365 profiles` | List saved profiles |
| `bc365 switch <profile>` | Switch to a saved profile |
| `bc365 check` | Check latest npm versions of bc365 packages |

## Multi-Tenant Usage

For agencies managing multiple clients, see [SETUP.md](SETUP.md#multi-tenant-usage-agencies).

## License

MIT
