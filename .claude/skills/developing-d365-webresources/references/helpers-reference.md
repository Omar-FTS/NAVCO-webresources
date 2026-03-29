# Helpers, Utilities, and Reference

## Field Visibility / Requirement Helpers

Keep these as private functions inside the IIFE:

```javascript
function showField(formContext, fieldName) {
    formContext.getControl(fieldName)?.setVisible(true);
}

function hideField(formContext, fieldName) {
    formContext.getControl(fieldName)?.setVisible(false);
}

function hideAndClearField(formContext, fieldName) {
    formContext.getControl(fieldName)?.setVisible(false);
    formContext.getAttribute(fieldName)?.setValue(null);
}

function setRequired(formContext, fieldName, level) {
    formContext.getAttribute(fieldName)?.setRequiredLevel(level); // "required"|"recommended"|"none"
}
```

### Batch helpers for operating on multiple fields at once

When an event handler needs to toggle visibility, required level, or disabled state across a group of fields, inline arrow-function batch helpers keep the logic readable:

```javascript
// Define near the top of the handler that needs them
const setVisible = (fields, visible) =>
    fields.forEach(field => formContext.getControl(field)?.setVisible(visible));

const setDisabled = (fields, isDisabled) =>
    fields.forEach(field => formContext.getControl(field)?.setDisabled(isDisabled));

const setRequiredLevel = (fields, level) =>
    fields.forEach(field => formContext.getAttribute(field)?.setRequiredLevel(level));

// Usage — clear groupings make intent obvious
const priceFields = ["dc_unitprice", "dc_discount", "dc_extendedamount"];
setVisible(priceFields, false);
setDisabled(priceFields, true);
setRequiredLevel(priceFields, "none");
```

Define these inside the specific handler function (not at the top of the IIFE) since `formContext` is in scope there.

---

## Option Set Value Mapping

```javascript
// Map as constants near the top of the IIFE
const STATUS_MAP = {
    100000000: "Draft",
    100000001: "Submitted",
    100000002: "Approved",
    100000003: "Rejected",
};

function getStatusDescription(value) {
    return STATUS_MAP[value] || "";
}

// For more complex logic, use switch
function getContractYears(contractLengthOption) {
    switch (contractLengthOption) {
        case 100000000: return 1;
        case 100000001: return 2;
        case 100000002: return 3;
        case 100000003: return 4;
        case 100000004: return 5;
        default: return 0;
    }
}
```

---

## GUID Handling

Always strip curly braces from GUIDs for API calls and comparisons:

```javascript
// Method 1: .replace() (explicit)
let cleanId = someId.replace("{", "").replace("}", "");

// Method 2: .slice() (concise)
let cleanId = someId.slice(1, -1);
```

Be consistent within a single file.

---

## Global Context Utilities

```javascript
let clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();
let userId = Xrm.Utility.getGlobalContext().userSettings.userId.replace("{", "").replace("}", "");
let roles = Xrm.Utility.getGlobalContext().userSettings.roles;
let userName = Xrm.Utility.getGlobalContext().userSettings.userName;
let orgSettings = Xrm.Utility.getGlobalContext().organizationSettings;
let orgId = orgSettings.organizationId;
let baseCurrencyId = orgSettings.baseCurrencyId;
```

---

## Form Selector (Switching Forms Programmatically)

```javascript
function isForm(formContext, formName) {
    let currentForm = formContext.ui.formSelector.getCurrentItem();
    return currentForm && currentForm.getLabel() === formName;
}

function navigateToForm(formContext, formName) {
    let items = formContext.ui.formSelector.items.get();
    for (let i = 0; i < items.length; i++) {
        if (items[i].getLabel() === formName) { items[i].navigate(); break; }
    }
}
```

---

## Custom Lookup View Filtering

```javascript
let viewId = "{00000000-0000-0000-0000-000000000001}"; // arbitrary unique GUID
let fetchXml = `<fetch version="1.0" output-format="xml-platform" mapping="logical" distinct="true">
    <entity name="product">
        <attribute name="productid" />
        <attribute name="name" />
        <filter type="and">
            <condition attribute="statecode" operator="eq" value="0" />
        </filter>
    </entity>
</fetch>`;

let layoutXml = `<grid name="resultset" object="1" jump="name" select="1" icon="1" preview="1">
    <row name="result" id="productid">
        <cell name="name" width="300" />
    </row>
