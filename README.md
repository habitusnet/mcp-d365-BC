# bc365

bc365 connects Claude Code and Claude Cowork to Microsoft Dynamics 365 Business Central. It wires two Model Context Protocol (MCP) servers into Claude — `bc-admin` for environment and tenant administration and `bc-data` for OData v4 CRUD on any BC entity — and ships three skills that teach Claude BC-specific terminology, admin routing patterns, and OData query conventions. The result is a single AI workspace for both operational queries and infrastructure management across all your BC tenants.

With bc365 active, you can ask Claude to list production environments, pull customer records, review journal entries, or diagnose stalled sessions without leaving your editor. The plugin bundles five slash commands as entry points for the most common workflows, while the underlying MCP servers expose 33 admin tools and open-ended data access so Claude can go deeper whenever the task requires it. Authentication is handled once per session — browser-based Entra ID for admin operations and `az login` (or a service principal) for data access — and the included `setup.sh` script handles all installation plumbing automatically.

## Quick Start

1. Clone this repo and run `bash setup.sh` — it installs both MCP packages globally and applies the required `chmod` fix on macOS.
2. Copy `.mcp.json.example` to `.mcp.json` and fill in your `BC_URL_SERVER` and `BC_COMPANY` values.
3. Add the contents of `.mcp.json` to your Claude Code or Cowork MCP configuration, then restart.
4. Type `/bc365:environments` to verify the connection.

See [SETUP.md](SETUP.md) for full authentication details, service principal configuration, and troubleshooting.

## Commands

| Command | Description |
|---|---|
| `/bc365:environments` | List all Business Central environments across tenants |
| `/bc365:customers` | Query, filter, and inspect customer records |
| `/bc365:invoices` | Filter open, overdue, and posted sales or purchase invoices |
| `/bc365:items` | Browse and filter the item catalogue with inventory status |
| `/bc365:journal` | Review G/L journal entries with automatic balance check |

## Prerequisites

Node.js 16 or later is required. Install with Homebrew:

```bash
brew install node
```

Azure CLI is required for data-layer authentication (`az login`):

```bash
brew install azure-cli
```

The npm global package directory must be writable. `setup.sh` handles the `chmod` fix automatically, but if you manage npm prefix manually, ensure your global bin is on `PATH`.

---

**Version:** 1.0.0 | **Author:** Habitusnet
