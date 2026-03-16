---
name: dataverse-webresource
description: Write and maintain JavaScript, HTML, CSS, and SVG web resources for Dynamics 365 / Dataverse model-driven apps following Microsoft best practices and the Client API reference
---

# Dataverse Web Resource Development Skill

You are an expert Dynamics 365 / Microsoft Dataverse web resource developer. Use this skill when writing, reviewing, or maintaining web resources (JavaScript form scripts, HTML web resources, ribbon commands, CSS, SVG icons) for model-driven apps.

---

## Project Discovery (MUST DO FIRST)

Before writing any code, inspect the existing files in the workspace to determine:

1. **Publisher prefix** — the schema name prefix used for custom entities and fields (e.g., `new_`, `cr_`, `contoso_`). All new web resource names MUST use the same prefix.
2. **Client / namespace name** — the name used in JavaScript namespaces (e.g., `Contoso`, `Acme`). Derived from the company or project name.
3. **Namespace patterns** — which patterns are in use:
    - **IIFE pattern**: `{Client}{Entity}Sdk` — attached to `window`, invoked with `.call()`.
        - e.g., `ContosoOrderSdk`, `ContosoQuoteLineSdk`, `AcmeContactSdk`
    - **Shared IIFE namespace**: Some files share a single namespace like `{Client}Sdk` when the script serves cross-entity or feature-specific logic.
    - **Revealing module pattern**: `{Prefix}.{Entity}Ribbon` — for ribbon command files that return an object of public methods (e.g., `Contoso.OpportunityRibbon`).
4. **File naming conventions** — follow whatever pattern the project already uses.
5. **Language style** — check whether the project uses `var` (legacy) or `let`/`const` (modern) and match accordingly.

> **Important:** Never assume a prefix or namespace. Always inspect existing files first. Code examples in this skill use `{prefix}_` and `{Client}` as placeholders—replace them with the project's actual values.

---

## File Naming Conventions

Follow the project's existing file naming patterns. Common conventions:

| File Type                  | Pattern                                  | Example                                       |
| -------------------------- | ---------------------------------------- | --------------------------------------------- |
| Entity form script         | `{prefix}_{entity}_main_operations.js`   | `new_lead_main_operations.js`                 |
| Ribbon commands            | `{prefix}_{entity}_ribbon.js`            | `new_order_ribbon.js`                         |
| Custom dialog scripts      | `{prefix}_{dialogName}.js`               | `new_opportunityCustomDialogs.js`             |
| HTML dialog (folder)       | `{prefix}_/{DialogName}/index.html`      | `new_/CreateQuoteDialog/index.html`           |
| HTML dialog (flat)         | `{prefix}_{dialog_name}_form.html`       | `new_close_appointment_dialog_form.html`      |
| Dialog JS companion        | `{prefix}_{dialog_name}.js`              | `new_close_appointment_dialog.js`             |
| Utility/shared scripts     | `{prefix}_{UtilityName}.js`              | `new_MaskPhoneNumber.js`                      |
| SVG icons                  | `{prefix}_{description}_icon.svg`        | `new_create_addendum_icon.svg`                |
| Standalone feature scripts | `{prefix}_{featureName}.js`              | `new_setGoogleMapIframeURL.js`                |
| Cross-entity feature       | `{prefix}_{verbNounFromEntity}.js`       | `new_getProductsFromOpportunity.js`           |

---

## JavaScript Code Organization

### No Module System

Dynamics 365 web resources do not support `import`/`export`, AMD, or CommonJS. All code is either global functions or attached to window-level namespace objects.

**Language**: Vanilla JavaScript. ES6+ features (`let`, `const`, `async/await`, template literals, arrow functions, optional chaining `?.`) are acceptable in new code. No TypeScript for web resources (TypeScript is only used in PCF controls).

### Pattern 1: IIFE with Namespace (PREFERRED for new files)

Assign public methods to `this`, keep helpers as private functions. The namespace follows `{Client}{Entity}Sdk`:

```javascript
var ContosoOrderSdk = window.ContosoOrderSdk || {};
(function () {
    /**
     * -----------------------------------------------------------------------------------------------------------------------
     * *************************************************** Event Handlers ***************************************************
     * -----------------------------------------------------------------------------------------------------------------------
     */

    /**
     * Form onLoad event handler.
     * @param {Object} executionContext - The execution context passed by the form event.
     */
    this.onLoad = function (executionContext) {
        let formContext = executionContext.getFormContext();
        // initialization logic...
    };

    /**
     * Field onChange event handler.
     * @param {Object} executionContext - The execution context passed by the form event.
     */
    this.onFieldChange = function (executionContext) {
        let formContext = executionContext.getFormContext();
        // change handling logic...
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------------
     * *************************************************** Helper Methods ***************************************************
     * -----------------------------------------------------------------------------------------------------------------------
     */

    /**
     * Private helper function (not exposed on the namespace).
     */
    function somePrivateHelper(formContext) {
        // helper logic...
    }
}).call(ContosoOrderSdk);
```


### Pattern 1b: Revealing Module (used for ribbon command dialogs)

A short prefix namespace uses a revealing module pattern for ribbon commands:

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

### Pattern 2: Global Functions (LEGACY -- only use when modifying existing files that use this pattern)

Global functions are used in legacy files and are **also required for Ribbon Workbench enable rules** that need a globally accessible function name:

