# Changelog

All notable changes to this project will be documented in this file.

## [2.2.7] — 2026-02-20

### Added
- `bc365 onboard --target claude-desktop` writes MCP servers directly into `claude_desktop_config.json`, merging with any existing config and preserving other keys
- `bc365 switch <profile> --target claude-desktop` does the same from a saved profile
- Both commands print "Restart Claude Desktop to apply changes." when using the claude-desktop target

## [2.2.6] — 2026-02-20

### Changed
- README rewritten: two-command quick start, scope table, skills section, multi-tenant workflow, troubleshooting
- SETUP.md updated: removed stale v1/`--output` references, updated multi-tenant section for `bc365 switch`

## [2.2.5] — 2026-02-20

### Changed
- README: documents `--scope` flag with reference table and examples for `onboard` and `switch`

## [2.2.4] — 2026-02-20

### Fixed
- `bc365 onboard --help` now shows `--scope` instead of the removed `--output` flag
- `bc365 switch` now re-registers MCP servers via `claude mcp add-json -s <scope>` instead of writing `.mcp.json`; accepts the same `--scope` option as `onboard`

## [2.2.3] — 2026-02-20

### Changed
- CHANGELOG backfilled for all v2.x releases

## [2.2.2] — 2026-02-20

### Changed
- README rewritten to reflect v2.2 — documents `claude mcp add-json` registration, skills bundle, `--scope` option, and MCP server table

## [2.2.1] — 2026-02-20

### Changed
- `bc365 onboard` skill sync: bundled `skills/bc-query/SKILL.md` now includes `$expand` pattern for sales/purchase order lines and invoice lines

## [2.2.0] — 2026-02-20

### Changed
- `bc365 onboard` now registers MCP servers via `claude mcp add-json -s local` instead of writing `.mcp.json`; servers land in `.claude/settings.local.json` (gitignored, per-user) and appear in `claude mcp list`
- New `scope` option (default: `'local'`); pass `scope: 'project'` to restore the old `.mcp.json` behaviour
- CI: `npm audit` now scoped to production dependencies (`--omit=dev`) to ignore test-tool advisories

## [2.1.0] — 2026-02-20

### Added
- Claude Code skill bundle: `skills/bc-query`, `skills/bc-admin`, `skills/bc-diagnose` bundled in the npm package
- `bc365 onboard` prints install hint: `claude plugin install habitusnet/bc365-skills`
- Companion plugin repo `habitusnet/bc365-skills` with sync CI (auto-opens PR on this repo when skills change)

## [2.0.0] — 2026-02-20

### Added
- `bc365 onboard` CLI: auto-discovers tenant, environments, companies via Entra ID device code flow, writes `.mcp.json`
- `bc365 switch <profile>` for multi-tenant profile management
- `bc365 profiles` command to list saved profiles
- `bc365 check` command to check latest npm versions of bc365 packages
- Entra ID multi-tenant app (`bc365 CLI`) with device code flow authentication
- Token caching via OS keychain (`keytar`)
- Vendored mirror repos with daily upstream-watch and security scanning:
  - `habitusnet/d365bc-admin-mcp`
  - `habitusnet/mcp-business-central`
- npm package published as `@habitusnet/bc365`
- CI: Jest tests, npm audit, CodeQL on every PR

### Changed
- Package name changed to `@habitusnet/bc365` for scoped npm distribution
- Minimum Node.js version: 20

---

