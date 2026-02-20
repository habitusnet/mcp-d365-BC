# Changelog

All notable changes to the bc365 plugin are documented here.

## [1.0.0] — 2026-02-20

### Added

- **Plugin manifest** (`.claude-plugin/plugin.json`) — registers bc365 as a Claude Cowork / Claude Code plugin
- **MCP server wiring** (`.mcp.json`) — connects bc-admin (`@demiliani/d365bc-admin-mcp`) and bc-data (`@knowall-ai/mcp-business-central`)
- **Setup script** (`setup.sh`) — prerequisite checker, automated install, and `--configure` flag for generating `.mcp.json.local` with literal credential values
- **Skill: bc-context** (`skills/bc-context.md`) — BC terminology and tenant/environment/company hierarchy
- **Skill: bc-admin** (`skills/bc-admin.md`) — routing guide for the 33 admin center tools
- **Skill: bc-data** (`skills/bc-data.md`) — OData v4 query patterns, entity reference, and write-permission notes
- **Command: /bc365:environments** (`commands/bc-environments.md`) — list and inspect BC environments in the tenant
- **Command: /bc365:customers** (`commands/bc-customers.md`) — search and display customer records
- **Command: /bc365:invoices** (`commands/bc-invoices.md`) — filter sales and purchase invoices
- **Command: /bc365:items** (`commands/bc-items.md`) — browse item catalog with inventory status
- **Command: /bc365:journal** (`commands/bc-journal.md`) — review G/L journal entries with balance check
- **Documentation** (`README.md`, `SETUP.md`) — quick start and full authentication walkthrough
- **Example config** (`.mcp.json.example`) — safe template with placeholder values for version control

### Security

- `.mcp.json` and `.mcp.json.local` excluded from version control via `.gitignore`
- Credential handling delegated to Azure CLI / Entra ID; no secrets stored in plugin files

### Known Limitations

- `setup.sh` fixes the npm executable-bit issue for macOS (`osx-arm64`) only; Linux users may need to adjust the binary path
- bc-data write operations require `D365 BUS FULL ACCESS` permission set assigned in BC — `az login` alone is not sufficient
- `$top=1000` cap on `/bc365:journal` queries means very large periods may show incomplete balance checks
