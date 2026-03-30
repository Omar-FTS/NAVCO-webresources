# Conditional Documentation Guide

<!--
  This file is used by ADW commands (/plan, /document, /patch) to decide which
  project docs to read before starting a task. The /document command automatically
  adds entries here when it creates new documentation.

  Each entry maps a doc file to conditions — the agent reads it only when a
  condition matches the current task. This keeps context loading efficient.
-->

## Instructions
- Review the task you've been asked to perform
- Check each documentation path in the Conditional Documentation section
- For each path, evaluate if any of the listed conditions apply to your task
  - IMPORTANT: Only read the documentation if any one of the conditions match your task
- IMPORTANT: You don't want to excessively read documentation. Only read the documentation if it's relevant to your task.

## Conditional Documentation

- README.md
  - Conditions:
    - When operating on application source code
    - When first understanding the project structure

- docs/tasks/bug-quote-product-cost-override-default-7f242fa6/doc-bug-quote-product-cost-override-default-7f242fa6.md
  - Conditions:
    - When working with the Quote Product (Quote Line) form scripts
    - When implementing or modifying default field values on form load in dc_quote_product_main_operations.js
    - When troubleshooting dc_costoverride or dc_overridedescription required-level behaviour
    - When adding guarded default value logic to formOnLoad handlers

