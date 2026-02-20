# bc365 — Claude Cowork Plugin for Business Central: Setup Guide

This guide walks you through connecting the **bc365 Claude Cowork plugin** to your Microsoft Business Central (BC) environment. No developer experience required — if you can navigate BC and your company's Azure portal, you can follow this guide on your own.

The plugin has two parts:

| Server | What it does | Auth method |
|--------|-------------|-------------|
| **bc-admin** | Manages BC environments, users, extensions | Browser sign-in (Microsoft account) |
| **bc-data** | Reads/writes business data (customers, invoices, etc.) | Azure CLI login or Service Principal |

---

## Prerequisites

Before you start, make sure you have the following. If anything is missing, the links below will take you to the right place.

| Requirement | Why you need it | How to check |
|-------------|----------------|--------------|
| **macOS with Apple Silicon (M1/M2/M3)** | The bc-admin binary is built for osx-arm64 | `uname -m` in Terminal → should say `arm64` |
| **Node.js v16 or higher** | Runs the plugin packages | `node --version` in Terminal |
| **npm** | Installs the bc-admin package | `npm --version` in Terminal |
| **Homebrew** | Used to install Azure CLI | `brew --version` in Terminal |
| **Azure CLI** | Authenticates your data connection to BC | `az --version` in Terminal |
| **BC Admin access** | Required for the bc-admin server | Ask your IT admin if unsure |
| **Your BC tenant ID** | Part of the API URL | Find it in Azure Portal → Azure Active Directory → Overview → Tenant ID |
| **Your BC environment name** | Part of the API URL | Visible in BC top-right menu or URL bar (e.g., `Production`, `Sandbox`) |
| **Your BC company display name** | Tells the plugin which company to read data from | BC → top-right gear icon → My Settings → Company |

If Node.js or Homebrew are missing, install them first:

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js (if not already installed)
brew install node
```

---

## Step 1 — Run setup.sh

The setup script does the heavy lifting: it checks your environment, installs the bc-admin package, fixes a known permissions issue with the binary, and tells you exactly what still needs to be done.

Open Terminal, navigate to the folder where you cloned or copied this repo, then run:

```bash
bash setup.sh
```

**What it checks:**

- Node.js is v16 or higher
- npm is available
- `@demiliani/d365bc-admin-mcp` package is installed globally (it installs it if not)
- The bc-admin binary has the correct executable permission (it fixes this automatically — see Troubleshooting if you hit an EACCES error)
- `d365bc-admin-mcp` command is on your PATH
- Azure CLI is installed and you are logged in
- `BC_URL_SERVER` and `BC_COMPANY` environment variables are set

**What a successful run looks like:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  bc365 — Claude Cowork Plugin Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

→ Checking Node.js...
✓ Node.js 22.4.0
✓ npm 10.8.1
→ Checking @demiliani/d365bc-admin-mcp...
✓ @demiliani/d365bc-admin-mcp installed
✓ Binary is executable
✓ d365bc-admin-mcp is on PATH
→ Checking Azure CLI...
✓ Azure CLI 2.61.0
✓ Azure CLI logged in (tenant: a1b2c3d4-e5f6-7890-abcd-ef1234567890)
→ Checking Business Central environment variables...
✓ BC_URL_SERVER = https://api.businesscentral.dynamics.com/v2.0/a1b2c3d4-e5f6-7890-abcd-ef1234567890/Production/api/v2.0
✓ BC_COMPANY = CRONUS International Ltd.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Setup complete!
```

If anything shows a red `✗`, read the message printed beneath it — it tells you exactly what to do. Warnings (`⚠`) are things to be aware of but won't stop the plugin from working.

**Optional flag — generate a config file with your values baked in:**

Some versions of Claude Cowork do not expand `${ENV_VAR}` placeholders in the plugin config. If that applies to you, run:

```bash
bash setup.sh --configure
```

This generates a file called `.mcp.json.local` with your actual tenant URL and company name filled in. **Do not commit this file** — it is listed in `.gitignore` for this reason.

---

## Step 2 — Configure bc-admin (admin server)

The bc-admin server is used for environment-level tasks: listing BC environments, managing users, checking which extensions are installed, and similar administrative work.

**How authentication works:**

- The first time Cowork calls bc-admin, a browser window opens automatically.
- Sign in with your Microsoft account — the same account you use to access BC as an admin.
- Your session token is cached for approximately 50 minutes and renews automatically while you are actively using the plugin.
- You do not need to create any app registrations or configure any secrets for bc-admin.

**First-run browser auth walkthrough:**

1. Send any bc-admin request in Cowork, for example: *"List all my Business Central environments."*
2. A browser window opens showing the standard Microsoft sign-in page.
3. Sign in with your BC admin Microsoft account (the one with admin rights in BC).
4. If your organisation uses multi-factor authentication (MFA), complete the MFA prompt as usual.
5. The browser will show a confirmation page saying the authentication was successful. You can close the tab.
6. Return to Cowork — the response to your original question will appear within a few seconds.

