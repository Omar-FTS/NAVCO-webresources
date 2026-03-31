# bug: dc-costoverride-default-on-load

## Metadata
adw_id: `66d4f5ab`
issue_description: `In the Quote Product (Quote Line) form in Dynamics 365, the field dc_costoverride is not being assigned a default value when the form loads. The requirement is that when the form opens, dc_costoverride should be set to 5 — but only when the field is currently empty (null), so existing records with a user-entered override cost are not silently overwritten.`

## Description
On the Quote Product (Quote Line) form in Dynamics 365, the field `dc_costoverride` is not being assigned a default value when the form loads. The form's `formOnLoad` function in `dc_quote_product_main_operations.js` currently calls five helpers — including `setCostOverrideDescriptionRequired` — but none of them write a value to `dc_costoverride`. As a result, new Quote Product lines open with the field blank, requiring manual entry on every new record. Existing records where a user already entered a value must not be silently overwritten.

## Objective
Add a guarded default-value assignment for `dc_costoverride` inside `formOnLoad` in `dc_quote_product_main_operations.js` so that the field is automatically set to `5` whenever it has no existing value, while leaving non-null values untouched.

## Problem Statement
The `formOnLoad` handler (lines 5–12 of `dc_quote_product_main_operations.js`) calls the following helpers:

- `lockFormWhenRelatedQuoteIsPendingApproval`
- `lockFormWhenRelatedQuoteIsWonOrLost`
- `filterProducts`
- `SetMarginsAndDefaults`
- `setCostOverrideDescriptionRequired`

None of these write a value to `dc_costoverride`. `SetMarginsAndDefaults` contains the correct guard pattern for `dc_marginrate` (only set when empty) but never applies the same logic to `dc_costoverride`. This missing initialisation means every new Quote Product record opens without a cost-override value.

## Solution Statement
Introduce a new private helper function `setDefaultCostOverride(formContext)` that:
1. Reads the `dc_costoverride` attribute via `formContext.getAttribute("dc_costoverride")`.
2. Checks whether the current value is `null` or `undefined` using loose equality (`== null`).
3. If so, calls `setValue(5)` on the attribute.

Call this helper from `formOnLoad` **after** `SetMarginsAndDefaults` and **before** `setCostOverrideDescriptionRequired`, so that the description field's required-level evaluation always runs against the final (post-default) value of `dc_costoverride`.

## Steps to Reproduce
1. Open the Dynamics 365 Quote Product (Quote Line) form in **Create** mode (new record).
2. Observe the `dc_costoverride` field — it is blank; no default value is applied.
3. **Expected:** the field should show `5` automatically.
4. **Actual:** the field is empty; the user must enter a value manually.

Also reproducible in **Update** mode on existing records where `dc_costoverride` was never populated (field is currently null).

## Root Cause Analysis
The root cause is a missing call in `formOnLoad`. The analogous guarded-default logic already exists for `dc_marginrate` in `SetMarginsAndDefaults` (lines 213–216):

```js
if (marginAttr && !marginAttr.getValue() && calculatedMargin !== null) {
    marginAttr.setValue(calculatedMargin);
}
```

No equivalent logic was ever added for `dc_costoverride`. The `setCostOverrideDescriptionRequired` function (lines 467–485) reads the field to determine required-level but does not set a value. Because `setCostOverrideDescriptionRequired` runs before any default would be applied, it also incorrectly leaves `dc_overridedescription` as `none` required on new records (since `dc_costoverride` is still null when it runs).

## Code Patterns to Follow
Reference implementations:

- **`dc_quote_product_main_operations.js` — lines 213–216** (`SetMarginsAndDefaults`): the established "only set when empty" guard pattern:
  ```js
  if (marginAttr && !marginAttr.getValue() && calculatedMargin !== null) {
      marginAttr.setValue(calculatedMargin);
  }
  ```
- **`dc_quote_product_main_operations.js` — lines 467–485** (`setCostOverrideDescriptionRequired`): shows the established way to access `dc_costoverride` via `formContext.getAttribute("dc_costoverride")` and operate on it.
- **`dc_quote_product_main_operations.js` — lines 5–12** (`formOnLoad`): shows where new initialisation calls are inserted and the expected call order.

## Relevant Files
Use these files to complete the task:

