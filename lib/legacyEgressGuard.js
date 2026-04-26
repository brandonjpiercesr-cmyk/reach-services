// ⬡B:legacy.egress.guard:SERVICE:fetch_chokepoint_egress_filter:20260426⬡
//
// LEGACY EGRESS GUARD — reach-services build
// Same logic as abacia-services version. Self-contained Supabase calls
// (no shared lib/supabase wrapper in this repo).
//
// PURPOSE: wrap Module.prototype.require AND global.fetch at boot. Every
// outbound HTTP call passes through. Calls to recognized outbound primitives
// are gated by policy. All other URLs pass through unchanged.
//
// POLICY: read once at boot from legacy brain row source=config.legacy_egress_policy.
// Owner HAMs resolved at boot from ham_profile rows where trust_level matches
// the configured tiers. No string literals naming any specific person.
//
// SAFETY: guard NEVER throws into caller. Fail-closed until policy loads.
// Unknown URL patterns ALWAYS pass through.
//
// We Are All ABA.

'use strict';

const Module = require('module');

const policy = {
  loaded: false,
  loadAttempted: false,
  loadError: null,
  disabled: true,
  permittedRecipientEmails: new Set(),
  permittedRecipientPhones: new Set(),
  ownerHamIds: new Set(),
  loadedAt: null,
};

let originalNodeFetch = null;
let originalGlobalFetch = null;
let ResponseCtor = null;
let installed = false;

const CLASSIFIERS = [
  {
    name: 'nylas_email_send',
    matches: (url) => /api\.us\.nylas\.com\/v3\/grants\/[^/]+\/messages\/send/.test(url),
    extractRecipients: (body) => {
      try {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        const out = [];
        for (const r of (parsed.to || [])) out.push(String(r.email || r).toLowerCase().trim());
        for (const r of (parsed.cc || [])) out.push(String(r.email || r).toLowerCase().trim());
        for (const r of (parsed.bcc || [])) out.push(String(r.email || r).toLowerCase().trim());
        return out.filter(Boolean);
      } catch { return []; }
    },
    recipientType: 'email',
  },
  {
    name: 'reach_call_dial',
    matches: (url) => /aba-reach\.onrender\.com\/api\/call\//.test(url),
    extractRecipients: (body) => {
      try {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        const to = parsed.to || parsed.targetNumber || parsed.phone || '';
        return to ? [String(to).trim()] : [];
      } catch { return []; }
    },
    recipientType: 'phone',
  },
  {
    name: 'reach_sms_send',
    matches: (url) => /aba-reach\.onrender\.com\/api\/sms\//.test(url),
    extractRecipients: (body) => {
      try {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        const to = parsed.to || parsed.targetNumber || parsed.phone || '';
        return to ? [String(to).trim()] : [];
      } catch { return []; }
    },
    recipientType: 'phone',
  },
  {
    name: 'twilio_calls',
    matches: (url) => /api\.twilio\.com\/.*\/Calls(\.json)?(\?|$)/.test(url),
    extractRecipients: (body) => {
      try {
        const params = new URLSearchParams(typeof body === 'string' ? body : '');
        const to = params.get('To');
        return to ? [String(to).trim()] : [];
      } catch { return []; }
    },
    recipientType: 'phone',
  },
  {
    name: 'twilio_messages',
    matches: (url) => /api\.twilio\.com\/.*\/Messages(\.json)?(\?|$)/.test(url),
    extractRecipients: (body) => {
      try {
        const params = new URLSearchParams(typeof body === 'string' ? body : '');
        const to = params.get('To');
        return to ? [String(to).trim()] : [];
      } catch { return []; }
    },
    recipientType: 'phone',
  },
  {
    name: 'elevenlabs_outbound_call',
    matches: (url) => /api\.elevenlabs\.io\/.*outbound[-/]call/.test(url),
    extractRecipients: (body) => {
      try {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        const to = parsed.to_number || parsed.to || parsed.phone || '';
        return to ? [String(to).trim()] : [];
      } catch { return []; }
    },
    recipientType: 'phone',
  },
  {
    name: 'sendblue_imessage',
    matches: (url) => /sendblue\.co\/.*\/messages?(\.json)?(\?|$)/.test(url),
    extractRecipients: (body) => {
      try {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        const to = parsed.number || parsed.to || parsed.phone || '';
        return to ? [String(to).trim()] : [];
      } catch { return []; }
    },
    recipientType: 'phone',
  },
];

function classify(urlStr) {
  for (const c of CLASSIFIERS) if (c.matches(urlStr)) return c;
  return null;
}

function isRecipientPermitted(rcpt, type) {
  const norm = String(rcpt).toLowerCase().trim();
  if (type === 'email') return policy.permittedRecipientEmails.has(norm);
  if (type === 'phone') {
    const digits = norm.replace(/[^\d+]/g, '');
    if (policy.permittedRecipientPhones.has(digits)) return true;
    if (policy.permittedRecipientPhones.has(norm)) return true;
    const stripped = digits.replace(/^\+?1?/, '');
    for (const p of policy.permittedRecipientPhones) {
      if (p.replace(/[^\d]/g, '').endsWith(stripped) && stripped.length >= 10) return true;
    }
    return false;
  }
  return false;
}

