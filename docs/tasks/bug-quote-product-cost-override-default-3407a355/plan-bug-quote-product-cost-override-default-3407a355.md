# bug: quote-product-cost-override-default

## Metadata
adw_id: `3407a355`
issue_description: `On the Quote Product (Quote Line) form in Dynamics 365, the field dc_costoverride is not being assigned a default value when the form loads. The form's formOnLoad function in dc_quote_product_main_operations.js currently calls setCostOverrideDescriptionRequired, which only manages the required-level of the companion description field — it does not write any value to dc_costoverride. As a result, new Quote Product lines open without a cost-override default, requiring manual entry every time.`

## Description
On the Quote Product (Quote Line) form in Dynamics 365, the field `dc_costoverride` is not being assigned a default value when the form loads. The `formOnLoad` function in `dc_quote_product_main_operations.js` calls `setCostOverrideDescriptionRequired`, which only manages the required-level of the companion description field (`dc_overridedescription`) — it does not write any value to `dc_costoverride`. As a result, every new Quote Product line opens with the field blank, forcing users to manually enter a cost override on every new record.

## Objective
Add a guarded default-value assignment to `formOnLoad` in `dc_quote_product_main_operations.js` so that `dc_costoverride` is set to `5` whenever the form opens and the field is currently empty (null/undefined). Existing records with a non-null `dc_costoverride` must not be overwritten.

## Problem Statement
The `formOnLoad` handler does not initialise `dc_costoverride` to any default value. Every new Quote Product record opens with the field blank, requiring manual entry. The analogous guard pattern for `dc_marginrate` (in `SetMarginsAndDefaults`) already exists in the file — it just was never applied to `dc_costoverride`.

## Solution Statement
Add a new private helper function `setDefaultCostOverride(formContext)` that reads `dc_costoverride` and, only when its value is `null`/`undefined` (loose `== null` check), sets it to `5`. Call this helper from `formOnLoad` **before** `setCostOverrideDescriptionRequired` so the required-level check on `dc_overridedescription` sees the newly applied default on new records.

## Steps to Reproduce
1. Open the Dynamics 365 Quote Product (Quote Line) form in **Create** mode.
2. Observe the `dc_costoverride` field — it is blank (no default value is applied).
3. **Expected:** the field displays `5` automatically on load.
4. **Actual:** the field is empty; no default is applied.

Also reproducible on **Update** mode records where `dc_costoverride` was never populated (the field is currently null).

## Root Cause Analysis
The `formOnLoad` handler (lines 5–12 of `dc_quote_product_main_operations.js`) calls five helper functions:

- `lockFormWhenRelatedQuoteIsPendingApproval` — locks controls when the quote is pending approval
- `lockFormWhenRelatedQuoteIsWonOrLost` — locks controls when the quote is won/lost
- `filterProducts` — applies a custom product-filter view to the product lookup
- `SetMarginsAndDefaults` — sets `dc_marginrate` when the field is empty (via a guard pattern)
- `setCostOverrideDescriptionRequired` — sets the required-level on `dc_overridedescription` based on whether `dc_costoverride` has a value

None of these functions assign a value to `dc_costoverride`. The `SetMarginsAndDefaults` function (lines 213–216) already demonstrates the correct guard pattern for "only set when empty", but that logic was never extended to `dc_costoverride`, leaving the missing default.

## Code Patterns to Follow
Reference implementations:

- **`dc_quote_product_main_operations.js` — lines 213–216** (`SetMarginsAndDefaults`): established guard pattern for "only set when empty":
  ```js
  if (marginAttr && !marginAttr.getValue() && calculatedMargin !== null) {
      marginAttr.setValue(calculatedMargin);
  }
  ```
- **`dc_quote_product_main_operations.js` — lines 467–485** (`setCostOverrideDescriptionRequired`): shows how `dc_costoverride` is accessed via `formContext.getAttribute("dc_costoverride")` and its value read with `getValue()`.
- **`formOnLoad` — lines 5–12**: insertion point for the new `setDefaultCostOverride` call.
- **`var` style in private functions**: all private helper functions inside the IIFE use `var` (not `const`/`let`) — the new helper must follow the same style.

## Relevant Files
Use these files to complete the task:

- `dc_quote_product_main_operations.js` — the only file that needs to change; contains `formOnLoad`, `setCostOverrideDescriptionRequired`, and all `dc_costoverride` attribute access patterns.
- `.app_config.yaml` — confirms no automated build/lint/test pipeline; validation is manual + Node.js syntax check.
- `docs/tasks/conditional_docs.md` — conditional documentation guide (includes a condition for this exact scenario).
- `docs/tasks/bug-quote-product-cost-override-default-7f242fa6/doc-bug-quote-product-cost-override-default-7f242fa6.md` — prior implementation document for the same issue (adw_id `7f242fa6`); read for additional context on the guard pattern, call-order rationale, and `var` style requirement.
- `.claude/skills/developing-d365-webresources/SKILL.md` — project coding rules and conventions for Dynamics 365 web resources; follow all rules during implementation.

