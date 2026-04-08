
How to Use It
1. Project structure:
your-project/
├── src/
│   ├── scripts/
│   │   └── myForm.js        ← your web resources here
│   └── html/
│       └── myPage.html
├── watcher.js               ← the script above
├── .env                     ← your credentials
└── package.json
2. Create your .env file:
envD365_URL=https://yourorg.crm.dynamics.com
CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CLIENT_SECRET=your-secret-here
TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SOLUTION_PREFIX=new_
3. Get your credentials (one-time setup):

Go to Azure Portal → App Registrations → New Registration
Add it as an Application User in D365 with System Admin or Customizer role
Copy the Client ID, Secret, and Tenant ID into .env

4. Install & run:
bashnpm install chokidar axios dotenv
node watcher.js
Now every time you save a file inside ./src, it will:

Find or create the web resource in D365
Upload the content
Auto-publish it — ready to test immediately ✅




/**
 * D365 Web Resource Auto-Deploy Watcher
 * Watches your local folder and deploys changed files to D365 on save.
 *
 * Setup:
 *   npm install chokidar axios dotenv
 *
 * .env file:
 *   D365_URL=https://yourorg.crm.dynamics.com
 *   CLIENT_ID=your-app-registration-client-id
 *   CLIENT_SECRET=your-client-secret
 *   TENANT_ID=your-tenant-id
 *   SOLUTION_PREFIX=new_   ← your publisher prefix
 */

require("dotenv").config();
const chokidar = require("chokidar");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const {
  D365_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  TENANT_ID,
  SOLUTION_PREFIX = "new_",
  SOLUTION_UNIQUE_NAME,        // e.g. "MyDevSolution"
  SOLUTION_DISPLAY_NAME,       // e.g. "My Dev Solution"
  SOLUTION_PUBLISHER_PREFIX,   // e.g. "new"  (must match an existing publisher)
} = process.env;

// Map file extensions to D365 web resource type codes
const TYPE_MAP = {
  ".html": 1,  ".htm": 1,
  ".css":  2,
  ".js":   3,
  ".xml":  4,
  ".png":  5,  ".jpg": 6, ".gif": 7,
  ".xap":  8,  ".xsl": 9, ".ico": 10,
  ".svg":  11, ".resx": 12,
};

// ── Auth ─────────────────────────────────────────────────────────────────────
let tokenCache = null;

