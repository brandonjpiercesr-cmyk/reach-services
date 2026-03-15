// ⬡B:reach.voice.speech_id:MODULE:name_extraction:v1.0:20260315⬡
// Phase 8: Voice ID by Speech
// When a caller says "Hey ABA this is BJ" from an unknown number,
// extract the name from speech and match to HAM (Human ABA Master) profile in brain.
//
// This module exports a function that CONTACT_REGISTRY lookup falls back to
// when phone number is not recognized.

const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://htlxjkbrstpwwtzsbyvb.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MzI4MjEsImV4cCI6MjA4NjEwODgyMX0.MOgNYkezWpgxTO3ZHd0omZ0WLJOOR-tL7hONXWG9eBw';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDUzMjgyMSwiZXhwIjoyMDg2MTA4ODIxfQ.G55zXnfanoUxRAoaYz-tD9FDJ53xHH-pRgDrKss_Iqo';

// ═══════════════════════════════════════════════════════════════════════════
// NAME EXTRACTION PATTERNS
// Handles: "This is BJ", "Hey ABA it's CJ", "My name is Dwayne", etc.
// ═══════════════════════════════════════════════════════════════════════════

const NAME_PATTERNS = [
  // "this is [name]"
  /(?:this is|it's|it is|i'm|i am|my name is|name's|they call me)\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+)?)/i,
  // "hey aba [name] here"
  /(?:hey aba|hi aba|yo aba)\s+(?:this is\s+)?([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+)?)\s+here/i,
  // "[name] here" at start of utterance
  /^([a-z][a-z'-]+)\s+here\b/i,
  // "it's [name]" standalone
  /^(?:it's|it is)\s+([a-z][a-z'-]+)/i,
];

// Known nicknames / aliases to canonical names
const NAME_ALIASES = {
  'bj': 'bj',
  'b.j.': 'bj',
  'bryan': 'bj',
  'bryan jr': 'bj',
  'cj': 'cj',
  'c.j.': 'cj',
  'charles': 'cj',
  'vante': 'vante',
  'devante': 'vante',
  'dwayne': 'dwayne',
  'murray': 'dwayne',
  'brandon': 'brandon',
  'boss': 'brandon',
  'eric': 'eric',
  'dr eric': 'eric',
  'dr. eric': 'eric',
  'doc': 'eric',
  'raquel': 'raquel',
  'bethany': 'bethany',
};

/**
 * Extract a name from speech text
 * @param {string} speechText - The transcribed speech
 * @returns {string|null} - Extracted name or null
 */
function extractNameFromSpeech(speechText) {
  if (!speechText || typeof speechText !== 'string') return null;

  const text = speechText.trim().toLowerCase();

  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim().toLowerCase();
      // Check aliases first
      if (NAME_ALIASES[extracted]) return NAME_ALIASES[extracted];
      // Check if first word is an alias
      const firstWord = extracted.split(/\s+/)[0];
      if (NAME_ALIASES[firstWord]) return NAME_ALIASES[firstWord];
      // Return raw extracted name
      return extracted;
    }
  }

  return null;
}

/**
 * Look up a HAM (Human ABA Master) profile by name in the brain
 * @param {string} name - The name to look up (could be nickname or canonical)
 * @returns {object|null} - Profile object or null
 */
