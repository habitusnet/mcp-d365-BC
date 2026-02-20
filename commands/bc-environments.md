---
name: bc-environments
description: List all Business Central environments with status, type, and version
---

# /bc365:environments — List BC Environments

List all Business Central environments for the tenant with their current status, type, and version information.

## Workflow

### Step 1 — Fetch all environments

Call the **bc-admin** tool `getEnvironments` (or equivalent list-environments tool) to retrieve all environments for the current tenant. If the call requires authentication, a browser popup will appear — prompt the user: "Please allow the authentication popup to continue."

### Step 2 — Enrich each environment record

For each environment returned, collect or derive:
- **Name** — the environment identifier (e.g. `Production`, `Sandbox-UAT`)
- **Type** — `Production` or `Sandbox`
- **Status** — one of: `Active`, `Removing`, `Preparing`, `Failed`
- **Version** — the Business Central platform version (e.g. `25.3.12345.0`)
- **Apps** — count of installed apps; call `getInstalledApps` per environment if not included in the list response, using the environment name as the parameter

### Step 3 — Display results

Render a table in this format:

```
| Name | Type | Status | Version | Apps |
|------|------|--------|---------|------|
| Production | Production | Active | 25.3.12345 | 14 |
| Sandbox-UAT | Sandbox | Active | 25.3.12345 | 11 |
```

Status values should be rendered as plain text. Do not attempt colour coding in Markdown.

### Step 4 — Summary line

After the table, print a one-line summary:

```
Total: 3 environments — 1 Production, 2 Sandbox
```

If any environment has a status other than `Active`, call it out explicitly:

```
⚠ Sandbox-Dev is currently in status: Preparing
```

### Step 5 — Offer follow-up actions

End with this block (fill in real environment names from the results):

```
What would you like to do next?
- "show apps in [env]" — list installed apps for an environment
- "install app in [env]" — install an AppSource or PTE app
- "copy [env] to new sandbox" — clone an environment
```

## Edge Cases

- **No environments found**: Print "No environments found for this tenant. Verify the tenant ID configured in `.mcp.json`."
- **Auth required**: Prompt user to allow the browser popup before retrying.
- **Partial data**: If app count cannot be retrieved for an environment, show `—` in the Apps column and note it below the table.