async function getToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;

  const res = await axios.post(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         `${D365_URL}/.default`,
    })
  );

  tokenCache = {
    token:     res.data.access_token,
    expiresAt: Date.now() + (res.data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

// ── D365 API helpers ──────────────────────────────────────────────────────────
async function apiGet(path) {
  const token = await getToken();
  const res = await axios.get(`${D365_URL}/api/data/v9.2/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  return res.data;
}

async function apiPatch(path, body) {
  const token = await getToken();
  await axios.patch(`${D365_URL}/api/data/v9.2/${path}`, body, {
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      "If-Match":     "*",
    },
  });
}

async function apiPost(path, body) {
  const token = await getToken();
  const res = await axios.post(`${D365_URL}/api/data/v9.2/${path}`, body, {
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return res;
}

// ── Publish customizations ────────────────────────────────────────────────────
async function publishWebResource(webResourceId) {
  const token = await getToken();
  await axios.post(
    `${D365_URL}/api/data/v9.2/PublishXml`,
    { ParameterXml: `<importexportxml><webresources><webresource>{${webResourceId}}</webresource></webresources></importexportxml>` },
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
}

// ── Solution association ──────────────────────────────────────────────────────
let solutionIdCache = null;

async function getSolutionId() {
  if (solutionIdCache) return solutionIdCache;
  if (!SOLUTION_UNIQUE_NAME) {
    console.log("⚠️  No SOLUTION_UNIQUE_NAME set — skipping solution association.");
    return null;
  }

  // Try to find existing solution
  const data = await apiGet(
    `solutions?$filter=uniquename eq '${SOLUTION_UNIQUE_NAME}'&$select=solutionid,friendlyname`
  );

  if (data.value.length > 0) {
    solutionIdCache = data.value[0].solutionid;
    console.log(`🗂️  Solution found: "${data.value[0].friendlyname}" (${solutionIdCache})\n`);
    return solutionIdCache;
  }

  // Solution not found — create it
  console.log(`🆕 Solution "${SOLUTION_UNIQUE_NAME}" not found. Creating...`);

  // Look up the publisher by prefix
  const prefix = SOLUTION_PUBLISHER_PREFIX || SOLUTION_PREFIX.replace(/_$/, "");
  const pubData = await apiGet(
    `publishers?$filter=customizationprefix eq '${prefix}'&$select=publisherid,friendlyname`
  );

  if (pubData.value.length === 0) {
    console.error(`❌ No publisher found with prefix "${prefix}". Check SOLUTION_PUBLISHER_PREFIX in .env`);
    return null;
  }

  const publisherId = pubData.value[0].publisherid;
  console.log(`📎 Using publisher: "${pubData.value[0].friendlyname}" (${publisherId})`);

  const res = await apiPost("solutions", {
    uniquename:    SOLUTION_UNIQUE_NAME,
    friendlyname:  SOLUTION_DISPLAY_NAME || SOLUTION_UNIQUE_NAME,
    version:       "1.0.0.0",
    "publisherid@odata.bind": `/publishers(${publisherId})`,
  });

  // Extract new solution ID from the Location header
  const location = res.headers["odata-entityid"] || res.headers["location"] || "";
  const newId = location.match(/\(([^)]+)\)/)?.[1];

  if (!newId) {
    console.error("❌ Solution created but could not retrieve its ID. Check D365 manually.");
    return null;
  }

  solutionIdCache = newId;
  console.log(`✅ Solution created: "${SOLUTION_DISPLAY_NAME || SOLUTION_UNIQUE_NAME}" (${newId})\n`);
  return solutionIdCache;
}

async function addToSolution(webResourceId) {
  const solutionId = await getSolutionId();
  if (!solutionId) return;

  // Check if already in solution
  const existing = await apiGet(
    `solutioncomponents?$filter=objectid eq ${webResourceId} and componenttype eq 61 and _solutionid_value eq ${solutionId}&$select=solutioncomponentid`
  );

  if (existing.value.length > 0) {
    console.log(`🗂️  Already in solution — skipping association.`);
    return;
  }

  const token = await getToken();
  await axios.post(
    `${D365_URL}/api/data/v9.2/AddSolutionComponent`,
    {
      ComponentId:         webResourceId,
      ComponentType:       61,          // 61 = Web Resource
      SolutionUniqueName:  SOLUTION_UNIQUE_NAME,
      AddRequiredComponents: false,
      DoNotIncludeSubcomponents: false,
    },
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  console.log(`🗂️  Added to solution: ${SOLUTION_UNIQUE_NAME}`);
}

// ── Core deploy function ──────────────────────────────────────────────────────
async function deployWebResource(filePath) {
  const ext      = path.extname(filePath).toLowerCase();
  const typeCode = TYPE_MAP[ext];
  if (!typeCode) { console.log(`⚠️  Skipping unsupported type: ${ext}`); return; }

  // Build the D365 web resource name from the local file path
  // e.g.  src/scripts/myForm.js  →  new_/scripts/myForm.js
  const relativePath = path.relative("src", filePath).replace(/\\/g, "/");
  const wrName       = `${SOLUTION_PREFIX}${relativePath}`;

  const content = fs.readFileSync(filePath);
  const base64  = content.toString("base64");

  console.log(`\n📦 Deploying: ${wrName}`);

  // Check if web resource exists
  const query = `webresourceset?$filter=name eq '${wrName}'&$select=webresourceid,name`;
  const existing = await apiGet(query);

  if (existing.value.length > 0) {
    // Update
    const id = existing.value[0].webresourceid;
    await apiPatch(`webresourceset(${id})`, { content: base64 });
    console.log(`✅ Updated: ${wrName}`);
    await addToSolution(id);
    await publishWebResource(id);
    console.log(`🚀 Published!`);
  } else {
    // Create
    const res = await apiPost("webresourceset", {
      name:            wrName,
      displayname:     path.basename(filePath),
      webresourcetype: typeCode,
      content:         base64,
    });
    const newId = res.headers["OData-EntityId"]
      ?.match(/\(([^)]+)\)/)?.[1];
    console.log(`✅ Created: ${wrName}`);
    if (newId) {
      await addToSolution(newId);
      await publishWebResource(newId);
      console.log(`🚀 Published!`);
    }
  }
}

// ── Watcher ───────────────────────────────────────────────────────────────────
console.log("👀 Watching ./src for changes... (Ctrl+C to stop)\n");

chokidar
  .watch("./src", { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 300 } })
  .on("add",    filePath => deployWebResource(filePath).catch(console.error))
  .on("change", filePath => deployWebResource(filePath).catch(console.error));