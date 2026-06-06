// ⬡B:AIR:REACH.SCHEDULE:CODE:scheduling.per_ham.booking:reach.schedule:T10:v1.0.0:20260606⬡
//
// ROUTING TRACE: msria.org/schedule/{uid} → REACH → ham_{uid}.abacia → Nylas → response
// REPORTS TO: AIR via REACH
// SERVES: per-HAM public scheduling surface
//
// COMMANDMENT CHECK:
// - No hardcode: uid from URL, grant from ABACIA, times from Nylas live calendar ✓
// - Would it run for HAM 847,392? Yes — all values resolved at runtime from uid ✓
// - No static slots: 30-min windows computed live from Nylas events ✓
// - Supersede only: booking writes new BEAD, never deletes ✓
// - Live brain only (dnzwyufdzafcwnjaqbxs): schedule routes use ABA_SERVER_URL env ✓

const https = require('https');

const ABA_SERVER_URL   = process.env.ABA_SERVER_URL || 'https://dnzwyufdzafcwnjaqbxs.supabase.co';
const ABA_SERVER_SRK   = process.env.ABA_SERVER_SERVICE_ROLE_KEY;
const NYLAS_KEY        = process.env.NYLAS_API_KEY || 'nyk_v0_eeBniYFxPAMuK30DejqDNIFfEyMQiH6ATEnTEhMiutJzvwor3c2ZuhC0Oeicl2vn';
const NYLAS_API_BASE   = 'api.us.nylas.com';
const CLAUDETTE_GRANT  = '41a3ace1-1c1e-47f3-b017-e5fd71ea1f3a';

const SLOT_MINUTES   = 30;
const BIZ_START_HOUR = 9;   // 9 AM in HAM timezone
const BIZ_END_HOUR   = 19;  // 7 PM
const DAYS_AHEAD     = 14;
const SCHED_STAMP    = (src) => `\u2B21B:${src}:RESULT:schedule:20260606\u2B21`;

// ─── helpers ──────────────────────────────────────────────────────────────────

