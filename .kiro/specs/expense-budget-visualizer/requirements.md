# Requirements Document

## Introduction

The Expense & Budget Visualizer is a standalone, client-side web application that lets users track personal spending by entering transactions, viewing a categorized list, monitoring their total balance, and visualizing spending distribution through a live pie chart. All data is persisted in the browser's Local Storage, requiring no backend server. The application is built with HTML, CSS, and vanilla JavaScript only.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an Item Name, Amount, and Category.
- **Transaction_List**: The scrollable UI component that displays all saved transactions.
- **Input_Form**: The HTML form used to enter a new transaction.
- **Category**: A label classifying a transaction — one of: Food, Transport, Fun, or any user-defined custom category.
- **Balance_Display**: The UI element at the top of the page showing the running total of all transaction amounts.
- **Pie_Chart**: The visual chart component showing spending distribution by category.
- **Local_Storage**: The browser's `localStorage` API used to persist transaction data between sessions.
- **Validator**: The client-side logic that checks whether Input_Form fields meet submission requirements.
- **Category_Manager**: The component that manages the available set of categories, including built-in and user-defined ones.
- **Summary_View**: An optional monthly summary view that aggregates transactions by month.
- **Sort_Controller**: The optional component that controls the display order of transactions in the Transaction_List.
- **IDR_Format**: Indonesian Rupiah currency formatting, displayed as "Rp" followed by a whole number with a period (.) as the thousands separator and no decimal places (e.g., "Rp 12.500" for 12,500 IDR). IDR does not use fractional cents — amounts are always whole numbers.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to fill out a form with an item name, amount, and category, so that I can record a new expense transaction.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for Item Name accepting up to 100 characters, a numeric field for Amount accepting whole number values between 1 and 999,999,999,999, and a dropdown for Category.
2. THE Input_Form SHALL populate the Category dropdown with at minimum the three built-in categories: Food, Transport, and Fun.
3. WHEN the user submits the Input_Form, THE Validator SHALL verify that the Item Name field is non-empty and does not exceed 100 characters, the Amount field contains a whole number between 1 and 999,999,999,999, and a Category is selected.
4. IF the user submits the Input_Form with one or more empty or invalid fields, THEN THE Validator SHALL display an inline error message adjacent to each invalid field identifying the reason for rejection and SHALL prevent the transaction from being saved.
5. WHEN the user submits the Input_Form with all fields valid, THE App SHALL add the transaction to the Transaction_List and save it to Local_Storage within 1 second.
6. WHEN a transaction is successfully submitted, THE Input_Form SHALL reset the Item Name field to empty, the Amount field to empty, and the Category dropdown to its default unselected state.
7. IF Local_Storage is unavailable when the user submits the Input_Form with all fields valid, THEN THE App SHALL display an error message indicating the transaction could not be saved and SHALL NOT add the transaction to the Transaction_List.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all saved transactions in chronological ascending order (oldest first) by default.
2. THE Transaction_List SHALL display the Item Name, Amount formatted in IDR_Format (e.g., Rp 12.500), and Category for each transaction.
3. WHILE the number of transactions exceeds the visible list area, THE Transaction_List SHALL remain scrollable to allow the user to view all entries.
4. THE Transaction_List SHALL provide a delete control for each transaction.
5. WHEN the user activates the delete control for a transaction, THE App SHALL remove that transaction from the Transaction_List and from Local_Storage.
6. IF Local_Storage deletion fails when the user activates the delete control, THEN THE App SHALL display an error message indicating the deletion could not be persisted and SHALL revert the transaction to the Transaction_List.
7. WHEN no transactions exist, THE Transaction_List SHALL display a visible message indicating that no transactions have been added yet.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending balance at the top of the page, so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all transaction amounts, displaying Rp 0 when no transactions exist.
2. WHEN a new transaction is added, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.
3. WHEN a transaction is deleted, THE Balance_Display SHALL update to reflect the revised total without requiring a page reload.
4. THE Balance_Display SHALL format the total in IDR_Format (e.g., Rp 1.234.567), with no decimal places.

---

### Requirement 4: Spending Distribution Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money is going at a glance.

#### Acceptance Criteria

