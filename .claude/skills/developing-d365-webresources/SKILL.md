---
name: developing-d365-webresources
description: Writes and maintains JavaScript, HTML, CSS, and SVG web resources for Dynamics 365 / Dataverse model-driven apps. Always use this skill when writing form scripts, ribbon commands, HTML dialogs, or any web resource for Dynamics 365, Dataverse, or Power Apps model-driven apps — even if the user just says "add a field" or "fix the save logic" without explicitly mentioning the platform. Covers Client API, Xrm.WebApi, namespace patterns, event handlers, and Microsoft best practices. Trigger whenever the user references formContext, Xrm, dc_ fields, quote lines, opportunity products, ribbons, BPF, or any Dynamics-specific code pattern.
---

# Dynamics 365 Web Resource Development

You are an expert Dynamics 365 / Microsoft Dataverse web resource developer. Use this skill when writing, reviewing, or maintaining web resources (JavaScript form scripts, HTML web resources, ribbon commands, CSS, SVG icons) for model-driven apps.

---

## Project Discovery (MUST DO FIRST)

Before writing any code, inspect the existing files in the workspace to determine:

1. **Publisher prefix** — the schema name prefix used for custom entities and fields (e.g., `new_`, `cr_`, `contoso_`). All new web resource names MUST use the same prefix.
2. **Client / namespace name** — the name used in JavaScript namespaces (e.g., `Contoso`, `Acme`). Derived from the company or project name. For new entity scripts, derive the namespace as `{Company}{Entity}Sdk` (e.g., `NavcoWorkOrderSdk`), never reuse a generic namespace like `NavcoSdk` for a new entity file.
3. **Namespace patterns** — which patterns are in use:
    - **IIFE pattern**: `{Client}{Entity}Sdk` — attached to `window`, invoked with `.call()`.
    - **Revealing module pattern**: `{Prefix}.{Entity}Ribbon` — for ribbon command files.
4. **File naming conventions** — follow whatever pattern the project already uses.
5. **Language style** — check whether the project uses `var` (legacy) or `let`/`const` (modern) and match accordingly. Always use `let`/`const` in new files.

> **Never assume a prefix or namespace. Always inspect existing files first.**

---

## File Naming Conventions

| File Type                  | Pattern                                  | Example                              |
| -------------------------- | ---------------------------------------- | ------------------------------------ |
| Entity form script         | `{prefix}_{entity}_main_operations.js`   | `new_lead_main_operations.js`        |
| Ribbon commands            | `{prefix}_{entity}_ribbon.js`            | `new_order_ribbon.js`                |
| Custom dialog scripts      | `{prefix}_{dialogName}.js`               | `new_opportunityCustomDialogs.js`    |
| HTML dialog (folder)       | `{prefix}_/{DialogName}/index.html`      | `new_/CreateQuoteDialog/index.html`  |
| HTML dialog (flat)         | `{prefix}_{dialog_name}_form.html`       | `new_close_appointment_dialog_form.html` |
| Dialog JS companion        | `{prefix}_{dialog_name}.js`              | `new_close_appointment_dialog.js`    |
| Utility/shared scripts     | `{prefix}_{UtilityName}.js`              | `new_MaskPhoneNumber.js`             |
| SVG icons                  | `{prefix}_{description}_icon.svg`        | `new_create_addendum_icon.svg`       |

---

## JavaScript Code Organization

### No Module System

Dynamics 365 web resources do not support `import`/`export`, AMD, or CommonJS. All code is either global functions or attached to window-level namespace objects. Use vanilla JavaScript — no TypeScript for web resources.

### Pattern 1: IIFE with Namespace (PREFERRED for new files)

