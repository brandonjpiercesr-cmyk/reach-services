# ⚠️ CRITICAL ROUTES — DO NOT REMOVE ⚠️

**ANY DEPLOY THAT REMOVES THESE ROUTES WILL BREAK OMI INTEGRATION**

## Required Routes in worker.js

### 1. `/api/omi/auth`
```javascript
if (path === '/api/omi/auth') {
  return jsonResponse(res, 200, {
    authenticated: true,
    app_id: 'aba-intelligence-layer',
    status: 'active'
  });
}
```
**WHY:** OMI periodically checks this endpoint. If it returns 404, the app silently disappears from OMI and webhooks stop being sent.

### 2. `/api/omi/manifest`
Returns the app manifest for OMI integration.
**WHY:** Required for OMI to know what the app does.

### 3. `/api/omi/webhook`
Receives transcript data from OMI devices.
**WHY:** This is how ABA hears through the OMI pendant.

### 4. Heartbeat (at bottom of file)
```javascript
setInterval(async () => {
  await fetch('https://aba-reach.onrender.com/');
}, 60000);
```
**WHY:** Render free tier sleeps after 15min of inactivity. When REACH is asleep, OMI webhook calls time out (5-10s timeout vs 30-60s wake time). The heartbeat keeps REACH awake 24/7.

## GitHub Actions Protection

A CI workflow runs on every push that validates these routes exist. If any are missing, **the deploy will be marked as failed**.

## If You Need to Refactor

1. Keep these routes functional
2. Test `/api/omi/auth` returns 200 with `authenticated: true`
3. Test webhook processes and stores to Supabase
4. Keep heartbeat at bottom of file

## History

These routes were accidentally removed 5+ times by different chat sessions between Feb 13-14 2026, causing repeated OMI failures. This protection was added to prevent recurrence.
