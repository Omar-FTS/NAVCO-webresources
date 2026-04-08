# Skill Evaluation: List Web Resources Named dc_quote

## User Prompt
> "what web resources named dc_quote are already in D365?"

---

## Agent Transcript

### Step 1 — Recognize intent

The user is asking what web resources named `dc_quote` already exist in D365. This is a **list/query** request, not a deploy request. The skill's "Useful Commands" section explicitly covers this case:

> Run this proactively if the user asks "what web resources are deployed?" or wants to verify before deploying.

### Step 2 — Check .env

The `.env` file exists in the workspace root (confirmed by task context). Proceed.

### Step 3 — Run the list command

I would tell the user:

> "I'll query D365 now for web resources matching `dc_quote`..."

Then run:

```bash
cd "C:/Users/Omar Taladeh/Desktop/web-resources/NAVCO" && uv run .claude/skills/deploying-d365-webresources/deploy.py --list dc_quote
```

### Step 4 — Report the result

After the command runs, I would read the terminal output and relay the list of matching web resources to the user. For example, if the output showed:

```
dc_quote.js
dc_quote_main_operations.js
dc_quote_ribbon.js
```

I would say:

> "Here are the web resources in D365 whose name contains `dc_quote`:
> - `dc_quote.js`
> - `dc_quote_main_operations.js`
> - `dc_quote_ribbon.js`
>
> Let me know if you'd like to deploy or update any of them."

If no results were returned, I would say:

> "No web resources matching `dc_quote` were found in D365. If you'd like to deploy one, just tell me which file to use."

---

## Key Observations

- The skill has a dedicated `--list <filter>` flag exactly for this use case.
- The agent does NOT need to deploy anything — the right action is a read-only query.
- The `.env` file already exists, so no setup step is needed.
- The command is run from the workspace root so `.env` is resolved correctly.
- The skill instruction says to run this command **proactively** when the user asks what is deployed.
