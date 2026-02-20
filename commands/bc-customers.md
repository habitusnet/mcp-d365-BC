---
name: bc-customers
description: Search and display Business Central customer records with balance and contact info
---

# /bc365:customers — Search and Display Customers

Search the Business Central customer list or browse the top customers by name.

## Workflow

### Step 1 — Parse the user's input

Examine whether the user supplied a search term alongside the command (e.g. `/bc365:customers Contoso` or `/bc365:customers 10000`).

- If the term looks like a customer number (all digits), search by field `number`.
- If the term is a name fragment, use `list_items` on `customers` with `$filter=contains(displayName,'{term}')&$top=25&$orderby=displayName asc`.
- If no search term is given, call `list_items` on `customers` with `$top=20&$orderby=displayName asc`.

Use the **bc-data** tool `list_items` or `get_items_by_field` depending on the case above.

### Step 2 — Select fields

Always request these fields via `$select`:
`number,displayName,balanceDue,paymentTermsId,phoneNumber,email,blocked`

### Step 3 — Display results

Render a table:

```
| No. | Name | Balance Due (LCY) | Payment Terms | Phone | Email | Status |
|-----|------|-------------------|---------------|-------|-------|--------|
| 10000 | Contoso Ltd | 4,250.00 | 30 Days | +41 44 ... | ... | OK |
| 10010 | Blocked Corp | 0.00 | 14 Days | | | ⚠ BLOCKED |
```

Formatting rules:
- `balanceDue`: right-align, two decimal places, thousands separator
- `blocked`: if `true` or any non-empty block value, show `⚠ BLOCKED`; otherwise show `OK`
- Missing phone or email: leave cell empty

### Step 4 — Result count

Below the table, print: `Showing {n} customer(s).`

If `balanceDue` is unavailable for any row (field not returned), show `—` and note: "Balance data not available — check OData API permissions."

### Step 5 — Offer follow-up actions

```
What would you like to do next?
- "show invoices for [customer]" — list all sales invoices for a customer
- "show open orders for [customer]" — list open sales orders
- "update [field] for [customer]" — modify a customer field
```

## Edge Cases

- **No results**: Print "No customers matched '{term}'. Try a shorter or different search term."
- **Blocked customers**: Always render the ⚠ BLOCKED indicator regardless of filter — never hide blocked status.
- **Large result sets**: Limit to 20 (no term) or 25 (with term). If exactly at the limit, add: "Showing top {n} results. Refine your search to narrow down."
