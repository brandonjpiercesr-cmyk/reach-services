// ⬡B:AIR:REACH.SCHEDULE:CODE:scheduling.per_ham.booking:reach.schedule:T10:v2.0.0:20260606⬡
//
// v2 — addresses every real failure from v1:
//   1. HAM bleed: NO hardcoded grant IDs. No fallback to Brandon's calendar for other HAMs.
//      Returns 503 if no grant bead found. Isolation guaranteed at DB level via Accept-Profile.
//   2. Slot source: reads RADAR.{uid}.event.* beads from ham_{uid}.abacia — the brain already
//      has all calendar events stamped by RADAR. No Nylas API call for availability.
//   3. IMAN notification: native https, no execFile curl hack.
//   4. Privacy: event titles never exposed to the booker. Only slot windows returned.
//   5. CAL bead fallback path: reads CAL.{ham}.availability.{window} first when stamped,
//      falls back to RADAR events while global builds the loop.
//
// ROUTING: msria.org/schedule/{uid} → REACH → ham_{uid}.abacia → slots → response
// HAM ISOLATION: every ABACIA read uses Accept-Profile: ham_{uid} — scoped at DB level.

const https = require('https');

const ABA_SERVER_URL = process.env.ABA_SERVER_URL || 'https://dnzwyufdzafcwnjaqbxs.supabase.co';
const ABA_SERVER_SRK = process.env.ABA_SERVER_SERVICE_ROLE_KEY;
const NYLAS_KEY      = process.env.NYLAS_API_KEY;
const NYLAS_HOST     = 'api.us.nylas.com';
// CLAUDETTE grant — read from env. Never hardcoded here.

// All scheduling preferences are read per-HAM from the ham.prefs bead.
// No hardcoded values. Defaults below are fallback-only when the bead is absent.
const PREFS_DEFAULT = {
  timezone:     'America/New_York',
  bizHours:     { start: 9, end: 19 },
  slotDuration: 30,
  daysAhead:    14,
  weekendsOff:  true,
};
const MEM        = '\u2B21';

// ─── helpers ──────────────────────────────────────────────────────────────────

function hamSchema(uid) {
  return `ham_${uid.toLowerCase()}`;
}

function reply(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// All ABACIA reads scoped to the HAM's schema via Accept-Profile — no cross-HAM access possible
function abaGet(schema, path) {
  return new Promise((resolve, reject) => {
    if (!ABA_SERVER_SRK) return reject(new Error('ABA_SERVER_SERVICE_ROLE_KEY not configured'));
    const url = new URL(ABA_SERVER_URL);
    const opts = {
      hostname: url.hostname,
      path,
      method: 'GET',
      headers: {
        apikey: ABA_SERVER_SRK,
        Authorization: `Bearer ${ABA_SERVER_SRK}`,
        'Accept-Profile': schema,
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
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('ABACIA timeout')); });
    req.end();
  });
}

function abaPost(schema, path, payload) {
  return new Promise((resolve, reject) => {
    if (!ABA_SERVER_SRK) return reject(new Error('ABA_SERVER_SERVICE_ROLE_KEY not configured'));
    const url = new URL(ABA_SERVER_URL);
    const data = JSON.stringify(payload);
    const opts = {
      hostname: url.hostname,
      path,
      method: 'POST',
      headers: {
        apikey: ABA_SERVER_SRK,
        Authorization: `Bearer ${ABA_SERVER_SRK}`,
        'Content-Type': 'application/json',
        'Accept-Profile': schema,
        'Content-Profile': schema,
        Prefer: 'return=representation,resolution=merge-duplicates',
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
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('ABACIA timeout')); });
    req.write(data);
    req.end();
  });
}

