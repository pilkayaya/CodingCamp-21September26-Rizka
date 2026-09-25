# Design Document

## Overview

The Expense & Budget Visualizer is a zero-dependency, client-side single-page application (SPA) delivered as a single HTML file with one external CSS file (`css/style.css`) and one JavaScript module (`js/app.js`). There is no build step, no package manager, and no backend — the app opens directly in a browser.

The application lets a user:
- Record expense transactions (name, amount, category)
- View all transactions in a scrollable list with per-item delete
- Monitor a running total balance
- See a live pie chart of spending by category
- Add custom categories beyond the three built-ins (Food, Transport, Fun)
- View a monthly spending summary (optional)
- Sort the transaction list by amount or category (optional)

All state is persisted in `localStorage`. [Chart.js 4.x](https://www.chartjs.org/docs/latest/) is loaded via CDN (`cdn.jsdelivr.net/npm/chart.js`) for pie chart rendering — it is the only external dependency and is loaded at page open, not at runtime.

**Key design decisions:**

| Decision | Choice | Rationale |
|---|---|---|
| No framework | Vanilla JS + DOM API | Requirement 10.2 mandates a single `js/app.js`; no bundler allowed |
| Chart library | Chart.js 4.x UMD via CDN | Requirement 4 expects a pie chart; Canvas-based, cross-browser, no extra deps |
| Persistence | `localStorage` (JSON) | Required by spec; synchronous API fits a single-threaded JS app |
| Module pattern | IIFE / module-level closures | Avoids polluting global scope without requiring ES modules or bundlers |
| State management | Single in-memory array + render cycle | Simple and predictable; full re-render on every state change |
| Currency format | IDR (Rp) with `.` thousands separator, integer amounts only | Requirement 11; IDR has no fractional subunit in everyday use |

---

## Architecture

The app follows a unidirectional data flow:

```
User Action
    │
    ▼
Command Handler (js/app.js)
    │  mutates
    ▼
In-Memory State (transactions[], categories[])
    │  persisted to
    ▼
localStorage
    │  triggers
    ▼
render() — full UI re-render
    ├── renderTransactionList()
    ├── renderBalance()
    ├── renderPieChart()
    ├── renderCategoryDropdown()
    ├── renderMonthlySummary()   [optional]
    └── renderSortControls()     [optional]
```

There is **no virtual DOM** and **no reactive framework**. Every state mutation calls `render()`, which re-paints affected UI sections. Because the dataset for a personal expense tracker is small (< a few thousand entries), a full re-render on every change is fast and correct.

### File Layout

```
index.html          ← entry point; loads Chart.js CDN, css/style.css, js/app.js
css/
  style.css         ← all visual styling
js/
  app.js            ← all application logic
```

---

## Components and Interfaces

All components live inside `js/app.js` as named functions within an IIFE wrapper. There are no separate files.

### 1. State Module

Holds the single source of truth.

```js
// Internal state (not exported, closure-scoped)
let transactions = [];   // Transaction[]
let categories  = [];    // string[]  (built-ins + custom)
let sortState   = { field: null, direction: 'asc' }; // Sort_Controller state
let activeView  = 'list'; // 'list' | 'summary'
```

### 2. Storage Module (`storage`)

Wraps `localStorage` and isolates all I/O. Returns `{ ok, error }` result objects so callers can handle failures without throwing.

```js
const STORAGE_KEY = 'expense_transactions';
const CATEGORIES_KEY = 'expense_categories';

storage.load()            → { ok: true, data: Transaction[] } | { ok: false, error: string }
storage.save(transactions) → { ok: true } | { ok: false, error: string }
storage.loadCategories()   → { ok: true, data: string[] } | { ok: false, error: string }
storage.saveCategories(cats) → { ok: true } | { ok: false, error: string }
storage.isAvailable()      → boolean
```

### 3. Validator Module (`validator`)

Pure functions — no side effects, no DOM access.

```js
validator.validateTransaction({ name, amount, category })
  → { valid: true } | { valid: false, errors: { name?, amount?, category? } }

validator.validateCategory(name, existingCategories)
  → { valid: true } | { valid: false, error: string }
```

### 4. Category Manager (`categoryManager`)

Manages the list of available categories (built-in + custom).

```js
const BUILTIN_CATEGORIES = ['Food', 'Transport', 'Fun'];
const MAX_CUSTOM_CATEGORIES = 20;

categoryManager.init()                         → void  (loads from storage)
categoryManager.getAll()                       → string[]
categoryManager.add(name)                      → { ok: true } | { ok: false, error: string }
```

### 5. Transaction Manager (`txManager`)

Manages the transaction list and coordinates with storage.

```js
txManager.init()              → { ok: true } | { ok: false, error: string }
txManager.getAll()            → Transaction[]
txManager.add(tx)             → { ok: true, transaction: Transaction } | { ok: false, error: string }
txManager.remove(id)          → { ok: true } | { ok: false, error: string }
```

### 6. Compute Module (`compute`)

Pure functions for derived values — balance and chart data.

```js
compute.totalBalance(transactions)  → number
compute.categoryTotals(transactions) → Map<string, number>
compute.monthlySummary(transactions) → { label: string, total: number }[]
compute.sortTransactions(transactions, { field, direction }) → Transaction[]
compute.formatIDR(amount)  → string  // e.g. formatIDR(12500) → "Rp 12.500"
```

> Uses period (`.`) as the thousands separator with no decimal places, per IDR_Format defined in requirements Glossary.

### 7. Render Module (`render`)

Owns all DOM mutations. Called after every state change.

```js
render.all()               // full re-render (called on init and after every mutation)
render.transactionList()
render.balance()
render.pieChart()
render.categoryDropdown()
render.monthlySummary()    // optional
render.sortControls()      // optional
render.showError(message)
render.clearErrors()
render.showFieldError(fieldId, message)
render.clearFieldErrors()
```

### 8. Pie Chart Wrapper (`chartManager`)

Wraps the Chart.js instance, preventing duplicate canvas registrations.

```js
chartManager.init(canvasId)
chartManager.update(categoryTotals)  // Map<string, number>
chartManager.destroy()
```

### 9. Event Handler Registration (`bindEvents`)

Called once on `DOMContentLoaded`. Attaches all event listeners.

```js
bindEvents() → void
// Attaches: form submit, delete clicks (event delegation), category add,
//           view toggle, sort button clicks
```

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string}  id        - UUID v4 (crypto.randomUUID() or fallback)
 * @property {string}  name      - Item name, 1–100 characters
 * @property {number}  amount    - Positive integer (whole number), 1–999999999999
 * @property {string}  category  - One of the current category list
 * @property {string}  createdAt - ISO 8601 timestamp (new Date().toISOString())
 */