function buildBlockedResponse(classifierName, recipients, reason) {
  const body = JSON.stringify({
    error: 'legacy_egress_blocked',
    classifier: classifierName,
    blocked_recipients: recipients,
    reason,
    policy_loaded: policy.loaded,
    policy_disabled: policy.disabled,
    timestamp: new Date().toISOString(),
  });
  if (ResponseCtor) {
    return new ResponseCtor(body, {
      status: 403,
      statusText: 'Blocked by legacy egress guard',
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return {
    ok: false, status: 403,
    statusText: 'Blocked by legacy egress guard',
    headers: { get: () => 'application/json' },
    text: async () => body,
    json: async () => JSON.parse(body),
    body,
    __egressGuardSynthesized: true,
  };
}

async function logBlock(classifierName, urlStr, recipients, reason, callsiteHint) {
  try {
    const SUPA_URL = process.env.SUPABASE_URL || 'https://htlxjkbrstpwwtzsbyvb.supabase.co';
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!SUPA_KEY) return;
    // Use originalNodeFetch (or originalGlobalFetch) to avoid recursion through our own wrap
    const fetchFn = originalNodeFetch || originalGlobalFetch || global.fetch;
    if (!fetchFn) return;
    const body = JSON.stringify({
      source: `legacy.egress.blocked.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
      memory_type: 'legacy_egress_blocked',
      content: JSON.stringify({
        classifier: classifierName,
        url: urlStr.substring(0, 300),
        recipients,
        reason,
        callsite: callsiteHint,
        policy_loaded: policy.loaded,
        policy_disabled: policy.disabled,
        service: 'reach-services',
        timestamp: new Date().toISOString(),
      }),
      importance: 7,
      is_system: true,
      tags: ['legacy_egress', 'blocked', classifierName, 'reach-services'],
    });
    await fetchFn(`${SUPA_URL}/rest/v1/aba_memory`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body,
    });
  } catch (logErr) {
    try { console.warn('[EGRESS-GUARD] block-log failed (non-fatal):', logErr.message); } catch {}
  }
}

function callsiteHint() {
  try {
    const stack = (new Error()).stack.split('\n');
    const filtered = stack.slice(4, 9).map(l => l.trim()).filter(l => !l.includes('legacyEgressGuard'));
    return filtered.slice(0, 3).join(' | ').substring(0, 400);
  } catch { return ''; }
}

function makeGuardedFetch(originalFetchFn) {
  const guarded = async function legacyEgressGuardedFetch(url, options) {
    let urlStr;
    try {
      urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : String(url));
    } catch {
      return originalFetchFn(url, options);
    }
    let classifier;
    try { classifier = classify(urlStr); } catch { classifier = null; }
    if (!classifier) return originalFetchFn(url, options);
    try {
      if (policy.loaded && !policy.disabled) return originalFetchFn(url, options);
      const body = options && options.body ? options.body : '';
      let recipients = [];
      try { recipients = classifier.extractRecipients(body) || []; } catch { recipients = []; }
      if (recipients.length === 0) {
        const reason = policy.loaded ? 'no_recipients_extractable' : 'policy_not_loaded_fail_closed';
        logBlock(classifier.name, urlStr, [], reason, callsiteHint());
        return buildBlockedResponse(classifier.name, [], reason);
      }
      const allPermitted = recipients.every(r => isRecipientPermitted(r, classifier.recipientType));
      if (allPermitted) return originalFetchFn(url, options);
      const reason = policy.loaded ? 'recipient_not_in_permitted_set' : 'policy_not_loaded_fail_closed';
      logBlock(classifier.name, urlStr, recipients, reason, callsiteHint());
      return buildBlockedResponse(classifier.name, recipients, reason);
    } catch (guardErr) {
      try { console.error('[EGRESS-GUARD] internal error, falling through:', guardErr.message); } catch {}
      return originalFetchFn(url, options);
    }
  };
  guarded.__egressGuarded = true;
  return guarded;
}

async function loadPolicy() {
  policy.loadAttempted = true;
  try {
    const SUPA_URL = process.env.SUPABASE_URL || 'https://htlxjkbrstpwwtzsbyvb.supabase.co';
    const SUPA_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    if (!SUPA_KEY) {
      policy.loadError = 'no_supabase_key';
      console.warn('[EGRESS-GUARD] FAIL-CLOSED: no SUPABASE key in env');
      return;
    }
    const fetchFn = originalNodeFetch || originalGlobalFetch || global.fetch;
    if (!fetchFn) {
      policy.loadError = 'no_fetch_available';
      return;
    }
    const cfgRes = await fetchFn(
      `${SUPA_URL}/rest/v1/aba_memory?source=eq.config.legacy_egress_policy&select=content&limit=1`,
      { headers: { apikey: SUPA_KEY } }
    );
    if (!cfgRes.ok) {
      policy.loadError = `config_fetch_${cfgRes.status}`;
      console.warn(`[EGRESS-GUARD] FAIL-CLOSED: config fetch returned ${cfgRes.status}`);
      return;
    }
    const cfgRows = await cfgRes.json();
    if (!cfgRows || cfgRows.length === 0) {
      policy.loadError = 'no_config_row';
      console.warn('[EGRESS-GUARD] FAIL-CLOSED: config.legacy_egress_policy row not found');
      return;
    }
    const cfg = typeof cfgRows[0].content === 'string' ? JSON.parse(cfgRows[0].content) : cfgRows[0].content;
    policy.disabled = cfg.disabled !== false;
    const trustLevels = (cfg.owner_resolution && cfg.owner_resolution.trust_levels) || ['T10'];

    const profilesRes = await fetchFn(
      `${SUPA_URL}/rest/v1/aba_memory?memory_type=eq.ham_profile&select=source,content&limit=50`,
      { headers: { apikey: SUPA_KEY } }
    );
    const profileRows = profilesRes.ok ? await profilesRes.json() : [];

    const emails = new Set();
    const phones = new Set();
    const ownerIds = new Set();
    for (const row of (profileRows || [])) {
      try {
        const profile = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
        if (!profile || !trustLevels.includes(profile.trust_level)) continue;
        const hamId = (row.source || '').replace('ham.profile.', '');
        if (hamId) ownerIds.add(hamId);
        if (profile.email) emails.add(String(profile.email).toLowerCase().trim());
        if (Array.isArray(profile.email_aliases)) for (const e of profile.email_aliases) emails.add(String(e).toLowerCase().trim());
        if (Array.isArray(profile.emails)) for (const e of profile.emails) emails.add(String(e).toLowerCase().trim());
        if (profile.phone) {
          const p = String(profile.phone).trim();
          phones.add(p); phones.add(p.replace(/[^\d+]/g, ''));
        }
        if (Array.isArray(profile.phones)) for (const p of profile.phones) {
          phones.add(String(p).trim()); phones.add(String(p).replace(/[^\d+]/g, ''));
        }
      } catch { /* skip */ }
    }

    policy.permittedRecipientEmails = emails;
    policy.permittedRecipientPhones = phones;
    policy.ownerHamIds = ownerIds;
    policy.loaded = true;
    policy.loadError = null;
    policy.loadedAt = new Date().toISOString();

    console.log(`[EGRESS-GUARD] policy loaded: disabled=${policy.disabled}, owner_hams=${ownerIds.size}, emails=${emails.size}, phones=${phones.size}`);
  } catch (err) {
    policy.loadError = err.message;
    console.error('[EGRESS-GUARD] loadPolicy failed (staying fail-closed):', err.message);
  }
}

function install() {
  if (installed) return;
  installed = true;

  const origRequire = Module.prototype.require;
  Module.prototype.require = function legacyEgressGuardedRequire(id) {
    const result = origRequire.apply(this, arguments);
    try {
      if ((id === 'node-fetch' || id === 'undici') && typeof result === 'function' && !result.__egressGuarded) {
        if (!ResponseCtor && result.Response) ResponseCtor = result.Response;
        if (!originalNodeFetch) originalNodeFetch = result;
        const wrapped = makeGuardedFetch(result);
        for (const k of Object.keys(result)) {
          try { wrapped[k] = result[k]; } catch {}
        }
        wrapped.default = wrapped;
        return wrapped;
      }
    } catch {}
    return result;
  };

  if (typeof global.fetch === 'function' && !global.fetch.__egressGuarded) {
    if (!ResponseCtor && typeof global.Response !== 'undefined') ResponseCtor = global.Response;
    originalGlobalFetch = global.fetch;
    global.fetch = makeGuardedFetch(global.fetch);
  }

  loadPolicy().catch(err => {
    try { console.error('[EGRESS-GUARD] async loadPolicy threw:', err.message); } catch {}
  });

  try {
    process.on('SIGHUP', () => {
      console.log('[EGRESS-GUARD] SIGHUP received — refreshing policy');
      loadPolicy().catch(err => console.error('[EGRESS-GUARD] SIGHUP refresh failed:', err.message));
    });
  } catch {}

  console.log('[EGRESS-GUARD] installed (fail-closed until policy loads)');
}

function status() {
  return {
    installed,
    policy_loaded: policy.loaded,
    policy_disabled: policy.disabled,
    policy_load_error: policy.loadError,
    policy_loaded_at: policy.loadedAt,
    owner_hams: Array.from(policy.ownerHamIds),
    permitted_email_count: policy.permittedRecipientEmails.size,
    permitted_phone_count: policy.permittedRecipientPhones.size,
    classifiers: CLASSIFIERS.map(c => c.name),
    service: 'reach-services',
  };
}

module.exports = { install, loadPolicy, status, _internal: { policy, classify, makeGuardedFetch } };
