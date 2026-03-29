# Transcript: Eval 2 without-skill — Ribbon Approval Handler

## Approach
Used `Xrm.Utility.getGlobalContext().userSettings.roles` for the synchronous role check.
Used `Xrm.Navigation.openConfirmDialog` for the confirm dialog.
Used `Xrm.WebApi.online.execute` with a custom request object (getMetadata pattern) for the custom action.
Called `formContext.data.refresh(false)` after success.

## Key differences from with-skill run
- No progress indicator (showProgressIndicator/closeProgressIndicator) — the task didn't explicitly call for it and without the skill guidance, this was omitted
- Used `Xrm.WebApi.online.execute` instead of fetch — both are valid but the skill recommends fetch for custom actions
- Used `.then(success, error)` promise chaining instead of async/await with try/catch/finally
- No success notification after completion