```javascript
var ContosoOrderSdk = window.ContosoOrderSdk || {};
(function () {
    /**
     * -----------------------------------------------------------------------------------------------------------------------
     * *************************************************** Event Handlers ***************************************************
     * -----------------------------------------------------------------------------------------------------------------------
     */

    this.onLoad = function (executionContext) {
        let formContext = executionContext.getFormContext();
        // initialization logic...
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------------
     * *************************************************** Helper Methods ***************************************************
     * -----------------------------------------------------------------------------------------------------------------------
     */

    function somePrivateHelper(formContext) {
        // helper logic...
    }
}).call(ContosoOrderSdk);
```

### Pattern 2: Revealing Module (for ribbon command files)

```javascript
var Contoso = Contoso || {};

Contoso.OpportunityRibbon = (function () {
    function openDialog(formContext) {
        let recordId = formContext.data.entity.getId().slice(1, -1);
        // dialog logic...
    }
    return { OpenDialog: openDialog };
})();
```

### Pattern 3: Global Functions (LEGACY only)

Only use when modifying existing legacy files, or for **Ribbon Workbench enable rules** that require a globally accessible function name. Place ribbon enable rule globals **outside** any IIFE, at the bottom of the file.

---

## Form Event Handlers

Name onChange handlers after the field they handle — this is the convention across the project:

```javascript
// onLoad — entry point; call orchestrator functions from here
this.formOnLoad = function (executionContext) {
    const formContext = executionContext.getFormContext();
    initializeForm(formContext);
};

// onLoad can be async when startup needs an await
this.formOnLoad = async function (executionContext) {
    const formContext = executionContext.getFormContext();
    const hasRole = await checkUserHasRole("Sales Manager");
    if (!hasRole) lockForm(formContext);
};

// onChange — name mirrors the field (camelCase)
this.onDC_ProductChange    = function (executionContext) { /* dc_productid changed */ };
this.onQuantityChange      = function (executionContext) { /* quantity changed */ };
this.onPriceOverrideChange = function (executionContext) { /* ispriceoverridden changed */ };

// onSave — registered via formContext.data.entity.addOnSave()
function onSaveHandler(executionContext) {
    const formContext = executionContext.getFormContext();
    // executionContext.getEventArgs().preventDefault(); // to block save
}

// onDataLoad — fires on data.refresh() calls too
function onDataLoadHandler(executionContext) {
    const formContext = executionContext.getFormContext();
}
```

## Form Type Constants

| Value | Form Type |
| ----- | --------- |
| 1     | Create    |
| 2     | Update    |
| 3     | Read Only |
| 4     | Disabled  |
| 6     | Bulk Edit |

---

## Common Client API Operations

```javascript
// Attribute
formContext.getAttribute("field").getValue();
formContext.getAttribute("field").setValue(val);
formContext.getAttribute("optionset").getText();
formContext.getAttribute("field").setRequiredLevel("required"); // "required"|"recommended"|"none"

// Control
formContext.getControl("field").setVisible(true);
formContext.getControl("field").setDisabled(true);
formContext.getControl("optionset").removeOption(100000000);

// Lookup value
formContext.getAttribute("lookupfield").setValue([{ id, entityType, name }]);
let ref = formContext.getAttribute("lookupfield").getValue();
if (ref?.length > 0) { let { id, name, entityType } = ref[0]; }

// Tab / Section
formContext.ui.tabs.get("tab_name").setVisible(true);
formContext.ui.tabs.get("tab_name").sections.get("section_name").setVisible(false);

// Subgrid
formContext.ui.controls.get("subgrid_name").refresh();

// Disable all controls
formContext.ui.controls.forEach(ctrl => ctrl?.setDisabled?.(true));

// Record ID (strip curly braces)
let recordId = formContext.data.entity.getId().slice(1, -1);

// Save / Refresh
formContext.data.save();
formContext.data.refresh(false); // true = save before refresh
formContext.data.refresh(true).then(() => Xrm.Navigation.openAlertDialog({ text: "Done." }));
```

### Notifications