```javascript
function onLoad(context) {
    let formContext = context.getFormContext();
    // initialization logic...
}

function onFieldChange(context) {
    let formContext = context.getFormContext();
    // change logic...
}

/*-------------------------------------------------------------------------------------------------------------*/
/*********************************************** Helper methods ************************************************/
/*-------------------------------------------------------------------------------------------------------------*/

function helperFunction(formContext) {
    // helper logic...
}
```

> **Ribbon Workbench note:** Enable rules sometimes require a global function that returns a `Promise<boolean>`. If a file otherwise uses the IIFE namespace pattern, place the ribbon enable rule function **outside** the IIFE at the bottom of the file:
>
> ```javascript
> // ... end of IIFE ...
> }).call(ContosoQuoteSdk);
>
> // Global -- required for Ribbon Workbench enable rule
> function isAccountNotOnCreditHold(primaryControl) {
>     let formContext = primaryControl;
>     return new Promise(function (resolve) {
>         // async check, then resolve(true) or resolve(false)
>         resolve(true);
>     });
> }
> ```

---

## Form Event Handlers

### onLoad Handler

Always extract `formContext` from the execution context first:

```javascript
this.onLoad = function (executionContext) {
    let formContext = executionContext.getFormContext();

    // Check form type before doing work
    if (formContext.ui.getFormType() === 2) {
        // Update form specific logic
    }

    // Register programmatic onSave handlers when needed
    formContext.data.entity.addOnSave(onSaveHandler);

    // Register data onLoad (fires on refresh, not just initial load)
    formContext.data.addOnLoad(onDataLoadHandler);
};
```

### onChange Handler

```javascript
this.onFieldChange = function (executionContext) {
    let formContext = executionContext.getFormContext();
    let value = formContext.getAttribute("fieldname").getValue();
    // react to change...
};
```

### onSave Handler (registered programmatically)

```javascript
function onSaveHandler(executionContext) {
    let formContext = executionContext.getFormContext();

    // To prevent save:
    executionContext.getEventArgs().preventDefault();

    // To allow save after async work:
    formContext.data.save();
}
```

### data.addOnLoad Handler (fires on form data refresh)

Use `formContext.data.addOnLoad()` when you need logic to re-run after `formContext.data.refresh()` calls. This is different from form `onLoad` (which only fires once on initial load).

```javascript
function onDataLoadHandler(executionContext) {
    let formContext = executionContext.getFormContext();
    // Re-evaluate field visibility, recalculate values, etc.
}
```

---

## Form Type Constants

Always use these numeric values for `formContext.ui.getFormType()`:

| Value | Form Type |
| ----- | --------- |
| 1     | Create    |
| 2     | Update    |
| 3     | Read Only |
| 4     | Disabled  |
| 6     | Bulk Edit |

---

## Common Client API Operations

### Attributes (getValue, setValue, setRequiredLevel)

```javascript
// Get value
let value = formContext.getAttribute("fieldname").getValue();

// Set value
formContext.getAttribute("fieldname").setValue(newValue);

// Get option set text
let text = formContext.getAttribute("optionsetfield").getText();

// Check if field is dirty
let isDirty = formContext.getAttribute("fieldname").getIsDirty();

// Set required level
formContext.getAttribute("fieldname").setRequiredLevel("required"); // "required", "recommended", or "none"
```

### Controls (visibility, disabled, options)

```javascript
// Show/hide field
formContext.getControl("fieldname").setVisible(true);
formContext.getControl("fieldname").setVisible(false);

// Enable/disable field
formContext.getControl("fieldname").setDisabled(true);
formContext.getControl("fieldname").setDisabled(false);

// Remove option from option set
formContext.getControl("optionsetfield").removeOption(100000000);

// Get all options
let options = formContext.getControl("optionsetfield").getOptions();
```

### Lookup Value Construction

```javascript
// Set a lookup value
let lookupValue = [
    {
        id: recordId,
        entityType: "entityname",
        name: recordName,
    },
];
formContext.getAttribute("lookupfield").setValue(lookupValue);

// Get lookup value
let lookupRef = formContext.getAttribute("lookupfield").getValue();
if (lookupRef && lookupRef.length > 0) {
    let id = lookupRef[0].id;
    let name = lookupRef[0].name;
    let entityType = lookupRef[0].entityType;
}
```

### Tab and Section Visibility

```javascript
// Tab visibility
formContext.ui.tabs.get("tab_name").setVisible(true);

// Section visibility
formContext.ui.tabs
    .get("tab_name")
    .sections.get("section_name")
    .setVisible(false);
```

### Form Notifications

```javascript
// Set form notification (types: "ERROR", "WARNING", "INFO")
formContext.ui.setFormNotification(
    "Message to user",
    "WARNING",
    "unique_message_id",
);

// Clear form notification
formContext.ui.clearFormNotification("unique_message_id");
```

### Control-Level Notifications

```javascript
let notification = {
    messages: ["This field has a validation issue."],
    notificationLevel: "RECOMMENDATION", // or 'ERROR'
    uniqueId: "field_notification_id",
};
formContext.getControl("fieldname").addNotification(notification);
formContext.getControl("fieldname").clearNotification("field_notification_id");
```

### Data Operations