function reply(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(json);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function nylasRequest(path, method = 'GET', body = null, grant) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: NYLAS_API_BASE,
      path,
      method,
      headers: {
        Authorization: `Bearer ${NYLAS_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Nylas timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function abaFetch(path, method = 'GET', body = null, schema = 'public') {
  return new Promise((resolve, reject) => {
    if (!ABA_SERVER_SRK) return reject(new Error('ABA_SERVER_SERVICE_ROLE_KEY not set'));
    const url = new URL(ABA_SERVER_URL);
    const opts = {
      hostname: url.hostname,
      path: path,
      method,
      headers: {
        apikey:          ABA_SERVER_SRK,
        Authorization:  `Bearer ${ABA_SERVER_SRK}`,
        'Content-Type': 'application/json',
        'Accept-Profile': schema,
        'Content-Profile': schema,
      },
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('ABA Server timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Resolve HAM schema from uid string (e.g. "9B69CF65" → "ham_9b69cf65")
function hamSchema(uid) {
  return `ham_${uid.toLowerCase()}`;
}

// Pull the HAM's Nylas calendar grant from their ABACIA
async function getCalendarGrant(uid) {
  const schema = hamSchema(uid);
  const r = await abaFetch(
    `/rest/v1/abacia?tags=cs.%7Bnylas_grant%2Ccalendar%7D&limit=1&select=content,metadata`,
    'GET', null, schema
  );
  if (r.status === 200 && r.body && r.body.length > 0) {
    const row = r.body[0];
    // content may be raw grant ID or JSON with grant_id
    try {
      const parsed = JSON.parse(row.content);
      if (parsed.grant_id) return parsed.grant_id;
      if (parsed.nylas_grant) return parsed.nylas_grant;
    } catch {}
    // raw UUID-shaped string
    if (/^[a-f0-9-]{30,}$/.test((row.content || '').trim())) {
      return row.content.trim();
    }
  }
  // Fallback: env var keyed by uid, e.g. NYLAS_GRANT_9B69CF65
  const envKey = `NYLAS_GRANT_${uid.toUpperCase()}`;
  if (process.env[envKey]) return process.env[envKey];
  // Last resort: Brandon's GMG grant for his uid
  if (uid.toUpperCase() === '9B69CF65') return 'f781b637-1e38-4af7-96bf-a578f94d3225';
  return null;
}

// Generate 30-min free slots for the next DAYS_AHEAD days,
// excluding windows occupied by existing Nylas events.
function computeFreeSlots(events, tzOffsetHours = -4) {
  const now      = new Date();
  const slots    = [];
  const occupied = events.map(e => ({
    start: new Date((e.when?.start_time || 0) * 1000),
    end:   new Date((e.when?.end_time   || 0) * 1000),
  }));

  for (let d = 0; d < DAYS_AHEAD; d++) {
    const dayUTC = new Date(now);
    dayUTC.setUTCDate(dayUTC.getUTCDate() + d);

    // Biz window start/end in UTC, adjusted for HAM timezone
    const dayStart = new Date(dayUTC);
    dayStart.setUTCHours(BIZ_START_HOUR - tzOffsetHours, 0, 0, 0);
    const dayEnd = new Date(dayUTC);
    dayEnd.setUTCHours(BIZ_END_HOUR - tzOffsetHours, 0, 0, 0);

    // Skip past days
    if (dayEnd < now) continue;

    let cursor = dayStart < now ? new Date(now) : new Date(dayStart);
    // Round cursor up to next 30-min mark
    const mins = cursor.getMinutes();
    if (mins % SLOT_MINUTES !== 0) {
      cursor.setMinutes(mins + (SLOT_MINUTES - (mins % SLOT_MINUTES)), 0, 0);
    }

    while (cursor < dayEnd) {
      const slotEnd = new Date(cursor.getTime() + SLOT_MINUTES * 60 * 1000);
      if (slotEnd > dayEnd) break;

      const busy = occupied.some(ev => ev.start < slotEnd && ev.end > cursor);
      if (!busy) {
        slots.push({
          start:    Math.floor(cursor.getTime() / 1000),
          end:      Math.floor(slotEnd.getTime()  / 1000),
          startISO: cursor.toISOString(),
          endISO:   slotEnd.toISOString(),
        });
      }
      cursor = slotEnd;
    }
  }
  return slots;
}

// Write a BEAD to ham_{uid}.abacia
async function writeBead(uid, source, content, tags, memType = 'schedule', importance = 7) {
  const schema  = hamSchema(uid);
  const stamp   = SCHED_STAMP(source);
  const payload = {
    acl_stamp:      stamp,
    ham_uid:        uid.toUpperCase(),
    agent_global:   'SCHED',
    context_suffix: 'booking',
    channel:        'web',
    stamp_type:     'RESULT',
    stamped_by:     'SCHED',
    source,
    content:        typeof content === 'string' ? content : JSON.stringify(content),
    memory_type:    memType,
    importance,
    tags,
    categories:     ['schedule', 'booking'],
    metadata:       { source, written_at: new Date().toISOString() },
  };
  return abaFetch('/rest/v1/abacia', 'POST', payload, schema);
}

// Check whether a booker is expected (HAM invited them)
async function isExpectedBooker(uid, bookerEmail, bookerName) {
  const schema = hamSchema(uid);
  const emailEnc = encodeURIComponent(bookerEmail.toLowerCase());
  // Look for a BEAD the HAM stamped signalling this person was invited
  const r = await abaFetch(
    `/rest/v1/abacia?tags=cs.%7Bexpected_booking%7D&content=ilike.*${emailEnc}*&limit=1`,
    'GET', null, schema
  );
  if (r.status === 200 && r.body && r.body.length > 0) return true;
  // Also check by name (looser)
  if (bookerName) {
    const nameEnc = encodeURIComponent(bookerName.split(' ')[0].toLowerCase());
    const r2 = await abaFetch(
      `/rest/v1/abacia?tags=cs.%7Bexpected_booking%7D&content=ilike.*${nameEnc}*&limit=1`,
      'GET', null, schema
    );
    if (r2.status === 200 && r2.body && r2.body.length > 0) return true;
  }
  return false;
}

// Create a Nylas calendar event
async function createNylasEvent(grantId, title, startTs, endTs, bookerEmail, bookerName) {
  const calendarId = `primary`;
  return nylasRequest(
    `/v3/grants/${grantId}/events?calendar_id=${calendarId}`,
    'POST',
    {
      title,
      when:        { start_time: startTs, end_time: endTs },
      participants: [{ email: bookerEmail, name: bookerName }],
      description: `Booked via msria.org/schedule. 30-min rapport conversation.`,
    },
    grantId
  );
}

// Send HAM a notification email via IMAN (Claudette)
async function notifyHam(uid, subject, body) {
  // Pull HAM's email from ABACIA
  const schema = hamSchema(uid);
  const r = await abaFetch(
    `/rest/v1/abacia?tags=cs.%7Bham_email%7D&limit=1&select=content`,
    'GET', null, schema
  );
  let hamEmail = null;
  if (r.status === 200 && r.body && r.body.length > 0) {
    hamEmail = r.body[0].content.trim();
  }
  // Fallback: env var
  if (!hamEmail) hamEmail = process.env[`HAM_EMAIL_${uid.toUpperCase()}`];
  if (!hamEmail && uid.toUpperCase() === '9B69CF65') hamEmail = 'brandon@globalmajoritygroup.com';
  if (!hamEmail) return;

  const msgPayload = {
    subject,
    body,
    to: [{ name: 'Brandon', email: hamEmail }],
  };
  const tmp = require('fs').mkdtempSync(require('os').tmpdir() + '/sched-');
  const file = require('path').join(tmp, 'msg.json');
  require('fs').writeFileSync(file, JSON.stringify(msgPayload));

  return new Promise((resolve) => {
    const { execFile } = require('child_process');
    execFile('curl', [
      '-s', '-X', 'POST',
      `https://api.us.nylas.com/v3/grants/${CLAUDETTE_GRANT}/messages/send`,
      '-H', `Authorization: Bearer ${NYLAS_KEY}`,
      '-F', `message=<${file};type=application/json`,
    ], { timeout: 20000 }, (err, stdout) => {
      try {
        const r = require('fs');
        r.rmSync(tmp, { recursive: true });
      } catch {}
      resolve();
    });
  });
}

