# Response: What web resources named dc_quote are already in D365?

I don't have the ability to connect to a Dynamics 365 environment or query its API directly. To answer "what web resources named `dc_quote` are already in D365?", you would need to either:

1. **Use the Power Platform CLI or a D365 API call** to query existing web resources — for example:
   ```bash
   pac webresource list --name dc_quote*
   ```
   or a Dataverse Web API query:
   ```
   GET [org]/api/data/v9.2/webresourceset?$filter=startswith(name,'dc_quote')&$select=name,displayname,webresourcetype
   ```

2. **Check the D365 maker portal** — go to make.powerapps.com → your environment → Solutions or Web Resources, and search for `dc_quote`.

Without a live connection to your D365 environment, I can only see what exists **locally** in this repository. Locally, I can see these `dc_quote`-related files:

- `dc_quote_main_operations.js`
- `dc_quote_product_main_operations.js`

But I cannot tell you which of these (or any others) are already published/exist in your D365 environment — that requires querying the environment directly.