- `dc_quote_product_main_operations.js` — the only file that needs to change; contains `formOnLoad`, `setCostOverrideDescriptionRequired`, `SetMarginsAndDefaults`, and all `dc_costoverride` attribute access patterns.
- `.app_config.yaml` — confirms no automated build/lint/test pipeline; validation is manual plus a Node.js syntax check.
- `docs/tasks/conditional_docs.md` — conditional documentation guide; lists this bug's related documentation.
- `docs/tasks/bug-quote-product-cost-override-default-7f242fa6/doc-bug-quote-product-cost-override-default-7f242fa6.md` — prior documentation for the same fix; review for implementation notes and var-style guidance.
- `SKILL.md` — project coding rules and conventions for Dynamics 365 web resources (namespace patterns, `var` vs `let`/`const`, Client API rules).

> No new files are required for this change.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Add `setDefaultCostOverride` helper function
- Open `dc_quote_product_main_operations.js`.
- Locate the closing brace of `setCostOverrideDescriptionRequired` (around line 485), which is the last helper function before `toggleSpecialProductMargin`.
- Insert the following new private helper function immediately after it, inside the IIFE:
  ```js
  // Set default value for dc_costoverride on form load
  function setDefaultCostOverride(formContext) {
      var costOverrideAttr = formContext.getAttribute("dc_costoverride");
      if (costOverrideAttr && costOverrideAttr.getValue() == null) {
          costOverrideAttr.setValue(5);
      }
  }
  ```
- Use `var` (not `let`/`const`) to match the legacy variable declaration style used in the adjacent private functions (`setCostOverrideDescriptionRequired`, `SetMarginsAndDefaults`, `getLookupValue`, etc.) in this file.
- Use `== null` (loose equality) to catch both `null` and `undefined`, consistent with null-guard patterns elsewhere in the file.

### 2. Update `formOnLoad` — add call and re-order `setCostOverrideDescriptionRequired`
- In the `formOnLoad` function (lines 5–12), add a call to `setDefaultCostOverride(formContext)` after `SetMarginsAndDefaults` and move `setCostOverrideDescriptionRequired` to run last:
  ```js
  this.formOnLoad = function (executionContext) {
      const formContext = executionContext.getFormContext();
      lockFormWhenRelatedQuoteIsPendingApproval(formContext);
      lockFormWhenRelatedQuoteIsWonOrLost(formContext);
      filterProducts(executionContext);
      SetMarginsAndDefaults(executionContext);
      setDefaultCostOverride(formContext);              // new call
      setCostOverrideDescriptionRequired(executionContext); // moved to last
  }
  ```
- This ordering ensures:
  - Lock functions run first (they do not depend on `dc_costoverride` value).
  - `SetMarginsAndDefaults` runs and may set `dc_marginrate`.
  - `setDefaultCostOverride` applies the `5` default only if `dc_costoverride` is null.
  - `setCostOverrideDescriptionRequired` evaluates the final value of `dc_costoverride` (now `5` on new records) and correctly marks `dc_overridedescription` as `required`.
- Do **not** call `fireOnChange()` on `dc_costoverride` after setting the default — the `onCostOverrideChange` handler would redundantly re-invoke `SetMarginsAndDefaults` and `setCostOverrideDescriptionRequired` on initial load.

### 3. Verify `setCostOverrideDescriptionRequired` behaviour across three scenarios
- Trace through the logic manually to confirm correctness:
  - **New record** (`dc_costoverride` is null on open): `setDefaultCostOverride` sets value to `5`; `setCostOverrideDescriptionRequired` sees non-null value → marks `dc_overridedescription` as `required`. ✓
  - **Existing record with a non-null `dc_costoverride`** (e.g., `10`): `setDefaultCostOverride` guard fires (`getValue() != null`) → skips `setValue`; `setCostOverrideDescriptionRequired` sees existing value → marks `dc_overridedescription` as `required`. ✓
  - **Existing record with null `dc_costoverride`**: `setDefaultCostOverride` sets value to `5`; `setCostOverrideDescriptionRequired` sees non-null → marks `dc_overridedescription` as `required`. ✓

### 4. Run the syntax validation command
- From the project root, run the Node.js syntax check to confirm no parse errors were introduced:
  ```
  node -e "require('fs').readFileSync('dc_quote_product_main_operations.js','utf8'); console.log('Syntax OK');"
  ```
- The output must be `Syntax OK` with exit code 0.