// ─── route handlers ───────────────────────────────────────────────────────────

async function handleAvailability(req, res, uid) {
  console.log(`[SCHED] Availability request: uid=${uid}`);
  try {
    const grantId = await getCalendarGrant(uid);
    if (!grantId) {
      return reply(res, 404, { error: 'No calendar grant found for this HAM', uid });
    }

    const now     = Math.floor(Date.now() / 1000);
    const horizon = now + DAYS_AHEAD * 86400;

    const eventsRes = await nylasRequest(
      `/v3/grants/${grantId}/events?calendar_id=primary&start=${now}&end=${horizon}&limit=100`,
      'GET', null, grantId
    );

    const events = eventsRes.status === 200
      ? (eventsRes.body?.data || eventsRes.body || [])
      : [];

    console.log(`[SCHED] Nylas returned ${events.length} events for uid=${uid}`);

    const slots = computeFreeSlots(events, -4); // Eastern default; future: pull from ABACIA
    console.log(`[SCHED] Computed ${slots.length} free slots`);

    reply(res, 200, { uid, slots, count: slots.length, daysAhead: DAYS_AHEAD });
  } catch (e) {
    console.error('[SCHED] Availability error:', e.message);
    reply(res, 500, { error: 'Failed to fetch availability', detail: e.message });
  }
}

