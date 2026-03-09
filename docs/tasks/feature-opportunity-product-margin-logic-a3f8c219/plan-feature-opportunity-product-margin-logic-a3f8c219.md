# feature: Opportunity Product Margin & Field Visibility Logic

## Metadata
adw_id: `a3f8c219`
issue_description: `N52 formula conversion for opportunityproduct form — sets margins, field visibility, and product-family-based logic when dc_productid is populated on an opportunity product line item.`

## Description
An N52 formula exists for the **opportunityproduct** (opportunity product line item) form that must be converted to a new JavaScript web resource. The formula fires when `dc_productid` contains data and:

1. Hides `productdescription` / `productid` and sets them to not-required (custom `dc_productid` is used instead).
2. Clears the `isproductoverridden` flag to 0.
3. Reads margin defaults from the parent **opportunity** (`dc_standardproductmargin`, `dc_specialproductmargin`, `dc_outsidelabormargin`, `dc_subscriptionproductmargin`).
4. Reads the product family from the product's parent product number.
5. Shows/hides `dc_specialproduct` and `dc_monthlyquantity`, sets required levels, and locks `dc_monthlyquantity` to 1 for MONITORING_FAMILY — all matching the product family.
6. If `dc_marginrate` is **empty**, populates it with the calculated family margin.
7. The formula also hints at additional commented-out logic for `dc_manualmargin` and a "linemarginrate vs marginrate" comparison that needs to be addressed.

The equivalent logic for the **quote** product form already lives in `dc_quote_product_main_operations.js` → `SetMarginsAndDefaults`. This new file mirrors that pattern for the opportunity product entity.

## Objective
Create `dc_opportunity_product_main_operations.js` — a new web resource that handles margin defaults, field visibility, and product-family routing on the **opportunityproduct** form, mirroring the pattern established in `dc_quote_product_main_operations.js`.

## Problem Statement
No JavaScript web resource currently exists for the opportunityproduct form. The N52 formula that drives product-family-based UI behaviour and margin defaulting on that form has not yet been converted to JavaScript, leaving the form without client-side logic.

## Solution Statement
Create `dc_opportunity_product_main_operations.js` under the `NavcoOpportunityLineSdk` namespace, reusing the helper patterns from `dc_quote_product_main_operations.js` (`getProductFamily`, `showField`, `hideField`, `hideAndClearField`, `getLookupValue`) and adapting them to the `opportunityproduct` entity and its parent `opportunityid` lookup.

## Code Patterns to Follow
Reference implementations:

- **`dc_quote_product_main_operations.js` → `SetMarginsAndDefaults` (line 147–239)** — exact structural twin: retrieves parent record margins, calls `getProductFamily`, switches on family to set field visibility and `calculatedMargin`, then conditionally populates `dc_marginrate`.
- **`dc_quote_product_main_operations.js` → `toggleSpecialProductMargin` (line 505–557)** — pattern for reacting to `dc_specialproduct` toggle on MATERIAL_FAMILY.
- **`dc_quote_product_main_operations.js` → `showHideQuantityValues` (line 608–653)** — pattern for quantity field show/hide on load.
- **`dc_quote_product_main_operations.js` → `getLookupValue` / `getProductFamily` / `showField` / `hideField` / `hideAndClearField`** — shared helpers to replicate verbatim.
- **Namespace convention** — `var NavcoOpportunityLineSdk = window.NavcoOpportunityLineSdk || {}; (function(){ ... }).call(NavcoOpportunityLineSdk)`.
- **Event handler naming** — public handlers are registered on `this` (e.g. `this.formOnLoad`, `this.onDC_ProductChange`); private functions remain inside the IIFE.

## Relevant Files
- **`dc_quote_product_main_operations.js`** — primary reference; entire structure is replicated for opportunity product.
- **`dc_quote_main_operations.js`** — reference for namespace pattern, `getLookupValue`, and event handler style.

### New Files
- **`dc_opportunity_product_main_operations.js`** — new web resource containing `NavcoOpportunityLineSdk`.

## Implementation Plan

### Phase 1: Foundation
Set up the namespace skeleton, copy and adapt the private helper functions (`getLookupValue`, `getProductFamily`, `showField`, `hideField`, `hideAndClearField`, `setRequired`) — these are identical except `getLookupValue` must resolve `opportunityid` instead of `dc_quoteid`/`quoteid`.

