# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a zero-dependency, client-side single-page application using vanilla JavaScript, a single HTML file, one CSS file (`css/style.css`), and one JS module (`js/app.js`). The app follows a unidirectional data flow with a full re-render cycle on every state change. All state is persisted in `localStorage`. Chart.js 4.x is loaded via CDN for pie chart rendering.

## Tasks

- [x] 1. Scaffold project structure and HTML shell
  - Create `index.html` with semantic HTML5 structure: sections for Input_Form, Balance_Display, Transaction_List, and Pie_Chart
  - Add `<link>` tag for `css/style.css` and `<script>` tags for Chart.js CDN and `js/app.js` (defer)
  - Create `css/style.css` as an empty file
  - Create `js/app.js` with an IIFE wrapper containing placeholder module stubs
  - Add the `<canvas id="pie-chart">` element and `<div id="error-banner">` element in HTML
  - _Requirements: 10.1, 10.2, 10.3, 9.2_

- [x] 2. Implement the Compute module (pure functions)
  - [x] 2.1 Implement `compute.formatIDR(amount)`
    - Accept a non-negative integer and return a string prefixed with "Rp ", using period (`.`) as thousands separator with no decimal places
    - Handle edge cases: 0 → `"Rp 0"`, 12500 → `"Rp 12.500"`, 1234567 → `"Rp 1.234.567"`
    - _Requirements: 11.2, 3.4, 2.2_

  - [ ]* 2.2 Write property test for `compute.formatIDR` (Property 6)
    - **Property 6: IDR format is applied consistently**
    - Use `fc.integer({ min: 0, max: 999999999999 })` to verify output always starts with "Rp ", uses `.` as thousands separator, has no decimal point, and has correct digit grouping
    - **Validates: Requirements 11.2**

  - [x] 2.3 Implement `compute.totalBalance(transactions)`
    - Sum all transaction `amount` fields in the array; return 0 for an empty array
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 2.4 Write property test for `compute.totalBalance` (Property 4)
    - **Property 4: Balance equals sum of all transaction amounts**
    - Use `fc.array(validTransactionArb)` and verify the return value equals `transactions.reduce((s, t) => s + t.amount, 0)`
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 2.5 Implement `compute.categoryTotals(transactions)`
    - Return a `Map<string, number>` keyed by category with summed amounts; exclude categories with a zero total
    - _Requirements: 4.1, 4.6_

  - [ ]* 2.6 Write property test for pie chart percentages (Property 5)
    - **Property 5: Pie chart slice percentages sum to 100**
    - Use `fc.array(validTransactionArb, { minLength: 1 })` to verify category percentages derived from `compute.categoryTotals` sum to 100 (±0.5% rounding tolerance)
    - **Validates: Requirements 4.1, 4.5**

  - [x] 2.7 Implement `compute.sortTransactions(transactions, { field, direction })`
    - Support sorting by `amount` (asc/desc) and `category` (asc/desc A-Z); return original order when `field` is null
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 2.8 Write property test for `compute.sortTransactions` (Property 11)
    - **Property 11: Sort preserves all transactions**
    - Use `fc.array(validTransactionArb)` combined with `fc.constantFrom('amount','category')` and `fc.constantFrom('asc','desc')` to verify the sorted list contains exactly the same set of transaction ids
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [x] 2.9 Implement `compute.monthlySummary(transactions)`
    - Group transactions by calendar month/year, return `{ label: string, total: number }[]` in reverse chronological order
    - _Requirements: 7.1, 7.2_

