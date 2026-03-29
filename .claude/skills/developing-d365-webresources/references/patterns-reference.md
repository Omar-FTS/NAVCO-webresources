# Patterns Reference — Ribbon, Dialogs, HTML, BPF, Record Cloning

## Ribbon Button Patterns

### Enable Rules (must return a Promise)

Enable rules MUST return `Promise<boolean>`. For async checks (role checks, data queries), wrap in the promise:

```javascript
var ContosoOrderSdk = window.ContosoOrderSdk || {};
(function () {
    this.enableRuleForButton = function (primaryControl) {
        let formContext = primaryControl;
        return new Promise(function (resolve) {
            let accountRef = formContext.getAttribute("customerid").getValue();
            if (!accountRef || accountRef.length === 0) { resolve(false); return; }
            Xrm.WebApi.retrieveRecord("account", accountRef[0].id, "?$select=creditonhold")
                .then(function (result) { resolve(!result.creditonhold); })
                .catch(function () { resolve(false); });
        });
    };
}).call(ContosoOrderSdk);
```

> **Ribbon Workbench:** If the enable rule must be referenced by name in Ribbon Workbench XML, it MUST be a **global function** placed outside any IIFE.

### Ribbon Click Handler (opening dialogs)

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
            formContext.ui.controls.get("subgridname").refresh();
        }).catch(function (e) {
            Xrm.Navigation.openErrorDialog(e);
        });
    }
    return { OnButtonClick: onButtonClick };
})();
```

### Button Click Handler (async operation with progress)

```javascript
this.onButtonClick = async function (formContext) {
    Xrm.Utility.showProgressIndicator("Processing...");
    try {
        // perform operations...
    } catch (error) {
        await Xrm.App.addGlobalNotification({ type: 2, level: 2, message: "An error occurred. Please contact your administrator." });
    } finally {
        Xrm.Utility.closeProgressIndicator();
    }
};
```

---

## Navigation and Dialogs

### Open a Form

```javascript
Xrm.Navigation.openForm({ entityName: "entityname", entityId: recordId, openInNewWindow: false }, {});
```

### Open a Form with Pre-populated Fields and BPF

```javascript
Xrm.Navigation.openForm(
    { entityName: "quote", formId: "xxxxxxxx-...", processId: bpfProcessId, openInNewWindow: false },
    { name: "Pre-filled Name", customerid: accountId, customeridname: accountName, customeridtype: "account" }
);
```

### Confirm Dialog

```javascript
let result = await Xrm.Navigation.openConfirmDialog(
    { text: "Are you sure?", title: "Confirmation" },
    { height: 200, width: 450 }
);
if (result.confirmed) { /* proceed */ }
```

### Alert Dialog

```javascript
Xrm.Navigation.openAlertDialog({ text: "Operation completed." }, { height: 120, width: 260 });
```

### Error Dialog

```javascript
Xrm.Navigation.openErrorDialog({ message: "An error occurred.", details: "Details:\n" + error.message });
```

### Open Web Resource as Modal Dialog

```javascript
Xrm.Navigation.navigateTo(
    { pageType: "webresource", webresourceName: "{prefix}_dialog_form_name", data: "param1=value1" },
    { target: 2, position: 1, width: { value: 50, unit: "%" }, height: { value: 40, unit: "%" } }
);
```

### Progress Indicators

```javascript
Xrm.Utility.showProgressIndicator("Loading data...");
// ... async work ...
Xrm.Utility.closeProgressIndicator();
```

---

## HTML Web Resource Patterns

### Dialog HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Dialog Title</title>
    <style>
        body { font-family: SegoeUI, "Segoe UI", sans-serif; }
    </style>
    <!-- For flat-file dialogs: reference companion JS by web resource name (no .js extension) -->
    <script src="{prefix}_dialog_companion_script" type="text/javascript"></script>
</head>
<body>
    <form id="dialog-form">
        <input type="hidden" id="record-id" />
        <div style="display: flex; justify-content: flex-end; padding: 16px;">
            <button type="submit">Save</button>
            <button type="button" id="cancel-btn">Cancel</button>
        </div>
    </form>
</body>
</html>
```

### Parsing Data Parameters

```javascript
document.onreadystatechange = function () {
    if (document.readyState === "complete") {
        let data = getDataParam();
        document.getElementById("record-id").value = data["recordId"];

        document.getElementById("dialog-form").addEventListener("submit", function (e) {
            e.preventDefault();
            sendData();
        });
        document.getElementById("cancel-btn").addEventListener("click", function () { self.close(); });
    }
};

function getDataParam() {
    if (location.search === "") return {};
    let vals = location.search.substr(1).split("&").map(v => v.replace(/\+/g, " ").split("="));
    for (let i in vals) {
        if (vals[i][0].toLowerCase() === "data") return parseDataValue(vals[i][1]);
    }
    return {};
}

function parseDataValue(datavalue) {
    if (!datavalue) return {};
    return decodeURIComponent(datavalue).split("&").reduce(function (result, pair) {
        let parts = pair.replace(/\+/g, " ").split("=");
        result[parts[0]] = parts[1];
        return result;
    }, {});
}
```

