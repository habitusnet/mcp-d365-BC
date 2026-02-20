# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] — Unreleased

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

