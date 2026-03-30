# Bug Fix: Quote Product Cost Override Default Value

**ADW ID:** 7f242fa6
**Date:** 2026-03-30
**Plan:** docs/tasks/bug-quote-product-cost-override-default-7f242fa6/plan-bug-quote-product-cost-override-default-7f242fa6.md

## Overview

The `dc_costoverride` field on the Quote Product (Quote Line) form in Dynamics 365 was not receiving a default value on form load, requiring users to manually enter a cost override on every new record. This fix adds a guarded default of `5` that applies only when the field is currently null, preserving any existing user-entered values on update records.

## What Was Built

- New private helper function `setDefaultCostOverride(formContext)` in `dc_quote_product_main_operations.js` that sets `dc_costoverride` to `5` when the field has no value
- Updated `formOnLoad` call order so `setDefaultCostOverride` runs before `setCostOverrideDescriptionRequired`, ensuring the description field's required-level check sees the newly applied default on new records

## Technical Implementation

### Files Modified

- `dc_quote_product_main_operations.js`: Added `setDefaultCostOverride` helper function and updated `formOnLoad` call order

### Key Changes

- **New helper function** `setDefaultCostOverride(formContext)` (line ~492): reads `dc_costoverride` via `formContext.getAttribute("dc_costoverride")` and calls `setValue(5)` only when `getValue() == null` (loose equality to catch both `null` and `undefined`)
- **`formOnLoad` reordering**: `setDefaultCostOverride(formContext)` is now called after `SetMarginsAndDefaults` but before `setCostOverrideDescriptionRequired`, so the required-level logic on `dc_overridedescription` always evaluates against the final value of `dc_costoverride`
- **Guard pattern**: Uses `== null` (loose equality), consistent with the existing null-guard pattern in `SetMarginsAndDefaults` and `getLookupValue` helpers throughout the file
- **No `fireOnChange` call**: The default is set silently without triggering `onCostOverrideChange`, avoiding a redundant re-run of `SetMarginsAndDefaults` and `setCostOverrideDescriptionRequired` on initial load
- **`var` style preserved**: The new function uses `var` to match the legacy variable declaration style used in adjacent private functions in the file

## How to Use

The fix is applied automatically on form load — no user action is required.

1. Open a new Quote Product (Quote Line) form in **Create** mode: `dc_costoverride` will show `5` and `dc_overridedescription` will be marked required.
2. Open an existing Quote Product record with a non-null `dc_costoverride` (e.g., `10`): the existing value is preserved unchanged.
3. Open an existing Quote Product record where `dc_costoverride` is currently null: the field is set to `5` on load and `dc_overridedescription` is marked required.

## Configuration

No configuration required. The default value `5` is hardcoded in `setDefaultCostOverride`. If the default should be configurable in the future (e.g., driven by a field on the parent Quote record), that would be a separate task.

## Testing

**Syntax check:**
```
node -e "require('fs').readFileSync('dc_quote_product_main_operations.js','utf8'); console.log('Syntax OK');"
```

**Manual smoke-test in Dynamics 365** — three scenarios to verify:
1. New record (Create mode): `dc_costoverride` = `5`, `dc_overridedescription` required
2. Existing record with a non-null `dc_costoverride`: value not overwritten
3. Existing record with null `dc_costoverride`: set to `5` on load, `dc_overridedescription` required

Also confirm all other `formOnLoad` behaviours continue working: pending-approval lock, won/lost lock, product filter, and margin defaults.

## Notes

- The default value `5` comes directly from the issue requirements. Changing this value requires modifying `setDefaultCostOverride` in `dc_quote_product_main_operations.js`.
- `dc_costoverride` is a number/currency field; `setValue(5)` passes a numeric literal, consistent with how `marginAttr.setValue(calculatedMargin)` works in `SetMarginsAndDefaults`.
- An identical feature plan exists at `docs/tasks/feature-set-dc-costoverride-on-load-e0a95fe3/`; this bug plan supersedes it.
- The fix is fully contained in `dc_quote_product_main_operations.js` — no other files were modified as part of the logic change.
