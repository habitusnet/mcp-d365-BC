#!/usr/bin/env bash
# bc365 — Claude Cowork plugin for Microsoft 365 Business Central
# Setup script: installs prerequisites, validates environment, optionally configures .mcp.json
# Usage: bash setup.sh [--configure]

set -euo pipefail

RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[1;33m'
BLU='\033[0;34m'
NC='\033[0m'

ok()   { echo -e "${GRN}✓${NC} $*"; }
warn() { echo -e "${YLW}⚠${NC}  $*"; }
fail() { echo -e "${RED}✗${NC} $*"; ERRORS=$((ERRORS+1)); }
info() { echo -e "${BLU}→${NC} $*"; }

ERRORS=0
CONFIGURE=false
[[ "${1:-}" == "--configure" ]] && CONFIGURE=true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  bc365 — Claude Cowork Plugin Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Node.js ────────────────────────────────────────
info "Checking Node.js..."
if command -v node &>/dev/null; then
  NODE_VER=$(node --version | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [[ "$NODE_MAJOR" -ge 16 ]]; then
    ok "Node.js $NODE_VER"
  else
    fail "Node.js $NODE_VER found — need v16 or higher"
    echo "    Install: brew install node"
  fi
else
  fail "Node.js not found"
  echo "    Install: brew install node"
fi

# ── 2. npm ────────────────────────────────────────────
info "Checking npm..."
if command -v npm &>/dev/null; then
  ok "npm $(npm --version)"
else
  fail "npm not found (should come with Node.js)"
fi

# ── 3. @demiliani/d365bc-admin-mcp (bc-admin server) ─
info "Checking @demiliani/d365bc-admin-mcp..."
BC_ADMIN_BIN=""
if npm list -g @demiliani/d365bc-admin-mcp &>/dev/null; then
  BC_ADMIN_BIN="$(npm root -g)/@demiliani/d365bc-admin-mcp/build/osx-arm64/D365BCAdminMCP"
  ok "@demiliani/d365bc-admin-mcp installed"
else
  info "Installing @demiliani/d365bc-admin-mcp globally..."
  npm install -g @demiliani/d365bc-admin-mcp
  BC_ADMIN_BIN="$(npm root -g)/@demiliani/d365bc-admin-mcp/build/osx-arm64/D365BCAdminMCP"
  ok "@demiliani/d365bc-admin-mcp installed"
fi

# Fix missing executable bit (npm postinstall bug)
if [[ -f "$BC_ADMIN_BIN" && ! -x "$BC_ADMIN_BIN" ]]; then
  info "Fixing executable permission on osx-arm64 binary..."
  chmod +x "$BC_ADMIN_BIN"
  ok "Binary is now executable"
elif [[ -x "$BC_ADMIN_BIN" ]]; then
  ok "Binary is executable"
else
  # Try linux-x64 fallback (shouldn't happen on macOS but be safe)
  BC_ADMIN_BIN="$(npm root -g)/@demiliani/d365bc-admin-mcp/build/linux-x64/D365BCAdminMCP"
  if [[ -f "$BC_ADMIN_BIN" ]]; then
    chmod +x "$BC_ADMIN_BIN"
    warn "Using linux-x64 binary (expected osx-arm64 — check your architecture)"
  else
    fail "Could not find D365BCAdminMCP binary after install"
    echo "    Try: npm uninstall -g @demiliani/d365bc-admin-mcp && npm install -g @demiliani/d365bc-admin-mcp"
  fi
fi

# Verify d365bc-admin-mcp is on PATH
if command -v d365bc-admin-mcp &>/dev/null; then
  ok "d365bc-admin-mcp is on PATH"
else
  fail "d365bc-admin-mcp not on PATH"
  warn "Run: export PATH=\"\$(npm config get prefix)/bin:\$PATH\""
  warn "Add that line to your ~/.zshrc to make it permanent"
fi

# ── 4. Azure CLI (bc-data auth) ───────────────────────
info "Checking Azure CLI..."
if command -v az &>/dev/null; then
  ok "Azure CLI $(az version --query '"azure-cli"' -o tsv 2>/dev/null || az --version | head -1 | awk '{print $2}')"
  # Check if logged in
  if az account show &>/dev/null 2>&1; then
    TENANT=$(az account show --query tenantId -o tsv 2>/dev/null || echo "unknown")
    ok "Azure CLI logged in (tenant: $TENANT)"
  else
    warn "Azure CLI installed but not logged in"
    warn "Run: az login"
    warn "Then: az account set --subscription <your-subscription>"
  fi
else
  warn "Azure CLI not found — needed for bc-data (business data) server"
  echo "    Install: brew install azure-cli"
  echo "    Then:    az login"
  echo ""
  echo "    Alternative: use service principal auth by setting:"
  echo "      BC_AUTH_TYPE=client_credentials"
  echo "      BC_TENANT_ID=<your-tenant-id>"
  echo "      BC_CLIENT_ID=<your-app-registration-id>"
  echo "      BC_CLIENT_SECRET=<your-client-secret>"
fi

# ── 5. BC environment variables check ─────────────────
echo ""
info "Checking Business Central environment variables..."
BC_VARS_OK=true

if [[ -z "${BC_URL_SERVER:-}" ]]; then
  warn "BC_URL_SERVER not set"
  echo "    Set it to your BC API URL, e.g.:"
  echo "    https://api.businesscentral.dynamics.com/v2.0/<tenant-id>/<environment>/api/v2.0"
  BC_VARS_OK=false
else
  ok "BC_URL_SERVER = $BC_URL_SERVER"
fi

if [[ -z "${BC_COMPANY:-}" ]]; then
  warn "BC_COMPANY not set"
  echo "    Set it to your company display name exactly as it appears in BC, e.g.:"
  echo "    CRONUS International Ltd."
  BC_VARS_OK=false
else
  ok "BC_COMPANY = $BC_COMPANY"
fi

if [[ "$BC_VARS_OK" == "false" ]]; then
  echo ""
  echo "  Add these to your ~/.zshrc (or use direnv in this project directory):"
  echo ""
  echo "    export BC_URL_SERVER=\"https://api.businesscentral.dynamics.com/v2.0/<tenant-id>/<environment>/api/v2.0\""
  echo "    export BC_COMPANY=\"Your Company Name\""
  echo "    export BC_AUTH_TYPE=\"azure_cli\"  # or client_credentials"
  echo ""
fi

# ── 6. Optional: generate .mcp.json with literal values ─
if [[ "$CONFIGURE" == "true" ]]; then
  echo ""
  info "Generating .mcp.json with your current env vars..."
  if [[ -z "${BC_URL_SERVER:-}" || -z "${BC_COMPANY:-}" ]]; then
    warn "Skipping .mcp.json generation — BC_URL_SERVER and BC_COMPANY must be set"
    warn "Set them and re-run: bash setup.sh --configure"
  else
    cat > .mcp.json.local <<EOF
{
  "mcpServers": {
    "bc-admin": {
      "type": "stdio",
      "command": "d365bc-admin-mcp"
    },
    "bc-data": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@knowall-ai/mcp-business-central"],
      "env": {
        "BC_URL_SERVER": "${BC_URL_SERVER}",
        "BC_COMPANY": "${BC_COMPANY}",
        "BC_AUTH_TYPE": "${BC_AUTH_TYPE:-azure_cli}"
      }
    }
  }
}
EOF
    ok "Generated .mcp.json.local with your literal values"
    warn ".mcp.json.local is in .gitignore — do NOT commit it (contains your tenant URL)"
    info "If \${VAR} expansion doesn't work in your Cowork version, copy .mcp.json.local to .mcp.json"
  fi
fi

# ── 7. Summary ────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ "$ERRORS" -eq 0 ]]; then
  echo -e "${GRN}  ✓ Setup complete!${NC}"
  echo ""
  echo "  Next steps:"
  echo "  1. Set BC_URL_SERVER and BC_COMPANY in your shell (if not done)"
  echo "  2. Run: az login  (if not already logged in)"
  echo "  3. In Claude Cowork: /plugin install  → select bc365"
  echo "  4. First bc-admin query triggers browser auth (Microsoft Entra ID)"
  echo "  5. Try: 'List all my Business Central environments'"
else
  echo -e "${RED}  ✗ Setup completed with $ERRORS error(s)${NC}"
  echo ""
  echo "  Fix the errors above and re-run: bash setup.sh"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit $ERRORS