```javascript
// Save the form
formContext.data.save();

// Refresh the form (false = no save before refresh)
formContext.data.refresh(false);

// Refresh with chained callback (e.g., to show a success dialog after refresh)
formContext.data.refresh(true).then(function () {
    Xrm.Navigation.openAlertDialog({ text: "Operation completed." });
});

// Get record ID (always strip curly braces)
let recordId = formContext.data.entity
    .getId()
    .replace("{", "")
    .replace("}", "");

// Alternative: use .slice(1, -1) to strip curly braces
let recordId = formContext.data.entity.getId().slice(1, -1);

// Get entity name
let entityName = formContext.data.entity.getEntityName();
```

### Batch Control Manipulation (forEach)

Use `formContext.ui.controls.forEach()` to bulk-enable/disable all controls — useful for locking a form based on record status:

```javascript
// Disable all controls on the form
formContext.ui.controls.forEach(function (control) {
    if (control && control.setDisabled) {
        control.setDisabled(true);
    }
});
```

### Form Selector (Switching Forms Programmatically)

```javascript
// Check which form is active
function isForm(formContext, formName) {
    let currentForm = formContext.ui.formSelector.getCurrentItem();
    return currentForm && currentForm.getLabel() === formName;
}

// Navigate to a different form by name
let items = formContext.ui.formSelector.items.get();
for (let i = 0; i < items.length; i++) {
    if (items[i].getLabel() === "Target Form Name") {
        items[i].navigate();
        break;
    }
}
```

### Subgrid Operations

```javascript
// Refresh a subgrid (e.g., after a dialog closes or related record changes)
formContext.ui.controls.get("subgrid_control_name").refresh();
```

### Custom Lookup View Filtering

Use `addCustomView()` to dynamically filter lookup options based on form data:

```javascript
let viewId = "{00000000-0000-0000-0000-000000000001}"; // arbitrary unique GUID
let entityName = "product";
let viewDisplayName = "Filtered Products";

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

let productControl = formContext.getControl("productid");
productControl.addCustomView(viewId, entityName, viewDisplayName, fetchXml, layoutXml, true);
```

### IFrame Manipulation

```javascript
let iframe = formContext.ui.controls.get("IFRAME_controlname");
let currentSrc = iframe.getSrc();
iframe.setSrc(newUrl);
```

---

## Xrm.WebApi Usage

### Preferred: Xrm.WebApi.retrieveMultipleRecords with FetchXML

Use template literals for FetchXML in new code:

```javascript
let fetchXml = `<fetch version="1.0" output-format="xml-platform" mapping="logical" distinct="false">
    <entity name="account">
        <attribute name="accountid" />
        <attribute name="name" />
        <filter type="and">
            <condition attribute="accountid" operator="eq" value="${accountId}" />
        </filter>
    </entity>
</fetch>`;

Xrm.WebApi.retrieveMultipleRecords(
    "account",
    "?fetchXml=" + encodeURIComponent(fetchXml),
)
    .then(function (result) {
        if (result.entities && result.entities.length > 0) {
            let record = result.entities[0];
            // process record...
        }
    })
    .catch(function (error) {
        console.error(error.message);
    });
```

### Xrm.WebApi.retrieveRecord (single record)

```javascript
Xrm.WebApi.retrieveRecord("account", accountId, "?$select=name,revenue&$expand=primarycontactid($select=fullname)")
    .then(function (result) {
        let name = result.name;
        let contactName = result.primarycontactid ? result.primarycontactid.fullname : null;
    })
    .catch(function (error) {
        console.error(error.message);
    });
```

### Xrm.WebApi.updateRecord

```javascript
let data = {
    fieldname: "new value",
    "lookupfield@odata.bind": "/relatedentities(guid-here)",
};

Xrm.WebApi.updateRecord("entityname", recordId, data)
    .then(function (result) {
        // success
    })
    .catch(function (error) {
        console.error(error.message);
    });
```

### Xrm.WebApi.createRecord

```javascript
let data = {
    name: "New Record",
    fieldname: 100,
    "lookupfield@odata.bind": "/relatedentities(guid-here)",
};

Xrm.WebApi.createRecord("entityname", data)
    .then(function (result) {
        let newId = result.id;
    })
    .catch(function (error) {
        console.error(error.message);
    });
```

### Xrm.WebApi.deleteRecord

```javascript
Xrm.WebApi.deleteRecord("entityname", recordId)
    .then(function (result) {
        // success
    })
    .catch(function (error) {
        console.error(error.message);
    });
```

### Xrm.WebApi.execute (for bound/unbound actions)

```javascript
function CustomActionRequest(parameters) {
    this.param1 = parameters.param1;
    this.param2 = parameters.param2;
    this.getMetadata = function () {
        return {
            boundParameter: null,
            parameterTypes: {
                param1: { typeName: "Edm.String", structuralProperty: 1 },
                param2: { typeName: "Edm.Int32", structuralProperty: 1 },
            },
            operationType: 0, // 0=Action, 1=Function
            operationName: "your_CustomActionName",
        };
    };
}

Xrm.WebApi.execute(new CustomActionRequest({ param1: "value", param2: 42 }))
    .then(function (response) {
        return response.json();
    })
    .then(function (result) {
        // process result
    })
    .catch(function (error) {
        console.error(error.message);
    });
```

### Native fetch() with OData (for cases not covered by Xrm.WebApi)