- [x] 3. Implement the Validator module (pure functions)
  - [x] 3.1 Implement `validator.validateTransaction({ name, amount, category })`
    - Validate: name non-empty and ≤ 100 chars; amount is a whole integer in [1, 999999999999]; category is a non-empty string
    - Reject decimal amounts with error "Amount must be a whole number (no decimals)"
    - Return `{ valid: true }` or `{ valid: false, errors: { name?, amount?, category? } }`
    - _Requirements: 1.3, 1.4, 11.1, 11.3_

  - [ ]* 3.2 Write property test for whitespace name rejection (Property 2)
    - **Property 2: Whitespace-only and empty names are rejected**
    - Use `fc.stringMatching(/^\s*$/)` and verify `validator.validateTransaction` returns `valid: false` with a `name` error
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 3.3 Write property test for amount bounds (Property 3)
    - **Property 3: Amount bounds are enforced**
    - Use `fc.oneof(fc.integer({ max: 0 }), fc.integer({ min: 1000000000000 }))` to verify validator returns `valid: false` with an `amount` error for out-of-range values
    - **Validates: Requirements 1.3, 1.4**

  - [x] 3.4 Implement `validator.validateCategory(name, existingCategories)`
    - Reject empty/whitespace strings, names > 50 chars, and case-insensitive duplicates
    - Return `{ valid: true }` or `{ valid: false, error: string }`
    - _Requirements: 6.4_

- [ ] 4. Checkpoint — Verify pure function modules
  - Ensure all tests pass for `compute` and `validator` modules. Ask the user if questions arise.

- [x] 5. Implement the Storage module
  - [x] 5.1 Implement `storage.isAvailable()`
    - Test `localStorage` with a probe write/read/delete; return `boolean`
    - _Requirements: 9.5, 5.4_

  - [x] 5.2 Implement `storage.load()` and `storage.save(transactions)`
    - `load()`: read `"expense_transactions"` key, parse JSON, return `{ ok: true, data }` or `{ ok: false, error }` on parse failure
    - `save(transactions)`: serialize to JSON and write; catch write errors and return `{ ok: false, error }`
    - _Requirements: 5.1, 5.4, 5.5, 5.6_

  - [x] 5.3 Implement `storage.loadCategories()` and `storage.saveCategories(cats)`
    - Mirror load/save for the `"expense_categories"` key (stores only custom categories, not built-ins)
    - _Requirements: 6.3_

  - [ ]* 5.4 Write property test for transaction serialization round-trip (Property 7)
    - **Property 7: Transaction serialization round-trip**
    - Use `fc.array(validTransactionArb)` to verify `JSON.parse(JSON.stringify(transactions))` produces a deeply equal result
    - **Validates: Requirements 5.1, 5.4**

- [x] 6. Implement CategoryManager module
  - [x] 6.1 Implement `categoryManager.init()`, `categoryManager.getAll()`, and `categoryManager.add(name)`
    - `init()`: load custom categories from storage; prepend `['Food', 'Transport', 'Fun']` at runtime
    - `getAll()`: return built-ins plus custom categories
    - `add(name)`: validate with `validator.validateCategory`, enforce 20-custom-category limit, persist to storage
    - Return `{ ok: true }` or `{ ok: false, error }` from `add()`
    - _Requirements: 1.2, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.2 Write property test for custom category uniqueness (Property 8)
    - **Property 8: Custom category uniqueness (case-insensitive)**
    - Use `fc.array(fc.string({ minLength: 1, maxLength: 50 }))` to verify that adding a duplicate name (any casing) returns `{ ok: false }` and leaves the list unchanged
    - **Validates: Requirements 6.4**

  - [ ]* 6.3 Write property test for custom category limit (Property 9)
    - **Property 9: Custom category limit enforcement**
    - Use `fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 20, maxLength: 20 })` (all unique) to reach the limit and verify the next `add()` call returns `{ ok: false }`
    - **Validates: Requirements 6.5**

- [x] 7. Implement TransactionManager module
  - [x] 7.1 Implement `txManager.init()`
    - Call `storage.load()`; on parse failure discard data and initialize empty; surface errors for the render layer
    - _Requirements: 5.1, 5.5_

  - [x] 7.2 Implement `txManager.add(tx)`
    - Generate UUID via `crypto.randomUUID()` (with fallback), attach `createdAt` ISO timestamp, append to in-memory array, call `storage.save()`; if save fails, retain in memory and return `{ ok: false, error }` for the render layer
    - _Requirements: 1.5, 5.4, 5.6_

  - [x] 7.3 Implement `txManager.remove(id)`
    - Remove the transaction from the in-memory array, call `storage.save()`; if save fails, revert removal in memory and return `{ ok: false, error }`
    - _Requirements: 2.5, 2.6, 5.4_

  - [ ]* 7.4 Write property test for delete removes exactly one (Property 10)
    - **Property 10: Delete removes exactly the targeted transaction**
    - Use `fc.array(validTransactionArb, { minLength: 1 })` to verify that after `txManager.remove(id)` the list no longer contains that id and its length is exactly one less
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 7.5 Write property test for add grows the list by one (Property 1)
    - **Property 1: Adding a transaction grows the list by exactly one**
    - Use a valid transaction arbitrary to verify that after `txManager.add(tx)` the list length increases by exactly 1
    - **Validates: Requirements 1.3, 1.5**