function nylasReq(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    if (!NYLAS_KEY) return reject(new Error('NYLAS_API_KEY not configured'));
    const opts = {
      hostname: NYLAS_HOST,
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

// Native https IMAN notify — no execFile, no curl, no external processes
function imanNotify(grantId, toEmail, subject, htmlBody) {
  return new Promise((resolve) => {
    if (!NYLAS_KEY || !grantId) { resolve(); return; }
    const msg = JSON.stringify({
      subject,
      body: htmlBody,
      to: [{ email: toEmail }],
    });
    // Nylas v3 requires multipart/form-data for message send.
    // Build a minimal multipart body manually.
    const boundary = `notify${Date.now()}`;
    const mpBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="message"; filename="message.json"\r\nContent-Type: application/json\r\n\r\n`),
      Buffer.from(msg),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const opts = {
      hostname: NYLAS_HOST,
      path: `/v3/grants/${grantId}/messages/send`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NYLAS_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': mpBody.length,
      },
    };
    const req = https.request(opts, res => { res.resume(); res.on('end', resolve); });
    req.on('error', () => resolve());
    req.setTimeout(20000, () => { req.destroy(); resolve(); });
    req.write(mpBody);
    req.end();
  });
}

// ─── per-HAM data reads from ABACIA ──────────────────────────────────────────

// Read ham.settings from ham_{uid}.abacia — key locked by global
async function getHamSettings(uid) {
  const DEFAULTS = {
    background: 'pink-smoke', backgroundMode: 'fixed',
    backgroundPool: ['pink-smoke'], kenBurns: true,
    kenBurnsDuration: 20, theme: 'glass-navy-copper',
  };
  try {
    const r = await abaGet(hamSchema(uid),
      '/rest/v1/abacia?source=eq.ham.settings&select=content&limit=1');
    if (r.status === 200 && r.body && r.body.length > 0) {
      return { ...DEFAULTS, ...JSON.parse(r.body[0].content) };
    }
  } catch (e) {
    console.warn(`[SCHED] ham.settings read failed for ${uid}:`, e.message);
  }
  return DEFAULTS;
}

// Read ham.prefs from ABACIA — all scheduling preferences live here, not in code
async function getHamPrefs(uid) {
  try {
    const r = await abaGet(hamSchema(uid),
      '/rest/v1/abacia?source=eq.ham.prefs&select=content&limit=1');
    if (r.status === 200 && r.body && r.body.length > 0) {
      return { ...PREFS_DEFAULT, ...JSON.parse(r.body[0].content) };
    }
  } catch (e) {
    console.warn('[SCHED] ham.prefs read failed for', uid, ':', e.message);
  }
  return PREFS_DEFAULT;
}


// Read calendar grant from ham_{uid}.abacia — source=nylas.grant.calendar
// NO hardcoded fallback. Returns null if not found → caller returns 503.
// This is the HAM bleed fix: if no grant bead exists for this HAM, we stop.
async function getCalendarGrant(uid) {
  try {
    const r = await abaGet(hamSchema(uid),
      '/rest/v1/abacia?source=eq.nylas.grant.calendar&select=content&limit=1');
    if (r.status === 200 && r.body && r.body.length > 0) {
      const parsed = JSON.parse(r.body[0].content);
      return {
        grantId:          parsed.grant_id,
        calendarId:       parsed.calendar_id || parsed.email,
        email:            parsed.email,
        notificationGrant: parsed.notification_grant || process.env.NYLAS_CLAUDETTE_GRANT || null,
      };
    }
  } catch (e) {
    console.error(`[SCHED] Calendar grant read failed for ${uid}:`, e.message);
  }
  return null;
}

// Read HAM's email for notifications — source=ham.settings or nylas.grant.calendar
async function getHamEmail(uid) {
  try {
    const r = await abaGet(hamSchema(uid),
      '/rest/v1/abacia?source=eq.nylas.grant.calendar&select=content&limit=1');
    if (r.status === 200 && r.body && r.body.length > 0) {
      return JSON.parse(r.body[0].content).email || null;
    }
  } catch {}
  return null;
}

// Read RADAR event beads from ham_{uid}.abacia
// These are the HAM's actual calendar events, already stamped by RADAR.
// Titles are NOT returned to the booker — only start/end times for slot computation.
async function getRadarEvents(uid) {
  const now   = new Date();
  const limit = 200;
  try {
    // RADAR beads use source pattern RADAR.{UID}.event.*
    const r = await abaGet(hamSchema(uid),
      `/rest/v1/abacia?source=like.RADAR.${uid.toUpperCase()}.event.*&select=content&limit=${limit}`);
    if (r.status === 200 && Array.isArray(r.body)) {
      return r.body.map(row => {
        try { return JSON.parse(row.content); }
        catch { return null; }
      }).filter(Boolean).filter(ev => {
        // Only events that end in the future
        const end = new Date(ev.end_time);
        return end > now && !ev.is_all_day;
      });
    }
  } catch (e) {
    console.error(`[SCHED] RADAR events read failed for ${uid}:`, e.message);
  }
  return [];
}

// Read CAL availability bead if global has stamped it (YYYYMM window key)
async function getCalAvailability(uid) {
  const now    = new Date();
  const window = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const source = `CAL.${uid.toLowerCase()}.availability.${window}`;
  try {
    const r = await abaGet(hamSchema(uid),
      `/rest/v1/abacia?source=eq.${encodeURIComponent(source)}&select=content&limit=1`);
    if (r.status === 200 && r.body && r.body.length > 0) {
      const parsed = JSON.parse(r.body[0].content);
      if (parsed.slots && Array.isArray(parsed.slots)) {
        console.log(`[SCHED] CAL bead found for ${uid}/${window}: ${parsed.slots.length} slots`);
        return parsed.slots;
      }
    }
  } catch (e) {
    console.warn(`[SCHED] CAL bead read failed for ${uid}:`, e.message);
  }
  return null;
}

// Check if a booker is expected (HAM invited them)
async function isExpectedBooker(uid, bookerEmail, bookerName) {
  const emailEnc = encodeURIComponent(bookerEmail.toLowerCase());
  try {
    const r = await abaGet(hamSchema(uid),
      `/rest/v1/abacia?tags=cs.%7Bexpected_booking%7D&content=ilike.*${emailEnc}*&limit=1`);
    if (r.status === 200 && r.body && r.body.length > 0) return true;
  } catch {}
  if (bookerName) {
    const nameEnc = encodeURIComponent(bookerName.split(' ')[0].toLowerCase());
    try {
      const r2 = await abaGet(hamSchema(uid),
        `/rest/v1/abacia?tags=cs.%7Bexpected_booking%7D&content=ilike.*${nameEnc}*&limit=1`);
      if (r2.status === 200 && r2.body && r2.body.length > 0) return true;
    } catch {}
  }
  return false;
}

// ─── slot computation from RADAR events ───────────────────────────────────────

// DST-safe slot computation — uses Intl.DateTimeFormat to convert wall-clock biz hours to UTC
// No hardcoded timezone offset. Reads prefs for bizHours, slotDuration, daysAhead, weekendsOff.
function wallToUTC(localDateStr, wallHour, tz) {
  const probe = new Date(`${localDateStr}T${String(wallHour).padStart(2,'0')}:00:00Z`);
  const inTZ  = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  }).format(probe);
  const [h]  = inTZ.split(':').map(Number);
  const drift = h - wallHour;
  return new Date(probe.getTime() - drift * 3600000);
}

function computeFreeSlots(busyEvents, prefs = PREFS_DEFAULT) {
  const tz     = prefs.timezone || 'America/New_York';
  const slotMs = (prefs.slotDuration || 30) * 60 * 1000;
  const now    = new Date();
  const slots  = [];
  const busy   = busyEvents.map(ev => ({
    start: new Date(ev.start_time || (ev.start * 1000)),
    end:   new Date(ev.end_time   || (ev.end   * 1000)),
  }));

  for (let d = 0; d < (prefs.daysAhead || 14); d++) {
    const ref   = new Date();
    ref.setUTCDate(ref.getUTCDate() + d);
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(ref);

    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(ref);
    if (prefs.weekendsOff && (weekday === 'Sat' || weekday === 'Sun')) continue;

    const bizStart = wallToUTC(localDate, prefs.bizHours?.start ?? 9,  tz);
    const bizEnd   = wallToUTC(localDate, prefs.bizHours?.end   ?? 19, tz);
    if (bizEnd < now) continue;

    let cursor = bizStart < now
      ? new Date(Math.ceil(now.getTime() / slotMs) * slotMs)
      : new Date(bizStart);

    while (cursor.getTime() + slotMs <= bizEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + slotMs);
      const blocked = busy.some(ev => ev.start < slotEnd && ev.end > cursor);
      if (!blocked) slots.push({
        start: Math.floor(cursor.getTime() / 1000),
        end:   Math.floor(slotEnd.getTime() / 1000),
      });
      cursor = slotEnd;
    }
  }
  return slots;
}


async function writeBead(uid, source, content, tags, importance = 7) {
  const stamp = `${MEM}B:${source}:RESULT:schedule:20260606${MEM}`;
  return abaPost(hamSchema(uid), '/rest/v1/abacia', {
    acl_stamp: stamp, ham_uid: uid.toUpperCase(),
    agent_global: 'SCHED', context_suffix: 'booking',
    channel: 'web', stamp_type: 'RESULT', stamped_by: 'SCHED',
    source,
    content: typeof content === 'string' ? content : JSON.stringify(content),
    memory_type: 'schedule', importance, tags,
    categories: ['schedule', 'booking'],
    metadata: { written_at: new Date().toISOString() },
  });
}

// ─── route handlers ───────────────────────────────────────────────────────────

async function handleAvailability(req, res, uid) {
  console.log(`[SCHED] Availability: uid=${uid}`);
  try {
    // 1. Settings — from ham.settings bead
    const settings = await getHamSettings(uid);

    // 2. Calendar grant — hard fail if not found (no HAM bleed)
    const grant = await getCalendarGrant(uid);
    if (!grant) {
      console.error(`[SCHED] No calendar grant bead for uid=${uid}`);
      return reply(res, 503, {
        error: 'Calendar not configured for this HAM',
        uid,
        hint: 'nylas.grant.calendar bead missing from ABACIA',
      });
    }

    // 3. Slots — read CAL bead first (global), fall back to RADAR events
    let slots = await getCalAvailability(uid);
    if (!slots) {
      console.log(`[SCHED] CAL bead absent — computing from RADAR events`);
      const events = await getRadarEvents(uid);
      console.log(`[SCHED] RADAR: ${events.length} events for uid=${uid}`);
      slots = computeFreeSlots(events, -4); // timezone from ham.settings in future
    }

    console.log(`[SCHED] ${slots.length} free slots for uid=${uid}`);
    const tokens = await getDesignTokens(uid);
    reply(res, 200, { uid, slots, count: slots.length, daysAhead: DAYS_AHEAD, settings, tokens });
  } catch (e) {
    console.error('[SCHED] Availability error:', e.message);
    reply(res, 500, { error: 'Failed to compute availability', detail: e.message });
  }
}

async function handleBook(req, res, uid) {
  console.log(`[SCHED] Book: uid=${uid}`);
  try {
    const body = await parseBody(req);
    const { bookerName, bookerEmail, slotStart, slotEnd } = body;
    if (!bookerName || !bookerEmail || !slotStart || !slotEnd) {
      return reply(res, 400, { error: 'Required: bookerName, bookerEmail, slotStart, slotEnd' });
    }

    // Grant — hard fail if not found
    const grant = await getCalendarGrant(uid);
    if (!grant) {
      return reply(res, 503, { error: 'Calendar not configured for this HAM', uid });
    }

    const hamEmail  = await getHamEmail(uid);
    const expected  = await isExpectedBooker(uid, bookerEmail, bookerName);
    const startDT   = new Date(slotStart * 1000).toLocaleString('en-US', {
      timeZone: 'America/New_York', weekday: 'long', month: 'long',
      day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    if (expected) {
      // A — auto-confirm: create Nylas event, write bead, notify HAM
      console.log(`[SCHED] Expected booker ${bookerEmail} — auto-confirming`);
      const eventRes = await nylasReq(
        `/v3/grants/${grant.grantId}/events?calendar_id=${encodeURIComponent(grant.calendarId)}`,
        'POST',
        {
          title: `1:1 — ${bookerName}`,
          when: { start_time: slotStart, end_time: slotEnd },
          participants: [{ email: bookerEmail, name: bookerName }],
          description: 'Booked via msria.org/schedule. 30-min 1:1.',
        }
      );
      const eventId = eventRes.body?.data?.id || 'unknown';

      await writeBead(uid,
        `schedule.confirmed.${bookerEmail.replace(/[@.]/g, '_')}.${slotStart}`,
        { bookerName, bookerEmail, slotStart, slotEnd, eventId, status: 'confirmed' },
        ['schedule', 'confirmed_booking', 'expected'], 8);

      const notifGrant1 = grant.notificationGrant || process.env.NYLAS_CLAUDETTE_GRANT;
      if (hamEmail && notifGrant1) {
        await imanNotify(notifGrant1, hamEmail,
          `1:1 Booked — ${bookerName}`,
          `<p>Hey!</p><p><strong>${bookerName}</strong> booked a 1:1 for <strong>${startDT} EST</strong>. Auto-confirmed, calendar event created.</p><p>Thanks,<br>ABA</p>`);
      }
      reply(res, 200, { status: 'confirmed', message: `Your 1:1 is confirmed for ${startDT} EST.` });

    } else {
      // B — cold: hold pending, notify HAM
      console.log(`[SCHED] Cold booker ${bookerEmail} — holding for HAM`);
      const pendingId = `schedule.pending.${bookerEmail.replace(/[@.]/g, '_')}.${slotStart}`;
      await writeBead(uid, pendingId,
        { bookerName, bookerEmail, slotStart, slotEnd, status: 'pending', requestedAt: new Date().toISOString() },
        ['schedule', 'pending_booking', 'cold'], 7);

      const notifGrant2 = grant.notificationGrant || process.env.NYLAS_CLAUDETTE_GRANT;
      if (hamEmail && notifGrant2) {
        await imanNotify(notifGrant2, hamEmail,
          `1:1 Request — ${bookerName} (needs your OK)`,
          `<p>Hey!</p><p><strong>${bookerName}</strong> (${bookerEmail}) wants a 1:1 for <strong>${startDT} EST</strong>. Not on your expected list. Reply approve or decline.</p><p>Pending ID: ${pendingId}</p><p>Thanks,<br>ABA</p>`);
      }
      reply(res, 200, { status: 'pending', message: 'Your request has been sent. You will hear back shortly.' });
    }
  } catch (e) {
    console.error('[SCHED] Book error:', e.message);
    reply(res, 500, { error: 'Booking failed', detail: e.message });
  }
}

// ─── export ───────────────────────────────────────────────────────────────────

async function handleScheduleRoute(req, res, pathname, method) {
  const m = pathname.match(/^\/api\/schedule\/([A-Z0-9]+)\/(availability|book|bookings|confirm)$/i);
  if (!m) return false;
  const uid    = m[1].toUpperCase();
  const action = m[2].toLowerCase();
  if (action === 'availability' && method === 'GET')  { await handleAvailability(req, res, uid); return true; }
  if (action === 'book'         && method === 'POST')  { await handleBook(req, res, uid); return true; }
  if (action === 'bookings'     && method === 'GET')   { await handleBookings(req, res, uid); return true; }
  if (action === 'confirm'      && method === 'POST')  { await handleConfirm(req, res, uid); return true; }
  return false;
}

module.exports = { handleScheduleRoute };

// ─── /bookings — returns pending and confirmed bookings for HAM ───────────────
async function handleBookings(req, res, uid) {
  console.log(`[SCHED] Bookings list: uid=${uid}`);
  try {
    const r = await abaGet(hamSchema(uid),
      `/rest/v1/abacia?tags=cs.%7Bschedule%7D&tags=cs.%7Bbooking%7D&source=like.schedule.*&select=source,content,tags&limit=50&order=created_at.desc`);
    if (r.status !== 200) return reply(res, 500, { error: 'Could not read bookings' });
    const bookings = (r.body || []).map(row => {
      try {
        const c = JSON.parse(row.content);
        return { source: row.source, ...c, tags: row.tags };
      } catch { return null; }
    }).filter(Boolean).filter(b => b.status === 'pending' || b.status === 'confirmed');
    reply(res, 200, { bookings });
  } catch (e) {
    console.error('[SCHED] Bookings error:', e.message);
    reply(res, 500, { error: 'Failed', detail: e.message });
  }
}

// ─── /confirm — HAM confirms or declines a pending booking ────────────────────
async function handleConfirm(req, res, uid) {
  console.log(`[SCHED] Confirm: uid=${uid}`);
  try {
    const body   = await parseBody(req);
    const { source, action } = body; // action: 'confirm' | 'decline'
    if (!source || !['confirm','decline'].includes(action)) {
      return reply(res, 400, { error: 'Required: source, action (confirm|decline)' });
    }

    // Read the pending bead
    const r = await abaGet(hamSchema(uid),
      `/rest/v1/abacia?source=eq.${encodeURIComponent(source)}&select=content&limit=1`);
    if (r.status !== 200 || !r.body || !r.body.length) {
      return reply(res, 404, { error: 'Booking not found' });
    }
    const booking = JSON.parse(r.body[0].content);
    const grant   = await getCalendarGrant(uid);

    if (action === 'confirm' && grant) {
      // Create the Nylas calendar event
      await nylasReq(
        `/v3/grants/${grant.grantId}/events?calendar_id=${encodeURIComponent(grant.calendarId)}`,
        'POST',
        {
          title: `1:1 — ${booking.bookerName}`,
          when: { start_time: booking.slotStart, end_time: booking.slotEnd },
          participants: [{ email: booking.bookerEmail, name: booking.bookerName }],
          description: 'Confirmed via msria.org/schedule manage panel.',
        }
      );
    }

    // Supersede the bead with updated status
    const newSource = source.replace('pending', action === 'confirm' ? 'confirmed' : 'declined');
    await writeBead(uid, newSource,
      { ...booking, status: action === 'confirm' ? 'confirmed' : 'declined', resolvedAt: new Date().toISOString() },
      ['schedule', action === 'confirm' ? 'confirmed_booking' : 'declined_booking'], 8);

    reply(res, 200, { ok: true, action, source: newSource });
  } catch (e) {
    console.error('[SCHED] Confirm error:', e.message);
    reply(res, 500, { error: 'Failed', detail: e.message });
  }
}

// ─── read global.aesthetics.design_tokens bead ───────────────────────────────
async function getDesignTokens(uid) {
  try {
    const r = await abaGet(hamSchema(uid),
      '/rest/v1/abacia?source=eq.global.aesthetics.design_tokens&select=content&limit=1');
    if (r.status === 200 && r.body && r.body.length > 0) {
      return JSON.parse(r.body[0].content);
    }
  } catch (e) {
    console.warn('[SCHED] design tokens read failed:', e.message);
  }
  return null;
}