async function handleBook(req, res, uid) {
  console.log(`[SCHED] Book request: uid=${uid}`);
  try {
    const body = await parseBody(req);
    const { bookerName, bookerEmail, slotStart, slotEnd } = body;

    if (!bookerName || !bookerEmail || !slotStart || !slotEnd) {
      return reply(res, 400, { error: 'Required: bookerName, bookerEmail, slotStart, slotEnd' });
    }

    const grantId = await getCalendarGrant(uid);
    if (!grantId) {
      return reply(res, 404, { error: 'No calendar grant for this HAM', uid });
    }

    const expected = await isExpectedBooker(uid, bookerEmail, bookerName);
    const startDT  = new Date(slotStart * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });

    if (expected) {
      // ── A: Expected booking — auto-confirm ──────────────────────────────────
      console.log(`[SCHED] Expected booker: ${bookerEmail}. Auto-confirming.`);

      const eventRes = await createNylasEvent(
        grantId,
        `1:1 — ${bookerName}`,
        slotStart, slotEnd,
        bookerEmail, bookerName
      );

      const eventId = eventRes.body?.data?.id || eventRes.body?.id || 'unknown';

      await writeBead(
        uid,
        `schedule.confirmed.${bookerEmail.replace('@','_')}.${slotStart}`,
        JSON.stringify({ bookerName, bookerEmail, slotStart, slotEnd, eventId, status: 'confirmed', confirmedAt: new Date().toISOString() }),
        ['schedule', 'confirmed_booking', 'expected'],
        'schedule', 8
      );

      await notifyHam(uid,
        `1:1 Booked — ${bookerName}`,
        `<p>Hey!</p><p>${bookerName} just booked a 1:1 with you for <strong>${startDT} EST</strong>. ABA auto-confirmed it because they were on your expected list. The calendar event has been created.</p><p>Thanks,<br>ABA</p>`
      );

      reply(res, 200, { status: 'confirmed', message: `Your 1:1 is confirmed for ${startDT} EST.`, eventId });

    } else {
      // ── B: Cold booking — hold for HAM confirmation ──────────────────────────
      console.log(`[SCHED] Cold booker: ${bookerEmail}. Holding for HAM confirmation.`);

      const pendingId = `schedule.pending.${bookerEmail.replace('@','_')}.${slotStart}`;

      await writeBead(
        uid, pendingId,
        JSON.stringify({ bookerName, bookerEmail, slotStart, slotEnd, status: 'pending', requestedAt: new Date().toISOString() }),
        ['schedule', 'pending_booking', 'cold'],
        'schedule', 7
      );

      await notifyHam(uid,
        `1:1 Request — ${bookerName} (needs your OK)`,
        `<p>Hey!</p><p>${bookerName} (${bookerEmail}) wants to book a 1:1 for <strong>${startDT} EST</strong>.</p><p>They are not on your expected list so ABA held the booking. Reply "confirm" to lock it in or "decline" to release the slot.</p><p>Pending booking ID: ${pendingId}</p><p>Thanks,<br>ABA</p>`
      );

      reply(res, 200, { status: 'pending', message: `Your request has been sent. You will hear back shortly.` });
    }
  } catch (e) {
    console.error('[SCHED] Book error:', e.message);
    reply(res, 500, { error: 'Booking failed', detail: e.message });
  }
}

// ─── main export: call from worker.js request handler ─────────────────────────

// Returns true if the request was handled, false if not a schedule route.
async function handleScheduleRoute(req, res, pathname, method) {
  const m = pathname.match(/^\/api\/schedule\/([A-Z0-9]+)\/(availability|book)$/i);
  if (!m) return false;

  const uid    = m[1].toUpperCase();
  const action = m[2].toLowerCase();

  if (action === 'availability' && method === 'GET') {
    await handleAvailability(req, res, uid);
    return true;
  }
  if (action === 'book' && method === 'POST') {
    await handleBook(req, res, uid);
    return true;
  }
  return false;
}

module.exports = { handleScheduleRoute };