async function lookupHAMByName(name) {
  if (!name) return null;

  const canonical = NAME_ALIASES[name.toLowerCase()] || name.toLowerCase();

  try {
    // Search ham_profile by source pattern
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/aba_memory?memory_type=eq.ham_profile&source=ilike.ham.profile.${canonical}*&select=content,source&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON } }
    );

    if (profileRes.ok) {
      const profiles = await profileRes.json();
      if (profiles && profiles.length > 0) {
        const profile = typeof profiles[0].content === 'string'
          ? JSON.parse(profiles[0].content)
          : profiles[0].content;
        console.log(`[VOICE:SPEECH_ID] Matched "${name}" to HAM profile: ${profiles[0].source}`);
        return {
          ...profile,
          userId: canonical,
          matchedBy: 'speech',
          matchedName: name
        };
      }
    }

    // Fallback: search team_profile by tag
    const teamRes = await fetch(
      `${SUPABASE_URL}/rest/v1/aba_memory?memory_type=eq.team_profile&tags=cs.{${canonical}}&select=content,source&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON } }
    );

    if (teamRes.ok) {
      const teams = await teamRes.json();
      if (teams && teams.length > 0) {
        console.log(`[VOICE:SPEECH_ID] Matched "${name}" to team profile: ${teams[0].source}`);
        const parts = (teams[0].content || '').split('|').map(p => p.trim());
        return {
          name: parts[0]?.replace('TEAM MEMBER:', '').trim() || name,
          title: parts[1] || '',
          email: parts[2] || '',
          location: parts[3] || '',
          role: parts[4] || '',
          userId: canonical,
          matchedBy: 'speech',
          matchedName: name
        };
      }
    }

    // Fallback: full text search across brain
    const fullRes = await fetch(
      `${SUPABASE_URL}/rest/v1/aba_memory?memory_type=in.(ham_profile,team_profile,awa_profile)&content=ilike.*${canonical}*&select=content,source,memory_type&limit=3`,
      { headers: { 'apikey': SUPABASE_ANON } }
    );

    if (fullRes.ok) {
      const results = await fullRes.json();
      if (results && results.length > 0) {
        const best = results[0];
        const profile = typeof best.content === 'string' ? JSON.parse(best.content) : best.content;
        console.log(`[VOICE:SPEECH_ID] Fuzzy matched "${name}" via ${best.memory_type}: ${best.source}`);
        return {
          ...profile,
          userId: canonical,
          matchedBy: 'speech_fuzzy',
          matchedName: name
        };
      }
    }

    console.log(`[VOICE:SPEECH_ID] No match found for "${name}"`);
    return null;

  } catch (err) {
    console.error(`[VOICE:SPEECH_ID] Lookup error:`, err.message);
    return null;
  }
}

/**
 * Write a voice identification event to brain (feeds proactive engine)
 * @param {string} name - Identified name
 * @param {string} phone - Phone number used
 * @param {string} method - 'phone' or 'speech'
 */
async function writeVoiceIdEvent(name, phone, method) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        content: `Voice call identified: ${name} via ${method}${phone ? ` from ${phone}` : ''}`,
        memory_type: 'voice_identification',
        source: `voice.id.${method}.${Date.now()}`,
        user_id: name,
        importance: 4,
        is_system: true,
        tags: ['voice', 'identification', method, name]
      })
    });
  } catch (err) {
    console.error('[VOICE:SPEECH_ID] Failed to write event:', err.message);
  }
}

/**
 * Main entry point: identify caller from speech when phone lookup fails
 * Called by the voice handler in worker.js after CONTACT_REGISTRY miss
 *
 * @param {string} speechText - First utterance from the caller
 * @param {string} phoneNumber - The phone number (for logging)
 * @returns {object|null} - { name, role, trust, access, promptAddon, userId } or null
 */
async function identifyCallerBySpeech(speechText, phoneNumber) {
  const extractedName = extractNameFromSpeech(speechText);
  if (!extractedName) {
    console.log(`[VOICE:SPEECH_ID] No name found in speech: "${(speechText || '').substring(0, 100)}"`);
    return null;
  }

  console.log(`[VOICE:SPEECH_ID] Extracted name "${extractedName}" from speech`);

  const profile = await lookupHAMByName(extractedName);
  if (!profile) return null;

  // Write identification event to brain
  await writeVoiceIdEvent(extractedName, phoneNumber, 'speech');

  // Build caller identity compatible with CONTACT_REGISTRY format
  return {
    name: profile.name || extractedName,
    role: profile.role || 'team',
    trust: profile.trust || 'T7',
    access: profile.access || 'limited',
    userId: profile.userId || extractedName,
    promptAddon: profile.promptAddon || `This caller identified themselves as ${profile.name || extractedName} via voice. They were not in the phone registry. Verify identity naturally in conversation before sharing sensitive information.`,
    matchedBy: profile.matchedBy || 'speech',
    phone: phoneNumber
  };
}

module.exports = {
  extractNameFromSpeech,
  lookupHAMByName,
  identifyCallerBySpeech,
  writeVoiceIdEvent,
  NAME_ALIASES,
  NAME_PATTERNS
};
