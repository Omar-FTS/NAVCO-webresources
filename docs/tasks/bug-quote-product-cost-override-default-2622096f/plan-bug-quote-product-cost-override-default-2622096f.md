# bug: quote-product-cost-override-default

## Metadata
adw_id: `2622096f`
issue_description: `In the Quote Product (Quote Line) form in Dynamics 365, the field dc_costoverride is not being assigned a default value when the form loads. The requirement is that when the form opens, dc_costoverride should be set to 5 — but only when the field is currently empty (null), so existing records with a user-entered override cost are not silently overwritten.`

## Description
On the Quote Product (Quote Line) form in Dynamics 365, the field `dc_costoverride` is not being assigned a default value when the form loads. The form's `formOnLoad` function in `dc_quote_product_main_operations.js` currently calls `setCostOverrideDescriptionRequired`, which only manages the required-level of the companion description field — it does not write any value to `dc_costoverride`. As a result, new Quote Product lines open without a cost-override default, requiring manual entry every time.

## Objective
Add logic to the `formOnLoad` handler in `dc_quote_product_main_operations.js` so that `dc_costoverride` is set to `5` when the form opens and the field currently has no value (null/undefined). Existing records with a non-null `dc_costoverride` must not be overwritten.

## Problem Statement
The `formOnLoad` function does not initialise `dc_costoverride` to any default value. New Quote Product records open with the field blank, forcing users to manually enter a cost override every time. The requirement is a default of `5` applied only when the field is empty.

## Solution Statement
Add a new private helper function `setDefaultCostOverride(formContext)` that reads the `dc_costoverride` attribute and, only when its current value is `null`/`undefined`, sets it to `5`. Call this helper from `formOnLoad` — after `setDefaultCostOverride` runs, ensure `setCostOverrideDescriptionRequired` fires last so it sees the newly-set default and immediately marks `dc_overridedescription` as `required` on new records.

## Steps to Reproduce
1. Open the Dynamics 365 Quote Product (Quote Line) form in **Create** mode.
2. Observe the `dc_costoverride` field — it is blank (no default value).
3. Expected: the field should display `5` automatically.
4. Actual: the field is empty; no default is applied.

Also reproducible on **Update** mode records where `dc_costoverride` was never populated (field is currently null).

## Root Cause Analysis
The `formOnLoad` handler (lines 5–12 of `dc_quote_product_main_operations.js`) calls five helper functions:

- `lockFormWhenRelatedQuoteIsPendingApproval` — locks controls when quote is pending approval
- `lockFormWhenRelatedQuoteIsWonOrLost` — locks controls when quote is won/lost
- `filterProducts` — applies custom product filter view
- `SetMarginsAndDefaults` — sets `dc_marginrate` when empty
- `setCostOverrideDescriptionRequired` — sets required level on `dc_overridedescription` based on whether `dc_costoverride` has a value

None of these functions assign a value to `dc_costoverride`. The `SetMarginsAndDefaults` function has the correct pattern for a guarded default (lines 213–216), but it is only applied to `dc_marginrate`. The analogous logic for `dc_costoverride` was never implemented, causing the missing default.

## Code Patterns to Follow
Reference implementations:

- **`dc_quote_product_main_operations.js` — lines 213–216** (`SetMarginsAndDefaults`): the established guard pattern for "only set when empty":
  ```js
  if (marginAttr && !marginAttr.getValue() && calculatedMargin !== null) {
      marginAttr.setValue(calculatedMargin);
  }
  ```
- **`dc_quote_product_main_operations.js` — lines 467–485** (`setCostOverrideDescriptionRequired`): shows how `dc_costoverride` is accessed via `formContext.getAttribute("dc_costoverride")` and `getValue()` is checked for null.
- **`formOnLoad` — lines 5–12**: location where the new initialisation call is inserted.

## Relevant Files
Use these files to complete the task:

- `dc_quote_product_main_operations.js` — the only file that needs to change; contains `formOnLoad`, `setCostOverrideDescriptionRequired`, and all `dc_costoverride` attribute access patterns.
- `.app_config.yaml` — confirms no automated build/lint/test pipeline; validation is manual + Node.js syntax check.
- `docs/tasks/conditional_docs.md` — conditional documentation guide; lists this task's context conditions.
- `docs/tasks/bug-quote-product-cost-override-default-7f242fa6/doc-bug-quote-product-cost-override-default-7f242fa6.md` — prior implementation documentation for the same fix (reference for implementation decisions already made).

> No new files are required for this change.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Add `setDefaultCostOverride` helper function
- Open `dc_quote_product_main_operations.js`.
- Locate the closing brace of `setCostOverrideDescriptionRequired` (around line 485).
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
- Use `== null` (loose equality) to catch both `null` and `undefined`, consistent with null-guard patterns already used elsewhere in the file (e.g., `getLookupValue`).
- Use `var` to match the legacy variable declaration style used in adjacent private functions.

