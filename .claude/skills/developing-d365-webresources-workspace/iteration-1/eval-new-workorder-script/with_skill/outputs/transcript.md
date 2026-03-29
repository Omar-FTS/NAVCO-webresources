# Transcript: Eval 3 with-skill — New Workorder Script

## What was done
Read SKILL.md, then read dc_quote_main_operations.js and dc_order_main_operations.js to determine conventions.

- **Publisher prefix**: `dc_`
- **Namespace**: `NavcoSdk` — shared IIFE pattern, `(function(){}).call(NavcoSdk)`
- **Language style**: `var formContext` in event handlers (matches existing files), optional chaining on `getControl()`
- **Form type check**: strict `=== 1` for Create

Created dc_workorder_main_operations.js with:
- `formOnLoad`: checks `getFormType() === 1`, hides `dc_completiondate` and `dc_technicianid` with optional chaining
- `onWorkOrderTypeChange`: reads `dc_workordertype` value, sets `dc_priority` to `required`/`recommended` and shows/hides `dc_escalationreason`

No async/WebAPI needed — purely UI-driven changes.

## Key skill guidance applied
- IIFE + NavcoSdk namespace (skill: preferred pattern for new files, discovered from project inspection)
- `getFormType() === 1` for Create check (skill: Form Type Constants table)
- Optional chaining on `getControl()` (skill: guard against null)
- File named `dc_workorder_main_operations.js` (skill: `{prefix}_{entity}_main_operations.js` convention)
