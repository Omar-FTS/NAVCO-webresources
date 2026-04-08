#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "httpx",
#   "python-dotenv",
# ]
# ///
"""
D365 Web Resource Deploy Script
Deploys a file or all supported files in a folder to D365 on demand.

Usage:
  uv run deploy.py <path>
  uv run deploy.py --list [filter]

Examples:
  uv run deploy.py ./dc_quote_product_main_operations.js
  uv run deploy.py ./dc_
  uv run deploy.py --list dc_quote
"""

import base64
import os
import sys
import time
from pathlib import Path

# Ensure UTF-8 output on Windows (emoji support)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

import httpx
from dotenv import load_dotenv

# ── Load .env from project root (two levels up from this script) ──────────────
SCRIPT_DIR   = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent  # skills/deploying-d365-webresources → .claude → project root
ENV_FILE     = PROJECT_ROOT / ".env"

if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    load_dotenv()  # fallback: search from cwd

# ── Config ────────────────────────────────────────────────────────────────────
D365_URL               = os.getenv("D365_URL", "").rstrip("/")
CLIENT_ID              = os.getenv("CLIENT_ID", "")
CLIENT_SECRET          = os.getenv("CLIENT_SECRET", "")
TENANT_ID              = os.getenv("TENANT_ID", "")
SOLUTION_UNIQUE_NAME   = os.getenv("SOLUTION_UNIQUE_NAME", "")
SOLUTION_DISPLAY_NAME  = os.getenv("SOLUTION_DISPLAY_NAME", "")
SOLUTION_PUBLISHER_PREFIX = os.getenv("SOLUTION_PUBLISHER_PREFIX", "")

REQUIRED = {"D365_URL": D365_URL, "CLIENT_ID": CLIENT_ID,
            "CLIENT_SECRET": CLIENT_SECRET, "TENANT_ID": TENANT_ID}
missing = [k for k, v in REQUIRED.items() if not v]
if missing:
    print(f"❌ Missing required .env variables: {', '.join(missing)}")
    sys.exit(1)

TYPE_MAP = {
    ".html": 1, ".htm": 1,
    ".css":  2,
    ".js":   3,
    ".xml":  4,
    ".png":  5, ".jpg": 6, ".gif": 7,
    ".xap":  8, ".xsl": 9, ".ico": 10,
    ".svg":  11, ".resx": 12,
}

ODATA_HEADERS = {
    "OData-MaxVersion": "4.0",
    "OData-Version":    "4.0",
}

# PublishXml can take 30-60 seconds on larger orgs
TIMEOUT = httpx.Timeout(10.0, read=120.0)

# ── Auth ──────────────────────────────────────────────────────────────────────
_token_cache: dict = {}