1. THE Pie_Chart SHALL render a pie chart that shows each Category as a distinct slice, sized proportionally to that Category's sum of transaction amounts relative to the total sum of all transaction amounts across all Categories.
2. WHEN a new transaction is added, THE Pie_Chart SHALL update to reflect the current spending distribution without any additional user action.
3. WHEN a transaction is deleted, THE Pie_Chart SHALL update to reflect the revised spending distribution without any additional user action.
4. WHEN no transactions exist, THE Pie_Chart SHALL display a visible text message indicating that no spending data is available, in place of the chart.
5. THE Pie_Chart SHALL label each slice with the Category name and its percentage of total spending, where the percentage is rounded to one decimal place (e.g., 33.3%).
6. IF a Category's total transaction amount is zero, THEN THE Pie_Chart SHALL exclude that Category's slice from the rendered chart.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my spending history when I close or refresh the page.

#### Acceptance Criteria

1. WHEN the App loads, THE App SHALL read all previously saved transactions from Local_Storage and render them in the Transaction_List.
2. WHEN the App loads with saved transactions, THE Balance_Display SHALL reflect the total from the loaded transactions.
3. WHEN the App loads with saved transactions, THE Pie_Chart SHALL render the spending distribution from the loaded transactions.
4. WHEN a transaction is added or deleted, THE App SHALL immediately write the updated transaction list to Local_Storage before rendering the updated UI state.
5. IF Local_Storage contains data that cannot be parsed as a valid transaction list when the App loads, THEN THE App SHALL discard the unreadable data, initialize with an empty transaction list, and display an error message indicating that saved data could not be loaded.
6. IF writing to Local_Storage fails when a transaction is added or deleted, THEN THE App SHALL retain the transaction in the in-memory transaction list and display an error message indicating that the change could not be saved persistently.

---

### Requirement 6: Custom Categories (Optional)

**User Story:** As a user, I want to add my own expense categories, so that I can classify transactions beyond the three built-in categories.

#### Acceptance Criteria

1. WHERE custom categories are enabled, THE Category_Manager SHALL provide a UI control that allows the user to enter and save a new category name of 1 to 50 characters.
2. WHERE custom categories are enabled, WHEN the user saves a new category, THE Input_Form Category dropdown SHALL include the new category as a selectable option.
3. WHERE custom categories are enabled, THE Category_Manager SHALL persist custom categories in Local_Storage so they are available across sessions.
4. WHERE custom categories are enabled, IF the user attempts to save a category whose name is empty, contains only whitespace, or matches an existing category name (case-insensitive), THEN THE Category_Manager SHALL display an error message indicating the reason and SHALL NOT save the category.
5. WHERE custom categories are enabled, IF the user attempts to save a new category when 20 custom categories already exist, THEN THE Category_Manager SHALL display an error message indicating the category limit has been reached and SHALL NOT save the new category.

---

### Requirement 7: Monthly Summary View (Optional)

**User Story:** As a user, I want to see a summary of my spending grouped by month, so that I can understand my spending patterns over time.

#### Acceptance Criteria

1. WHERE the monthly summary view is enabled, THE Summary_View SHALL group transactions by calendar month and year, and display each group in reverse chronological order (most recent month first), showing the total amount for each month formatted in IDR_Format.
2. WHERE the monthly summary view is enabled, THE Summary_View SHALL display each monthly group with a month label in the format "Month YYYY" (e.g., "September 2025") and the corresponding total amount.
3. WHERE the monthly summary view is enabled, WHEN transactions are added or deleted, THE Summary_View SHALL immediately update to reflect the current monthly totals; IF a month's total reaches zero after a deletion, THEN that month's group SHALL be removed from the Summary_View.
4. WHERE the monthly summary view is enabled, THE App SHALL provide a toggle or navigation control to switch between the Transaction_List view and the Summary_View.
5. WHERE the monthly summary view is enabled, WHEN no transactions exist, THE Summary_View SHALL display a visible message indicating that no spending data is available for any month.

---

### Requirement 8: Sort Transactions (Optional)

**User Story:** As a user, I want to sort my transaction list by amount or category, so that I can find and compare transactions more easily.

#### Acceptance Criteria

