# Response: 403 Error — prvCreateWebResource

A 403 error referencing `prvCreateWebResource` is a **security privilege error** in Dynamics 365 / Dataverse. It means the user account (or application/service principal) performing the deployment does not have the necessary privilege to create web resources.

## What This Means

In D365, every operation maps to a privilege. `prvCreateWebResource` is the privilege required to create (or in some deployment flows, upsert) a Web Resource record. A 403 means the security role assigned to your account is missing this privilege.

## Steps to Fix

### 1. Identify Which Account Is Being Used
Determine whether you are deploying as:
- A **named user account** (interactive login)
- An **application user / service principal** (used in automated pipelines)

### 2. Check the Security Role

**For a named user:**
1. Go to **Power Platform Admin Center** (admin.powerplatform.microsoft.com) or the legacy **Settings > Security > Users** in D365.
2. Find the user and open their security roles.
3. Look for a role that includes **Web Resource** privileges.

**For an application user:**
1. In the environment, go to **Settings > Security > Users**, filter by **Application Users**.
2. Find the app user tied to your service principal.
3. Check its assigned security roles.

### 3. Grant the Required Privilege

The easiest fix is to assign the **System Administrator** or **System Customizer** role, both of which include `prvCreateWebResource`.

If you need a least-privilege approach:
- Open the role in the Security Role editor.
- Go to the **Customization** tab.
- Find **Web Resource** and grant at minimum **Create** and **Write** access at the **Organization** level.

### 4. Assign the Role
- For a named user: assign the role directly to the user.
- For an application user: assign the role to the application user record in D365 (not in Azure AD — it must be done inside the D365 environment).

### 5. Re-run the Deployment
After the role is updated, retry your deployment. Role changes in D365 typically take effect immediately (no cache invalidation needed for API calls).

## Common Mistakes

- **Assigning the role in Azure AD only** — Azure AD roles do not grant D365 privileges. The role must be assigned inside the D365 environment to the application user.
- **Using a role that has Web Resource privileges scoped to "User" level only** — deployment tools often create records at the org level, so the privilege scope must be **Organization**.
- **Expired or wrong client secret / certificate** — if authentication itself is failing, D365 may return a 403 rather than a 401. Double-check that your credentials are valid and the app registration has the correct API permissions (`Dynamics CRM > user_impersonation`).

## Quick Summary

| Symptom | Cause | Fix |
|---|---|---|
| 403 prvCreateWebResource | Missing Create privilege on Web Resource | Assign System Customizer or grant Web Resource > Create in the security role |
| 403 on Application User | Role not assigned inside D365 | Assign role to the app user in D365 Settings > Security > Users |
| 403 despite correct role | Privilege scope is "User" not "Organization" | Edit role, set Web Resource privileges to Organization scope |