```javascript
let clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();

fetch(
    clientUrl +
        "/api/data/v9.2/accounts?" +
        "$select=name,revenue" +
        "&$filter=name eq '" + encodeURIComponent(searchName) + "'",
    {
        method: "GET",
        headers: {
            Accept: "application/json",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
            Prefer: 'odata.include-annotations="*"',
        },
    },
)
    .then(function (response) {
        return response.json();
    })
    .then(function (data) {
        // Use OData annotations for lookup metadata:
        // data["_lookupfield_value@Microsoft.Dynamics.CRM.lookuplogicalname"]
        // data["_lookupfield_value@OData.Community.Display.V1.FormattedValue"]
    })
    .catch(function (error) {
        console.error(error);
    });
```

### PATCH (update via fetch)

```javascript
fetch(clientUrl + "/api/data/v9.2/accounts(" + recordId + ")", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        name: "Updated Name",
        "primarycontactid@odata.bind": "/contacts(guid-here)",
    }),
})
    .then(function (response) {
        if (!response.ok) {
            return response.json();
        }
        return response;
    })
    .then(function (response) {
        if (response.hasOwnProperty && response.hasOwnProperty("error")) {
            throw Error(response.error.message);
        }
        // success
    })
    .catch(function (error) {
        console.error(error);
    });
```

### Custom Action via fetch (bound to entity)

```javascript
let actionPath =
    "accounts(" + recordId + ")/Microsoft.Dynamics.CRM.your_CustomActionName";
let serverUrl = Xrm.Utility.getGlobalContext().getClientUrl();

fetch(serverUrl + "/api/data/v9.2/" + actionPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        /* action parameters */
    }),
})
    .then(function (response) {
        return response.json();
    })
    .then(function (result) {
        /* process */
    })
    .catch(function (error) {
        console.error(error);
    });
```

---

## Security Role Checks

### Preferred: Synchronous via userSettings.roles

```javascript
function hasSecurityRole(roleName) {
    let hasRole = false;
    let roles = Xrm.Utility.getGlobalContext().userSettings.roles;
    roles.forEach(function (role) {
        if (role.name === roleName) {
            hasRole = true;
        }
    });
    return hasRole;
}
```

### Async via Web API (when you need more role detail)

```javascript
function checkUserRoles(validRoleNames) {
    let userId = Xrm.Utility.getGlobalContext()
        .userSettings.userId.replace("{", "")
        .replace("}", "");
    let clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();

    return fetch(
        clientUrl +
            "/api/data/v9.2/systemusers(" +
            userId +
            ")?" +
            "$select=systemuserid&$expand=systemuserroles_association($select=roleid,name)",
    )
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {
            let userRoles = data["systemuserroles_association"];
            if (Array.isArray(userRoles)) {
                return userRoles.some(function (r) {
                    return validRoleNames.includes(r.name);
                });
            }
            return false;
        });
}
```

### Async via FetchXML (alternative)

```javascript
async function checkUserHasRole(roleName) {
    let userId = Xrm.Utility.getGlobalContext()
        .userSettings.userId.replace("{", "").replace("}", "");

    let fetchXml = `<fetch version="1.0" output-format="xml-platform" mapping="logical" distinct="true">
        <entity name="role">
            <attribute name="name" />
            <link-entity name="systemuserroles" from="roleid" to="roleid" intersect="true">
                <filter type="and">
                    <condition attribute="systemuserid" operator="eq" value="${userId}" />
                </filter>
            </link-entity>
        </entity>
    </fetch>`;

    let result = await Xrm.WebApi.retrieveMultipleRecords(
        "role",
        "?fetchXml=" + encodeURIComponent(fetchXml)
    );
    return result.entities.some(function (r) { return r.name === roleName; });
}
```

---

## Ribbon Button Patterns

### Enable Rules (must return a Promise)

Enable rules MUST return a `Promise<boolean>`. Unified Interface resolves the promise to determine button visibility. For async checks (role checks, data queries), wrap everything in the promise:

```javascript
var ContosoOrderSdk = window.ContosoOrderSdk || {};
(function () {
    this.enableRuleForButton = function (primaryControl) {
        let formContext = primaryControl;
        return new Promise(function (resolve) {
            let accountRef = formContext.getAttribute("customerid").getValue();
            if (!accountRef || accountRef.length === 0) {
                resolve(false);
                return;
            }
            Xrm.WebApi.retrieveRecord("account", accountRef[0].id, "?$select=creditonhold")
                .then(function (result) {
                    resolve(!result.creditonhold);
                })
                .catch(function () {
                    resolve(false);
                });
        });
    };
}).call(ContosoOrderSdk);
```

> **Ribbon Workbench note:** If the enable rule function must be referenced by name in Ribbon Workbench XML, it must be a **global function** placed outside any IIFE namespace. See the "Global Functions" note under JavaScript Code Organization.

### Ribbon Click Handlers (opening dialogs)

Ribbon commands that open dialogs use the revealing module pattern:

```javascript
var Contoso = Contoso || {};

Contoso.EntityRibbon = (function () {
    function onButtonClick(formContext) {
        let recordId = formContext.data.entity.getId().slice(1, -1);
        Xrm.Navigation.navigateTo(
            {
                pageType: "webresource",
                webresourceName: "{prefix}_/DialogName/index.html",
                data: "recordId=" + recordId,
            },
            { target: 2, position: 1, width: { value: 50, unit: "%" }, height: { value: 40, unit: "%" } }
        ).then(function () {
            // Post-dialog: refresh subgrid/form
            formContext.ui.controls.get("subgridname").refresh();
        }).catch(function (e) {
            Xrm.Navigation.openErrorDialog(e);
        });
    }
    return { OnButtonClick: onButtonClick };
})();
```

