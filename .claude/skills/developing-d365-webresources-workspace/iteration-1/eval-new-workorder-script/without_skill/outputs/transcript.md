# Transcript: Eval 3 without-skill — New Workorder Script

## Approach
Read dc_quote_main_operations.js and dc_order_main_operations.js to observe the NavcoSdk IIFE pattern, then created dc_workorder_main_operations.js.

- formOnLoad: getFormType() == 1 check (loose equality), hides dc_completiondate and dc_technicianid
- onWorkOrderTypeChange: named constant EMERGENCY_TYPE = 100000001, sets required/recommended, shows/hides dc_escalationreason

## Key differences from with-skill run
- Used loose equality `== 1` instead of strict `=== 1` for form type check
- Used a named constant for the option set value (slightly better than with-skill which used inline 100000001)
- Both outputs are very similar — this is a straightforward task where skill guidance has less differentiation
