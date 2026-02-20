# Testing Checklist — bc365 Plugin v1.0.0

This document covers the beta test plan for the bc365 plugin. Tests must be run against a real BC tenant; mock data cannot substitute for live BC API responses.

## Prerequisites

- [ ] `setup.sh` has been run with no errors
- [ ] `az login` or service principal credentials are configured
- [ ] `BC_URL_SERVER`, `BC_COMPANY`, and `BC_AUTH_TYPE` are set correctly
- [ ] Plugin is installed in Claude Cowork or Claude Code (`.claude-plugin/plugin.json` visible)

---

## 1. Plugin Load

| Check | Expected | Pass |
|-------|----------|------|
| Plugin appears in plugin list | bc365 listed with name and description | ☐ |
| No MCP server errors on startup | bc-admin and bc-data both start without errors | ☐ |
| bc-admin auth popup appears | Browser opens on first bc-admin tool call | ☐ |
| bc-data connects to BC API | First `list_items` call returns 200 (not 404/401) | ☐ |

---

## 2. bc-admin: Environment Operations

| Command | Input | Expected | Pass |
|---------|-------|----------|------|
| `/bc365:environments` | No args | Table of environments with Name/Type/Status/Version | ☐ |
| `/bc365:environments` | Production env name | Filtered to that environment with app count | ☐ |
| List environments | Sandbox env | Shows Sandbox type correctly | ☐ |

---

## 3. bc-data: Customer Queries

| Command | Input | Expected | Pass |
|---------|-------|----------|------|
| `/bc365:customers` | No args | Up to 20 customers sorted by name | ☐ |
| `/bc365:customers Contoso` | Name fragment | Filtered results containing "Contoso" | ☐ |
| `/bc365:customers 10000` | Customer number | Single customer record | ☐ |
| `/bc365:customers` | Blocked customer in data | ⚠ BLOCKED indicator shown | ☐ |
| No match | `/bc365:customers zzz` | "No customers matched" message | ☐ |

---

## 4. bc-data: Invoice Queries

| Command | Input | Expected | Pass |
|---------|-------|----------|------|
| `/bc365:invoices` | No args | Last 30 days, all statuses | ☐ |
| `/bc365:invoices open sales` | Direction + status | salesInvoices with status=Open | ☐ |
| `/bc365:invoices overdue` | Overdue filter | Open invoices past dueDate | ☐ |
| `/bc365:invoices this month purchases` | Date + direction | purchaseInvoices for current month | ☐ |
| Status icons | Mix of statuses | Correct icon for each (✓ Paid, → Open, ⚠ Overdue, ○ Draft) | ☐ |
| Direction prompt | Ambiguous input | Asks sales or purchase? | ☐ |

---

## 5. bc-data: Items

| Command | Input | Expected | Pass |
|---------|-------|----------|------|
| `/bc365:items` | No args | Up to 20 items with price and inventory | ☐ |
| `/bc365:items chair` | Name fragment | Filtered items | ☐ |
| `/bc365:items` | Item with zero stock | ⚠ Out of stock indicator | ☐ |
| `/bc365:items` | Blocked item | ✗ Blocked indicator | ☐ |

---

## 6. bc-data: G/L Journal

| Command | Input | Expected | Pass |
|---------|-------|----------|------|
| `/bc365:journal` | No args | Current month entries | ☐ |
| `/bc365:journal January 2026` | Month name | Jan 2026 date range filter applied | ☐ |
| `/bc365:journal Q1 2026` | Quarter | Jan–Mar 2026 range | ☐ |
| `/bc365:journal last month` | Relative period | Correct previous month range | ☐ |
| Balance check | Balanced journal | ✓ Journal is balanced message | ☐ |
| Balance check | Imbalanced journal | ⚠ Imbalance message with account list | ☐ |
| Result cap | Period with >1000 entries | Truncation warning shown | ☐ |

---

## 7. Natural Language Routing

| Input | Expected MCP server | Pass |
|-------|---------------------|------|
| "How many environments do we have?" | bc-admin | ☐ |
| "Show me overdue invoices" | bc-data | ☐ |
| "Update the update window to Sunday 2am" | bc-admin | ☐ |
| "What's the balance for customer 10000?" | bc-data | ☐ |
| "Install the app with ID abc-123" | bc-admin | ☐ |

---

## 8. Error Handling

| Scenario | Expected | Pass |
|----------|----------|------|
| Wrong `BC_COMPANY` GUID | 404 error message, no crash | ☐ |
| Expired `az login` token | 401 message with re-login instruction | ☐ |
| No results for date range | "No entries found" message (not empty table) | ☐ |
| bc-admin token timeout (~50 min) | Retry auto-refreshes silently | ☐ |

---

## Test Environments

Record which BC tenant/environment each test run was validated against:

| Tenant | Environment | Tester | Date | Result |
|--------|-------------|--------|------|--------|
| | | | | |
| | | | | |
| | | | | |

**Minimum for v1.0.0 release: 1 Production tenant + 1 Sandbox tenant passing all checks.**