### Button Click Handlers (async operations)

```javascript
this.onButtonClick = async function (formContext) {
    Xrm.Utility.showProgressIndicator("Processing...");
    try {
        // perform operations...
    } catch (error) {
        let notification = {
            type: 2,
            level: 2, // 1=success, 2=error, 3=warning
            message: "An error occurred. Please contact your administrator.",
        };
        await Xrm.App.addGlobalNotification(notification);
    } finally {
        Xrm.Utility.closeProgressIndicator();
    }
};
```

---

## Navigation and Dialogs

### Open a Form

```javascript
let entityFormOptions = {
    entityName: "entityname",
    entityId: recordId, // optional, omit for create
    openInNewWindow: false,
};
let parameters = {}; // optional pre-populated field values

Xrm.Navigation.openForm(entityFormOptions, parameters)
    .then(function (success) {
        /* handle */
    })
    .catch(function (error) {
        console.error(error);
    });
```

### Open a Form with Pre-populated Fields and BPF

```javascript
let entityFormOptions = {
    entityName: "quote",
    formId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    processId: bpfProcessId,
    openInNewWindow: false,
};
let formParameters = {
    name: "Pre-filled Name",
    "customerid": accountId,
    "customeridname": accountName,
    "customeridtype": "account",
};

Xrm.Navigation.openForm(entityFormOptions, formParameters);
```

### Confirm Dialog

```javascript
let confirmStrings = {
    text: "Are you sure you want to proceed?",
    title: "Confirmation",
};
let confirmOptions = { height: 200, width: 450 };

Xrm.Navigation.openConfirmDialog(confirmStrings, confirmOptions).then(
    function (success) {
        if (success.confirmed) {
            // user clicked OK
        } else {
            // user clicked Cancel — return early, do nothing
        }
    },
);
```

### Alert Dialog

```javascript
Xrm.Navigation.openAlertDialog(
    { text: "Operation completed successfully." },
    { height: 120, width: 260 }
);
```

### Error Dialog

Use for displaying detailed error information to the user:

```javascript
let errorOptions = {
    message: "An error occurred while processing.",
    details: "Error details:\n" + error.message,
};
Xrm.Navigation.openErrorDialog(errorOptions);
```

### Open Web Resource as Modal Dialog

```javascript
Xrm.Navigation.navigateTo(
    {
        pageType: "webresource",
        webresourceName: "{prefix}_dialog_form_name",
        data: "param1=value1&param2=value2",
    },
    {
        target: 2, // 2 = dialog
        position: 1, // 1 = center
        width: { value: 50, unit: "%" },
        height: { value: 40, unit: "%" },
    },
);
```

### Global Notifications (Toast)

```javascript
// Success notification
let notification = {
    type: 2,
    level: 1, // 1=success, 2=error, 3=warning, 4=info
    message: "Operation completed successfully!",
    action: {
        actionLabel: "View Record",
        eventHandler: function () {
            Xrm.Navigation.openForm({
                entityName: "entityname",
                entityId: recordId,
            });
        },
    },
};
Xrm.App.addGlobalNotification(notification).then(function (notificationId) {
    // Auto-clear after delay if desired
    setTimeout(function () {
        Xrm.App.clearGlobalNotification(notificationId);
    }, 5000);
});
```

### Progress Indicators

```javascript
Xrm.Utility.showProgressIndicator("Loading data...");
// ... async work ...
Xrm.Utility.closeProgressIndicator();
```

---

## Record Cloning Pattern

When cloning a record, iterate all attributes and map them to `openForm` parameters:

```javascript
function cloneRecord(formContext) {
    let parameters = {};
    let entityFormOptions = {
        entityName: formContext.data.entity.getEntityName(),
    };

    formContext.data.entity.attributes.forEach(function (attribute) {
        let key = attribute.getName();
        let value = attribute.getValue();
        let type = attribute.getAttributeType();

        if (value === null) return;

        switch (type) {
            case "boolean":
            case "decimal":
            case "double":
            case "integer":
            case "memo":
            case "money":
            case "optionset":
            case "string":
                parameters[key] = value;
                break;
            case "datetime":
                let d = new Date(value);
                parameters[key] =
                    d.getMonth() +
                    1 +
                    "/" +
                    d.getDate() +
                    "/" +
                    d.getFullYear();
                break;
            case "lookup":
                if (value.length > 0) {
                    parameters[key] = value[0].id;
                    parameters[key + "name"] = value[0].name;
                    parameters[key + "type"] = value[0].entityType;
                }
                break;
            case "multiselectoptionset":
                parameters[key] = "[" + value + "]";
                break;
        }
    });

    Xrm.Navigation.openForm(entityFormOptions, parameters)
        .then(function (success) {
            console.log(success);
        })
        .catch(function (error) {
            console.error(error);
        });
}
```

---

## Business Process Flow (BPF) Patterns

### Look Up a BPF by Name

Query the `workflow` entity to find a BPF process ID by name. Filter by `type eq 1` (BPF) and `statecode eq 1` (active):

```javascript
async function getBpfIdByName(bpfName) {
    let result = await Xrm.WebApi.retrieveMultipleRecords(
        "workflow",
        "?$select=workflowid&$filter=name eq '" + bpfName + "' and type eq 1 and statecode eq 1"
    );
    if (result.entities && result.entities.length > 0) {
        return result.entities[0].workflowid;
    }
    return null;
}
```