```

**localStorage serialization:** the full `transactions[]` array is stored as a single JSON string under key `"expense_transactions"`.

```json
[
  {
    "id": "a1b2c3d4-...",
    "name": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "createdAt": "2025-09-21T10:30:00.000Z"
  }
]
```

### Category List

```js
/**
 * @typedef {string[]} CategoryList
 * Custom categories stored as a JSON array under key "expense_categories".
 * Built-in categories are NOT stored — they are always prepended at runtime.
 */
```

```json
["Travel", "Health"]
```

Full category list at runtime = `['Food', 'Transport', 'Fun', ...customCategories]`.

### Sort State

```js
/**
 * @typedef {Object} SortState
 * @property {'amount' | 'category' | null} field
 * @property {'asc' | 'desc'} direction
 */
```

Sort state is **not persisted** — it resets to `{ field: null, direction: 'asc' }` on page reload (per Requirement 8.5).

### Validation Constraints Summary

| Field | Rule |
|---|---|
| Item Name | Non-empty, ≤ 100 chars |
| Amount | Integer (whole number), 1 ≤ x ≤ 999,999,999,999; decimal values rejected |
| Category | Must be selected (non-empty string) |
| Custom Category | 1–50 chars, not empty/whitespace, not duplicate (case-insensitive), ≤ 20 custom total |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Adding a transaction grows the list by exactly one

*For any* valid transaction (non-empty name ≤ 100 chars, amount in [0.01, 999,999,999.99], valid category) added to any existing transaction list, the resulting list length SHALL be exactly one greater than the original length.

**Validates: Requirements 1.3, 1.5**

---

### Property 2: Whitespace-only and empty names are rejected

*For any* string composed entirely of whitespace characters (including the empty string), submitting it as an Item Name SHALL be rejected by the Validator and the transaction list SHALL remain unchanged.

**Validates: Requirements 1.3, 1.4**

---

### Property 3: Amount bounds are enforced

*For any* numeric value outside the range [0.01, 999,999,999.99] (including zero, negative numbers, and values above the maximum), the Validator SHALL reject the submission, and the transaction list SHALL remain unchanged.

**Validates: Requirements 1.3, 1.4**

---

### Property 4: Balance equals sum of all transaction amounts

*For any* list of transactions, the value displayed by Balance_Display SHALL equal the arithmetic sum of all transaction amounts in that list, formatted in IDR_Format (integer, period thousands separator, Rp prefix) — e.g. `"Rp 1.234.568"`.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 5: Pie chart slice percentages sum to 100

*For any* non-empty list of transactions, the sum of all category percentage values shown in the Pie_Chart labels SHALL equal 100% (within rounding tolerance of ±0.5% due to one-decimal rounding).

**Validates: Requirements 4.1, 4.5**

---

### Property 6: IDR format is applied consistently

*For any* non-negative integer amount, `compute.formatIDR(amount)` SHALL return a string that starts with "Rp ", uses a period (.) as the thousands separator, contains no decimal point, and produces the correct digit grouping (groups of 3 from the right).

**Validates: Requirements 11.2**

---

### Property 7: Transaction serialization round-trip

*For any* valid transaction list, serializing it to JSON and deserializing it back SHALL produce a transaction list that is deeply equal to the original (same ids, names, amounts, categories, createdAt values).

**Validates: Requirements 5.1, 5.4**

---

### Property 8: Custom category uniqueness (case-insensitive)

*For any* existing category list, attempting to add a category name that matches any existing entry case-insensitively SHALL be rejected by the Category_Manager and the category list SHALL remain unchanged.

**Validates: Requirements 6.4**

---

### Property 9: Custom category limit enforcement

*For any* category list already at the maximum (20 custom categories), attempting to add one more SHALL be rejected, and the category list length SHALL remain unchanged.

**Validates: Requirements 6.5**

---

### Property 10: Delete removes exactly the targeted transaction

*For any* transaction list containing a transaction with a given id, deleting that id SHALL result in a list that does not contain that id and whose length is exactly one less than the original.

**Validates: Requirements 2.4, 2.5**

---

### Property 11: Sort preserves all transactions

*For any* transaction list and any valid sort criterion (amount asc/desc, category asc/desc), sorting SHALL produce a list that contains the same set of transaction ids as the original, with no additions or removals.

**Validates: Requirements 8.1, 8.2, 8.3**

---

## Error Handling

### Error Categories and Responses

| Scenario | Detection Point | UI Response | State Effect |
|---|---|---|---|
| Blank or invalid form field | `validator.validateTransaction()` on submit — also rejects decimal amounts | Inline error message per field; form not submitted | No change |
| Decimal amount entered | `validator.validateTransaction()` on submit | Inline error: "Amount must be a whole number (no decimals)" | No change |
| `localStorage` unavailable on load | `storage.isAvailable()` on init | Banner warning: persistence unavailable, session-only mode | In-memory only |
| `localStorage` corrupted on load | JSON parse failure in `storage.load()` | Banner error: data could not be loaded; data discarded | Initialize empty |
| `localStorage` write failure on add | `storage.save()` return value | Toast/banner: change could not be saved persistently; transaction retained in memory | In-memory only |
| `localStorage` write failure on delete | `storage.save()` return value | Toast/banner: deletion not persisted; transaction reverted in Transaction_List | Revert in-memory |
| `localStorage` delete failure | `storage.save()` return value | Error message; transaction reinserted | Revert in-memory |
| Duplicate custom category | `validator.validateCategory()` | Inline error adjacent to category input | No change |
| Custom category limit reached | `categoryManager.add()` | Inline error message | No change |

### Error Display Pattern

- **Inline field errors**: `<span class="field-error">` injected adjacent to the offending `<input>` or `<select>`; cleared on next successful submit or on input change.
- **Banner/toast errors**: A `<div id="error-banner">` at the top of the page, auto-dismissed after 5 seconds or on user dismissal.
- **No `alert()` or `console.error()` for user-facing messages** — all errors are surfaced in the DOM.

### localStorage Unavailability

When `localStorage` throws on first access (private browsing, browser policy), the app initializes with an empty in-memory state and shows a persistent warning banner. All features except persistence remain functional for the session.

---

## Testing Strategy

### Approach

This feature is a client-side web application with UI rendering, localStorage I/O, and Chart.js integration. The testing strategy uses two complementary layers:

1. **Unit tests** — for pure logic functions (validator, compute, storage serialization)
2. **Property-based tests** — for universal correctness properties of the pure-function modules

UI rendering, Chart.js integration, and localStorage I/O are **not** candidates for property-based testing (side-effect-only, external dependencies, rendering output). Those are covered by example-based integration/manual tests.

### Property-Based Testing

**Library:** [fast-check](https://fast-check.dev/) (framework-agnostic, works with any test runner)
**Runner:** [Vitest](https://vitest.dev/) (or Jest; `fast-check` is runner-agnostic)
**Minimum iterations:** 100 per property test

Each property test is tagged with a comment referencing the design document property:
```js
// Feature: expense-budget-visualizer, Property 1: Adding a transaction grows the list by exactly one
```

#### Properties to Implement as Property-Based Tests

| Design Property | Test Module | fast-check Arbitraries |
|---|---|---|
| Property 1 — transaction list grows by 1 | `validator.test.js` | `fc.record({ name: fc.string({minLength:1,maxLength:100}), amount: fc.float({min:0.01,max:999999999.99}), category: fc.constantFrom(...CATEGORIES) })` |
| Property 2 — whitespace names rejected | `validator.test.js` | `fc.stringMatching(/^\s*$/)` |
| Property 3 — amount bounds enforced | `validator.test.js` | `fc.oneof(fc.float({max:0}), fc.float({min:1000000000}))` |
| Property 4 — balance equals sum | `compute.test.js` | `fc.array(validTransactionArb)` |
| Property 5 — pie chart percentages sum to 100 | `compute.test.js` | `fc.array(validTransactionArb, {minLength:1})` |
| Property 6 — serialization round-trip | `storage.test.js` | `fc.array(validTransactionArb)` |
| Property 7 — category uniqueness | `categoryManager.test.js` | `fc.array(fc.string({minLength:1,maxLength:50}))` |
| Property 8 — category limit | `categoryManager.test.js` | `fc.array(fc.string({minLength:1,maxLength:50}), {minLength:20,maxLength:20})` |
| Property 9 — delete removes exactly one | `txManager.test.js` | `fc.array(validTransactionArb, {minLength:1})` |
| Property 10 — sort preserves all transactions | `compute.test.js` | `fc.array(validTransactionArb)` combined with `fc.constantFrom('amount','category')` and `fc.constantFrom('asc','desc')` |
| Property 6 — IDR format consistency | `compute.test.js` | `fc.integer({min:0, max:999999999999})` |

### Unit Tests (Example-Based)

These cover specific behaviors and error conditions not suited to property generation:

- `Validator`: empty string name, name exactly 100 chars, amount = 0.00, amount = 0.01, amount = 999,999,999.99, no category selected
- `Compute.monthlySummary`: transactions spanning multiple months, single month, empty list
- `Storage`: `isAvailable()` returns false when `localStorage` throws; corrupted JSON returns `{ ok: false }`
- `CategoryManager`: built-in categories always present; adding a category; 20-category limit
- `Compute.formatIDR`: `formatIDR(0)` → `"Rp 0"`, `formatIDR(12500)` → `"Rp 12.500"`, `formatIDR(1234567)` → `"Rp 1.234.567"`, `formatIDR(999999999999)` → `"Rp 999.999.999.999"`

### Integration / Manual Tests

These verify the wired-up app in a real browser:

- Load app in Chrome, Firefox, Edge, Safari — Transaction_List, Balance_Display, Pie_Chart all render
- Submit a valid transaction → list updates, balance updates, pie chart updates within 100ms
- Submit form with empty fields → inline errors appear, no transaction saved
- Delete a transaction → list updates, balance recalculates, pie chart updates
- Reload page → transactions persist from localStorage
- Open in private/incognito (no localStorage) → session-only banner appears
- Resize viewport to < 768px → single-column layout, no horizontal scroll
- Keyboard-only navigation → all interactive elements receive focus with visible indicator
