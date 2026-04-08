---
name: deploying-d365-webresources
description: Deploys local JavaScript/HTML/CSS/SVG files to a Dynamics 365 or Dataverse environment on demand. Use this skill whenever the user wants to deploy, publish, upload, push, or sync web resources to D365 or Dataverse — even if they just say "push this to D365", "upload the file", or "update the web resource". The agent handles every step automatically — checking credentials, running the script, and diagnosing errors. No dependency installation required (uses uv).
---

# D365 Web Resource Deploy Skill

You are an AI agent. When this skill is invoked, handle every step yourself and narrate what you are doing. Never ask the user to run commands manually.

The deploy script uses `uv` — **no installation step is needed**. `uv` resolves Python dependencies automatically on first run. If `uv` itself is not installed, tell the user to install it from https://docs.astral.sh/uv/getting-started/installation/ and stop.

---

## Agent Workflow

### Step 1 — Parse arguments

The skill accepts up to three arguments:

```
/deploying-d365-webresources <path> [display-name] [unique-name]
```

| Argument | Required | Description |
|---|---|---|
| `<path>` | Yes | File or folder to deploy. |
| `[display-name]` | No | Solution display name, e.g. `"My Dev Solution"`. Overrides `SOLUTION_DISPLAY_NAME` in `.env`. |
| `[unique-name]` | No | Solution unique name, e.g. `"mydevsolution"`. Defaults to display name lowercased with spaces removed. |

Examples:
- `/deploying-d365-webresources ./dc_quote.js` — deploy one file, no solution association
- `/deploying-d365-webresources ./dc_` — deploy all files in the `dc_` folder
- `/deploying-d365-webresources ./dc_quote.js "My Dev Solution"` — deploy and add to solution
- `/deploying-d365-webresources ./dc_quote.js "My Dev Solution" "myCustomUniqueName"` — explicit unique name

If the user did not provide a path, ask:
> "Which file or folder do you want to deploy? For example: `./dc_quote_main_operations.js` or `./dc_` to deploy all files in the `dc_` folder."

### Step 2 — Check `.env` exists

Check whether `.env` exists in the workspace root.

If it does **not** exist:
> "I don't see a `.env` file. I'll create one from the example — please fill in your D365 credentials and let me know when ready."

Copy `.env.example` to `.env` and stop until the user confirms it's filled in.

If `.env` exists, proceed directly to Step 3. The script validates the required variables itself and will print a clear error if any are missing.

### Step 3 — Run the deploy

Tell the user: "Deploying `<path>` to D365..."

Always use `uv run` directly (not `npm run deploy`) — this ensures quoted arguments with spaces are passed correctly. Run from the workspace root so relative paths and `.env` resolution work:

```bash
cd "<workspace-root>" && uv run .claude/skills/deploying-d365-webresources/deploy.py <path>
cd "<workspace-root>" && uv run .claude/skills/deploying-d365-webresources/deploy.py <path> "display-name"
cd "<workspace-root>" && uv run .claude/skills/deploying-d365-webresources/deploy.py <path> "display-name" "unique-name"
```

The workspace root is the current working directory at the time the skill is invoked.

### Step 4 — Report the result

Read the terminal output and respond to the user:

| Output contains | What to say |
|---|---|
| `🚀 Published!` after `✅ Updated` | "Done! `<name>` was updated and published to D365." |
| `🚀 Published!` after `✅ Created` | "Done! `<name>` is a new web resource — created and published." |
| `⚠️  Skipping unsupported type` | "That file type isn't supported. Supported: `.js`, `.html`, `.css`, `.xml`, `.svg`, `.png`, `.jpg`, `.gif`, `.ico`, `.resx`." |
| `Missing required .env variables` | "Your `.env` is missing: `<variables>`. Please add them and let me know." |
| `Path does not exist` | "That path doesn't exist. Can you check the path and try again?" |
| `failed (403)` + `prvCreateWebResource` | See permissions steps below |
| `failed (401)` | "Authentication failed. Please check `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` in `.env`." |
| `ConnectError` or `TimeoutException` | "Couldn't reach D365. Please check `D365_URL` in `.env` and make sure the environment is online." |
| `✅ Done.` (end of output) | Summarize how many files were deployed successfully. |

**When you see a 403 `prvCreateWebResource` error:**
1. Say: "The D365 app user is missing the `prvCreateWebResource` privilege. Here's how to fix it:"
2. Tell the user:
   > "In D365, go to **Settings → Security → Application Users**, open the app user, click **Manage Roles**, and make sure both **System Administrator** and **System Customizer** are checked. Save, then wait 3–5 minutes for D365 to refresh its privilege cache."
3. Ask: "Let me know when that's done and I'll retry the deploy."
4. When the user confirms, run the deploy again.

---

## Solution Association

Web resources can be automatically added to a D365 solution in two ways:

**Via `.env`** (persistent — applies to all deploys):
```
SOLUTION_UNIQUE_NAME=MyDevSolution
SOLUTION_DISPLAY_NAME=My Dev Solution
SOLUTION_PUBLISHER_PREFIX=new   # only needed if solution doesn't exist yet
```

**Via CLI arguments** (one-off — overrides `.env` for this deploy):
```
/deploying-d365-webresources ./dc_quote.js "My Dev Solution"
```

If no solution is configured, the web resource is deployed and published without any solution association.

---

## Useful Commands

**List web resources in D365** (useful to check what's already deployed):
```bash
uv run .claude/skills/deploying-d365-webresources/deploy.py --list dc_quote
```

Run this proactively if the user asks "what web resources are deployed?" or wants to verify before deploying.

---

## Reference

### Prerequisites

- [`uv`](https://docs.astral.sh/uv/getting-started/installation/) must be installed on the machine (one-time, system-level install)
- A `.env` file in the project root with D365 credentials

### Required `.env` variables

```
D365_URL=https://<your-org>.crm.dynamics.com
CLIENT_ID=<Azure App Registration client ID>
CLIENT_SECRET=<Azure App Registration client secret>
TENANT_ID=<Azure tenant ID>
```

### How web resource names are built

The web resource name in D365 is the file path relative to the deploy target. For a file deploy (`./dc_quote.js`), the name is just `dc_quote.js`. For a folder deploy, the name includes any subdirectory path (e.g., `subfolder/dc_quote.js`).

### App Registration requirements

The D365 Application User needs **both**:
- **System Administrator**
- **System Customizer**

System Customizer alone is missing `prvCreateWebResource`. After assigning roles, wait 3–5 minutes for the privilege cache to refresh.
