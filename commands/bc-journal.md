---
name: bc-journal
description: Review and analyse General Ledger journal entries for a period — supports month-end close workflows
---

# /bc365:journal — Review G/L Journal Entries

Review General Ledger journal entries for a period to support month-end close and reconciliation.

> **Read-only command.** This command queries data only. It does not post, modify, or reverse any G/L entries.

## Workflow

### Step 1 — Parse the period

Convert the user's natural language period into an OData date range filter:

| Input | Filter |
|-------|--------|
| "January 2026" / "Jan 2026" | `postingDate ge 2026-01-01 and postingDate le 2026-01-31` |
| "last month" | First and last day of the previous calendar month |
| "this month" | First day of current month to today |
| "Q1 2026" | `postingDate ge 2026-01-01 and postingDate le 2026-03-31` |
| Q2/Q3/Q4 YYYY | Apr–Jun / Jul–Sep / Oct–Dec accordingly |
| "this year" / "YTD" | Jan 1 of current year to today |
| "FY2025" | If fiscal year is known from context, use it; otherwise assume Jan–Dec |

If no period is stated, default to the current calendar month.

### Step 2 — Query G/L entries

Call `list_items` on `generalLedgerEntries` with:
- `$filter={date range filter from Step 1}`
- `$orderby=accountNumber asc,postingDate asc`
- `$select=accountNumber,accountName,debitAmount,creditAmount,postingDate,documentNumber,description`
- `$top=1000` (BC OData page limit; note if results are capped)

### Step 3 — Group and aggregate by account

Process the returned entries in memory. For each unique `accountNumber`:
- Sum all `debitAmount` values → Total Debits
- Sum all `creditAmount` values → Total Credits
- Net = Total Debits − Total Credits

Also compute grand totals across all accounts.

### Step 4 — Display summary table

Print a header: `G/L Journal — {period label} ({n} entries)`

```
| Account No. | Account Name | Total Debits | Total Credits | Net |
|-------------|--------------|--------------|---------------|-----|
| 1010 | Cash | 12,500.00 | 8,200.00 | 4,300.00 |
| 6100 | Salaries | 0.00 | 4,300.00 | -4,300.00 |
| ... | | | | |
| **Grand Total** | | **12,500.00** | **12,500.00** | **0.00** |
```

Right-align all numeric columns. Use two decimal places.

### Step 5 — Balance check

Compare grand total debits to grand total credits:

- Equal → `✓ Journal is balanced for {period}.`
- Not equal → `⚠ Imbalance of {|difference|} detected. Review entries for account(s): {list of account numbers where Net ≠ 0 unexpectedly}.`

### Step 6 — Detailed view on request or imbalance

If balance is off, automatically list individual entries for the imbalanced accounts:

```
| Date | Document No. | Description | Debit | Credit |
|------|-------------|-------------|-------|--------|
```

Also show this detail view if the user explicitly asks ("show details for account 1010").

### Step 7 — Offer follow-up actions

```
What would you like to do next?
- "show details for account [no.]" — list individual entries for that account
- "export to CSV format" — output all entries as CSV text
- "compare to prior period" — run the same query for the previous period
```

## Edge Cases

- **No entries found**: "No G/L entries found for {period}. Confirm the date range and that the correct company is configured."
- **Result cap hit**: If exactly 1000 rows returned, note: "Results may be truncated at 1000 entries. The balance check may be incomplete."
- **Missing accountName**: Fall back to `accountNumber` as the display name.