### Interacting with Parent Form from HTML Web Resource

```javascript
// Access parent (the ONLY supported way from HTML web resource)
let value = window.parent.Xrm.Page.getAttribute("fieldname").getValue();
window.parent.Xrm.Page.getAttribute("fieldname").setValue(newValue);
let clientUrl = window.parent.Xrm.Utility.getGlobalContext().getClientUrl();

window.parent.Xrm.Utility.showProgressIndicator("Processing...");
window.parent.Xrm.Utility.closeProgressIndicator();

// Close dialog
self.close();
```

> `window.parent.Xrm.Page` is the one exception to the "never use Xrm.Page" rule.

---

## Business Process Flow (BPF) Patterns

### Look Up a BPF by Name

```javascript
async function getBpfIdByName(bpfName) {
    let result = await Xrm.WebApi.retrieveMultipleRecords(
        "workflow",
        "?$select=workflowid&$filter=name eq '" + bpfName + "' and type eq 1 and statecode eq 1"
    );
    return result.entities?.length > 0 ? result.entities[0].workflowid : null;
}
```

### Activate a BPF on a Record

```javascript
async function setBpfByName(formContext, bpfName) {
    let processId = await getBpfIdByName(bpfName);
    if (processId) {
        formContext.data.process.setActiveProcess(processId, function (status) {
            if (status !== "success") console.warn("Failed to set BPF: " + bpfName);
        });
    }
}
```

### Conditional BPF / Form Selection

```javascript
this.onLoad = async function (executionContext) {
    let formContext = executionContext.getFormContext();
    let recordType = formContext.getAttribute("your_recordtypefield").getValue();

    if (recordType === YOUR_TYPE_A_VALUE) {
        await setBpfByName(formContext, "Type A Process");
    } else if (recordType === YOUR_TYPE_B_VALUE) {
        let items = formContext.ui.formSelector.items.get();
        for (let i = 0; i < items.length; i++) {
            if (items[i].getLabel() === "Type B Form") { items[i].navigate(); break; }
        }
    }
};
```

---

## Record Cloning Pattern

```javascript
function cloneRecord(formContext) {
    let parameters = {};
    formContext.data.entity.attributes.forEach(function (attribute) {
        let key = attribute.getName();
        let value = attribute.getValue();
        let type = attribute.getAttributeType();
        if (value === null) return;

        switch (type) {
            case "boolean": case "decimal": case "double": case "integer":
            case "memo": case "money": case "optionset": case "string":
                parameters[key] = value; break;
            case "datetime":
                let d = new Date(value);
                parameters[key] = (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear();
                break;
            case "lookup":
                if (value.length > 0) {
                    parameters[key] = value[0].id;
                    parameters[key + "name"] = value[0].name;
                    parameters[key + "type"] = value[0].entityType;
                }
                break;
            case "multiselectoptionset":
                parameters[key] = "[" + value + "]"; break;
        }
    });

    Xrm.Navigation.openForm({ entityName: formContext.data.entity.getEntityName() }, parameters);
}
```

---

## Multi-Step Async Orchestration

### Pattern: Confirmation → Progress → Action → Refresh

```javascript
this.onRibbonAction = async function (formContext) {
    let confirm = await Xrm.Navigation.openConfirmDialog({ text: "Are you sure?", title: "Confirm Action" });
    if (!confirm.confirmed) return;

    Xrm.Utility.showProgressIndicator("Processing...");
    try {
        let recordId = formContext.data.entity.getId().slice(1, -1);
        let clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();

        await fetch(
            clientUrl + "/api/data/v9.2/entitynames(" + recordId + ")/Microsoft.Dynamics.CRM.your_ActionName",
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
        );

        await formContext.data.refresh(true);

        let notifId = await Xrm.App.addGlobalNotification({ type: 2, level: 1, message: "Action completed successfully." });
        setTimeout(function () { Xrm.App.clearGlobalNotification(notifId); }, 5000);
    } catch (error) {
        Xrm.Navigation.openErrorDialog({ message: error.message });
    } finally {
        Xrm.Utility.closeProgressIndicator();
    }
};
```

### Sequential Record Updates in a Loop

Use `await` in a `for` loop — NOT `.forEach()`:

```javascript
async function updateRecords(entityName, recordIds, data) {
    for (let i = 0; i < recordIds.length; i++) {
        await Xrm.WebApi.updateRecord(entityName, recordIds[i], data);
    }
}
```