- [ ] 8. Checkpoint — Verify storage and manager modules
  - Ensure all tests pass for `storage`, `categoryManager`, and `txManager` modules. Ask the user if questions arise.

- [x] 9. Implement ChartManager module
  - [x] 9.1 Implement `chartManager.init(canvasId)` and `chartManager.update(categoryTotals)`
    - `init()`: create a Chart.js doughnut/pie instance on the given canvas id; store the instance to prevent duplicate registrations
    - `update(categoryTotals)`: compute per-category percentages (rounded to 1 decimal), update `chart.data.labels` and `chart.data.datasets[0].data`, call `chart.update()`
    - Assign distinct colors per category slice
    - _Requirements: 4.1, 4.5, 4.6, 11.6_

  - [x] 9.2 Implement `chartManager.destroy()`
    - Call `chart.destroy()` if an instance exists; reset the stored reference
    - _Requirements: 4.1_

- [x] 10. Implement Render module
  - [x] 10.1 Implement `render.balance()`
    - Read total from `compute.totalBalance(txManager.getAll())`, format with `compute.formatIDR()`, write to the Balance_Display DOM element
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 11.4_

  - [x] 10.2 Implement `render.transactionList()`
    - Build list items from `txManager.getAll()` (optionally sorted via `compute.sortTransactions`), display Item Name, IDR-formatted Amount, and Category for each
    - Render a delete button per item (use `data-id` attribute for delegation)
    - Show "No transactions added yet" message when the list is empty
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 11.5_

  - [x] 10.3 Implement `render.pieChart()`
    - Pass `compute.categoryTotals(txManager.getAll())` to `chartManager.update()`
    - Show "No spending data available" text message in place of the chart when there are no transactions
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 10.4 Implement `render.categoryDropdown()`
    - Populate the category `<select>` with options from `categoryManager.getAll()`; preserve the default unselected state
    - _Requirements: 1.2, 6.2_

  - [x] 10.5 Implement `render.showError(message)`, `render.clearErrors()`, `render.showFieldError(fieldId, message)`, `render.clearFieldErrors()`
    - `showError`: inject message into `#error-banner`, auto-dismiss after 5 seconds
    - `clearErrors`: hide and empty the banner
    - `showFieldError`: inject a `<span class="field-error">` adjacent to the target field
    - `clearFieldErrors`: remove all `.field-error` spans
    - _Requirements: 1.4, 2.6, 5.5, 5.6, 9.5_

  - [x] 10.6 Implement `render.monthlySummary()`
    - Use `compute.monthlySummary(txManager.getAll())` to build grouped month rows with IDR-formatted totals
    - Show "No spending data available" when the list is empty
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 11.7_

  - [x] 10.7 Implement `render.sortControls()`
    - Render amount asc/desc and category asc/desc sort buttons; visually indicate the active sort state
    - _Requirements: 8.1, 8.2, 8.5_

  - [x] 10.8 Implement `render.all()`
    - Call all sub-render functions in order: `balance()`, `transactionList()`, `pieChart()`, `categoryDropdown()`, `monthlySummary()`, `sortControls()`
    - _Requirements: 9.3_