### Phase 2: Core Implementation
Implement the main logic functions:

- **`SetMarginsAndDefaults(executionContext)`** — adapts the quote version:
  - Guard: `dc_productid` must have a value.
  - Lookup: `opportunityid` (single field, no fallback needed for opp product).
  - API call: retrieve `dc_standardproductmargin`, `dc_specialproductmargin`, `dc_outsidelabormargin`, `dc_subscriptionproductmargin` from the opportunity.
  - Call `getProductFamily` and switch on the five families (same cases as quote version).
  - After the switch: if `dc_marginrate` is empty, set it to `calculatedMargin`.
  - Also on entry: set `isproductoverridden` to `false` (0), hide `productdescription` and `productid`, remove their required levels.

- **`toggleSpecialProductMargin(executionContext)`** — fires on `dc_specialproduct` change, identical to quote version except uses `opportunityid` for margin lookup.

- **`showHideQuantityValues(formContext)`** — fires on load, same logic as quote version.

### Phase 3: Integration
Wire up the public event handlers on `this`:

| Handler | Trigger |
|---|---|
| `this.formOnLoad` | Form OnLoad |
| `this.onDC_ProductChange` | `dc_productid` OnChange |
| `this.onSpecialProductChange` | `dc_specialproduct` OnChange |
| `this.onMarginRateChange` | `dc_marginrate` OnChange |
| `this.onMonthlyQuantityChange` | `dc_monthlyquantity` OnChange |

`formOnLoad` calls: `showHideQuantityValues`, `SetMarginsAndDefaults` (if product is already set on load).
`onDC_ProductChange` calls: `SetMarginsAndDefaults`, `showHideQuantityValuesInOnChange`.
`onSpecialProductChange` calls: `SetMarginsAndDefaults`, `toggleSpecialProductMargin`.
`onMarginRateChange` calls: `SetMarginsAndDefaults`.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Create `dc_opportunity_product_main_operations.js` with namespace skeleton
- Create the file at the project root following the IIFE + `call` pattern:
  ```js
  var NavcoOpportunityLineSdk = window.NavcoOpportunityLineSdk || {};
  (function () {
      // ... event handlers and private functions
  }).call(NavcoOpportunityLineSdk);
  ```

### 2. Copy and adapt private helper functions
- Copy `getLookupValue` from `dc_quote_product_main_operations.js` — no changes needed (generic).
- Copy `getProductFamily` — no changes needed (generic product lookup).
- Copy `showField`, `hideField`, `hideAndClearField`, `setRequired` — no changes needed.

### 3. Implement `SetMarginsAndDefaults`
- Guard: if `dc_productid` has no value, return early.
- On entry (before async):
  - Set `isproductoverridden` to `false` via `formContext.getAttribute("isproductoverridden").setValue(false)`.
  - Hide `productdescription` and `productid` via `hideField`.
  - Set their required level to `"none"`.
- Resolve `opportunityid` using `getLookupValue(formContext, "opportunityid")`.
- Call `Xrm.WebApi.retrieveRecord` on the opportunity for the four margin fields.
- Call `getProductFamily` with the dc_productid value.
- Switch on product family — five cases identical to quote version:
  - `MATERIAL_FAMILY`: show `dc_specialproduct`, hide+clear `dc_monthlyquantity`, margin = special or standard based on `dc_specialproduct`.
  - `OUTSIDELABOR_FAMILY`: hide+clear `dc_monthlyquantity`, hide `dc_specialproduct`, margin = outsideLabor.
  - `MONITORING_FAMILY`: hide `dc_specialproduct`, show `dc_monthlyquantity`, setValue(1), disable, setRequired, margin = subscription.
  - `SUBSCRIPTION_FAMILY`: show + setRequired `dc_monthlyquantity`, hide `dc_specialproduct`, margin = subscription.
  - `SERVICE_FAMILY`: hide+clear `dc_monthlyquantity`, hide `dc_specialproduct`, margin = outsideLabor.
- After switch: if `dc_marginrate` is empty and `calculatedMargin !== null`, set it.

### 4. Implement `toggleSpecialProductMargin`
- Copy from `dc_quote_product_main_operations.js` line 505–557.
- Change the parent lookup from `dc_quoteid`/`quoteid` fallback to just `opportunityid`.
- Logic otherwise identical: if MATERIAL_FAMILY, set margin to special or standard based on `dc_specialproduct` value; always overwrite (not guarded by empty-check, unlike `SetMarginsAndDefaults`).