### 5. Manual smoke-test in Dynamics 365
- Upload the updated `dc_quote_product_main_operations.js` as the web resource to the target Dynamics 365 environment (publish customisations after upload).
- **Scenario A — New record (Create mode):** Open a Quote Product form in Create mode. Confirm `dc_costoverride` displays `5` and `dc_overridedescription` is marked required.
- **Scenario B — Existing record with value:** Open an existing Quote Product record that already has a non-null `dc_costoverride` (e.g., `10`). Confirm the value remains `10` and is not overwritten.
- **Scenario C — Existing record without value:** Open an existing Quote Product record where `dc_costoverride` is null. Confirm the field is set to `5` on load and `dc_overridedescription` is marked required.
- **Regression check:** Confirm all other `formOnLoad` behaviours continue working: pending-approval lock shows the correct form notification and disables controls; won/lost lock disables controls; product filter applies correctly; margin defaults (`dc_marginrate`) still populate when empty.

## Testing Strategy
### Unit Tests
No automated test runner is configured for this project (see `.app_config.yaml`). Testing is performed via:
- **Syntax validation:** Node.js `require` check (see Validation Commands).
- **Manual functional testing:** three Dynamics 365 scenarios (new record, existing with value, existing without value) as described in Task 5.

### Edge Cases
- `dc_costoverride` attribute does not exist on the form (e.g., form layout differs): the `costOverrideAttr && ...` guard in `setDefaultCostOverride` prevents a null-reference error.
- Form is opened in Read-Only or Disabled mode: `setValue(5)` still sets the attribute value in memory; the control's disabled state is applied by the lock functions, which run before `setDefaultCostOverride`. This is the same behaviour as `SetMarginsAndDefaults` for `dc_marginrate`.
- `dc_costoverride` holds `0` (numeric zero): `0 == null` is `false` in JavaScript, so a zero value is treated as a valid user-entered value and is not overwritten. This is the correct behaviour since `0` is an explicitly set number.

## Acceptance Criteria
- `dc_costoverride` is set to `5` when a Quote Product form opens and the field has no existing value (null or undefined).
- `dc_costoverride` is **not** overwritten when the field already holds a non-null user-entered value on an existing record.
- `dc_overridedescription` is correctly marked as `required` on form load for all records where `dc_costoverride` ends up non-null after load (new records and existing records with null → default applied).
- The fix is confined to `dc_quote_product_main_operations.js`; no other files are modified.
- No JavaScript syntax errors are introduced (Node.js syntax check passes with `Syntax OK`).
- All existing `formOnLoad` behaviours — pending-approval lock, won/lost lock, product filter, and margin defaults — continue to work without regression.

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

No automated build, lint, or test commands are configured for this project (see `.app_config.yaml`). Validation is performed manually:

1. **Syntax check** — run at the project root; must exit with `Syntax OK`:
   ```
   node -e "require('fs').readFileSync('dc_quote_product_main_operations.js','utf8'); console.log('Syntax OK');"
   ```

2. **Manual smoke-test in Dynamics 365** — follow the three scenarios in Task 5:
   - Scenario A: New record → `dc_costoverride` = `5`, `dc_overridedescription` required.
   - Scenario B: Existing record with value → value unchanged.
   - Scenario C: Existing record without value → `dc_costoverride` = `5`, `dc_overridedescription` required.

## Notes
- The default value `5` is hardcoded directly from the issue description. If the default should be configurable in the future (e.g., driven by a field on the parent Quote record), that is a separate task.
- `dc_costoverride` is a number/currency field in Dynamics 365; `setValue(5)` passes a numeric literal, consistent with how `marginAttr.setValue(calculatedMargin)` passes a numeric value in `SetMarginsAndDefaults`.
- Use `var` for the attribute variable in `setDefaultCostOverride` to match the legacy variable declaration style used inside `setCostOverrideDescriptionRequired` and the other private functions in this file. Do not introduce `let`/`const` into private helper functions unless refactoring the whole file.
- A prior feature plan (`docs/tasks/feature-set-dc-costoverride-on-load-e0a95fe3/`) and a prior bug plan (`docs/tasks/bug-quote-product-cost-override-default-7f242fa6/`) cover the same change. This plan supersedes both; consult the doc file at `docs/tasks/bug-quote-product-cost-override-default-7f242fa6/doc-bug-quote-product-cost-override-default-7f242fa6.md` for post-implementation notes.
- The `0` (zero) edge case is intentionally not treated as "empty": `0 == null` evaluates to `false` in JavaScript, so a zero value is preserved as a valid user entry.
