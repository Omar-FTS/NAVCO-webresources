The D365 app user is missing the `prvCreateWebResource` privilege. Here's how to fix it:

In D365, go to **Settings → Security → Application Users**, open the app user, click **Manage Roles**, and make sure both **System Administrator** and **System Customizer** are checked. Save, then wait 3–5 minutes for D365 to refresh its privilege cache.

Let me know when that's done and I'll retry the deploy.