### 5. Implement `showHideQuantityValues` / `showHideQuantityValuesInOnChange`
- Copy from `dc_quote_product_main_operations.js` lines 602–653.
- No changes needed — relies only on `getProductFamily` and `formContext`, which are the same.

### 6. Wire public event handlers on `this`
- `this.formOnLoad`: call `showHideQuantityValues(formContext)`, and if `dc_productid` has a value also call `SetMarginsAndDefaults(executionContext)`.
- `this.onDC_ProductChange`: call `SetMarginsAndDefaults`, `showHideQuantityValuesInOnChange`.
- `this.onSpecialProductChange`: call `SetMarginsAndDefaults`, `toggleSpecialProductMargin`.
- `this.onMarginRateChange`: call `SetMarginsAndDefaults`.
- `this.onMonthlyQuantityChange`: if needed, placeholder for future contract-length calculation (log or no-op; do not copy the quote version's `calculateQuantityFromMonthlyAndContract` unless confirmed it applies to opp products).

### 7. Run Validation Commands
- Execute validation commands listed below to confirm the file is well-formed and consistent.

## Testing Strategy

### Unit Tests
No automated test runner is configured. Manual validation steps:
- Open an opportunity product line item in Dynamics 365.
- Select a product from each family (MATERIAL_FAMILY, OUTSIDELABOR_FAMILY, MONITORING_FAMILY, SUBSCRIPTION_FAMILY, SERVICE_FAMILY) and verify field visibility and margin defaults match the expected behaviour per family.
- Clear `dc_marginrate` and change product — confirm it repopulates automatically.
- Set `dc_marginrate` manually, change product — confirm it is NOT overwritten.
- Toggle `dc_specialproduct` on a MATERIAL_FAMILY product — confirm margin switches between standard and special.

### Edge Cases
- `dc_productid` cleared after selection — form should not error; guards must handle null.
- Product with no parent product (no family) — all family-specific fields stay as-is; no margin set.
- Opportunity with missing margin fields (null values) — `calculatedMargin` stays null; `dc_marginrate` not touched.
- `isproductoverridden` attribute absent from form — use optional chaining (`?.setValue`) to avoid runtime error.
- `productdescription` / `productid` controls absent from the form layout — use `?.setVisible(false)` guards.

## Acceptance Criteria
- `dc_opportunity_product_main_operations.js` exists at the project root.
- Namespace is `NavcoOpportunityLineSdk`, following the existing convention.
- All five product families are handled in `SetMarginsAndDefaults` with correct field show/hide and margin assignment.
- `dc_marginrate` is only auto-populated when it is currently empty.
- `isproductoverridden` is set to `false` and `productdescription`/`productid` are hidden whenever `dc_productid` has data.
- `toggleSpecialProductMargin` switches margin immediately when `dc_specialproduct` changes (always overwriting).
- No runtime errors when product family is null or margin fields on the opportunity are null.
- Code follows the IIFE + `call` namespace pattern, async/await style, and `console.error("Navco: ...")` error logging used in the rest of the codebase.

## Validation Commands
No automated build, lint, or test commands are configured for this project (see `.app_config.yaml`). Validate manually:

```
# 1. Syntax check — Node.js must be available
node --check dc_opportunity_product_main_operations.js

# 2. Confirm file exists and is non-empty
ls -lh dc_opportunity_product_main_operations.js
```

## Notes
- The truncated section of the formula (commented-out code) references `dc_manualmargin` and a condition where `linemarginrate != marginrate`. This is **not implemented** in the current quote product file either. Do not implement it in this pass — add a `// TODO` comment in the code noting the commented-out formula intent.
- `isproductoverridden` uses value `0` (integer) in the formula (`SetClientSideField('isproductoverridden', 0)`). In the Xrm API this maps to `setValue(false)` for a Two Options field — use the boolean form.
- The formula uses `[opportunityproduct.opportunityid]` for the parent lookup. In the Xrm form context this is attribute name `opportunityid` — a standard lookup field on opportunityproduct records.
- Deploy the web resource to Dynamics 365 and register `NavcoOpportunityLineSdk.formOnLoad` on the opportunityproduct form's OnLoad event, and the other handlers on their respective field OnChange events.