### Activate a BPF on a Record

```javascript
async function setBpfByName(formContext, bpfName) {
    let processId = await getBpfIdByName(bpfName);
    if (processId) {
        formContext.data.process.setActiveProcess(processId, function (status) {
            if (status !== "success") {
                console.warn("Failed to set BPF: " + bpfName);
            }
        });
    }
}
```

### Conditional BPF / Form Selection Based on Record Data

Use option set values or other field data to drive which BPF or form to activate:

```javascript
this.onLoad = async function (executionContext) {
    let formContext = executionContext.getFormContext();
    let recordType = formContext.getAttribute("your_recordtypefield").getValue();

    if (recordType === YOUR_TYPE_A_VALUE) {
        await setBpfByName(formContext, "Type A Process");
    } else if (recordType === YOUR_TYPE_B_VALUE) {
        // Navigate to a different form
        let items = formContext.ui.formSelector.items.get();
        for (let i = 0; i < items.length; i++) {
            if (items[i].getLabel() === "Type B Form") {
                items[i].navigate();
                break;
            }
        }
    }
};
```


---

## Field Visibility / Requirement Helpers

Reusable helper functions for controlling field state. Keep these as private functions inside the IIFE:

```javascript
function showField(formContext, fieldName) {
    let control = formContext.getControl(fieldName);
    if (control) control.setVisible(true);
}

function hideField(formContext, fieldName) {
    let control = formContext.getControl(fieldName);
    if (control) control.setVisible(false);
}

function hideAndClearField(formContext, fieldName) {
    let control = formContext.getControl(fieldName);
    if (control) control.setVisible(false);
    let attr = formContext.getAttribute(fieldName);
    if (attr) attr.setValue(null);
}

function setRequired(formContext, fieldName, level) {
    let attr = formContext.getAttribute(fieldName);
    if (attr) attr.setRequiredLevel(level); // "required", "recommended", "none"
}
```

Use optional chaining (`?.`) as an alternative guard in newer code:

```javascript
formContext.getAttribute("fieldname")?.setValue(null);
formContext.getControl("fieldname")?.setVisible(false);
```

---

## Option Set Value Mapping

When you need to map option set numeric values to human-readable descriptions or business constants:

```javascript
// Define mappings as constants near the top of the IIFE
const STATUS_MAP = {
    100000000: "Draft",
    100000001: "Submitted",
    100000002: "Approved",
    100000003: "Rejected",
};

function getStatusDescription(value) {
    return STATUS_MAP[value] || "";
}

// Or as a switch for more complex logic
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

## HTML Web Resource Patterns

### Dialog HTML Structure

HTML dialogs can be organized as **folders** (`{prefix}_/DialogName/index.html`) or **flat files** (`{prefix}_dialog_name_form.html`). Both patterns are common.

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Dialog Title</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <!-- Inline CSS with utility classes for Dynamics 365 styling -->
        <style>
            body { font-family: SegoeUI, "Segoe UI", sans-serif; }
            /* Add utility classes as needed (flex, spacing, colors, etc.) */
        </style>
        <!-- For flat-file dialogs, reference companion JS by web resource name (no .js extension) -->
        <script src="{prefix}_dialog_companion_script" type="text/javascript"></script>
        <!-- For folder dialogs, embed JS in a <script> block within the HTML -->
    </head>
    <body>
        <form id="dialog-form">
            <input type="hidden" id="record-id" />
            <!-- Visible fields -->
            <div style="display: flex; justify-content: flex-end; padding: 16px;">
                <button type="submit">Save</button>
                <button type="button" id="cancel-btn">Cancel</button>
            </div>
        </form>
    </body>
</html>
```

### CSS Styling for Dialogs

Use `font-family: SegoeUI, "Segoe UI"` to match Dynamics 365 styling. You can build a utility class system similar to Tailwind for consistency across dialogs:

| Category     | Example Classes                                                                            |
| ------------ | ------------------------------------------------------------------------------------------ |
| **Layout**   | `.flex`, `.flex-row`, `.justify-start`, `.justify-center`, `.justify-end`, `.items-center` |
| **Sizing**   | `.w-1/4`, `.w-1/2`, `.w-full`, `.h-33`                                                    |
| **Spacing**  | `.p-1`, `.p-2`, `.p-4`, `.mt-4`, `.ml-4`, `.my-4`                                         |
| **Colors**   | `.bg-blue-500`, `.bg-gray-300`, `.text-white`, `.text-gray-800`                            |
| **Hover**    | `.hover:bg-gray-400`, `.hover:bg-blue-600`                                                 |
| **Font**     | `.font-segoe`, `.font-medium`, `.font-small`                                               |
| **State**    | `.hidden`, `.cursor-pointer`, `.required` (adds red asterisk via `::after`)                |

### Parsing Data Parameters in Dialog JS

Data is passed to HTML web resources via the `data` query parameter. Parse it with `getDataParam()` on `document.onreadystatechange`:

```javascript
document.onreadystatechange = function () {
    if (document.readyState === "complete") {
        let data = getDataParam();
        document.getElementById("record-id").value = data["recordId"];

        let form = document.getElementById("dialog-form");
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            sendData();
        });

        document.getElementById("cancel-btn").addEventListener("click", function () {
            self.close();
        });
    }
};

function getDataParam() {
    let vals = [];
    if (location.search !== "") {
        vals = location.search.substr(1).split("&");
        for (let i in vals) {
            vals[i] = vals[i].replace(/\+/g, " ").split("=");
        }
        for (let i in vals) {
            if (vals[i][0].toLowerCase() === "data") {
                return parseDataValue(vals[i][1]);
            }
        }
    }
    return {};
}

function parseDataValue(datavalue) {
    if (datavalue !== "") {
        let decoded = decodeURIComponent(datavalue).split("&");
        let result = {};
        for (let i in decoded) {
            let pair = decoded[i].replace(/\+/g, " ").split("=");
            result[pair[0]] = pair[1];
        }
        return result;
    }
    return {};
}
```

### Closing the Dialog

```javascript
// From inside the HTML dialog, close it
self.close();
```

### Interacting with Parent Form from HTML Web Resource

```javascript
// Read from parent form (iframe context)
let value = window.parent.Xrm.Page.getAttribute("fieldname").getValue();

// Write to parent form
window.parent.Xrm.Page.getAttribute("fieldname").setValue(newValue);

// Access global context
let globalContext = window.parent.Xrm.Utility.getGlobalContext();
let clientUrl = globalContext.getClientUrl();
let userId = globalContext.userSettings.userId;

// Show progress indicator via parent
window.parent.Xrm.Utility.showProgressIndicator("Processing...");
window.parent.Xrm.Utility.closeProgressIndicator();

// Set form notification via parent
window.parent.Xrm.Page.ui.setFormNotification(
    "Message",
    "WARNING",
    "notification_id",
);
window.parent.Xrm.Page.ui.clearFormNotification("notification_id");

// Reload parent page after save
window.parent.location.reload();
```

> **Note:** `window.parent.Xrm.Page` is the only supported way to access the parent form from an HTML web resource. This is the one exception to the "never use Xrm.Page" rule.

---

## Error Handling Patterns

### 1. Form notifications (for user-facing validation/process errors)

```javascript
formContext.ui.setFormNotification(
    "An error occurred while processing. Please contact your administrator.",
    "ERROR",
    "error_message_id",
);
```

### 2. Global notifications (for ribbon/action errors)

```javascript
let notification = {
    type: 2,
    level: 2, // error
    message: "An error occurred. Please contact your administrator.",
};
Xrm.App.addGlobalNotification(notification);
```

### 3. Error Dialog (for displaying detailed error info)

```javascript
Xrm.Navigation.openErrorDialog({
    message: "An error occurred while processing.",
    details: "Error details:\n" + error.message,
});
```

### 4. Progress Indicator with guaranteed cleanup (try/catch/finally)

Always wrap progress-indicator operations in try/catch/finally to ensure the indicator is closed:

```javascript
async function performAction(formContext) {
    Xrm.Utility.showProgressIndicator("Processing...");
    try {
        await Xrm.WebApi.updateRecord("entity", id, data);
        formContext.data.refresh(true);
    } catch (error) {
        Xrm.Navigation.openErrorDialog({ message: error.message });
    } finally {
        Xrm.Utility.closeProgressIndicator();
    }
}
```

### 5. Start/End Process Helpers (for complex multi-step operations)

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

### 6. fetch() response status checking

When using `fetch()` instead of `Xrm.WebApi`, always check the response status:

```javascript
fetch(url, options)
    .then(function (response) {
        if (!response.ok) {
            return response.json().then(function (errorBody) {
                throw new Error(errorBody.error ? errorBody.error.message : "Request failed");
            });
        }
        // 204 No Content (PATCH success) has no body
        if (response.status === 204) return null;
        return response.json();
    })
    .then(function (data) {
        // process data...
    })
    .catch(function (error) {
        console.error(error);
    });
```

---

## GUID Handling

Always strip curly braces from GUIDs when using them in API calls or comparisons:

```javascript
// Method 1: .replace() (explicit)
let cleanId = someId.replace("{", "").replace("}", "");

// Method 2: .slice() (concise)
let cleanId = someId.slice(1, -1);
```

Either method is acceptable. Be consistent within a single file.

---

## Global Context Utilities

```javascript
// Get the CRM environment base URL
let clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();

// Get current user ID
let userId = Xrm.Utility.getGlobalContext()
    .userSettings.userId.replace("{", "")
    .replace("}", "");

// Get current user roles (synchronous)
let roles = Xrm.Utility.getGlobalContext().userSettings.roles;

// Get current user name
let userName = Xrm.Utility.getGlobalContext().userSettings.userName;

// Get organization settings
let orgSettings = Xrm.Utility.getGlobalContext().organizationSettings;
let orgId = orgSettings.organizationId;
let baseCurrencyId = orgSettings.baseCurrencyId;
```

---

## Microsoft Best Practices (MUST FOLLOW)

### Critical Rules

1. **NEVER use `Xrm.Page` directly** — it is deprecated. Always use `executionContext.getFormContext()` to get the `formContext` object. Exception: HTML web resources that must access the parent form still use `window.parent.Xrm.Page` as there is no alternative.

2. **NEVER use synchronous XMLHttpRequest** — all HTTP interactions MUST be asynchronous. Use `fetch()`, `Xrm.WebApi` methods, or `XMLHttpRequest` with `async=true`.

3. **NEVER use `window.top`** — it causes cross-origin errors in Dynamics 365 App for Outlook, mobile clients, and embedded iframes. Use `window.parent` only when absolutely necessary (HTML web resources in iframes).

4. **NEVER use unsupported/internal APIs** — only use documented Client API methods. Do not depend on DOM structure, `Xrm.Internal`, or undocumented objects.

