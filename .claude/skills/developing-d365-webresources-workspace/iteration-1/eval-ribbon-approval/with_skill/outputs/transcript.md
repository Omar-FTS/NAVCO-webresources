# Transcript: Eval 2 with-skill — Ribbon Approval Handler

## What was done
Read the skill (SKILL.md) and the existing dc_opportunityCustomDialogs.js. The file uses the `DC.OpportunityRibbon` revealing module pattern.

Added a new `submitForApproval` async function inside the revealing module that:
1. Checks the `Sales Manager` role synchronously via `Xrm.Utility.getGlobalContext().userSettings.roles` (skill guidance: prefer synchronous role check)
2. Shows an alert if the user lacks the role
3. Opens `Xrm.Navigation.openConfirmDialog` with "Send for approval?" (skill guidance: never use browser confirm())
4. Calls the custom action `dc_SubmitOpportunityForApproval` via fetch to Web API v9.2 bound to the opportunity
5. Wraps in try/catch/finally with showProgressIndicator/closeProgressIndicator (skill guidance: always wrap progress indicator in try/finally)
6. Refreshes the form and shows a timed global notification on success
7. Exported as `SubmitForApproval` from the return object alongside existing `OpenMultipleQuoteDialog`

## Key skill guidance applied
- Synchronous role check pattern from webapi-reference.md
- `openConfirmDialog` pattern from patterns-reference.md
- Custom action via fetch pattern from webapi-reference.md
- try/catch/finally with progress indicator from SKILL.md error handling section
