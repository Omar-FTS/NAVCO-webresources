# WebAPI & Data Access Reference

## API Selection Guidelines

| Use case | Preferred API |
| --- | --- |
| Retrieve a single record by ID | `Xrm.WebApi.retrieveRecord` |
| Retrieve multiple records / filtered queries | `Xrm.WebApi.retrieveMultipleRecords` with FetchXML |
| Create / update / delete records | `Xrm.WebApi.createRecord` / `updateRecord` / `deleteRecord` |
| Execute bound/unbound actions | `Xrm.WebApi.execute` |
| Need OData annotations (formatted values, lookup metadata) | `fetch()` with OData headers |

> **Default to `Xrm.WebApi.*` for all data operations.** It handles authentication tokens automatically, works correctly in both online and offline contexts, and does not require `clientUrl` construction. Only fall back to native `fetch()` when you specifically need OData response annotations that `Xrm.WebApi` does not expose.

---

## Xrm.WebApi.retrieveMultipleRecords with FetchXML (preferred)

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

Xrm.WebApi.retrieveMultipleRecords("account", "?fetchXml=" + encodeURIComponent(fetchXml))
    .then(function (result) {
        if (result.entities && result.entities.length > 0) {
            let record = result.entities[0];
        }
    })
    .catch(function (error) { console.error(error.message); });
```

## Xrm.WebApi.retrieveRecord (single record)

```javascript
Xrm.WebApi.retrieveRecord("account", accountId, "?$select=name,revenue&$expand=primarycontactid($select=fullname)")
    .then(function (result) {
        let name = result.name;
        let contactName = result.primarycontactid?.fullname ?? null;
    });
```

## Xrm.WebApi.updateRecord

```javascript
let data = {
    fieldname: "new value",
    "lookupfield@odata.bind": "/relatedentities(guid-here)",
};
Xrm.WebApi.updateRecord("entityname", recordId, data).catch(function (error) { console.error(error.message); });
```

## Xrm.WebApi.createRecord

```javascript
let data = {
    name: "New Record",
    fieldname: 100,
    "lookupfield@odata.bind": "/relatedentities(guid-here)",
};
Xrm.WebApi.createRecord("entityname", data).then(function (result) { let newId = result.id; });
```

## Xrm.WebApi.deleteRecord

```javascript
Xrm.WebApi.deleteRecord("entityname", recordId);
```

## Xrm.WebApi.execute (bound/unbound actions)

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
    .then(function (response) { return response.json(); })
    .then(function (result) { /* process */ });
```

---

## Native fetch() with OData

**Only use when you need OData response annotations** (e.g., formatted values, lookup logical names). For simple reads/writes, prefer `Xrm.WebApi.*` above. Do NOT use `fetch()` just to retrieve a single record by ID — use `Xrm.WebApi.retrieveRecord` instead.

```javascript
let clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();

fetch(
    clientUrl + "/api/data/v9.2/accounts?$select=name,revenue&$filter=name eq '" + encodeURIComponent(searchName) + "'",
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
.then(function (response) { return response.json(); })
.then(function (data) {
    // OData annotation examples:
    // data["_lookupfield_value@Microsoft.Dynamics.CRM.lookuplogicalname"]
    // data["_lookupfield_value@OData.Community.Display.V1.FormattedValue"]
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
    if (!response.ok) return response.json();
    return response; // 204 No Content on success
})
.then(function (response) {
    if (response?.error) throw Error(response.error.message);
})
.catch(function (error) { console.error(error); });
```

### Custom Action via fetch (bound to entity)

```javascript
let actionPath = "accounts(" + recordId + ")/Microsoft.Dynamics.CRM.your_CustomActionName";
let serverUrl = Xrm.Utility.getGlobalContext().getClientUrl();

fetch(serverUrl + "/api/data/v9.2/" + actionPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ /* action parameters */ }),
})
.then(function (response) { return response.json(); })
.then(function (result) { /* process */ });
```

### fetch() response status checking

Always check `response.ok` when using `fetch()`:

```javascript
fetch(url, options)
    .then(function (response) {
        if (!response.ok) {
            return response.json().then(function (errorBody) {
                throw new Error(errorBody.error ? errorBody.error.message : "Request failed");
            });
        }
        if (response.status === 204) return null; // PATCH success, no body
        return response.json();
    })
    .then(function (data) { /* process */ })
    .catch(function (error) { console.error(error); });
```

---

## Security Role Checks

### Synchronous (preferred)

```javascript
function hasSecurityRole(roleName) {
    let hasRole = false;
    Xrm.Utility.getGlobalContext().userSettings.roles.forEach(function (role) {
        if (role.name === roleName) hasRole = true;
    });
    return hasRole;
}
```

### Async via Web API

```javascript
function checkUserRoles(validRoleNames) {
    let userId = Xrm.Utility.getGlobalContext().userSettings.userId.replace("{", "").replace("}", "");
    let clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();

    return fetch(
        clientUrl + "/api/data/v9.2/systemusers(" + userId + ")?$select=systemuserid&$expand=systemuserroles_association($select=roleid,name)"
    )
    .then(function (response) { return response.json(); })
    .then(function (data) {
        let userRoles = data["systemuserroles_association"];
        return Array.isArray(userRoles) && userRoles.some(r => validRoleNames.includes(r.name));
    });
}
```

### Async via FetchXML

```javascript
async function checkUserHasRole(roleName) {
    let userId = Xrm.Utility.getGlobalContext().userSettings.userId.replace("{", "").replace("}", "");
    let fetchXml = `<fetch>
        <entity name="role">
            <attribute name="name" />
            <link-entity name="systemuserroles" from="roleid" to="roleid" intersect="true">
                <filter><condition attribute="systemuserid" operator="eq" value="${userId}" /></filter>
            </link-entity>
        </entity>
    </fetch>`;
    let result = await Xrm.WebApi.retrieveMultipleRecords("role", "?fetchXml=" + encodeURIComponent(fetchXml));
    return result.entities.some(r => r.name === roleName);
}
```
