---
name: bc-data
description: This skill should be used when the user wants to query, create, update, or delete Business Central business records — customers, vendors, invoices, items, G/L entries, or accounts — via the OData API.
---

The bc-data MCP server wraps the Business Central OData v4 API (the BC endpoint path `/api/v2.0` refers to the BC API version, not the OData protocol version) via the `@knowall-ai/mcp-business-central` package. It provides six tools that cover the full CRUD surface: schema discovery, queries, field lookups, and write operations. All requests go to a specific BC environment and company, set via the `BC_URL_SERVER` and `BC_COMPANY` environment variables. `BC_URL_SERVER` should be the base URL of your BC environment API (e.g. `https://api.businesscentral.dynamics.com/v2.0/{tenantId}/{environmentName}/api/v2.0`), and `BC_COMPANY` should be the company GUID. If either is missing or wrong, every call will fail with a 404 or connection error.

## Authentication

By default, `@knowall-ai/mcp-business-central` authenticates using Azure CLI credentials — run `az login` once and the package picks up the token automatically. This is the zero-friction path for interactive use. For unattended or CI scenarios, a service principal can be used instead by setting the appropriate client ID, client secret, and tenant ID credentials in the environment. Either way, the identity must have access to the BC environment through Entra ID.

## Write Permissions

Read operations (GET) work for any authenticated user with at least viewer-level access to the BC company. Write operations — `create_item`, `update_item`, and `delete_item` — require the calling user or service principal to hold the **`D365 BUS FULL ACCESS`** permission set within BC, or a more specific page-level permission set that grants INSERT/MODIFY/DELETE on the relevant table. BC enforces this at the application layer, not just the API layer, so even a valid Entra ID token will receive a 403 if the BC permission set is not assigned. Default `az login` users typically have read-only API access unless a BC administrator has explicitly assigned write permissions. If write calls return 403, that is the first thing to check — not the token, not the URL.

## The Six Tools

**`get_schema(resource)`** — Call this first when working with an unfamiliar entity. It returns all fields, their types, and whether they are editable. This prevents filter syntax errors caused by guessing field names (BC field names are camelCase and sometimes unintuitive, e.g. `balanceDue` not `balance_due`).

**`list_items(resource, filter, top, skip, orderby, select)`** — The main workhorse for queries. `resource` is the OData entity name (e.g. `customers`, `salesInvoices`). All other parameters are optional: `filter` is an OData `$filter` expression, `top` limits results (use this to avoid returning thousands of rows), `skip` offsets for pagination, `orderby` sorts, and `select` restricts which fields come back. When in doubt, use `select` to keep responses lean.

**`get_items_by_field(resource, field, value)`** — Convenience shorthand for a single-field equality filter. Use it for quick lookups like finding a customer by their `number` or an item by `displayName`. For anything more complex, use `list_items` with a full filter expression.

**`create_item(resource, data)`** — POSTs a new record. `data` must be a JSON object with the required fields for that entity. Always call `get_schema` first on an unfamiliar resource to know which fields are mandatory. BC will reject the POST with a 400 and an error message if required fields are missing or if a number series has not been configured for that document type.

**`update_item(resource, id, data)`** — PATCHes an existing record by its GUID `id`. Only include the fields you want to change — BC merges the patch, it does not replace the full record. Note that many fields on posted documents (e.g. a posted sales invoice) are immutable; attempts to modify them will return a 400.

**`delete_item(resource, id)`** — DELETEs a record by GUID. Most BC documents can only be deleted if they are in Draft status — attempting to delete a posted document returns a 400 with a BC application-layer error, not a permissions error.

## Common Entities and Key Fields

- **`customers`**: `number`, `displayName`, `balanceDue`, `paymentTermsId`, `phoneNumber`, `email`, `blocked`
- **`vendors`**: `number`, `displayName`, `balance`, `paymentTermsId`, `currencyCode`
- **`items`**: `number`, `displayName`, `unitPrice`, `inventory`, `unitOfMeasureCode`, `blocked`
- **`salesInvoices`**: `number`, `customerNumber`, `totalAmountIncludingTax`, `dueDate`, `status` — values: `Draft`, `In Review`, `Open`, `Paid`, `Cancelled`, `Corrective`
- **`purchaseInvoices`**: `number`, `vendorNumber`, `totalAmountIncludingTax`, `dueDate`, `status`
- **`generalLedgerEntries`**: `accountNumber`, `accountName`, `debitAmount`, `creditAmount`, `postingDate`, `description`
- **`accounts`**: `number`, `displayName`, `category`, `subCategory`, `currentBalance`, `accountType`

## OData Filter Patterns

BC uses standard OData v4 filter syntax. These are the patterns that come up constantly:

```
Status filter:      $filter=status eq 'Open'
Date range:         $filter=postingDate ge 2026-01-01 and postingDate le 2026-01-31
Text search:        $filter=contains(displayName,'Contoso')
Overdue invoices:   $filter=status eq 'Open' and dueDate lt 2026-02-20
Combined:           $filter=customerNumber eq 'C00010' and status eq 'Open'
```

When translating natural language to filters: "last month" means calculate the first and last day of the prior calendar month and use a `ge`/`le` date range; "overdue" means `dueDate lt {today} and status eq 'Open'`; "this quarter" means the first day of the current fiscal quarter to today. Always compute the concrete dates rather than passing natural language strings — OData does not interpret them.

## Pagination

BC OData endpoints return a maximum of 100 records by default. Use `$top` to set an explicit limit and `$skip` to offset. For large datasets, follow the `@odata.nextLink` URL returned in the response — it encodes the next page's `$skip` automatically. When asked for "all" records of a large entity, use pagination rather than requesting unbounded results.

## Error Reference

- **401**: Token expired or not acquired — re-run `az login` or refresh credentials.
- **403**: Valid token but missing BC permission set — a BC admin must assign `D365 BUS FULL ACCESS` or equivalent to the user or service principal in BC.
- **404**: Wrong resource name, wrong company GUID, or wrong environment URL. Verify `BC_URL_SERVER`, `BC_COMPANY`, and that the entity name is spelled exactly as BC expects (case-sensitive).
- **400**: Malformed filter expression, missing required field on create, or attempt to modify an immutable field on a posted document. The error body from BC usually names the specific problem field.