```javascript
// Form-level
formContext.ui.setFormNotification("Message", "WARNING", "unique_id");
formContext.ui.clearFormNotification("unique_id");

// Control-level
formContext.getControl("field").addNotification({ messages: ["Issue."], notificationLevel: "ERROR", uniqueId: "id" });
formContext.getControl("field").clearNotification("id");

// Global (toast)
let notifId = await Xrm.App.addGlobalNotification({ type: 2, level: 1, message: "Success!" }); // level: 1=success,2=error,3=warning,4=info
setTimeout(() => Xrm.App.clearGlobalNotification(notifId), 5000);
```

---

## Xrm.WebApi Quick Reference

For full WebAPI patterns, fetch(), security role checks, and custom actions see [references/webapi-reference.md](references/webapi-reference.md).

```javascript
// Retrieve multiple (preferred — use FetchXML)
let fetchXml = `<fetch><entity name="account"><attribute name="accountid"/></entity></fetch>`;
let result = await Xrm.WebApi.retrieveMultipleRecords("account", "?fetchXml=" + encodeURIComponent(fetchXml));

// Retrieve single
let record = await Xrm.WebApi.retrieveRecord("account", id, "?$select=name");

// Create
let created = await Xrm.WebApi.createRecord("entity", { name: "Val", "lookup@odata.bind": "/entities(guid)" });

// Update
await Xrm.WebApi.updateRecord("entity", id, { fieldname: "value" });

// Delete
await Xrm.WebApi.deleteRecord("entity", id);
```

---

## Error Handling

Always wrap progress indicator operations in `try/catch/finally`:

```javascript
async function performAction(formContext) {
    Xrm.Utility.showProgressIndicator("Processing...");
    try {
        await Xrm.WebApi.updateRecord("entity", id, data);
        await formContext.data.refresh(true);
    } catch (error) {
        Xrm.Navigation.openErrorDialog({ message: error.message });
    } finally {
        Xrm.Utility.closeProgressIndicator();
    }
}
```

For more patterns see [references/patterns-reference.md](references/patterns-reference.md).

---

## Microsoft Best Practices — Critical Rules

1. **NEVER use `Xrm.Page`** — always use `executionContext.getFormContext()`. Exception: HTML web resources accessing the parent form use `window.parent.Xrm.Page`.
2. **NEVER use synchronous XMLHttpRequest** — all HTTP must be async.
3. **NEVER use `window.top`** — use `window.parent` only in HTML web resources.
4. **NEVER use unsupported/internal APIs** — only documented Client API methods.
5. **Ribbon enable rules MUST return `Promise<boolean>`**.
6. **Use API version v9.2** for all new `fetch()` calls.
7. **Always `encodeURIComponent(fetchXml)`** when passing FetchXML to `retrieveMultipleRecords`.
8. **Use `$webresource:` directive** in SiteMap/ribbon XML to create solution dependencies.

## Things to AVOID

1. `Xrm.Page` — use `formContext` from execution context
2. Synchronous `XMLHttpRequest`
3. `window.top` — use `window.parent` in HTML web resources only
4. jQuery — use native APIs
5. Hardcoded API keys or secrets in web resources
6. `alert()` — use form notifications or `Xrm.Navigation.openAlertDialog()`
7. `debugger;` statements in production code
8. `var` for new code — use `let`/`const`
9. `setTimeout()` to work around control timing — use event-driven approaches
10. `.forEach()` with `await` — use a `for` loop for sequential async
11. `Xrm.Utility.alertDialog()` (deprecated) — use `Xrm.Navigation.openAlertDialog()`
12. OData v2.0 endpoints — always use Web API v4.0

---

## Security Role Check