After the first sign-in, you will not be prompted again until the token expires (about 50 minutes of inactivity).

---

## Step 3 — Configure bc-data (business data server)

The bc-data server is what lets Cowork read and write your actual business data: customers, vendors, sales orders, invoices, general ledger entries, and more.

This server needs to know **where** your BC is (the API URL) and **which company** to use, plus valid credentials to authenticate. There are two authentication methods. Choose one:

- **Step 3a — Azure CLI (recommended):** You log in interactively using your browser. Best for personal use on your own machine.
- **Step 3b — Service Principal:** Uses an app registration and secret. Best for automated setups or shared machines.

---

## Step 3a — Azure CLI (recommended)

**What is Azure CLI?** It is a command-line tool that lets you sign in to Microsoft Azure services, including Business Central. Once you are signed in, the bc-data plugin automatically uses your credentials — no passwords or secrets to manage in config files.

**Install Azure CLI:**

```bash
brew install azure-cli
```

**Sign in to Azure:**

```bash
az login
```

Your browser will open. Sign in with your Microsoft account (the same one you use for BC). Once signed in, close the browser tab and return to Terminal.

**If your organisation has multiple Azure tenants**, sign in to the specific tenant that hosts your BC:

```bash
az login --tenant a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

Replace `a1b2c3d4-e5f6-7890-abcd-ef1234567890` with your actual tenant ID (see Step 4 for how to find it).

**Verify you are signed in:**

```bash
az account show
```

You should see your account details and tenant ID in the output.

---

## Step 3b — Service Principal (alternative for automated setups)

Use this method if you are setting up the plugin on a shared machine, in a CI/CD pipeline, or anywhere that interactive browser sign-in is not practical.

**What you need:**

- An **App Registration** in Azure Active Directory (your IT admin can create this)
- The app registration must have the BC API permission **`Financials.ReadWrite.All`** granted in Azure AD
- In BC itself, the app registration must be added as a user and assigned the **`D365 BUS FULL ACCESS`** permission set (your BC admin does this via BC → Settings → User Setup)
- Three values from the app registration: **Tenant ID**, **Client ID**, and **Client Secret**

**Where to find these values in the Azure portal:**

- **Tenant ID:** Azure Portal → Azure Active Directory → Overview → Tenant ID
- **Client ID:** Azure Portal → Azure Active Directory → App registrations → your app → Overview → Application (client) ID
- **Client Secret:** Azure Portal → Azure Active Directory → App registrations → your app → Certificates & secrets → your secret value (copy it when created — it is only shown once)

Once you have those values, set them as environment variables (see Step 4 for how to do this permanently).

---

## Step 4 — Set environment variables

Environment variables are settings that live in your shell's configuration file (`~/.zshrc`) and are automatically available every time you open Terminal. Think of them as persistent preferences your terminal remembers.

**Finding your values:**

**Tenant ID:** Log in to the [Azure Portal](https://portal.azure.com), go to **Azure Active Directory → Overview**. The Tenant ID is the GUID shown under your organisation name. It looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Environment name:** In BC, click the settings gear (top right) → **My Settings**. Your environment name is shown in the BC URL after you sign in, for example `Production`, `Sandbox`, or `UAT`.

**Company name:** In BC, click the settings gear (top right) → **My Settings → Company**. Copy the name exactly as shown — it is case-sensitive.

**The BC API URL format:**

```
https://api.businesscentral.dynamics.com/v2.0/{tenantId}/{environmentName}/api/v2.0
```

**Concrete examples:**

```
# Production environment
https://api.businesscentral.dynamics.com/v2.0/a1b2c3d4-e5f6-7890-abcd-ef1234567890/Production/api/v2.0

# Sandbox environment
https://api.businesscentral.dynamics.com/v2.0/a1b2c3d4-e5f6-7890-abcd-ef1234567890/Sandbox/api/v2.0

