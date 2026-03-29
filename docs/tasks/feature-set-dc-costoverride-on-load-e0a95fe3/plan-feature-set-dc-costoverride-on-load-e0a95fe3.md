# feature: set-dc-costoverride-on-load

## Metadata
adw_id: `e0a95fe3`
issue_description: `set the value of dc_costoverride when the form loads — need the field dc_costoverride to be 5 in file dc_quote_product_main_operations.js`

## Description
On the Quote Product (Quote Line) form in Dynamics 365, the field `dc_costoverride` is not being assigned a default value when the form loads. The requirement is that when the form opens, `dc_costoverride` should be set to `5` — but only when the field is currently empty (null), so existing records with a user-entered override cost are not silently overwritten.

## Objective
Add logic to the `formOnLoad` handler in `dc_quote_product_main_operations.js` that sets `dc_costoverride` to `5` on form load, following the same guard pattern used for `dc_marginrate` (only set when the field has no existing value).

## Problem Statement
The form currently initialises `dc_costoverride` via `setCostOverrideDescriptionRequired`, which only manages the required-level of the related description field — it does not write any value to `dc_costoverride`. As a result, new Quote Product lines open without a cost-override default, requiring manual entry every time.

## Solution Statement
Create a new private helper function `setDefaultCostOverride(formContext)` that:
1. Reads the `dc_costoverride` attribute.
2. If the attribute value is `null` / `undefined`, sets it to `5`.
3. Calls this helper from `formOnLoad` after the existing initialisation calls.

This mirrors the existing "only set when empty" pattern used for `dc_marginrate` in `SetMarginsAndDefaults` (line 214).

## Code Patterns to Follow
Reference implementations:

- **`dc_quote_product_main_operations.js` — lines 213–216** (`SetMarginsAndDefaults`): shows how to guard a `setValue` call so it only fires when the attribute currently has no value:
  ```js
  if (marginAttr && !marginAttr.getValue() && calculatedMargin !== null) {
      marginAttr.setValue(calculatedMargin);
  }
  ```
- **`dc_quote_product_main_operations.js` — lines 467–485** (`setCostOverrideDescriptionRequired`): shows the established pattern for reading `dc_costoverride` via `formContext.getAttribute("dc_costoverride")` and operating on it.
- **`formOnLoad` — lines 5–12**: shows where new initialisation calls should be inserted.

## Relevant Files
Use these files to complete the task:

- `dc_quote_product_main_operations.js` — the only file that needs to change; contains `formOnLoad`, `setCostOverrideDescriptionRequired`, and the `dc_costoverride` attribute access pattern.

> No new files are required for this change.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Add `setDefaultCostOverride` helper function
- Open `dc_quote_product_main_operations.js`.
- After the closing brace of `setCostOverrideDescriptionRequired` (around line 485), add the following new private helper function:
  ```js
  // Set default value for dc_costoverride on form load
  function setDefaultCostOverride(formContext) {
      var costOverrideAttr = formContext.getAttribute("dc_costoverride");
      if (costOverrideAttr && costOverrideAttr.getValue() == null) {
          costOverrideAttr.setValue(5);
      }
  }
  ```
- Use `== null` (loose equality) to catch both `null` and `undefined`, consistent with the null-guard patterns already used elsewhere in the file.

### 2. Call `setDefaultCostOverride` from `formOnLoad`
- In the `formOnLoad` function (lines 5–12), add a call to `setDefaultCostOverride(formContext)` **after** the existing initialisation calls so that it fires when the form opens:
  ```js
  this.formOnLoad = function (executionContext) {
      const formContext = executionContext.getFormContext();
      lockFormWhenRelatedQuoteIsPendingApproval(formContext);
      lockFormWhenRelatedQuoteIsWonOrLost(formContext);
      setCostOverrideDescriptionRequired(executionContext);
      filterProducts(executionContext);
      SetMarginsAndDefaults(executionContext);
      setDefaultCostOverride(formContext);   // <-- new call
  }
  ```
- Placing it last ensures the lock functions have already run; even if the form is locked, the value is still written to the attribute before any `setDisabled` logic fires (Dynamics 365 locks controls, not attribute values).

### 3. Verify `setCostOverrideDescriptionRequired` still works correctly
- After the value is set to `5` on load, `setCostOverrideDescriptionRequired` (called earlier in `formOnLoad`) will have already run with the old null value, potentially leaving `dc_overridedescription` as `"none"` required.
- To ensure consistency, move the call to `setCostOverrideDescriptionRequired` to **after** `setDefaultCostOverride`, or call it a second time at the end of `formOnLoad`:
  ```js
  this.formOnLoad = function (executionContext) {
      const formContext = executionContext.getFormContext();
      lockFormWhenRelatedQuoteIsPendingApproval(formContext);
      lockFormWhenRelatedQuoteIsWonOrLost(formContext);
      filterProducts(executionContext);
      SetMarginsAndDefaults(executionContext);
      setDefaultCostOverride(formContext);
      setCostOverrideDescriptionRequired(executionContext);  // moved to run after default is set
  }
  ```
- This guarantees `dc_overridedescription` is marked `required` (because `dc_costoverride` will now be `5`, non-null) on every new form open.

### 4. Manual smoke-test in Dynamics 365
- Upload the updated `dc_quote_product_main_operations.js` as the web resource to the target Dynamics 365 environment.
- Open a **new** Quote Product form (create scenario): confirm `dc_costoverride` shows `5` and `dc_overridedescription` is marked required.
- Open an **existing** Quote Product record that already has a non-null `dc_costoverride` value: confirm the existing value is **not** overwritten.
- Open an **existing** Quote Product record where `dc_costoverride` is currently null: confirm the field is set to `5` on load.

### 5. Run validation checks
- Execute the commands listed in the **Validation Commands** section below to confirm no syntax errors were introduced.

## Acceptance Criteria
- `dc_costoverride` is set to `5` when a Quote Product form opens and the field has no existing value.
- `dc_costoverride` is **not** overwritten when the field already holds a user-entered value on an existing record.
- `dc_overridedescription` is correctly marked as `required` on load (because `dc_costoverride` is now `5`, non-null) for new records.
- The change is confined to `dc_quote_product_main_operations.js`; no other files are modified.
- No JavaScript syntax errors are introduced.
- All existing form-load behaviour (lock logic, margin defaults, product filter) continues to work without regression.

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

No automated build, lint, or test commands are configured for this project (see `.app_config.yaml`). Validation is performed manually:

1. **Syntax check** — open the file in a browser DevTools console or Node.js REPL and confirm no parse errors:
   ```
   node -e "require('fs').readFileSync('dc_quote_product_main_operations.js','utf8'); console.log('Syntax OK');"
   ```
2. **Manual test in Dynamics 365** — follow the steps in Task 4 above.

## Notes
- The hardcoded value `5` comes directly from the issue description. If this should be driven by a configuration field on the parent Quote record in the future, that would be a separate task.
- The `dc_costoverride` field is a number/currency field in Dynamics 365; `setValue(5)` passes a numeric literal, consistent with how `marginAttr.setValue(calculatedMargin)` passes a numeric value in the existing code.
- Do **not** call `fireOnChange()` after setting the default; the `onCostOverrideChange` handler (line 45) will invoke `SetMarginsAndDefaults` and `setCostOverrideDescriptionRequired` again, which is redundant on initial load since `setCostOverrideDescriptionRequired` is already called in `formOnLoad`. Only fire `onChange` if downstream logic explicitly requires it.