> No new files are required for this change.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Add `setDefaultCostOverride` helper function
- Open `dc_quote_product_main_operations.js`.
- Locate the closing brace of `setCostOverrideDescriptionRequired` (around line 485).
- Insert the following new private helper function immediately after it, still inside the IIFE:
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
- Use `var` (not `const`/`let`) to match the legacy variable style used in adjacent private functions inside the IIFE.

### 2. Update `formOnLoad` to call `setDefaultCostOverride` and re-order `setCostOverrideDescriptionRequired`
- In the `formOnLoad` function (lines 5–12), add the call to `setDefaultCostOverride(formContext)` **before** `setCostOverrideDescriptionRequired` so the description field's required-level check evaluates against the newly-set default:
  ```js
  this.formOnLoad = function (executionContext) {
      const formContext = executionContext.getFormContext();
      lockFormWhenRelatedQuoteIsPendingApproval(formContext);
      lockFormWhenRelatedQuoteIsWonOrLost(formContext);
      filterProducts(executionContext);
      SetMarginsAndDefaults(executionContext);
      setDefaultCostOverride(formContext);               // <-- new call
      setCostOverrideDescriptionRequired(executionContext); // moved to last
  }
  ```
- Moving `setCostOverrideDescriptionRequired` to after `setDefaultCostOverride` ensures that on a new record, `dc_overridedescription` is immediately marked `required` (because `dc_costoverride` is now `5`, non-null) rather than remaining `none`.
- Do **not** call `fireOnChange()` on `dc_costoverride` after setting the default. The `onCostOverrideChange` handler would redundantly re-invoke `SetMarginsAndDefaults` and `setCostOverrideDescriptionRequired` on initial load.

### 3. Verify no regressions in `setCostOverrideDescriptionRequired`
- Mentally trace three scenarios to confirm `setCostOverrideDescriptionRequired` still behaves correctly after the re-ordering:
  - **New record (null `dc_costoverride`):** `setDefaultCostOverride` sets `dc_costoverride = 5`, then `setCostOverrideDescriptionRequired` marks `dc_overridedescription` as `required`. ✓
  - **Existing record with a non-null `dc_costoverride` (e.g., `10`):** `setDefaultCostOverride` skips (guard prevents overwrite), `setCostOverrideDescriptionRequired` marks `dc_overridedescription` as `required`. ✓
  - **Existing record with null `dc_costoverride`:** `setDefaultCostOverride` sets it to `5`, `setCostOverrideDescriptionRequired` marks `dc_overridedescription` as `required`. ✓

### 4. Manual smoke-test in Dynamics 365
- Upload the updated `dc_quote_product_main_operations.js` as the web resource to the target Dynamics 365 environment.
- Open a **new** Quote Product form (Create mode): confirm `dc_costoverride` shows `5` and `dc_overridedescription` is marked required.
- Open an **existing** Quote Product record with a non-null `dc_costoverride` (e.g., `10`): confirm the existing value is **not** overwritten.
- Open an **existing** Quote Product record where `dc_costoverride` is currently null: confirm the field is set to `5` on load and `dc_overridedescription` is marked required.
- Confirm all other `formOnLoad` behaviours continue working: pending-approval lock, won/lost lock, product filter, and margin defaults.

### 5. Run validation commands
- Execute the commands listed in the **Validation Commands** section below to confirm no syntax errors were introduced.

## Acceptance Criteria
- `dc_costoverride` is set to `5` when a Quote Product form opens and the field has no existing value (null or undefined).
- `dc_costoverride` is **not** overwritten when the field already holds a non-null user-entered value on an existing record.
- `dc_overridedescription` is correctly marked as `required` on form load for new records and for existing records where `dc_costoverride` was null (because the default of `5` is now applied first).
- The fix is confined to `dc_quote_product_main_operations.js`; no other files are modified.
- No JavaScript syntax errors are introduced.
- All existing `formOnLoad` behaviours (pending-approval lock, won/lost lock, product filter, margin defaults) continue to work without regression.

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

No automated build, lint, or test commands are configured for this project (see `.app_config.yaml`). Validation is performed as follows:

1. **Syntax check** — run in a terminal at the project root to confirm no parse errors:
   ```
   node -e "require('fs').readFileSync('dc_quote_product_main_operations.js','utf8'); console.log('Syntax OK');"
   ```
2. **Manual smoke-test in Dynamics 365** — follow the three scenarios in Task 4 above (new record, existing record with value, existing record without value).

## Notes
- The default value `5` comes directly from the issue description. If this should be configurable (e.g., driven by a field on the parent Quote record), that is a separate task.
- `dc_costoverride` is a number/currency field in Dynamics 365; `setValue(5)` passes a numeric literal, consistent with how `marginAttr.setValue(calculatedMargin)` passes a numeric value in `SetMarginsAndDefaults`.
- The new helper function uses `var` to match the legacy variable declaration style used in adjacent private functions in the file; do not introduce `const`/`let` into private functions that already use `var` unless refactoring the whole file.
- A prior plan for this same issue exists at `docs/tasks/bug-quote-product-cost-override-default-7f242fa6/` (adw_id `7f242fa6`). This plan covers the identical change and supersedes it for the current task tracking ID `3407a355`.
