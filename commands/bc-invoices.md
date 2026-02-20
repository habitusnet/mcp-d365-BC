---
name: bc-invoices
description: List and filter Business Central sales or purchase invoices by status, date, or customer/vendor
---

# /bc365:invoices — List and Filter Invoices

List Business Central sales or purchase invoices with filtering by status, date range, or counterparty.

## Workflow

### Step 1 — Determine invoice direction

Analyse the user's message for direction signals:
- Contains "sales", "customer", or a customer name/number → use `salesInvoices`
- Contains "purchase", "vendor", "supplier", or a vendor name/number → use `purchaseInvoices`
- Direction is unclear → ask before proceeding: "Sales invoices (from customers) or purchase invoices (from vendors)?"

### Step 2 — Build the OData filter

Examine the user's message for filter intent and construct the `$filter` parameter:

| Intent | Filter |
|--------|--------|
| "open" / "unpaid" | `status eq 'Open'` |
| "overdue" | `status eq 'Open' and dueDate lt {today: YYYY-MM-DD}` |
| "last month" | `postingDate ge {first day of prev month} and postingDate le {last day of prev month}` |
| "this month" | `postingDate ge {first day of current month} and postingDate le {today}` |
| "Q1/Q2/Q3/Q4 YYYY" | Compute quarter start and end dates |
| "for [customer/vendor]" | `customerNumber eq '{no}'` or `vendorNumber eq '{no}'` |
| No filter stated | Last 30 days, all statuses |

Default query when no filter applies: `$filter=postingDate ge {30 days ago}&$top=25&$orderby=postingDate desc`.

Always add `$top=25` unless a specific narrow filter is applied. Use `$select` to request only needed fields.

### Step 3 — Call bc-data

Call `list_items` with the resolved resource and filter. Fields to select:

- Sales: `number,customerNumber,customerName,totalAmountIncludingTax,dueDate,status,postingDate`
- Purchase: `number,vendorNumber,vendorName,totalAmountIncludingTax,dueDate,status,postingDate`

### Step 4 — Display results

Render a table with a status icon prefix:

Status icons: `Draft` → `○` · `Open` → `→` · `Paid` → `✓` · `Overdue` (Open + past due) → `⚠` · `Cancelled` → `✗` · `In Review` → `◷` · `Corrective` → `↺`

Determine Overdue client-side: status is `Open` and `dueDate` is before today.

```
| Invoice No. | Customer / Vendor | Amount (incl. VAT) | Due Date | Status |
|-------------|-------------------|--------------------|----------|--------|
| SI-00123 | Contoso Ltd | 5,250.00 | 2026-01-15 | ⚠ Overdue |
| SI-00124 | Fabrikam Inc | 1,800.00 | 2026-03-01 | → Open |
```

### Step 5 — Summary

Below the table print:
```
Total: {n} invoice(s) · Open: {amount} · Overdue: {amount}
```

Calculate open and overdue amounts from the returned data.

### Step 6 — Offer follow-up actions

```
What would you like to do next?
- "show details for invoice [no.]" — full invoice lines and header
- "show all overdue" — filter to overdue only
- "create invoice for [customer]" — start a new sales invoice
```

## Edge Cases

- **No results**: "No invoices matched your filter. Try broadening the date range or removing the status filter."
- **Missing dueDate**: Treat as not overdue; show `—` in Due Date column.