</grid>`;

formContext.getControl("productid").addCustomView(viewId, "product", "Filtered Products", fetchXml, layoutXml, true);
```

---

## IFrame Manipulation

```javascript
let iframe = formContext.ui.controls.get("IFRAME_controlname");
let currentSrc = iframe.getSrc();
iframe.setSrc(newUrl);
```

---

## Form Locking Patterns

### Lock all fields except specific ones

Use `doesControlHaveAttribute` to skip non-field controls (iframes, subgrids, web resources) when iterating `formContext.ui.controls`:

```javascript
function doesControlHaveAttribute(control) {
    let controlType = control.getControlType();
    return controlType !== "iframe" && controlType !== "webresource" && controlType !== "subgrid";
}

function lockForm(formContext, fieldsToSkip) {
    fieldsToSkip = fieldsToSkip || [];
    formContext.ui.controls.forEach(function (control) {
        if (doesControlHaveAttribute(control) && !fieldsToSkip.includes(control.getAttribute().getName())) {
            control.setDisabled(true);
        }
    });
}

// Usage: lock everything except a sequencing field
lockForm(formContext, ["dc_recostingsequencenumber"]);
```

For simpler cases where you just want to lock all controls:
```javascript
formContext.ui.controls.forEach(function (control) {
    if (control && control.setDisabled) control.setDisabled(true);
});
```

---

## Zero-to-Null Conversion

Convert zero values to null before save to avoid storing empty numeric values:

```javascript
function clearZeroValues(formContext, fieldNames) {
    fieldNames.forEach(function (fieldName) {
        let attr = formContext.getAttribute(fieldName);
        if (attr && attr.getValue() === 0) attr.setValue(null);
    });
}
```

---

## Error Handling Patterns

| Scenario | Pattern |
|---|---|
| User-facing validation | `formContext.ui.setFormNotification(msg, "ERROR", id)` |
| Ribbon / action errors | `Xrm.App.addGlobalNotification({ type: 2, level: 2, message })` |
| Detailed error info | `Xrm.Navigation.openErrorDialog({ message, details })` |
| Long operations | `showProgressIndicator` in `try`, `closeProgressIndicator` in `finally` |

### Start/End Process Helpers (for complex multi-step operations)

```javascript
function startProcess(message) {
    Xrm.Utility.showProgressIndicator(message || "Processing...");
}

function endProcess() {
    Xrm.Utility.closeProgressIndicator();
}

function showError(errorOptions) {
    Xrm.Navigation.openErrorDialog(errorOptions);
}
```

---

## SVG Icon Guidelines

- Use a standard viewBox (e.g., `0 0 24 24` for small icons, `0 0 512 512` for larger)
- Use simple, clean paths — avoid embedded raster images
- Use the project's publisher prefix in the web resource name
- Name descriptively: `{prefix}_{action}_icon.svg`

---

## CSS Utility Classes for Dialogs

Use `font-family: SegoeUI, "Segoe UI"` to match Dynamics 365 styling. Build utility classes similar to Tailwind for consistency:

| Category   | Example Classes                                                                            |
|------------|-------------------------------------------------------------------------------------------|
| Layout     | `.flex`, `.flex-row`, `.justify-start`, `.justify-center`, `.justify-end`, `.items-center` |
| Sizing     | `.w-1/4`, `.w-1/2`, `.w-full`, `.h-33`                                                    |
| Spacing    | `.p-1`, `.p-2`, `.p-4`, `.mt-4`, `.ml-4`, `.my-4`                                         |
| Colors     | `.bg-blue-500`, `.bg-gray-300`, `.text-white`, `.text-gray-800`                            |
| Hover      | `.hover:bg-gray-400`, `.hover:bg-blue-600`                                                 |
| Font       | `.font-segoe`, `.font-medium`, `.font-small`                                               |
| State      | `.hidden`, `.cursor-pointer`, `.required` (adds red asterisk via `::after`)                |

---

## Performance Guidelines

- Minimize the number of web API calls in `onLoad` — batch when possible.
- Use `Xrm.WebApi.retrieveMultipleRecords` with FetchXML for complex queries rather than multiple simple queries.
- Use progress indicators for any operation that may take more than 1 second.
- Avoid jQuery — use native DOM APIs and `fetch()`.
- Use meaningful notification IDs (e.g., `"priceListNotFoundWarning"`) not random strings.
- Guard against null values before calling `.getValue()`, `.setText()`, etc.