```javascript
// Synchronous (preferred) — roles already loaded on the client
function userHasRole(roleName) {
    const roles = Xrm.Utility.getGlobalContext().userSettings.roles;
    let found = false;
    roles.forEach(role => { if (role.name === roleName) found = true; });
    return found;
}

// Async — when you need to query roles for a specific user via WebApi
async function checkUserHasRole(roleName) {
    const userId = Xrm.Utility.getGlobalContext().userSettings.userId.replace("{", "").replace("}", "");
    const fetchXml = `<fetch mapping="logical">
        <entity name="systemuser">
            <attribute name="systemuserid"/>
            <filter><condition attribute="systemuserid" operator="eq" value="${userId}"/></filter>
            <link-entity name="systemuserroles" from="systemuserid" to="systemuserid">
                <link-entity name="role" from="roleid" to="roleid" alias="role">
                    <attribute name="name"/>
                </link-entity>
            </link-entity>
        </entity>
    </fetch>`;
    const result = await Xrm.WebApi.retrieveMultipleRecords("systemuser", "?fetchXml=" + encodeURIComponent(fetchXml));
    return result.entities.some(e => e["role.name"] === roleName);
}
```

---

## Reusable Helper Functions

These are commonly duplicated across files — define them as private functions inside the IIFE.

```javascript
// Clean curly braces from a GUID
function cleanGuid(guid) {
    return guid ? guid.replace("{", "").replace("}", "") : null;
}

// Get lookup value safely — returns null if field is empty
function getLookupValue(formContext, fieldName) {
    const attr = formContext.getAttribute(fieldName);
    if (!attr?.getValue()?.length) return null;
    return {
        id: cleanGuid(attr.getValue()[0].id),
        entityType: attr.getValue()[0].entityType,
        name: attr.getValue()[0].name
    };
}

// Show / hide a field — hiding also clears required level
function showField(formContext, fieldName) {
    formContext.getControl(fieldName)?.setVisible(true);
}

function hideField(formContext, fieldName) {
    formContext.getControl(fieldName)?.setVisible(false);
    formContext.getAttribute(fieldName)?.setRequiredLevel("none");
}

function hideAndClearField(formContext, fieldName) {
    hideField(formContext, fieldName);
    formContext.getAttribute(fieldName)?.setValue(null);
}
```

---

## Full Ribbon Command Pattern

A complete ribbon button handler: confirm → progress → call action → refresh.

```javascript
var Navco = Navco || {};

Navco.QuoteRibbon = (function () {

    async function getProductsFromOpportunity(formContext) {
        const confirmed = await confirmDialog(
            "Get Products from Opportunity",
            "This will replace current products. Continue?"
        );
        if (!confirmed) return;

        Xrm.Utility.showProgressIndicator("Fetching products...");
        try {
            const quoteId = formContext.data.entity.getId().slice(1, -1);
            const clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();

            await fetch(`${clientUrl}/api/data/v9.2/dc_GetProductsfromOpportunity`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "OData-MaxVersion": "4.0", "OData-Version": "4.0" },
                body: JSON.stringify({ QuoteId: quoteId })
            });

            await formContext.data.refresh(false);
            Xrm.Navigation.openAlertDialog({ title: "Success", text: "Products retrieved." });
        } catch (error) {
            Xrm.Navigation.openErrorDialog({ message: error.message });
        } finally {
            Xrm.Utility.closeProgressIndicator();
        }
    }

    return { GetProductsFromOpportunity: getProductsFromOpportunity };

})();

async function confirmDialog(title, text) {
    const result = await Xrm.Navigation.openConfirmDialog({ title, text }, { height: 200, width: 450 });
    return result.confirmed;
}
```

---

## Supporting Reference Files

- [references/webapi-reference.md](references/webapi-reference.md) — Full Xrm.WebApi, native fetch, PATCH, custom actions, security role checks
- [references/patterns-reference.md](references/patterns-reference.md) — Ribbon patterns, Navigation/Dialogs, HTML web resources, BPF, record cloning, multi-step async orchestration
- [references/helpers-reference.md](references/helpers-reference.md) — Field helpers, option set mapping, GUID handling, global context utilities, SVG guidelines