def get_token() -> str:
    if _token_cache.get("expires_at", 0) > time.time():
        return _token_cache["token"]

    resp = httpx.post(
        f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
        data={
            "grant_type":    "client_credentials",
            "client_id":     CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "scope":         f"{D365_URL}/.default",
        },
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    _token_cache["token"]      = data["access_token"]
    _token_cache["expires_at"] = time.time() + data["expires_in"] - 60
    return _token_cache["token"]

# ── D365 API helpers ──────────────────────────────────────────────────────────
def auth_headers(extra: dict = {}) -> dict:
    return {"Authorization": f"Bearer {get_token()}", **ODATA_HEADERS, **extra}

def api_get(path: str) -> dict:
    resp = httpx.get(
        f"{D365_URL}/api/data/v9.2/{path}",
        headers=auth_headers({"Accept": "application/json"}),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()

def api_patch(path: str, body: dict) -> None:
    resp = httpx.patch(
        f"{D365_URL}/api/data/v9.2/{path}",
        json=body,
        headers=auth_headers({"Content-Type": "application/json", "If-Match": "*"}),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()

def api_post(path: str, body: dict) -> httpx.Response:
    resp = httpx.post(
        f"{D365_URL}/api/data/v9.2/{path}",
        json=body,
        headers=auth_headers({"Content-Type": "application/json"}),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp

# ── D365 error helper ─────────────────────────────────────────────────────────
def d365_error(exc: httpx.HTTPStatusError) -> str:
    try:
        err = exc.response.json().get("error", {})
        return f"{err.get('code', '?')}: {err.get('message', str(exc))}"
    except Exception:
        return str(exc)

# ── Publish ───────────────────────────────────────────────────────────────────
def publish_web_resource(wr_id: str) -> None:
    xml = f"<importexportxml><webresources><webresource>{{{wr_id}}}</webresource></webresources></importexportxml>"
    resp = httpx.post(
        f"{D365_URL}/api/data/v9.2/PublishXml",
        json={"ParameterXml": xml},
        headers=auth_headers({"Content-Type": "application/json"}),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()

# ── Solution ──────────────────────────────────────────────────────────────────
_solution_id_cache: str = ""

def get_solution_id() -> str:
    global _solution_id_cache
    if _solution_id_cache:
        return _solution_id_cache
    if not SOLUTION_UNIQUE_NAME:
        print("⚠️  No SOLUTION_UNIQUE_NAME set — skipping solution association.")
        return ""

    data = api_get(f"solutions?$filter=uniquename eq '{SOLUTION_UNIQUE_NAME}'&$select=solutionid,friendlyname")
    if data["value"]:
        _solution_id_cache = data["value"][0]["solutionid"]
        print(f"🗂️  Solution found: \"{data['value'][0]['friendlyname']}\" ({_solution_id_cache})\n")
        return _solution_id_cache

    print(f"🆕 Solution \"{SOLUTION_UNIQUE_NAME}\" not found. Creating...")
    prefix = SOLUTION_PUBLISHER_PREFIX
    pub = api_get(f"publishers?$filter=customizationprefix eq '{prefix}'&$select=publisherid,friendlyname")
    if not pub["value"]:
        print(f"❌ No publisher found with prefix \"{prefix}\". Check SOLUTION_PUBLISHER_PREFIX in .env")
        return ""

    pub_id = pub["value"][0]["publisherid"]
    print(f"📎 Using publisher: \"{pub['value'][0]['friendlyname']}\" ({pub_id})")
    resp = api_post("solutions", {
        "uniquename":   SOLUTION_UNIQUE_NAME,
        "friendlyname": SOLUTION_DISPLAY_NAME or SOLUTION_UNIQUE_NAME,
        "version":      "1.0.0.0",
        "publisherid@odata.bind": f"/publishers({pub_id})",
    })
    location = resp.headers.get("odata-entityid", "") or resp.headers.get("location", "")
    import re
    m = re.search(r"\(([^)]+)\)", location)
    if not m:
        print("❌ Solution created but could not retrieve its ID.")
        return ""
    _solution_id_cache = m.group(1)
    print(f"✅ Solution created: \"{SOLUTION_DISPLAY_NAME or SOLUTION_UNIQUE_NAME}\" ({_solution_id_cache})\n")
    return _solution_id_cache

def add_to_solution(wr_id: str) -> None:
    sol_id = get_solution_id()
    if not sol_id:
        return
    existing = api_get(
        f"solutioncomponents?$filter=objectid eq {wr_id} and componenttype eq 61 "
        f"and _solutionid_value eq {sol_id}&$select=solutioncomponentid"
    )
    if existing["value"]:
        print("🗂️  Already in solution — skipping association.")
        return
    resp = httpx.post(
        f"{D365_URL}/api/data/v9.2/AddSolutionComponent",
        json={
            "ComponentId":               wr_id,
            "ComponentType":             61,
            "SolutionUniqueName":        SOLUTION_UNIQUE_NAME,
            "AddRequiredComponents":     False,
            "DoNotIncludeSubcomponents": False,
        },
        headers=auth_headers({"Content-Type": "application/json"}),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    print(f"🗂️  Added to solution: {SOLUTION_UNIQUE_NAME}")

# ── Collect files ─────────────────────────────────────────────────────────────
def collect_files(target: Path) -> list[Path]:
    if target.is_file():
        return [target]
    return [p for p in sorted(target.rglob("*")) if p.is_file()]

# ── Deploy one file ───────────────────────────────────────────────────────────
def deploy_web_resource(file_path: Path, base_path: Path) -> None:
    ext = file_path.suffix.lower()
    type_code = TYPE_MAP.get(ext)
    if not type_code:
        print(f"⚠️  Skipping unsupported type: {ext}")
        return

    relative = file_path.relative_to(base_path).as_posix()
    wr_name  = relative
    content  = base64.b64encode(file_path.read_bytes()).decode()

    print(f"\n📦 Deploying: {wr_name}")

    existing = api_get(f"webresourceset?$filter=name eq '{wr_name}'&$select=webresourceid,name")

    if existing["value"]:
        wr_id = existing["value"][0]["webresourceid"]
        try:
            api_patch(f"webresourceset({wr_id})", {"content": content})
            print(f"✅ Updated: {wr_name}")
            add_to_solution(wr_id)
            publish_web_resource(wr_id)
            print("🚀 Published!")
        except httpx.HTTPStatusError as exc:
            print(f"❌ Update failed ({exc.response.status_code}): {d365_error(exc)}")
    else:
        print("   ℹ️  Not found — creating new web resource...")
        try:
            resp = api_post("webresourceset", {
                "name":            wr_name,
                "displayname":     file_path.name,
                "webresourcetype": type_code,
                "content":         content,
            })
            import re
            location = resp.headers.get("odata-entityid", "") or resp.headers.get("location", "")
            m = re.search(r"\(([^)]+)\)", location)
            print(f"✅ Created: {wr_name}")
            if m:
                new_id = m.group(1)
                add_to_solution(new_id)
                publish_web_resource(new_id)
                print("🚀 Published!")
        except httpx.HTTPStatusError as exc:
            print(f"❌ Create failed ({exc.response.status_code}): {d365_error(exc)}")
            if exc.response.status_code == 403:
                print("   → The Application User in D365 needs both 'System Administrator' and 'System Customizer' roles.")
                print("   → D365 → Settings → Security → Application Users → Manage Roles.")
                print("   → Wait 3–5 minutes after assigning roles before retrying.")

# ── List web resources ────────────────────────────────────────────────────────
def list_web_resources(filter_str: str = "") -> None:
    query = "webresourceset?$select=name&$orderby=name asc&$top=200"
    if filter_str:
        query += f"&$filter=contains(name,'{filter_str}')"
    label = f" matching \"{filter_str}\"" if filter_str else ""
    print(f"\n🔍 Fetching web resources from D365{label}...\n")
    data = api_get(query)
    if not data["value"]:
        print("No matching web resources found.")
        return
    for wr in data["value"]:
        print(wr["name"])
    print(f"\n{len(data['value'])} result(s).")

# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    global SOLUTION_DISPLAY_NAME, SOLUTION_UNIQUE_NAME

    args = sys.argv[1:]

    if not args:
        print("Usage: uv run deploy.py <file-or-folder> [display-name] [unique-name]")
        print("       uv run deploy.py --list [name-filter]")
        sys.exit(1)

    if args[0] == "--list":
        filter_str = args[1] if len(args) > 1 else ""
        list_web_resources(filter_str)
        return

    target = Path(args[0]).resolve()
    if not target.exists():
        print(f"❌ Path does not exist: {target}")
        sys.exit(1)

    # Optional positional args: display name, then unique name
    if len(args) >= 2:
        SOLUTION_DISPLAY_NAME = args[1]
        SOLUTION_UNIQUE_NAME = ""  # reset so it gets derived from the provided display name
    if len(args) >= 3:
        SOLUTION_UNIQUE_NAME = args[2]
    elif SOLUTION_DISPLAY_NAME and not SOLUTION_UNIQUE_NAME:
        # Derive unique name from display name: lowercase, no spaces
        SOLUTION_UNIQUE_NAME = SOLUTION_DISPLAY_NAME.replace(" ", "").lower()

    base_path = target.parent if target.is_file() else target
    files     = collect_files(target)

    print(f"📂 Deploying {len(files)} file(s) from: {target}\n")
    for f in files:
        deploy_web_resource(f, base_path)

    print("\n✅ Done.")

if __name__ == "__main__":
    main()
