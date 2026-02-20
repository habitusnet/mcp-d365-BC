---
name: bc-items
description: Browse the Business Central item catalog and check stock levels
---

# /bc365:items — Browse Item Catalog and Inventory

Browse the Business Central item catalog, check stock levels, and identify items needing attention.

## Workflow

### Step 1 — Parse the user's input

Check whether the user provided a search term with the command (e.g. `/bc365:items chair` or `/bc365:items 80100`).

- If a term is provided, call `list_items` on `items` with:
  `$filter=contains(displayName,'{term}') or number eq '{term}'&$top=30&$orderby=number asc`
- If no term is provided, call `list_items` on `items` with:
  `$top=30&$orderby=number asc`

Use `$select=number,displayName,unitPrice,inventory,unitOfMeasureCode,type,blocked`.

### Step 2 — Display results

Render a table:

```
| Item No. | Description | Unit Price | Inventory | UoM | Type | Status |
|----------|-------------|------------|-----------|-----|------|--------|
| 80100 | Office Chair | 349.00 | 42 | PCS | Inventory | OK |
| 80200 | Standing Desk | 799.00 | 0 | PCS | Inventory | ⚠ No stock |
| 80300 | Retired Lamp | 59.00 | -3 | PCS | Inventory | ⚠ Negative |
| 80400 | Blocked Widget | 0.00 | 5 | PCS | Inventory | 🚫 BLOCKED |
```

Formatting rules:
- `unitPrice`: two decimal places, thousands separator
- `inventory`: integer; if `<= 0`, flag as noted below
- `blocked`: if `true` or non-empty block value → `🚫 BLOCKED`
- `inventory == 0` (and not blocked) → `⚠ No stock`
- `inventory < 0` (and not blocked) → `⚠ Negative`
- Otherwise → `OK`

### Step 3 — Result count and highlights

Below the table, print: `Showing {n} item(s).`

If any items are blocked or have zero/negative inventory, add a summary:
```
Attention: {x} item(s) with no/negative stock · {y} blocked item(s)
```

### Step 4 — Offer follow-up actions

```
What would you like to do next?
- "show purchase orders for [item]" — view open purchase orders containing this item
- "show sales history for [item]" — view past sales for this item
- "update price for [item]" — change the unit price
```

## Edge Cases

- **No results**: Print "No items matched '{term}'. Try the item number directly or a broader description."
- **Schema check**: If any required field is absent from the response, call `get_schema('items')` once and note which fields are available, then re-display with available data only.
- **Large catalog**: Always cap at 30 items. If exactly 30 returned, add: "Showing top 30 results. Use a search term to narrow down."