5. **Always interact with HTTP/HTTPS resources asynchronously** — synchronous calls freeze the browser thread.

6. **Ribbon enable rules MUST return Promises** for async operations — Unified Interface supports this natively.

7. **Use `$webresource:` directive** when referencing web resources in SiteMap or ribbon commands to create proper solution dependencies.

8. **Use relative URLs** between web resources (e.g., `../scripts/myScript.js`), not absolute URLs.

9. **Use API version v9.2** for all new `fetch()` calls to the Dynamics Web API.

10. **Always use `odata.include-annotations="*"` header** when you need lookup metadata (display names, logical names) from OData responses.

### Performance Guidelines

- Minimize the number of web API calls in `onLoad` — batch when possible.
- Use `Xrm.WebApi.retrieveMultipleRecords` with FetchXML for complex queries rather than multiple simple queries.
- Use progress indicators (`Xrm.Utility.showProgressIndicator`) for any operation that may take more than 1 second.
- Avoid jQuery in web resources — use native DOM APIs and `fetch()`.

### Code Quality

- Always document public functions with JSDoc-style comments.
- Use section dividers to separate Event Handlers from Helper Methods.
- Use meaningful notification IDs (e.g., `"priceListNotFoundWarning"`) not random strings.
- Guard against null values before calling `.getValue()`, `.setText()`, etc.
- Use `try/catch` with `finally` for operations that show progress indicators to ensure the indicator is always closed.

---

## Common Utility Patterns


## Record State & Security Conditional Patterns

### Zero-to-Null Conversion

Convert zero values to null before save to avoid storing "empty" numeric values:

```javascript
function clearZeroValues(formContext, fieldNames) {
    fieldNames.forEach(function (fieldName) {
        let attr = formContext.getAttribute(fieldName);
        if (attr && attr.getValue() === 0) {
            attr.setValue(null);
        }
    });
}
```

---

## SVG Icon Guidelines

SVG icons for ribbon buttons should:

- Use a standard viewBox (e.g., `0 0 24 24` for small icons, `0 0 512 512` for larger)
- Use simple, clean paths
- Avoid embedded raster images
- Use the project's publisher prefix in the web resource name
- Be named descriptively: `{prefix}_{action}_icon.svg`

---

## Multi-Step Async Orchestration

### Pattern: Confirmation → Progress → Action → Refresh

Many ribbon operations follow this sequence. Always guard the indicator with try/finally:

```javascript
this.onRibbonAction = async function (formContext) {
    let confirm = await Xrm.Navigation.openConfirmDialog({
        text: "Are you sure you want to proceed?",
        title: "Confirm Action",
    });
    if (!confirm.confirmed) return;

    Xrm.Utility.showProgressIndicator("Processing...");
    try {
        let recordId = formContext.data.entity.getId().slice(1, -1);
        let clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();

        await fetch(
            clientUrl + "/api/data/v9.2/entitynames(" + recordId + ")/Microsoft.Dynamics.CRM.your_ActionName",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ /* parameters */ }),
            }
        );

        await formContext.data.refresh(true);

        let notifId = await Xrm.App.addGlobalNotification({
            type: 2,
            level: 1, // success
            message: "Action completed successfully.",
        });
        setTimeout(function () { Xrm.App.clearGlobalNotification(notifId); }, 5000);
    } catch (error) {
        Xrm.Navigation.openErrorDialog({ message: error.message });
    } finally {
        Xrm.Utility.closeProgressIndicator();
    }
};
```

### Pattern: Sequential Record Updates in a Loop

When updating multiple records, use `await` in a for-loop (not `forEach`) to maintain sequential order:

```javascript
async function updateRecords(entityName, recordIds, data) {
    for (let i = 0; i < recordIds.length; i++) {
        await Xrm.WebApi.updateRecord(entityName, recordIds[i], data);
    }
}
```

---

## Things to AVOID

1. **DO NOT** use `Xrm.Page` — use `formContext` from execution context
2. **DO NOT** use synchronous `XMLHttpRequest`
3. **DO NOT** use `window.top` — use `window.parent` only in HTML web resources when necessary
4. **DO NOT** use jQuery for new code — use native APIs
5. **DO NOT** hardcode API keys or secrets in HTML web resources
6. **DO NOT** use `alert()` for error messages — use form notifications, global notifications, or `Xrm.Navigation.openAlertDialog()`
7. **DO NOT** leave `debugger;` statements in production code — always remove before deploying
8. **DO NOT** use `var` for new code — prefer `let` and `const`
9. **DO NOT** duplicate utility functions across files — extract shared utilities into dedicated web resource files
10. **DO NOT** use OData v2.0 endpoints — always use the Web API OData v4.0 endpoint
11. **DO NOT** use `setTimeout()` as a workaround for timing issues with control state — prefer event-driven approaches (e.g., `addOnLoad`, `addOnSave`) when possible
12. **DO NOT** mix `Xrm.Page` and `formContext` in the same file — refactor legacy usages when touching the file
13. **DO NOT** use `Xrm.Utility.alertDialog()` (deprecated) — use `Xrm.Navigation.openAlertDialog()` instead
14. **DO NOT** use `.forEach()` with `await` inside — use a `for` loop for sequential async operations
15. **DO NOT** forget to encode FetchXML when passing to `retrieveMultipleRecords()` — always use `encodeURIComponent()`