- [x] 11. Implement event handling and wire all modules together
  - [x] 11.1 Implement `bindEvents()` for form submission
    - On submit: call `render.clearFieldErrors()`, run `validator.validateTransaction()`, display per-field errors via `render.showFieldError()` on failure, or call `txManager.add()` + `render.all()` on success; reset the form on success
    - On storage write failure from `txManager.add()`: call `render.showError()` with persistence warning; do NOT remove the transaction from the in-memory list
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 5.4, 5.6_

  - [x] 11.2 Implement `bindEvents()` for transaction deletion (event delegation)
    - Delegate click events on the Transaction_List container; read `data-id` from the clicked delete button; call `txManager.remove(id)` + `render.all()`
    - On storage failure from `txManager.remove()`: call `render.showError()` and revert (handled inside `txManager.remove()`)
    - _Requirements: 2.5, 2.6, 5.4_

  - [x] 11.3 Implement `bindEvents()` for custom category addition
    - On category form submit: run `validator.validateCategory()`, show inline error on failure; call `categoryManager.add()` + `render.categoryDropdown()` on success
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 11.4 Implement `bindEvents()` for view toggle (Transaction_List ↔ Summary_View)
    - Toggle `activeView` state between `'list'` and `'summary'`; call `render.all()` to reflect the change
    - _Requirements: 7.4_

  - [x] 11.5 Implement `bindEvents()` for sort controls
    - On sort button click: update `sortState.field` and `sortState.direction`; call `render.transactionList()` to re-render with the new order
    - Preserve active sort state when transactions are added or deleted
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 11.6 Implement app initialization on `DOMContentLoaded`
    - Check `storage.isAvailable()`; if unavailable, call `render.showError()` with a persistent session-only warning
    - Call `txManager.init()` — on corrupted data show error banner and initialize empty
    - Call `categoryManager.init()`
    - Call `chartManager.init('pie-chart')`
    - Call `render.all()`
    - Call `bindEvents()`
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 9.5_

- [ ] 12. Checkpoint — Verify core app wiring
  - Ensure all modules are connected and the app loads without console errors. Add a transaction, delete a transaction, and reload — confirm data persists. Ask the user if questions arise.

- [x] 13. Apply CSS styling, responsive layout, and accessibility
  - [x] 13.1 Write base styles in `css/style.css`
    - Define a clear visual hierarchy with visible whitespace/borders separating Input_Form, Balance_Display, Transaction_List, and Pie_Chart sections
    - Set body font size to at least 16px and ensure text/background contrast ratio ≥ 4.5:1
    - Style the error banner (`#error-banner`) and inline field errors (`.field-error`) to be visually distinct
    - _Requirements: 10.3, 10.4_

  - [x] 13.2 Implement responsive layout at 768px breakpoint
    - Use a CSS media query for `max-width: 768px` that switches to a single-column arrangement
    - Ensure all primary components remain usable and visible without horizontal scrolling at narrow viewports
    - _Requirements: 10.5_

  - [x] 13.3 Implement keyboard navigation and focus indicators
    - Ensure all interactive elements in the Input_Form and Transaction_List receive focus in a logical tab order
    - Add visible `:focus` / `:focus-visible` styles (outline or equivalent) for all interactive elements
    - _Requirements: 10.6_

- [x] 14. Final checkpoint — Full verification
  - Ensure all automated tests pass. Verify the app loads within 3 seconds when opened directly as an HTML file. Confirm the layout is single-column at < 768px. Confirm keyboard navigation works for form inputs and delete buttons. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints validate incremental progress before moving to the next phase
- Property tests (Properties 1–11) match those defined in the design document's Correctness Properties section
- Unit tests for edge cases (`formatIDR(0)`, `formatIDR(12500)`, validator boundary values, storage corruption) complement the property tests
- The three optional features (custom categories, monthly summary, sort) are scaffolded throughout the task list rather than isolated at the end, so the app remains coherent at every checkpoint
- `fast-check` + `Vitest` (or Jest) are the recommended test tools per the design document

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1", "3.4"] },
    { "id": 1, "tasks": ["2.2", "2.3", "2.7", "2.9", "3.2", "3.3"] },
    { "id": 2, "tasks": ["2.4", "2.5", "2.8"] },
    { "id": 3, "tasks": ["2.6", "5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["5.4", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4", "7.5", "9.1"] },
    { "id": 8, "tasks": ["9.2", "10.1", "10.2", "10.3", "10.4", "10.5"] },
    { "id": 9, "tasks": ["10.6", "10.7", "10.8"] },
    { "id": 10, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5"] },
    { "id": 11, "tasks": ["11.6"] },
    { "id": 12, "tasks": ["13.1"] },
    { "id": 13, "tasks": ["13.2", "13.3"] }
  ]
}
```