# Custom environment named UAT
https://api.businesscentral.dynamics.com/v2.0/a1b2c3d4-e5f6-7890-abcd-ef1234567890/UAT/api/v2.0
```

**Adding the variables to your shell (Azure CLI auth — recommended):**

Open `~/.zshrc` in any text editor and add these lines at the bottom. Replace the example values with your real ones:

```bash
# Business Central — bc365 Claude Cowork Plugin
export BC_URL_SERVER="https://api.businesscentral.dynamics.com/v2.0/a1b2c3d4-e5f6-7890-abcd-ef1234567890/Production/api/v2.0"
export BC_COMPANY="CRONUS International Ltd."
export BC_AUTH_TYPE="azure_cli"
```

**Adding the variables to your shell (Service Principal auth):**

```bash
# Business Central — bc365 Claude Cowork Plugin (service principal)
export BC_URL_SERVER="https://api.businesscentral.dynamics.com/v2.0/a1b2c3d4-e5f6-7890-abcd-ef1234567890/Production/api/v2.0"
export BC_COMPANY="CRONUS International Ltd."
export BC_AUTH_TYPE="client_credentials"
export BC_TENANT_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
export BC_CLIENT_ID="b2c3d4e5-f6a7-8901-bcde-f12345678901"
export BC_CLIENT_SECRET="your-client-secret-value-here"
```

**Apply the changes without restarting Terminal:**

```bash
source ~/.zshrc
```

**Verify the variables are set:**

```bash
echo $BC_URL_SERVER
echo $BC_COMPANY
```

Both should print your values, not blank lines.

---

## Step 5 — Verify in Cowork

Once setup is complete, confirm that both servers are connected and working.

**1. Check that both MCP servers are connected:**

In Cowork, run:

```
/mcp
```

You should see both `bc-admin` and `bc-data` listed with a connected status. If either shows as disconnected, re-run `bash setup.sh` to check what is missing.

**2. Test bc-admin:**

Ask Cowork:

> *"List all my Business Central environments."*

Cowork should respond with a list of your BC environments (e.g., Production, Sandbox). If a browser window opens first, complete the sign-in as described in Step 2.

**3. Test bc-data:**

Ask Cowork:

> *"Show me the first 5 customers in Business Central."*

Cowork should return a list of customer records from your BC company. If you see an error instead, check the Troubleshooting section below.

---

## Troubleshooting

### `d365bc-admin-mcp: command not found`

**What this means:** The bc-admin command was installed but your Terminal cannot find it because npm's global bin folder is not in your PATH.

**Fix:**

```bash
export PATH="$(npm config get prefix)/bin:$PATH"
```

To make this permanent (so you don't have to run it every time), add the line above to your `~/.zshrc`:

```bash
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Then verify:

```bash
which d365bc-admin-mcp
```

It should print a path. If it still says "not found", run `bash setup.sh` again — it will diagnose the issue.

---

### bc-admin server fails to start / EACCES error

**What this means:** The bc-admin binary was installed but npm did not mark it as executable (a known bug in this package's install script). macOS refuses to run a binary that is not marked executable.

**Quick fix — re-run setup (recommended):**

```bash
bash setup.sh
```

The script detects and fixes this automatically.

**Manual fix:**

```bash
chmod +x $(npm root -g)/@demiliani/d365bc-admin-mcp/build/osx-arm64/D365BCAdminMCP
```

After running either fix, restart Cowork and try again.

---

### bc-data returns 401 Unauthorized

**What this means:** Your Azure credentials are either not present or have expired. Azure CLI tokens expire after a period of inactivity.

**Fix — log in again:**

```bash
az login
```

If your organisation has multiple tenants, log in to the specific one that hosts BC:

```bash
az login --tenant a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

Verify you are now logged in:

```bash
az account show
```

Then retry your request in Cowork. If you are using service principal auth and get a 401, check that `BC_CLIENT_SECRET` has not expired — secrets created in Azure have an expiry date. Your IT admin can create a new one if needed.

---

### bc-data returns 404 or returns no data

**What this means:** The plugin connected successfully but could not find the company or the URL is pointing to the wrong place. This is almost always a mismatch in `BC_COMPANY` or `BC_URL_SERVER`.

**Fix — check your company name:**

1. Open Business Central in your browser.
2. Click the **gear icon** in the top-right corner.
3. Click **My Settings**.
4. Look at the **Company** field. Copy the name exactly — including capitalisation, spaces, and punctuation.
5. Update `BC_COMPANY` in `~/.zshrc` to match exactly.
6. Run `source ~/.zshrc` and retry.

**Fix — check your API URL:**

Your `BC_URL_SERVER` must follow this exact format with `/api/v2.0` at the end:

```
https://api.businesscentral.dynamics.com/v2.0/{tenantId}/{environmentName}/api/v2.0
```

Common mistakes:

| Wrong | Right |
|-------|-------|
| `…/Production` (missing suffix) | `…/Production/api/v2.0` |
| `…/production/api/v2.0` (lowercase) | `…/Production/api/v2.0` |
| `…/sandbox/api/v2.0` (wrong environment) | `…/Sandbox/api/v2.0` |
| Wrong tenant ID | Check Azure AD → Overview → Tenant ID |

Run `echo $BC_URL_SERVER` in Terminal to see exactly what is set, and compare it carefully to the format above.

---

## Need help?

If you have worked through the troubleshooting steps above and the plugin still isn't working, collect the following and share with your IT admin or the plugin maintainer:

- Output of `bash setup.sh` (copy-paste from Terminal)
- Output of `az account show`
- Output of `echo $BC_URL_SERVER && echo $BC_COMPANY && echo $BC_AUTH_TYPE`
- The exact error message shown in Cowork