1. WHERE sorting is enabled, THE Sort_Controller SHALL provide controls to sort the Transaction_List in ascending or descending order by Amount.
2. WHERE sorting is enabled, THE Sort_Controller SHALL provide controls to sort the Transaction_List in ascending (A to Z) or descending (Z to A) alphabetical order by Category.
3. WHERE sorting is enabled, WHEN the user selects a sort option, THE Transaction_List SHALL reorder the displayed transactions according to the selected criterion without requiring a page reload.
4. WHERE sorting is enabled, THE Sort_Controller SHALL preserve the active sort criterion and direction when transactions are added or deleted, re-sorting the Transaction_List immediately to reflect the change, until the page is reloaded.
5. WHERE sorting is enabled, THE Sort_Controller SHALL display the Transaction_List in the original entry order by default before any sort option is selected.

---

### Requirement 9: Compatibility and Performance

**User Story:** As a user, I want the app to load quickly and work reliably across modern browsers, so that I can use it without friction.

#### Acceptance Criteria

1. THE App SHALL function correctly in the latest stable versions of Chrome, Firefox, Edge, and Safari, where "correctly" means transaction entry, deletion, balance calculation, Pie_Chart rendering, and Local_Storage read/write all operate without JavaScript console errors.
2. THE App SHALL load and become interactive — with Transaction_List, Balance_Display, and Pie_Chart rendered and the Input_Form accepting input — within 3 seconds of the HTML file being opened directly in a browser, without requiring any build tools, package managers, or server setup.
3. WHEN the user adds or deletes a transaction, THE App SHALL update the Transaction_List, Balance_Display, and Pie_Chart within 100 milliseconds of the action completing.
4. THE App SHALL operate without any external network requests at runtime, relying solely on locally bundled assets and Local_Storage.
5. IF Local_Storage is not available (unsupported or blocked by the browser) when the App loads, THEN THE App SHALL display a visible warning message indicating that data persistence is unavailable and SHALL operate in a session-only mode where transactions are stored in memory for the duration of the page session.

---

### Requirement 10: Responsive and Accessible UI

**User Story:** As a user, I want the interface to be clean, readable, and easy to use on different screen sizes, so that I have a pleasant experience regardless of my device.

#### Acceptance Criteria

1. THE App SHALL apply a single CSS stylesheet located at `css/style.css` for all visual styling.
2. THE App SHALL use a single JavaScript file located at `js/app.js` for all application logic.
3. THE App SHALL use a clear visual hierarchy with distinct sections for the Input_Form, Balance_Display, Transaction_List, and Pie_Chart, where each section is separated by visible whitespace or a border such that the boundaries between sections are distinguishable without overlap.
4. THE App SHALL use font sizes of at least 16px for body text and maintain a contrast ratio of at least 4.5:1 between text and its background color so that text is readable without requiring the user to zoom in.
5. WHEN the viewport width is less than 768px, THE App SHALL adjust its layout to a single-column arrangement so that all primary components remain usable and visible without horizontal scrolling.
6. IF a user navigates the App using only a keyboard, THEN THE App SHALL ensure that all interactive elements within the Input_Form and Transaction_List receive focus in a logical order and display a visible focus indicator.

---

### Requirement 11: Indonesian Rupiah (IDR) Currency Formatting

**User Story:** As a user, I want all monetary values to be displayed in Indonesian Rupiah (IDR) format, so that the app reflects the correct local currency.

#### Acceptance Criteria

1. THE Input_Form Amount field SHALL accept whole number values (integers) only, with a minimum of 1 and a maximum of 999,999,999,999 (approximately 1 trillion Rupiah).
2. THE App SHALL display all monetary amounts using IDR_Format: the prefix "Rp" followed by a space, then the integer amount with a period (.) as the thousands separator and no decimal places (e.g., "Rp 12.500", "Rp 1.234.567").
3. WHEN the user enters a decimal value in the Amount field, THE Validator SHALL reject the submission and display an inline error message indicating that only whole number amounts are accepted.
4. THE Balance_Display SHALL show the total in IDR_Format (e.g., "Rp 1.234.567").
5. THE Transaction_List SHALL show each transaction's amount in IDR_Format.
6. THE Pie_Chart slice labels SHALL show category totals in IDR_Format when displaying amounts.
7. WHERE the monthly summary view is enabled, THE Summary_View SHALL show each monthly total in IDR_Format.
