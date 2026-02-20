---
name: bc-admin
description: This skill should be used when the user wants to manage Business Central environments, install or update apps, upload Per-Tenant Extensions (PTEs), manage active sessions, configure update windows, toggle feature flags, or manage admin notification recipients.
---

The bc-admin MCP server connects to the Business Central admin center API via the `d365bc-admin-mcp` package. It handles everything on the infrastructure side of BC — the things you would normally click through in the BC admin center portal at `https://businesscentral.dynamics.com/{tenantId}/admin`. If a request is about business data (customer records, invoices, item inventory), that belongs to bc-data instead. The distinction is worth enforcing firmly: bc-admin has no knowledge of company-level data, and mixing the two up wastes time.

## Authentication

bc-admin uses browser-based Microsoft Entra ID (formerly Azure AD) OAuth2. The first tool call in a session triggers a browser popup asking you to sign in with a Microsoft account that has BC admin center access. Once authenticated, the token is cached for approximately 50 minutes and auto-refreshes silently. If a call fails with an auth error after a long idle period, simply retry — the refresh cycle will re-establish the session. No manual token management is needed.

## Environment Operations

The environment tools cover the full lifecycle: listing all environments in the tenant (with their names, types, versions, and status), creating new environments (Production or Sandbox, with optional country/region), copying an existing environment to a new one (useful for creating UAT clones from Production), and deleting environments. Deletion is permanent and irreversible — always confirm explicitly with the user before calling `delete_environment`, and never do it against Production without a very deliberate instruction. Copying an environment is the safe alternative when someone asks to "set up a new sandbox from current production data."

## App Management

BC environments run a set of Microsoft base apps plus any installed ISV or custom apps. The app management tools let you list installed apps in an environment, install a new app by its app ID and version (pulled from AppSource or a partner feed), update an existing app to a newer version, and uninstall an app. App installs and updates in BC Online are asynchronous — the call queues the operation, and you need to poll or check the environment's app list afterward to confirm completion. If an update fails due to a dependency conflict, BC will report the blocking app; resolve that first.

## Session Management

Session tools let you list all active sessions in a specific environment and company, and end individual sessions by session ID. Sessions show the user, their start time, client type (Web, API, Background), and current activity. Ending a session in production should be done carefully — it immediately terminates that user's work. The most legitimate use cases are clearing a stuck background session that's blocking a job queue, or freeing a locked record that a disconnected user left open. Always prefer waiting or contacting the user before force-ending a production session.

## PTE (Per-Tenant Extension) Workflow

PTEs are custom `.app` files developed specifically for a tenant rather than published through AppSource. The typical upload workflow is: upload the `.app` file (or upload from a local folder for development scenarios) → poll for deployment status using the deployment ID returned by the upload call → once status shows "Succeeded", verify the app appears in the environment's installed app list. If deployment shows "Failed", the error message usually names the specific validation or dependency issue. Do not attempt to re-upload without resolving the failure reason first — BC will queue another failed attempt. Uninstalling a PTE follows the same pattern as uninstalling any app.

## Update Windows, Feature Flags, and Notifications

Update window tools let you view the currently configured maintenance window for an environment (the time slot when Microsoft can apply BC version updates) and set a new preferred window by day-of-week and hour. If a customer is complaining about unexpected downtime, checking and adjusting the update window is the first response. Feature flag tools activate or deactivate named BC preview features for a specific environment — useful for enabling features in a sandbox before they become mandatory. Notification tools manage which email addresses receive admin center alerts for an environment, such as update notifications or failed background job alerts.

## Auth Utilities

Two utility tools sit outside the main categories: `get_tenant_id` (resolves your tenant GUID from the authenticated session — handy when constructing API URLs) and `get_auth_token` (returns the current bearer token, which can be used to make direct admin API calls outside of the MCP tool set if needed).