### 2. Update `formOnLoad` to call `setDefaultCostOverride` before `setCostOverrideDescriptionRequired`
- In the `formOnLoad` function (lines 5–12), add the call to `setDefaultCostOverride(formContext)` **before** `setCostOverrideDescriptionRequired` so the required-level check on `dc_overridedescription` evaluates against the newly-set default:
  ```js
  this.formOnLoad = function (executionContext) {
      const formContext = executionContext.getFormContext();
      lockFormWhenRelatedQuoteIsPendingApproval(formContext);
      lockFormWhenRelatedQuoteIsWonOrLost(formContext);
      filterProducts(executionContext);
      SetMarginsAndDefaults(executionContext);
      setDefaultCostOverride(formContext);              // <-- new call
      setCostOverrideDescriptionRequired(executionContext); // remains last
  }
  ```
- Do **not** call `fireOnChange()` on `dc_costoverride` after setting the default. The `onCostOverrideChange` handler would re-invoke `SetMarginsAndDefaults` and `setCostOverrideDescriptionRequired`, which is redundant on initial load.

### 3. Verify no regressions in `setCostOverrideDescriptionRequired`
- Confirm that `setCostOverrideDescriptionRequired` still functions correctly across all three scenarios:
  - **New record** (no prior value): `setDefaultCostOverride` sets `dc_costoverride = 5`; `setCostOverrideDescriptionRequired` then marks `dc_overridedescription` as `required`.
  - **Existing record with a non-null `dc_costoverride`**: `setDefaultCostOverride` guard fires (`getValue() != null`), skips assignment; `setCostOverrideDescriptionRequired` marks `dc_overridedescription` as `required`.
  - **Existing record where `dc_costoverride` is null**: `setDefaultCostOverride` sets it to `5`; `setCostOverrideDescriptionRequired` marks `dc_overridedescription` as `required`.

### 4. Manual smoke-test in Dynamics 365
- Upload the updated `dc_quote_product_main_operations.js` as the web resource to the target Dynamics 365 environment.
- Open a **new** Quote Product form (Create mode): confirm `dc_costoverride` shows `5` and `dc_overridedescription` is marked required.
- Open an **existing** Quote Product record with a non-null `dc_costoverride` (e.g., `10`): confirm the existing value is **not** overwritten.
- Open an **existing** Quote Product record where `dc_costoverride` is currently null: confirm the field is set to `5` on load and `dc_overridedescription` is marked required.
- Confirm all other `formOnLoad` behaviours continue working: pending-approval lock, won/lost lock, product filter, margin defaults.

### 5. Run validation commands
- Execute the commands listed in the **Validation Commands** section below to confirm no syntax errors were introduced.

## Acceptance Criteria
- `dc_costoverride` is set to `5` when a Quote Product form opens and the field has no existing value (null or undefined).
- `dc_costoverride` is **not** overwritten when the field already holds a non-null user-entered value on an existing record.
- `dc_overridedescription` is correctly marked as `required` on form load for new records and for existing records where `dc_costoverride` was previously null (because the default `5` is now applied).
- The fix is confined to `dc_quote_product_main_operations.js`; no other files are modified.
- No JavaScript syntax errors are introduced.
- All existing `formOnLoad` behaviours (pending-approval lock, won/lost lock, product filter, margin defaults) continue to work without regression.

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

No automated build, lint, or test commands are configured for this project (see `.app_config.yaml`). Validation is performed manually:

1. **Syntax check** — run in a terminal at the project root to confirm no parse errors:
   ```
   node -e "require('fs').readFileSync('dc_quote_product_main_operations.js','utf8'); console.log('Syntax OK');"
   ```
2. **Manual test in Dynamics 365** — follow the smoke-test steps in Task 4 above, covering the three scenarios: new record, existing record with value, existing record without value.

## Notes
- The hardcoded default value `5` comes directly from the issue description. If this should be configurable (e.g., driven by a field on the parent Quote record) in the future, that is a separate task.
- `dc_costoverride` is a number/currency field in Dynamics 365; `setValue(5)` passes a numeric literal, consistent with how `marginAttr.setValue(calculatedMargin)` passes a numeric value in `SetMarginsAndDefaults`.
- The fix uses `var` for the attribute variable to match the legacy `var`-style used inside `setCostOverrideDescriptionRequired` and other private functions in this file; do not introduce `const`/`let` into private functions unless refactoring the whole file.
- A prior implementation of this exact fix already exists; see `docs/tasks/bug-quote-product-cost-override-default-7f242fa6/` for the original plan and implementation documentation.
