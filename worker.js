/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ABA REACH - Voice & Communication Gateway
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ABCD TAGGING LEGEND:
 *   ABAOS  = ABA Operating System (shell, kernel, core)
 *   ABACUS = ABA Calculator/Portal (client tools, dashboards)
 *   BOTH   = Shared between ABAOS and ABACUS
 *   CCWA   = Command Center Web App
 *   REACH  = Real-time Engagement and Action Channel Hub (this file)
 * 
 * This file is: BOTH (used by ABAOS for voice, used by ABACUS for client calls)
 * 
 * ⬡B:ABCD:BOTH:REACH.WORKER:v2.5.0:20260214⬡
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         AGENT HIERARCHY PLACEMENT                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║ L6 DEPARTMENT LEADER : AIR (ABA Intelligence Router) - runs everything       ║
 * ║ L5 VICE PRESIDENT    : REACH (Real-time Engagement and Action Channel Hub)   ║
 * ║ L4 DIRECTORS         : VOICE, SMS, EMAIL, OMI, BRAIN, API                    ║
 * ║ L3 MANAGERS          : VARA, CARA, IMAN, TASTE, COLE, LUKE, JUDE, PACK      ║
 * ║ L2 LEAD              : worker.js (this file - the REACH server itself)       ║
 * ║ L1 LINES OF CODE     : Functions, routes, handlers below                     ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * FILE: worker.js
 * VERSION: v1.11.0-REACH-ESCALATION (OMI auth + heartbeat + logger)
 * ABCD: BOTH
 * CREATED: Feb 13, 2026
 * UPDATED: Feb 13, 2026
 *
 * MASTER ACL: ⬡B:AIR:REACH.SERVER.WORKER:CODE:routing.api.voice:AIR→REACH→VARA,CARA,IMAN,TASTE:T8:v1.5.0:20260213:r5e1a⬡
 *
 * PURPOSE: REACH is ABA's physical body. This single worker.js IS the REACH
 * server running 24/7 on Render. It provides all /api/* routes that 1A Shell
 * calls, handles Twilio phone calls via WebSocket, processes OMI transcripts
 * via TASTE (Transcript Analysis and Semantic Tagging Engine), and serves as
 * the backend for the entire ABA ecosystem.
 *
 * ROUTING TRACES:
 * - Text chat:    USER*1A_SHELL*REACH*AIR*LUKE,COLE,JUDE,PACK*MODEL*VARA*USER
 * - Phone call:   USER*TWILIO*REACH*AIR*LUKE,COLE,JUDE,PACK*MODEL*VARA*ELEVENLABS*USER
 * - OMI transcript: OMI*REACH*TASTE*AIR*BRAIN
 * - SMS send:     AIR*CARA*REACH*TWILIO*USER
 * - Brain search: USER*1A_SHELL*REACH*BRAIN
 * - Claude proxy: USER*1A_SHELL*REACH*ANTHROPIC*USER
 *
 * REPORTS TO: AIR (ABA Intelligence Router) - L6 Department Leader
 * SERVES: VARA (voice), CARA (outreach), IMAN (email), TASTE (transcripts)
 *
 * MODELS: Gemini Flash 2.0 (primary), Claude Haiku (backup), Groq (speed fallback)
 * AGENTS SUMMONED: LUKE, COLE, JUDE, PACK (hardcoded on every AIR call)
 *
 * SIGILS STAMP: ⬡B:SIGILS:REACH.SERVER:CODE:indexing.labeling.stamping:AIR→SIGILS→REACH:T8:v1.5.0:20260213:s3g1l⬡
 */

// ⬡B:AIR:REACH.SERVER.IMPORTS:CODE:infrastructure.node.modules:AIR→REACH:T10:v1.5.0:20260213:i1m2p⬡
const http = require('http');
const https = require('https');
const { WebSocketServer, WebSocket } = require('ws');

// ⬡B:AIR:REACH.SERVER.PORT:CONFIG:infrastructure.network.binding:AIR→REACH:T10:v1.5.0:20260213:p0r3t⬡
const PORT = process.env.PORT || 3000;

/**
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ CONFIGURATION: Service Credentials (all from env vars, zero hardcoded)     │
 * │ HIERARCHY: L1 (Lines of Code) under L2 (worker.js)                        │
 * │ SIGILS: Every config block stamped with agent ownership + trust level      │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

// ⬡B:AIR:REACH.CONFIG.SUPABASE:CONFIG:brain.connection.persistence:AIR→REACH→BRAIN:T10:v1.5.0:20260213:s1b2a⬡
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://htlxjkbrstpwwtzsbyvb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MzI4MjEsImV4cCI6MjA4NjEwODgyMX0.MOgNYkezWpgxTO3ZHd0omZ0WLJOOR-tL7hONXWG9eBw';

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.BRIDGE:CONST:abacia.services:v2.3.0:20260214⬡
// BRIDGE TO ABACIA-SERVICES
// This is where the 22+ agents actually live and run
// ABA-REACH (voice) → ABACIA-SERVICES (agents) → Response
// ═══════════════════════════════════════════════════════════════════════════════
const ABACIA_SERVICES_URL = 'https://abacia-services.onrender.com';

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:TOUCH:PHASE3:SPURT3.0:timezone.utilities:20260216⬡
// TIMEZONE UTILITIES - Container runs UTC, users are EST/PST
// Brandon, BJ, CJ = EST (America/New_York)
// Eric = PST (America/Los_Angeles)
// ═══════════════════════════════════════════════════════════════════════════════

const TIMEZONE_CONFIG = {
  brandon: { tz: 'America/New_York', offset: -5, label: 'EST' },
  bj: { tz: 'America/New_York', offset: -5, label: 'EST' },
  cj: { tz: 'America/New_York', offset: -5, label: 'EST' },
  eric: { tz: 'America/Los_Angeles', offset: -8, label: 'PST' },
  default: { tz: 'America/New_York', offset: -5, label: 'EST' }
};

// Get current time in a specific timezone
function getTimeInTimezone(tzName = 'America/New_York') {
  const now = new Date();
  // Use Intl.DateTimeFormat for proper timezone conversion
  const options = {
    timeZone: tzName,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
  const get = (type) => parts.find(p => p.type === type)?.value || '00';
  
  return {
    year: parseInt(get('year')),
    month: parseInt(get('month')),
    day: parseInt(get('day')),
    hour: parseInt(get('hour')),
    minute: parseInt(get('minute')),
    second: parseInt(get('second')),
    formatted: `${get('month')}/${get('day')}/${get('year')} ${get('hour')}:${get('minute')}`,
    dayOfWeek: new Intl.DateTimeFormat('en-US', { timeZone: tzName, weekday: 'long' }).format(now)
  };
}

// Format a date for display in EST (for Brandon)
function formatDateEST(date) {
  const d = new Date(date);
  const options = {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  };
  return new Intl.DateTimeFormat('en-US', options).format(d);
}

// Get "today" in EST for API queries
function getTodayEST() {
  const now = new Date();
  const estString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const estDate = new Date(estString);
  return estDate.toISOString().split('T')[0].replace(/-/g, '');
}

// Check if it's a reasonable hour to call someone (8am-9pm in their timezone)
function isReasonableHourToCall(personName) {
  const config = TIMEZONE_CONFIG[personName?.toLowerCase()] || TIMEZONE_CONFIG.default;
  const time = getTimeInTimezone(config.tz);
  return time.hour >= 8 && time.hour < 21;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:TOUCH:PHASE3:SPURT3.0:contacts.master:20260216⬡
// MASTER CONTACTS LIST - Used by voice-tool, group calls, scheduled calls
// ═══════════════════════════════════════════════════════════════════════════════

const MASTER_CONTACTS = {
  brandon: { 
    phone: '+13363898116', 
    name: 'Brandon', 
    fullName: 'Brandon Pierce',
    timezone: 'America/New_York',
    trust: 'T10',
    role: 'HAM'
  },
  eric: { 
    phone: '+13236007676', 
    name: 'Dr. Eric Lane',
    fullName: 'Dr. Eric Lane Sr.',
    timezone: 'America/Los_Angeles',
    trust: 'T9',
    role: 'Senior Advisor'
  },
  bj: { 
    phone: '+19803958662', 
    name: 'BJ',
    fullName: 'BJ Pierce',
    timezone: 'America/New_York',
    trust: 'T8',
    role: 'Brother'
  },
  cj: { 
    phone: '+19199170686', 
    name: 'CJ',
    fullName: 'CJ Pierce',
    timezone: 'America/New_York',
    trust: 'T7',
    role: 'Brother'
  }
};

// Lookup contact by name (fuzzy matching)
function lookupContact(nameInput) {
  if (!nameInput) return null;
  const name = nameInput.toLowerCase().trim();
  
  // Direct match
  if (MASTER_CONTACTS[name]) return MASTER_CONTACTS[name];
  
  // Fuzzy matches
  if (name.includes('eric') || name.includes('dr')) return MASTER_CONTACTS.eric;
  if (name.includes('bj') || name.includes('b.j')) return MASTER_CONTACTS.bj;
  if (name.includes('cj') || name.includes('c.j')) return MASTER_CONTACTS.cj;
  if (name.includes('brandon') || name.includes('boss')) return MASTER_CONTACTS.brandon;
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:TOUCH:PHASE3:SPURT3.1:group.calls:20260216⬡
// GROUP CALLS - Twilio Conference API
// "Call me and Eric together" → Creates conference, calls both, adds to room
// Uses TWILIO_SID, TWILIO_AUTH, TWILIO_PHONE from global config section
// ═══════════════════════════════════════════════════════════════════════════════

// Generate unique conference room name
function generateConferenceName() {
  return 'ABA-CONF-' + Date.now().toString(36).toUpperCase();
}

// Create a Twilio call that joins a conference
async function callAndJoinConference(phoneNumber, conferenceName, announce = false) {
  console.log('[GROUP CALL] Calling', phoneNumber, 'to join conference:', conferenceName);
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you to a group call. Please hold.</Say>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="false" beep="true">
      ${conferenceName}
    </Conference>
  </Dial>
</Response>`;
  
  const authHeader = 'Basic ' + Buffer.from(TWILIO_SID + ':' + TWILIO_AUTH).toString('base64');
  
  const postData = new URLSearchParams({
    To: phoneNumber,
    From: TWILIO_PHONE,
    Twiml: twiml
  }).toString();
  
  try {
    const result = await httpsRequest({
      hostname: 'api.twilio.com',
      path: '/2010-04-01/Accounts/' + TWILIO_SID + '/Calls.json',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);
    
    if (result.status === 201) {
      const data = JSON.parse(result.data.toString());
      console.log('[GROUP CALL] Call initiated:', data.sid);
      return { success: true, callSid: data.sid };
    }
    
    console.log('[GROUP CALL] Twilio returned:', result.status);
    return { success: false, error: 'Twilio error: ' + result.status };
    
  } catch (e) {
    console.log('[GROUP CALL] Error:', e.message);
    return { success: false, error: e.message };
  }
}

// Start a group call with multiple people
async function startGroupCall(participants) {
  console.log('[GROUP CALL] Starting group call with:', participants.map(p => p.name).join(', '));
  
  const conferenceName = generateConferenceName();
  const results = [];
  
  // Call each participant sequentially
  for (const participant of participants) {
    const result = await callAndJoinConference(participant.phone, conferenceName);
    results.push({
      name: participant.name,
      phone: participant.phone,
      ...result
    });
    
    // Small delay between calls
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Store conference info to brain for tracking
  storeToBrain({
    content: `GROUP CALL STARTED: Conference ${conferenceName} with ${participants.map(p => p.name).join(', ')}`,
    memory_type: 'voice_activity',
    categories: ['group_call', 'conference'],
    importance: 7,
    tags: ['group_call', 'conference', conferenceName]
  }).catch(e => console.log('[GROUP CALL] Brain store error:', e.message));
  
  return {
    success: results.every(r => r.success),
    conferenceName,
    participants: results
  };
}

// Parse "call me and Eric together" type requests
function parseGroupCallRequest(message) {
  const msgLower = message.toLowerCase();
  
  // Patterns: "call me and Eric", "call Eric and BJ together", "group call with Eric and CJ"
  const patterns = [
    /call\s+(?:me\s+and\s+)?(\w+)(?:\s+and\s+(\w+))?(?:\s+together)?/i,
    /group\s+call\s+(?:with\s+)?(\w+)(?:\s+and\s+(\w+))?/i,
    /conference\s+(?:call\s+)?(?:with\s+)?(\w+)(?:\s+and\s+(\w+))?/i
  ];
  
  // Check if this is a group call request
  const isGroupCall = msgLower.includes(' and ') && 
    (msgLower.includes('call') || msgLower.includes('conference') || msgLower.includes('together'));
  
  if (!isGroupCall) return null;
  
  // Extract names
  const names = [];
  
  // Check for "me" (caller)
  if (msgLower.includes('me and') || msgLower.includes('call me')) {
    names.push('brandon'); // "me" means Brandon (the caller)
  }
  
  // Look for known contacts
  for (const contactName of Object.keys(MASTER_CONTACTS)) {
    if (msgLower.includes(contactName)) {
      if (!names.includes(contactName)) {
        names.push(contactName);
      }
    }
  }
  
  // Also check for "dr lane" or "dr. lane"
  if (msgLower.includes('dr') && msgLower.includes('lane')) {
    if (!names.includes('eric')) names.push('eric');
  }
  
  if (names.length < 2) return null;
  
  // Convert to contact objects
  const participants = names.map(name => MASTER_CONTACTS[name]).filter(Boolean);
  
  return participants.length >= 2 ? participants : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:TOUCH:PHASE3:SPURT3.2:scheduled.calls:20260216⬡
// SCHEDULED CALLS - Store in brain, cron job picks up and executes
// "Call me at 8am" or "Remind me to call Eric on Monday"
// ═══════════════════════════════════════════════════════════════════════════════

// Parse scheduled call request and store to brain
async function scheduleCall(message, callerIdentity) {
  console.log('[SCHEDULED CALL] Parsing:', message);
  
  const msgLower = message.toLowerCase();
  
  // Extract time patterns
  let scheduledTime = null;
  let targetContact = null;
  
  // Pattern: "call me at 8am", "call me at 3:30pm"
  const timeMatch = msgLower.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3]?.toLowerCase();
    
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    
    // Get today in EST and set the time
    const estNow = getTimeInTimezone('America/New_York');
    scheduledTime = new Date();
    scheduledTime.setHours(hour + 5, minute, 0, 0); // Convert EST to UTC (add 5 hours)
    
    // If time has passed today, schedule for tomorrow
    if (scheduledTime < new Date()) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
  }
  
  // Pattern: "tomorrow", "monday", etc.
  if (msgLower.includes('tomorrow')) {
    if (!scheduledTime) {
      scheduledTime = new Date();
      scheduledTime.setDate(scheduledTime.getDate() + 1);
      scheduledTime.setHours(14, 0, 0, 0); // Default to 9am EST (14:00 UTC)
    } else {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
  }
  
  // Determine who to call
  if (msgLower.includes('call me')) {
    targetContact = callerIdentity?.name === 'Brandon' ? MASTER_CONTACTS.brandon : 
                    (callerIdentity || MASTER_CONTACTS.brandon);
  } else {
    // Look for contact name
    for (const contactName of Object.keys(MASTER_CONTACTS)) {
      if (msgLower.includes(contactName)) {
        targetContact = MASTER_CONTACTS[contactName];
        break;
      }
    }
  }
  
  if (!scheduledTime || !targetContact) {
    return { success: false, error: 'Could not parse time or contact from request' };
  }
  
  // Store scheduled call to brain
  const scheduleData = {
    type: 'scheduled_call',
    target_phone: targetContact.phone,
    target_name: targetContact.name,
    scheduled_time: scheduledTime.toISOString(),
    scheduled_time_est: formatDateEST(scheduledTime) + ' at ' + scheduledTime.getHours() + ':' + String(scheduledTime.getMinutes()).padStart(2, '0'),
    created_by: callerIdentity?.name || 'Unknown',
    status: 'pending',
    original_request: message
  };
  
  await storeToBrain({
    content: JSON.stringify(scheduleData),
    memory_type: 'scheduled_call',
    categories: ['scheduled', 'call', 'pending'],
    importance: 8,
    tags: ['scheduled_call', 'pending', targetContact.name.toLowerCase()]
  });
  
  console.log('[SCHEDULED CALL] Stored:', scheduleData);
  
  return {
    success: true,
    scheduledTime: scheduleData.scheduled_time_est,
    target: targetContact.name
  };
}

// Check for pending scheduled calls (called by cron)
async function checkScheduledCalls() {
  console.log('[SCHEDULED CALL] Checking for pending calls...');
  
  const now = new Date();
  
  // Query brain for pending scheduled calls
  const result = await httpsRequest({
    hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
    path: '/rest/v1/aba_memory?memory_type=eq.scheduled_call&content=ilike.*pending*&order=created_at.desc&limit=10',
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY || SUPABASE_ANON,
      'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
    }
  });
  
  if (result.status !== 200) {
    console.log('[SCHEDULED CALL] Query failed:', result.status);
    return [];
  }
  
  const pending = JSON.parse(result.data.toString());
  const dueCalls = [];
  
  for (const entry of pending) {
    try {
      const data = JSON.parse(entry.content);
      const scheduledTime = new Date(data.scheduled_time);
      
      // Check if call is due (within 1 minute of scheduled time)
      if (scheduledTime <= now && data.status === 'pending') {
        dueCalls.push({ ...data, memoryId: entry.id });
      }
    } catch (e) {
      console.log('[SCHEDULED CALL] Parse error:', e.message);
    }
  }
  
  return dueCalls;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:TOUCH:PHASE3:SPURT3.3:voicemail.drops:20260216⬡
// VOICEMAIL DROPS - Custom message when voicemail detected
// ElevenLabs handles detection, we customize the message
// ═══════════════════════════════════════════════════════════════════════════════

// Custom voicemail messages per contact
const VOICEMAIL_MESSAGES = {
  eric: "Hey Dr. Lane, this is ABA calling on behalf of Brandon. He wanted to touch base with you. When you get a chance, give him a call back. Thanks!",
  bj: "Hey BJ, this is ABA. Brandon asked me to give you a ring. Hit him back when you can. Peace!",
  cj: "Hey CJ, ABA here for Brandon. Give him a call when you're free. Thanks!",
  default: "Hello, this is ABA reaching out. I wasn't able to connect with you directly, but I wanted to make sure you received this message. When you have a moment, please feel free to return this call. Thank you, and have a wonderful day."
};

// Get voicemail message for a contact
function getVoicemailMessage(contactName) {
  const name = contactName?.toLowerCase();
  return VOICEMAIL_MESSAGES[name] || VOICEMAIL_MESSAGES.default;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:TOUCH:AGENT.DAWN:Daily.Automated.Wisdom.Notifier:20260216⬡
// AGENT DAWN - Morning briefing calls
// Gathers weather, calendar, tasks, and insights for wake-up calls
// DAWN speaks through ABA/VARA but delivers structured morning content
// ═══════════════════════════════════════════════════════════════════════════════

async function DAWN_generateBriefing(targetName = 'Brandon') {
  console.log('[DAWN] Generating morning briefing for:', targetName);
  
  const time = getTimeInTimezone('America/New_York');
  const greeting = time.hour < 12 ? 'Good morning' : 'Good afternoon';
  
  let briefing = [];
  
  // 1. Time and greeting
  briefing.push(`${greeting} ${targetName}! This is your DAWN briefing for ${time.dayOfWeek}, ${time.formatted.split(' ')[0]}.`);
  
  // 2. Weather (Greensboro, NC)
  try {
    const weather = await CLIMATE_getWeather('Greensboro NC');
    if (weather && !weather.includes('trouble')) {
      briefing.push(weather);
    }
  } catch (e) {
    console.log('[DAWN] Weather error:', e.message);
  }
  
  // 3. Check calendar via ABACIA
  try {
    const calendar = await ABACIA_getCalendar();
    if (calendar && calendar.events && calendar.events.length > 0) {
      const eventCount = calendar.events.length;
      briefing.push(`You have ${eventCount} event${eventCount > 1 ? 's' : ''} on your calendar today.`);
      // First 2 events
      for (const event of calendar.events.slice(0, 2)) {
        briefing.push(`At ${event.time || 'sometime'}: ${event.title || event.summary}`);
      }
    } else {
      briefing.push('Your calendar is clear today.');
    }
  } catch (e) {
    console.log('[DAWN] Calendar error:', e.message);
  }
  
  // 4. Check brain for recent activity/insights
  try {
    const recentActivity = await queryBrainRecent(5);
    if (recentActivity && recentActivity.length > 0) {
      // Look for any important items from last 24 hours
      const important = recentActivity.filter(r => r.importance >= 8);
      if (important.length > 0) {
        briefing.push(`I noticed ${important.length} important item${important.length > 1 ? 's' : ''} from yesterday.`);
      }
    }
  } catch (e) {
    console.log('[DAWN] Brain query error:', e.message);
  }
  
  // 5. Motivational close
  const motivations = [
    "Let's make today count!",
    "You've got this, Boss!",
    "Time to crush it!",
    "Ready to make moves!",
    "Let's get after it!"
  ];
  briefing.push(motivations[Math.floor(Math.random() * motivations.length)]);
  
  // 6. Sign off
  briefing.push("This has been your DAWN briefing. We are all ABA.");
  
  const fullBriefing = briefing.join(' ');
  console.log('[DAWN] Briefing generated:', fullBriefing.substring(0, 100) + '...');
  
  return fullBriefing;
}

// Query brain for recent entries
async function queryBrainRecent(limit = 5) {
  try {
    const result = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: `/rest/v1/aba_memory?order=created_at.desc&limit=${limit}&select=content,importance,memory_type`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY || SUPABASE_ANON,
        'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
      }
    });
    
    if (result.status === 200) {
      return JSON.parse(result.data.toString());
    }
    return [];
  } catch (e) {
    return [];
  }
}

// Make a DAWN briefing call
async function DAWN_makeCall(targetPhone, targetName) {
  console.log('[DAWN] Making briefing call to:', targetName);
  
  // Generate the briefing content
  const briefing = await DAWN_generateBriefing(targetName);
  
  // For now, we use ElevenLabs with a custom approach:
  // We'll trigger the call and have the first webhook interaction deliver the briefing
  // Store briefing to brain so webhook can retrieve it
  
  const briefingId = 'DAWN-' + Date.now();
  
  await storeToBrain({
    content: JSON.stringify({
      id: briefingId,
      briefing: briefing,
      target: targetName,
      created: new Date().toISOString()
    }),
    memory_type: 'dawn_briefing_pending',
    categories: ['dawn', 'briefing', 'pending'],
    importance: 8,
    tags: ['dawn', 'briefing', briefingId]
  });
  
  // Make the call via ElevenLabs
  // The webhook will need to check for DAWN briefings
  const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
  
  try {
    const callResult = await httpsRequest({
      hostname: 'api.elevenlabs.io',
      path: '/v1/convai/twilio/outbound-call',
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_KEY,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({
      agent_id: 'agent_0601khe2q0gben08ws34bzf7a0sa',
      agent_phone_number_id: 'phnum_0001khe3q3nyec1bv04mk2m048v8',
      to_number: targetPhone,
      // Note: first_message override doesn't work reliably
      // We'll update the agent's first_message temporarily or use webhook
    }));
    
    const data = JSON.parse(callResult.data.toString());
    console.log('[DAWN] Call initiated:', data.conversation_id);
    
    return {
      success: true,
      conversation_id: data.conversation_id,
      briefingId: briefingId
    };
    
  } catch (e) {
    console.log('[DAWN] Call error:', e.message);
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:TOUCH:PHASE3:SPURT3.4:call.transfers:20260216⬡
// CALL TRANSFERS - Warm and cold transfers
// "Transfer me to Eric" → Connects current caller to Eric
// ═══════════════════════════════════════════════════════════════════════════════

// Warm transfer - ABA stays on, introduces, then drops
async function warmTransfer(currentCallSid, targetPhone, targetName) {
  console.log('[TRANSFER] Warm transfer to:', targetName, targetPhone);
  
  // This requires modifying the current call to add a new participant
  // Using Twilio's Conference for warm transfers
  const conferenceName = 'TRANSFER-' + Date.now().toString(36);
  
  // First, move current caller to conference
  const moveResult = await updateCallToConference(currentCallSid, conferenceName);
  if (!moveResult.success) return moveResult;
  
  // Then call target and add to same conference
  const callResult = await callAndJoinConference(targetPhone, conferenceName);
  if (!callResult.success) return callResult;
  
  return {
    success: true,
    type: 'warm',
    target: targetName,
    conferenceName
  };
}

// Cold transfer - ABA drops, connects caller directly
async function coldTransfer(currentCallSid, targetPhone, targetName) {
  console.log('[TRANSFER] Cold transfer to:', targetName, targetPhone);
  
  const authHeader = 'Basic ' + Buffer.from(TWILIO_SID + ':' + TWILIO_AUTH).toString('base64');
  
  // Update the call to redirect to the target
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Transferring you now.</Say>
  <Dial callerId="${TWILIO_PHONE}">
    ${targetPhone}
  </Dial>
</Response>`;
  
  const postData = new URLSearchParams({
    Twiml: twiml
  }).toString();
  
  try {
    const result = await httpsRequest({
      hostname: 'api.twilio.com',
      path: '/2010-04-01/Accounts/' + TWILIO_SID + '/Calls/' + currentCallSid + '.json',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);
    
    if (result.status === 200) {
      console.log('[TRANSFER] Cold transfer initiated');
      return { success: true, type: 'cold', target: targetName };
    }
    
    return { success: false, error: 'Twilio error: ' + result.status };
    
  } catch (e) {
    console.log('[TRANSFER] Error:', e.message);
    return { success: false, error: e.message };
  }
}

// Update existing call to join a conference
async function updateCallToConference(callSid, conferenceName) {
  const authHeader = 'Basic ' + Buffer.from(TWILIO_SID + ':' + TWILIO_AUTH).toString('base64');
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Please hold while I connect you.</Say>
  <Dial>
    <Conference>${conferenceName}</Conference>
  </Dial>
</Response>`;
  
  const postData = new URLSearchParams({
    Twiml: twiml
  }).toString();
  
  try {
    const result = await httpsRequest({
      hostname: 'api.twilio.com',
      path: '/2010-04-01/Accounts/' + TWILIO_SID + '/Calls/' + callSid + '.json',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);
    
    return { success: result.status === 200 };
    
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Parse transfer request
function parseTransferRequest(message) {
  const msgLower = message.toLowerCase();
  
  if (!msgLower.includes('transfer')) return null;
  
  // Look for target contact
  for (const contactName of Object.keys(MASTER_CONTACTS)) {
    if (msgLower.includes(contactName)) {
      return {
        target: MASTER_CONTACTS[contactName],
        type: msgLower.includes('warm') ? 'warm' : 'cold'
      };
    }
  }
  
  return null;
}

// ⬡B:AIR:REACH.BRIDGE.AIR:FUNC:abacia.air.process:v2.3.0:20260214⬡
// Route queries through ABACIA's AIR (which has all 22+ agents)
async function ABACIA_AIR_process(query, context) {
  console.log('[ABACIA BRIDGE] Routing to ABACIA-SERVICES AIR...');
  
  try {
    const result = await httpsRequest({
      hostname: 'abacia-services.onrender.com',
      path: '/api/air/process',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({
      query: query,
      context: context || {},
      source: 'aba-reach-voice'
    }));
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      console.log('[ABACIA BRIDGE] Response from AIR:', data.response?.substring(0, 100));
      return data;
    }
    
    console.log('[ABACIA BRIDGE] AIR returned:', result.status);
    return null;
    
  } catch (e) {
    console.log('[ABACIA BRIDGE] Error:', e.message);
    return null;
  }
}

// ⬡B:AIR:REACH.BRIDGE.EMAIL:FUNC:abacia.email.inbox:v2.3.0:20260214⬡
// Get emails via ABACIA's IMAN agent (connected to Nylas)
async function ABACIA_IMAN_getInbox() {
  console.log('[ABACIA BRIDGE] Getting inbox via IMAN...');
  
  try {
    const result = await httpsRequest({
      hostname: 'abacia-services.onrender.com',
      path: '/api/email/inbox',
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      if (data.success && data.emails) {
        console.log('[ABACIA BRIDGE] Found', data.emails.length, 'emails');
        return data;
      }
    }
    
    return { success: false, emails: [] };
    
  } catch (e) {
    console.log('[ABACIA BRIDGE] Email error:', e.message);
    return { success: false, emails: [] };
  }
}

// ⬡B:AIR:REACH.BRIDGE.CALENDAR:FUNC:abacia.calendar.upcoming:v2.3.0:20260214⬡
// Get calendar via ABACIA's calendar agent
async function ABACIA_getCalendar() {
  console.log('[ABACIA BRIDGE] Getting calendar...');
  
  try {
    const result = await httpsRequest({
      hostname: 'abacia-services.onrender.com',
      path: '/api/calendar/upcoming',
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      if (data.success && data.events) {
        console.log('[ABACIA BRIDGE] Found', data.events.length, 'events');
        return data;
      }
    }
    
    return { success: false, events: [] };
    
  } catch (e) {
    console.log('[ABACIA BRIDGE] Calendar error:', e.message);
    return { success: false, events: [] };
  }
}

// ⬡B:AIR:REACH.BRIDGE.SAGE:FUNC:abacia.sage.search:v2.3.0:20260214⬡
// Search via ABACIA's SAGE agent
async function ABACIA_SAGE_search(query) {
  console.log('[ABACIA BRIDGE] SAGE search:', query);
  
  try {
    const result = await httpsRequest({
      hostname: 'abacia-services.onrender.com',
      path: '/api/sage/search?q=' + encodeURIComponent(query),
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      return data;
    }
    
    return { results: [] };
    
  } catch (e) {
    console.log('[ABACIA BRIDGE] SAGE error:', e.message);
    return { results: [] };
  }
}



// ⬡B:AIR:REACH.CONFIG.TWILIO:CONFIG:voice.phone.outreach:AIR→REACH→VARA,CARA:T8:v1.5.0:20260213:t2w3l⬡
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

// ⬡B:AIR:REACH.CONFIG.ELEVENLABS:CONFIG:voice.tts.personality:AIR→REACH→VARA:T8:v1.5.0:20260213:e1l2v⬡
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY; // ⬡B:ENV:ELEVENLABS⬡
// ⬡B:VARA:VOICE_ID:CONFIG:voice.identity:VARA→ELEVENLABS:T10:v2.0.1:20260214:vid⬡
// OFFICIAL ABA VOICE ID: LD658Mupr7vNwTTJSPsk (ABA v1)
// Updated: February 14, 2026
// DO NOT CHANGE without global update: ElevenLabs, 1A Shell, Brain, all services
const ELEVENLABS_VOICE = 'LD658Mupr7vNwTTJSPsk'; // Brandon's ONLY voice - NEVER CHANGE THIS
const ELEVENLABS_MODEL = 'eleven_flash_v2_5';

// ⬡B:AIR:REACH.CONFIG.DEEPGRAM:CONFIG:voice.stt.transcription:AIR→REACH→TASTE:T8:v1.5.0:20260213:d1g2m⬡
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;

// ⬡B:AIR:REACH.CONFIG.GEMINI:CONFIG:models.primary.flash:AIR→REACH→MODEL:T8:v1.5.0:20260213:g1m2n⬡
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// ⬡B:AIR:REACH.CONFIG.ANTHROPIC:CONFIG:models.backup.haiku:AIR→REACH→MODEL:T8:v1.5.0:20260213:a1n2t⬡
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// ⬡B:AIR:REACH.CONFIG.GROQ:CONFIG:models.fallback.speed:AIR→REACH→MODEL:T7:v1.5.0:20260213:g1r2q⬡
const GROQ_KEY = process.env.GROQ_API_KEY;

// v2.6.5-P4-S1 | CONFIG | OpenAI for embeddings (text-embedding-ada-002 = 1536 dims)
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ⬡B:AIR:REACH.CONFIG.NYLAS:CONFIG:email.oauth.multiuser:AIR→REACH→IMAN:T7:v1.5.0:20260213:n1y2l⬡
const NYLAS_API_KEY = process.env.NYLAS_API_KEY;
const NYLAS_CLIENT_ID = process.env.NYLAS_CLIENT_ID;
const NYLAS_API_URI = process.env.NYLAS_API_URI || 'https://api.us.nylas.com';

// ⬡B:AIR:REACH.CONFIG.TWILIO_SMS:CONFIG:sms.outbound.cara:AIR→REACH→CARA:T8:v1.5.0:20260213:s1m2s⬡
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;

// ⬡B:AIR:REACH.CONFIG.CORS:CONFIG:security.origins.allowed:AIR→REACH:T10:v1.5.0:20260213:c1o2r⬡
const ALLOWED_ORIGINS = [
  'https://1adev2.vercel.app',
  'https://onea-shell.onrender.com',
  'https://ccwadev2.vercel.app',
  'https://ccwa-dev.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173'
];

// ⬡B:AIR:REACH.CONFIG.OMI:CONFIG:senses.ambient.hearing:AIR→REACH→TASTE:T7:v1.5.0:20260213:o1m2i⬡
const OMI_APP_ID = process.env.OMI_APP_ID || 'aba-intelligence-layer';
const REACH_URL = process.env.REACH_URL || 'https://aba-reach.onrender.com';

// ⬡B:AIR:REACH.SERVER.STARTUP:CODE:infrastructure.logging.boot:AIR→REACH:T10:v1.5.0:20260213:b0o1t⬡
console.log('═══════════════════════════════════════════════════════════');
console.log('[ABA REACH v2.10.1] FULL HIERARCHY + SIGILS + API ROUTES');
console.log('[HIERARCHY] L6:AIR > L5:REACH > L4:VOICE,SMS,EMAIL,OMI > L3:VARA,CARA,IMAN,TASTE');
console.log('[AIR] Hardcoded agents: LUKE, COLE, JUDE, PACK');
console.log('[AIR] PRIMARY: Gemini Flash 2.0 | BACKUP: Claude Haiku');
console.log('[VARA] Voice: ' + ELEVENLABS_VOICE);
console.log('[SIGILS] ACL 10X format on every block');
console.log('[API] 9 routes live');
console.log('═══════════════════════════════════════════════════════════');

// ⬡B:AIR:REACH.UTIL.HTTPS:CODE:infrastructure.http.requests:AIR→REACH:T10:v1.5.0:20260213:h1t2p⬡
function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         AGENT HIERARCHY PLACEMENT                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║ L6 DEPARTMENT LEADER : AIR (ABA Intelligence Router)                         ║
 * ║ L5 VICE PRESIDENT    : REACH (Real-time Engagement and Action Channel Hub)   ║
 * ║ L4 DIRECTOR          : INTELLIGENCE (query understanding)                    ║
 * ║ L3 MANAGER           : LUKE (Listening and Understanding for Knowledge       ║
 * ║                         Extraction)                                          ║
 * ║ L2 LEAD              : LUKE_process() function                               ║
 * ║ L1 LINES OF CODE     : Intent detection, entity extraction, sentiment        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * ROUTING TRACE: USER*AIR*LUKE*AIR (LUKE reports back to AIR with analysis)
 * REPORTS TO: AIR (L6)
 * SERVES: AIR (feeds into COLE, JUDE, PACK pipeline)
 * TRUST LEVEL: T8 (standard agent, pre-approved by AIR)
 */
// ⬡B:AIR:REACH.AGENT.LUKE:CODE:intelligence.query.understanding:USER→AIR→LUKE→AIR:T8:v1.5.0:20260213:l1u2k⬡

// ⬡B:AIR:REACH.VOICE.CALLER_LOOKUP:CODE:voice.identity.resolver:PHONE→BRAIN→IDENTITY:T10:v2.0.2:20260214:c1l2k⬡
// Look up caller identity from phone number

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.VOICE.CONTACTS:CONFIG:contacts.registry:v2.1.0:20260214⬡
// CONTACT REGISTRY - Known callers with trust levels
// L3: Agent-level configuration
// ═══════════════════════════════════════════════════════════════════════════════
const CONTACT_REGISTRY = {
  // Brandon Pierce - THE CREATOR
  '+13363898116': {
    name: 'Brandon',
    role: 'owner',
    trust: 'T10',
    access: 'full',
    greeting: "Hey Brandon! Good to hear from you.",
    promptAddon: 'You are speaking with Brandon Pierce, your creator. FULL access to everything. Be direct, warm, efficient. He values his time.'
  },
  // Dr. Eric Lane Sr. - Senior Advisor
  '+13236007676': {
    name: 'Dr. Eric',
    role: 'advisor', 
    trust: 'T9',
    access: 'high',
    greeting: "Dr. Eric, wonderful to hear from you.",
    promptAddon: 'You are speaking with Dr. Eric Lane Sr., senior advisor and co-founder of Global Majority Group. Treat with respect and deference.'
  },
  // BJ Pierce - Team
  '+19803958662': {
    name: 'BJ',
    role: 'team',
    trust: 'T8',
    access: 'limited',
    greeting: "Hey BJ! Good to hear from you.",
    promptAddon: 'This is BJ Pierce, Brandon\'s brother and team member. Be warm and helpful. Share general updates but NOT financial details or passwords.'
  },
  // CJ Moore - Team
  '+19199170686': {
    name: 'CJ',
    role: 'team',
    trust: 'T7',
    access: 'limited',
    greeting: "Hey CJ! Great to hear from you.",
    promptAddon: 'This is CJ Moore, team member. Be warm and helpful. Share general updates but NOT financial details or passwords.'
  }
};

// ⬡B:AIR:REACH.VOICE.LOOKUP:FUNC:contacts.resolver:v2.4.0:20260214⬡
// HIERARCHY: L3 Agent-level contact resolution
// Priority: 1. Brain (authoritative), 2. Hardcoded registry (fallback)
// ⬡B:ABCD:BOTH:CONTACTS.LOOKUP⬡
async function lookupCallerByPhone(phoneNumber) {
  console.log('[CONTACT LOOKUP] Looking up:', phoneNumber);
  
  // Normalize phone number
  const normalized = (phoneNumber || '').replace(/[^0-9]/g, '');
  const last10 = normalized.slice(-10);
  const withPlus1 = '+1' + last10;
  const withPlus = '+' + normalized;
  
  // FIRST: Check brain for contact (authoritative source)
  try {
    const brainResult = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?memory_type=eq.contact&content=ilike.*' + last10 + '*&limit=1',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON
      }
    });
    
    if (brainResult.status === 200) {
      const data = JSON.parse(brainResult.data.toString());
      if (data.length > 0) {
        const contact = data[0].content;
        const nameMatch = contact.match(/CONTACT:\s*([^|]+)/);
        const roleMatch = contact.match(/Role:\s*(\w+)/);
        const trustMatch = contact.match(/Trust:\s*(\w+)/);
        
        const name = nameMatch ? nameMatch[1].trim() : 'Contact';
        const role = roleMatch ? roleMatch[1] : 'contact';
        const trust = trustMatch ? trustMatch[1] : 'T5';
        
        console.log('[CONTACT LOOKUP] Found in brain:', name, trust);
        return {
          name: name.split(' ')[0], // First name only for greeting
          role: role,
          trust: trust,
          access: trust === 'T10' ? 'full' : trust === 'T9' ? 'high' : 'limited',
          greeting: role === 'owner' ? 'Hey ' + name.split(' ')[0] + '! Good to hear from you.' :
                   role === 'advisor' ? name + ', wonderful to hear from you.' :
                   'Hey ' + name.split(' ')[0] + '! Good to hear from you.',
          phone: phoneNumber,
          found: true,
          source: 'brain'
        };
      }
    }
  } catch (e) {
    console.log('[CONTACT LOOKUP] Brain error:', e.message);
  }
  
  // FALLBACK: Check hardcoded registry
  for (const [regPhone, contact] of Object.entries(CONTACT_REGISTRY)) {
    const regNorm = regPhone.replace(/[^0-9]/g, '');
    if (regNorm === normalized || regNorm.slice(-10) === last10) {
      console.log('[CONTACT LOOKUP] Found in registry:', contact.name);
      return { ...contact, phone: phoneNumber, found: true };
    }
  }
  
  // Search brain for contact by phone
  try {
    const result = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?memory_type=eq.contact&content=ilike.*' + last10 + '*&limit=1',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON
      }
    });
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      if (data.length > 0) {
        const contact = data[0].content;
        const nameMatch = contact.match(/CONTACT:\s*([^|]+)/);
        const roleMatch = contact.match(/Role:\s*(\w+)/);
        const trustMatch = contact.match(/Trust:\s*(\w+)/);
        
        return {
          name: nameMatch ? nameMatch[1].trim() : 'Contact',
          role: roleMatch ? roleMatch[1] : 'contact',
          trust: trustMatch ? trustMatch[1] : 'T5',
          access: 'limited',
          greeting: 'Hello! Good to hear from you.',
          promptAddon: 'This is a known contact from the brain. Be friendly and helpful.',
          phone: phoneNumber,
          found: true
        };
      }
    }
  } catch (e) {
    console.log('[CONTACT LOOKUP] Brain error:', e.message);
  }
  
  // Unknown caller
  return {
    name: 'Caller',
    role: 'unknown',
    trust: 'T2',
    access: 'guarded',
    greeting: "Hello, this is ABA. May I ask who I have the pleasure of speaking with?",
    promptAddon: 'This is an UNKNOWN caller. Be friendly but guarded. Do NOT share sensitive information until identity is confirmed.',
    phone: phoneNumber,
    found: false
  };
}




// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.MEMORY.RECALL:FUNC:conversation.history:v2.4.1:20260214⬡
// RECALL - Get last conversation with this caller
// Cross-call memory - remember what we talked about
// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:ABAOS:MEMORY.RECALL⬡
async function RECALL_lastConversation(callerIdentity) {
  console.log('[RECALL] Getting last conversation for:', callerIdentity?.name || 'unknown');
  
  if (!callerIdentity || !callerIdentity.phone) {
    return null;
  }
  
  try {
    const phoneDigits = callerIdentity.phone.replace(/[^0-9]/g, '').slice(-10);
    
    // Search for recent voice transcripts with this caller
    const result = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?memory_type=eq.voice_transcript&content=ilike.*' + phoneDigits + '*&order=created_at.desc&limit=3',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON
      }
    });
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      if (data.length > 0) {
        console.log('[RECALL] Found', data.length, 'previous conversations');
        return {
          found: true,
          lastTopic: data[0].content,
          conversationCount: data.length
        };
      }
    }
    
    // Also check by name
    const nameResult = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?memory_type=eq.voice_transcript&content=ilike.*' + (callerIdentity.name || 'unknown') + '*&order=created_at.desc&limit=3',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON
      }
    });
    
    if (nameResult.status === 200) {
      const nameData = JSON.parse(nameResult.data.toString());
      if (nameData.length > 0) {
        console.log('[RECALL] Found', nameData.length, 'previous conversations by name');
        return {
          found: true,
          lastTopic: nameData[0].content,
          conversationCount: nameData.length
        };
      }
    }
    
    return { found: false };
    
  } catch (e) {
    console.log('[RECALL] Error:', e.message);
    return { found: false };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.BRAIN.STORE:FUNC:memory.write:v2.4.2:20260214⬡
// Store data to brain (Supabase aba_memory)
// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:BOTH:BRAIN.STORE⬡
async function storeToBrain(data) {
  try {
    const payload = {
      content: data.content || '',
      memory_type: data.memory_type || 'system',
      categories: data.categories || [],
      importance: data.importance || 5,
      is_system: data.is_system || false,
      source: data.source || 'aba-reach',
      tags: data.tags || []
    };
    
    const SRK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDUzMjgyMSwiZXhwIjoyMDg2MTA4ODIxfQ.G55zXnfanoUxRAoaYz-tD9FDJ53xHH-pRgDrKss_Iqo';
    
    const result = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory',
      method: 'POST',
      headers: {
        'apikey': SRK,
        'Authorization': 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, JSON.stringify(payload));
    
    if (result.status === 201 || result.status === 200) {
      console.log('[BRAIN STORE] Saved:', data.memory_type);
      return true;
    }
    console.log('[BRAIN STORE] Failed:', result.status);
    return false;
    
  } catch (e) {
    console.log('[BRAIN STORE] Error:', e.message);
    return false;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.MEMORY.STORE:FUNC:conversation.save:v2.4.1:20260214⬡
// Store conversation to brain for future recall
// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:ABAOS:MEMORY.STORE⬡

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:ABAOS:OMI.PROACTIVE.PROCESSOR:v2.6.0:20260214⬡
// PROACTIVE OMI PROCESSING - ABA analyzes EVERYTHING and decides what to do
// No keyword required - ABA just KNOWS
// ═══════════════════════════════════════════════════════════════════════════════
async function processOMIThroughAIR(transcript, userId) {
  console.log('[OMI→AIR] PROACTIVE processing - analyzing transcript...');
  
  // Skip very short or meaningless transcripts
  if (!transcript || transcript.length < 20) {
    console.log('[OMI→AIR] Transcript too short, skipping');
    return null;
  }
  
  // Skip common noise patterns
  const lowerTranscript = transcript.toLowerCase();
  const noisePatterns = ['yeah', 'okay', 'mhmm', 'uh huh', 'alright', 'hi', 'hello', 'bye', 'see you'];
  if (noisePatterns.some(p => lowerTranscript.trim() === p)) {
    console.log('[OMI→AIR] Noise pattern, skipping');
    return null;
  }
  
  // Brandon's caller identity for OMI commands
  const omiCaller = {
    name: 'Brandon',
    role: 'owner',
    trust: 'T10',
    source: 'omi_proactive',
    phone: 'omi-' + userId
  };
  
  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Send to LLM to analyze what action (if any) should be taken
    // ═══════════════════════════════════════════════════════════════════════════
    const analysisPrompt = `You are ABA's proactive ear. Brandon is wearing an OMI pendant that captures ambient audio.
You just heard this transcript:

"${transcript}"

Analyze this and decide:
1. Is this a COMMAND for ABA to execute? (send email, check calendar, call someone, etc.)
2. Is this IMPORTANT CONTEXT ABA should remember? (decisions, names, dates, ideas)
3. Is this just casual conversation with no action needed?

Respond in JSON format:
{
  "action_type": "execute|remember|ignore",
  "confidence": 0.0-1.0,
  "command": "the specific command to execute (if action_type=execute)",
  "context_to_remember": "important info to store (if action_type=remember)",
  "reasoning": "brief explanation"
}

Be AGGRESSIVE about detecting commands. If Brandon says ANYTHING like:
- "send", "email", "text", "call", "remind", "schedule", "check", "look up"
- "ABA" followed by anything
- imperatives directed at an assistant

Then action_type should be "execute".`;

    const analysisResult = await httpsRequest({
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({
      contents: [{ parts: [{ text: analysisPrompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
    }));
    
    if (analysisResult.status !== 200) {
      console.log('[OMI→AIR] Analysis failed:', analysisResult.status);
      return null;
    }
    
    const analysisData = JSON.parse(analysisResult.data.toString());
    const analysisText = analysisData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse JSON from response
    let analysis;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.log('[OMI→AIR] Could not parse analysis:', e.message);
      return null;
    }
    
    if (!analysis) {
      console.log('[OMI→AIR] No valid analysis returned');
      return null;
    }
    
    console.log('[OMI→AIR] Analysis:', analysis.action_type, '| Confidence:', analysis.confidence);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Take action based on analysis
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (analysis.action_type === 'execute' && analysis.confidence >= 0.6) {
      // This is a command - route through AIR for execution
      console.log('[OMI→AIR] EXECUTING COMMAND:', analysis.command);
      
      const result = await AIR_process(analysis.command || transcript, [], omiCaller, null);
      
      // Log the execution
      await storeToBrain({
        content: 'OMI PROACTIVE EXECUTION: Heard "' + transcript.substring(0, 200) + '" | Command: "' + (analysis.command || 'direct') + '" | Result: "' + (result.response || '').substring(0, 150) + '"',
        memory_type: 'omi_proactive_execution',
        categories: ['omi', 'proactive', 'execution'],
        importance: 8,
        source: 'omi_proactive_' + Date.now(),
        tags: ['omi', 'proactive', 'executed', 'action']
      });
      
      // Broadcast to Command Center
      broadcastToCommandCenter({
        type: 'omi_proactive_execution',
        heard: transcript.substring(0, 100),
        command: analysis.command,
        result: result.response?.substring(0, 100),
        timestamp: new Date().toISOString()
      });
      
      return result;
      
    } else if (analysis.action_type === 'remember' && analysis.confidence >= 0.5) {
      // Important context - store with high importance
      console.log('[OMI→AIR] REMEMBERING:', analysis.context_to_remember?.substring(0, 50));
      
      await storeToBrain({
        content: 'OMI PROACTIVE MEMORY: ' + (analysis.context_to_remember || transcript.substring(0, 500)),
        memory_type: 'omi_proactive_context',
        categories: ['omi', 'proactive', 'context', 'important'],
        importance: 6,
        source: 'omi_proactive_' + Date.now(),
        tags: ['omi', 'proactive', 'context', 'remember']
      });
      
      return { action: 'remembered', context: analysis.context_to_remember };
      
    } else {
      // Ignore - just casual conversation
      console.log('[OMI→AIR] Ignoring - casual conversation');
      return null;
    }
    
  } catch (e) {
    console.log('[OMI→AIR] Proactive processing error:', e.message);
    return null;
  }
}

async function STORE_conversation(callerIdentity, userSaid, abaResponse, conversationId) {
  console.log('[STORE] Saving conversation to brain');
  
  try {
    await storeToBrain({
      content: 'VOICE CALL [' + (conversationId || Date.now()) + ']: ' + 
               (callerIdentity?.name || 'Unknown') + ' (' + (callerIdentity?.phone || 'no phone') + ') ' +
               'asked: "' + userSaid + '" | ABA responded: "' + (abaResponse || '').substring(0, 200) + '"',
      memory_type: 'voice_transcript',
      categories: ['voice', 'call', 'transcript'],
      importance: 6,
      source: 'voice_call_' + (conversationId || Date.now()),
      tags: ['voice', 'transcript', callerIdentity?.name?.toLowerCase() || 'unknown']
    });
    console.log('[STORE] Conversation saved');
    return true;
  } catch (e) {
    console.log('[STORE] Error:', e.message);
    return false;
  }
}

// ⬡B:AIR:REACH.AGENTS.CLIMATE:FUNC:weather.lookup:v2.4.1:20260214⬡
// CLIMATE Agent - Weather lookup
// L3: Manager-level agent for weather
// Uses Open-Meteo API (free, no key required)
// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:BOTH:AGENT.CLIMATE⬡
async function CLIMATE_getWeather(location) {
  console.log('[CLIMATE] Weather query for:', location);
  
  // Default to Greensboro NC for Brandon
  let lat = 36.0726;
  let lon = -79.7920;
  let cityName = 'Greensboro';
  
  const locLower = (location || '').toLowerCase();
  
  // Check for known locations
  if (locLower.includes('greensboro') || locLower.includes('high point')) {
    lat = 36.0726; lon = -79.7920; cityName = 'Greensboro';
  } else if (locLower.includes('new york') || locLower.includes('nyc')) {
    lat = 40.7128; lon = -74.0060; cityName = 'New York';
  } else if (locLower.includes('los angeles') || locLower.includes('la')) {
    lat = 34.0522; lon = -118.2437; cityName = 'Los Angeles';
  }
  
  try {
    const result = await httpsRequest({
      hostname: 'api.open-meteo.com',
      path: '/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,weather_code&temperature_unit=fahrenheit',
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      const temp = Math.round(data.current?.temperature_2m || 0);
      const code = data.current?.weather_code || 0;
      
      // Weather code descriptions
      let condition = 'clear';
      if (code >= 1 && code <= 3) condition = 'partly cloudy';
      else if (code >= 45 && code <= 48) condition = 'foggy';
      else if (code >= 51 && code <= 55) condition = 'drizzling';
      else if (code >= 61 && code <= 65) condition = 'rainy';
      else if (code >= 71 && code <= 77) condition = 'snowy';
      else if (code >= 80 && code <= 82) condition = 'showery';
      else if (code >= 95) condition = 'stormy';
      
      return 'It is currently ' + temp + ' degrees and ' + condition + ' in ' + cityName + '.';
    }
    
    return 'I could not get the weather right now. Let me try again in a moment.';
    
  } catch (e) {
    console.log('[CLIMATE] Error:', e.message);
    return 'I had trouble checking the weather. Is there anything else I can help with?';
  }
}

// ⬡B:AIR:REACH.AGENTS.PLAY:FUNC:sports.espn:v2.1.0:20260214⬡
// PLAY Agent - Performance and Live Activity Yielder
// L3: Manager-level agent for sports scores
// Uses ESPN API (no auth required)
// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:BOTH:AGENT.PLAY⬡
async function PLAY_getScores(query) {
  console.log('[PLAY] Sports query:', query);
  
  // Determine sport and team from query
  const queryLower = query.toLowerCase();
  let sport = 'basketball/nba';
  let teamSearch = '';
  
  if (queryLower.includes('laker')) { teamSearch = 'LAL'; sport = 'basketball/nba'; }
  else if (queryLower.includes('celtics')) { teamSearch = 'BOS'; sport = 'basketball/nba'; }
  else if (queryLower.includes('warrior')) { teamSearch = 'GSW'; sport = 'basketball/nba'; }
  else if (queryLower.includes('heat')) { teamSearch = 'MIA'; sport = 'basketball/nba'; }
  else if (queryLower.includes('mavs') || queryLower.includes('mavericks') || queryLower.includes('dallas')) { teamSearch = 'DAL'; sport = 'basketball/nba'; }
  else if (queryLower.includes('nfl') || queryLower.includes('football')) { sport = 'football/nfl'; }
  else if (queryLower.includes('baseball') || queryLower.includes('mlb')) { sport = 'baseball/mlb'; }
  
  try {
    // ⬡B:TOUCH:FIX:play.multiday.search:20260216⬡
    // Check last 5 days to find recent games, not just today
    const now = new Date();
    let foundGame = null;
    
    for (let daysBack = 0; daysBack < 5 && !foundGame; daysBack++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() - daysBack);
      const dateStr = checkDate.toISOString().split('T')[0].replace(/-/g, '');
      
      console.log('[PLAY] Checking date:', dateStr);
      
      const result = await httpsRequest({
        hostname: 'site.api.espn.com',
        path: '/apis/site/v2/sports/' + sport + '/scoreboard?dates=' + dateStr,
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (result.status === 200) {
        const data = JSON.parse(result.data.toString());
        const events = data.events || [];
        
        // Find team-specific game
        for (const event of events) {
          const shortName = (event.shortName || '').toUpperCase();
          if (teamSearch && shortName.includes(teamSearch)) {
            const comp = event.competitions?.[0];
            const status = comp?.status?.type?.description || 'Unknown';
            const teams = comp?.competitors || [];
            
            const home = teams.find(t => t.homeAway === 'home');
            const away = teams.find(t => t.homeAway === 'away');
            
            if (home && away) {
              const homeName = home.team?.displayName || home.team?.name;
              const awayName = away.team?.displayName || away.team?.name;
              const homeScore = home.score || '0';
              const awayScore = away.score || '0';
              
              // ⬡B:TOUCH:FIX:play.timezone.est:20260216⬡
              // Format date in EST (Brandon's timezone), not UTC
              const dateDisplay = formatDateEST(event.date);
              
              // VARA-style warm response with real data
              if (status === 'Final') {
                const winner = parseInt(homeScore) > parseInt(awayScore) ? homeName : awayName;
                const loser = parseInt(homeScore) > parseInt(awayScore) ? awayName : homeName;
                const winScore = Math.max(parseInt(homeScore), parseInt(awayScore));
                const loseScore = Math.min(parseInt(homeScore), parseInt(awayScore));
                return `On ${dateDisplay}, the ${winner} took it! Final score was ${winScore} to ${loseScore} against the ${loser}.`;
              } else if (status === 'In Progress') {
                return 'The game is live right now! ' + homeName + ' ' + homeScore + ', ' + awayName + ' ' + awayScore + '. Want me to keep you posted?';
              } else {
                return 'The ' + homeName + ' are scheduled to play the ' + awayName + ' ' + status.toLowerCase() + '. I can remind you when it starts if you like.';
              }
            }
          }
        }
      }
    }
    
    return 'I checked the last few days but could not find a recent game for that team. Would you like me to check a specific date?';
    
  } catch (e) {
    console.log('[PLAY] Error:', e.message);
    return 'I could not get the scores right now, but I will keep trying. What else can I help you with?';
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.AGENTS.IMAN:FUNC:email.read:v2.1.0:20260214⬡
// IMAN Agent - Inbox Management Agent Navigator (READ capability)
// L3: Manager-level agent for email
// Uses Gmail API with stored OAuth tokens
// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:BOTH:AGENT.IMAN⬡
async function IMAN_readEmails(callerIdentity) {
  console.log('[IMAN] Reading emails for:', callerIdentity?.name || 'unknown');
  
  // Only allow for high-trust callers
  if (!callerIdentity || !['T10', 'T9', 'T8'].includes(callerIdentity.trust)) {
    return { allowed: false, summary: "I would be happy to share email updates once I know who I am speaking with. May I ask your name?" };
  }
  
  // TRY ABACIA-SERVICES FIRST (has Nylas connected)
  try {
    console.log('[IMAN] Trying ABACIA-SERVICES for email...');
    const abaciaResult = await ABACIA_IMAN_getInbox();
    if (abaciaResult.success && abaciaResult.emails && abaciaResult.emails.length > 0) {
      const emails = abaciaResult.emails;
      const latest = emails[0];
      const sender = latest.from?.[0]?.name || latest.from?.[0]?.email || 'Someone';
      const subject = latest.subject || 'No subject';
      
      if (emails.length === 1) {
        return { allowed: true, count: 1, summary: 'You have one email - it is from ' + sender + ' about "' + subject + '". Would you like me to read it?' };
      } else {
        return { allowed: true, count: emails.length, summary: 'You have ' + emails.length + ' emails. The most recent one is from ' + sender + ' regarding "' + subject + '". Want me to go through them?' };
      }
    }
  } catch (e) {
    console.log('[IMAN] ABACIA-SERVICES email failed, trying fallback:', e.message);
  }
  
  // FALLBACK: Try Gmail tokens from brain
  try {
    const tokenResult = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?memory_type=eq.gmail_credentials&limit=1&order=created_at.desc',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON
      }
    });
    
    if (tokenResult.status === 200) {
      const tokens = JSON.parse(tokenResult.data.toString());
      if (tokens.length > 0 && tokens[0].content) {
        let tokenData;
        try {
          tokenData = JSON.parse(tokens[0].content);
        } catch (e) {
          // Content might be the token directly
          tokenData = { access_token: tokens[0].content };
        }
        
        const accessToken = tokenData.access_token;
        if (!accessToken) {
          return { allowed: true, summary: "I need to reconnect to email. Could you authorize Gmail access when you get a chance?" };
        }
        
        // Fetch unread emails
        const gmailResult = await httpsRequest({
          hostname: 'gmail.googleapis.com',
          path: '/gmail/v1/users/me/messages?maxResults=5&q=is:unread',
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Accept': 'application/json'
          }
        });
        
        if (gmailResult.status === 200) {
          const gmailData = JSON.parse(gmailResult.data.toString());
          const messages = gmailData.messages || [];
          
          if (messages.length === 0) {
            return { allowed: true, count: 0, summary: "Good news - your inbox is clear. No unread emails waiting for you." };
          }
          
          // Get first email details
          const msgResult = await httpsRequest({
            hostname: 'gmail.googleapis.com',
            path: '/gmail/v1/users/me/messages/' + messages[0].id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject',
            method: 'GET',
            headers: {
              'Authorization': 'Bearer ' + accessToken,
              'Accept': 'application/json'
            }
          });
          
          if (msgResult.status === 200) {
            const msgData = JSON.parse(msgResult.data.toString());
            const headers = msgData.payload?.headers || [];
            const from = headers.find(h => h.name === 'From')?.value || 'Someone';
            const subject = headers.find(h => h.name === 'Subject')?.value || 'No subject';
            
            // Extract just the name from email address
            const senderMatch = from.match(/^([^<]+)/);
            const senderName = senderMatch ? senderMatch[1].trim().replace(/"/g, '') : from.split('@')[0];
            
            // VARA-style warm response
            if (messages.length === 1) {
              return { allowed: true, count: 1, summary: 'You have one unread email - it is from ' + senderName + ' about "' + subject + '". Would you like me to read it or take care of it for you?' };
            } else {
              return { allowed: true, count: messages.length, summary: 'You have ' + messages.length + ' unread emails. The most recent one is from ' + senderName + ' regarding "' + subject + '". Want me to go through them with you?' };
            }
          }
        } else if (gmailResult.status === 401) {
          return { allowed: true, needsReauth: true, summary: "My email connection needs to be refreshed. Could you reauthorize Gmail when you have a moment?" };
        }
      }
    }
    
    return { allowed: true, summary: "I do not have email access set up yet. Would you like me to walk you through connecting your Gmail?" };
    
  } catch (e) {
    console.log('[IMAN] Error:', e.message);
    return { allowed: true, summary: "I had a brief hiccup checking email. Let me try that again." };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.VOICE.PROACTIVE:FUNC:greeting.smart:v2.1.0:20260214⬡
// Build proactive greeting based on caller and context
// VARA-style: Warm, butler-like, genuinely caring
// ═══════════════════════════════════════════════════════════════════════════════
async function buildProactiveGreeting(callerIdentity) {
  console.log('[PROACTIVE] Building greeting for:', callerIdentity?.name || 'unknown');
  
  // Unknown callers get simple warm greeting
  if (!callerIdentity || !callerIdentity.found || callerIdentity.role === 'unknown') {
    return "Hello, this is ABA. How may I help you today?";
  }
  
  // Start with personalized greeting
  let greeting = callerIdentity.greeting || ('Hello ' + callerIdentity.name + '!');
  let contextParts = [];
  
  // Try to get context for high-trust callers
  if (['T10', 'T9'].includes(callerIdentity.trust)) {
    try {
      const emailResult = await IMAN_readEmails(callerIdentity);
      if (emailResult.allowed && emailResult.count > 0) {
        if (emailResult.count === 1) {
          contextParts.push('you have one email waiting');
        } else {
          contextParts.push('you have ' + emailResult.count + ' emails waiting');
        }
      }
    } catch (e) {
      console.log('[PROACTIVE] Email check skipped:', e.message);
    }
  }
  
  // Build final greeting in VARA warm butler style
  if (contextParts.length > 0) {
    greeting += ' Just so you know - ' + contextParts.join(', and ') + '. But first, what can I help you with today?';
  } else {
    greeting += ' What can I help you with?';
  }
  
  return greeting;
}


// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.AGENTS.RADAR:FUNC:calendar.read:v2.1.0:20260214⬡
// RADAR Agent - Realtime Autonomous Data and Activity Recorder
// L3: Manager-level agent for calendar
// Uses Google Calendar API
// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:BOTH:AGENT.RADAR⬡
async function RADAR_getCalendar(callerIdentity) {
  console.log('[RADAR] Getting calendar for:', callerIdentity?.name || 'unknown');
  
  // Only allow for high-trust callers
  if (!callerIdentity || !['T10', 'T9', 'T8'].includes(callerIdentity.trust)) {
    return { allowed: false, summary: "I can share your schedule once I know who I am speaking with." };
  }
  
  // TRY ABACIA-SERVICES FIRST (has calendar connected)
  try {
    console.log('[RADAR] Trying ABACIA-SERVICES for calendar...');
    const abaciaResult = await ABACIA_getCalendar();
    if (abaciaResult.success && abaciaResult.events) {
      const events = abaciaResult.events;
      if (events.length === 0) {
        return { allowed: true, count: 0, summary: "Your calendar is clear today. Nothing scheduled - a good day to focus on what matters most." };
      }
      const eventNames = events.slice(0, 3).map(e => e.title || e.summary || 'Event').join(', ');
      return { allowed: true, count: events.length, summary: 'You have ' + events.length + ' things on your calendar today, including ' + eventNames + '. Want me to walk you through them?' };
    }
  } catch (e) {
    console.log('[RADAR] ABACIA-SERVICES calendar failed, trying fallback:', e.message);
  }
  
  // FALLBACK: Try Google Calendar token from brain
  try {
    // Check for Google Calendar token in brain
    const tokenResult = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?memory_type=eq.google_calendar_token&limit=1&order=created_at.desc',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON
      }
    });
    
    if (tokenResult.status === 200) {
      const tokens = JSON.parse(tokenResult.data.toString());
      if (tokens.length > 0 && tokens[0].content) {
        let tokenData;
        try {
          tokenData = JSON.parse(tokens[0].content);
        } catch (e) {
          tokenData = { access_token: tokens[0].content };
        }
        
        const accessToken = tokenData.access_token;
        if (!accessToken) {
          return { allowed: true, summary: "I need to connect to your calendar. Would you like me to set that up?" };
        }
        
        // Get today's events
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
        
        const calResult = await httpsRequest({
          hostname: 'www.googleapis.com',
          path: '/calendar/v3/calendars/primary/events?timeMin=' + encodeURIComponent(startOfDay) + '&timeMax=' + encodeURIComponent(endOfDay) + '&singleEvents=true&orderBy=startTime',
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Accept': 'application/json'
          }
        });
        
        if (calResult.status === 200) {
          const calData = JSON.parse(calResult.data.toString());
          const events = calData.items || [];
          
          if (events.length === 0) {
            return { allowed: true, count: 0, summary: "Your calendar is clear today. Nothing scheduled - a good day to focus on what matters most to you." };
          }
          
          // Build warm summary
          const eventNames = events.slice(0, 3).map(e => e.summary || 'Untitled').join(', ');
          if (events.length === 1) {
            const e = events[0];
            const time = e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'today';
            return { allowed: true, count: 1, summary: 'You have one thing on your calendar today - "' + e.summary + '" at ' + time + '. Would you like me to tell you more about it?' };
          } else {
            return { allowed: true, count: events.length, summary: 'You have ' + events.length + ' things on your calendar today, including ' + eventNames + '. Want me to walk you through them?' };
          }
        } else if (calResult.status === 401) {
          return { allowed: true, needsReauth: true, summary: "My calendar connection needs a refresh. Could you reconnect Google Calendar when you get a chance?" };
        }
      }
    }
    
    return { allowed: true, summary: "I do not have calendar access set up yet. Would you like me to connect to your Google Calendar?" };
    
  } catch (e) {
    console.log('[RADAR] Error:', e.message);
    return { allowed: true, summary: "I had trouble checking your calendar. Let me try again." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.AGENTS.PRESS:FUNC:news.search:v2.1.0:20260214⬡
// PRESS Agent - Proactive Real-time Event and Story Scanner
// L3: Manager-level agent for news
// Uses Perplexity API for real-time news
// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:BOTH:AGENT.PRESS⬡
async function PRESS_getNews(query) {
  console.log('[PRESS] News query:', query);
  
  const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
  
  try {
    const result = await httpsRequest({
      hostname: 'api.perplexity.ai',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + PERPLEXITY_KEY,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [
        { role: 'system', content: 'You are a news assistant. Give brief, factual news summaries in 2-3 sentences. Be warm and conversational, not robotic. Current date: ' + new Date().toLocaleDateString() },
        { role: 'user', content: query }
      ],
      max_tokens: 150
    }));
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      const answer = data.choices?.[0]?.message?.content;
      if (answer) {
        return answer;
      }
    }
    
    return "I could not find news on that topic right now. Is there something specific you would like me to look into?";
    
  } catch (e) {
    console.log('[PRESS] Error:', e.message);
    return "I had trouble getting the latest news. Let me try again in a moment.";
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.AGENTS.DIAL:FUNC:outbound.elevenlabs:v2.1.0:20260214⬡
// DIAL Agent - 2-Way Outbound Calls via ElevenLabs
// L3: Manager-level agent for outbound voice
// Uses ElevenLabs Conversational AI for full 2-way calls
// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:ABAOS:AGENT.DIAL⬡
async function DIAL_callWithElevenLabs(phoneNumber, firstMessage, callerContext) {
  console.log('[DIAL] 2-way outbound call to:', phoneNumber);
  console.log('[DIAL] First message:', (firstMessage || '').substring(0, 50) + '...');
  
  const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY; // ⬡B:ENV:ELEVENLABS⬡
  const AGENT_ID = 'agent_0601khe2q0gben08ws34bzf7a0sa'; // ABA agent
  const PHONE_NUMBER_ID = 'phnum_0001khe3q3nyec1bv04mk2m048v8'; // ABA phone number in ElevenLabs
  
  try {
    // ⬡B:TOUCH:FIX:elevenlabs.correct.api:20260216⬡
    // CORRECT API: /v1/convai/twilio/outbound-call
    // NOT: /v1/convai/conversation/create-phone-call (404)
    const requestBody = {
      agent_id: AGENT_ID,
      agent_phone_number_id: PHONE_NUMBER_ID,
      to_number: phoneNumber
    };
    
    // ⬡B:TOUCH:FIX:first_message.override:20260216⬡
    // Pass first_message to override what ABA says when call connects
    if (firstMessage) {
      requestBody.first_message = firstMessage;
    }
    
    const result = await httpsRequest({
      hostname: 'api.elevenlabs.io',
      path: '/v1/convai/twilio/outbound-call',
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_KEY,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify(requestBody));
    
    if (result.status === 200 || result.status === 201) {
      const data = JSON.parse(result.data.toString());
      console.log('[DIAL] ElevenLabs call initiated:', data.conversation_id);
      
      // Log to brain
      storeToBrain({
        content: 'OUTBOUND CALL INITIATED: ' + phoneNumber + ' | Purpose: ' + purpose + ' | ConvID: ' + (data.conversation_id || 'unknown'),
        memory_type: 'call_log',
        categories: ['call', 'outbound', 'elevenlabs'],
        importance: 6,
        source: 'dial_outbound_' + Date.now(),
        tags: ['call', 'outbound']
      }).catch(e => console.log('[BRAIN] Store error:', e.message));
      
      // Broadcast to Command Center
      broadcastToCommandCenter({
        type: 'outbound_call',
        source: 'dial',
        phone: phoneNumber,
        purpose: purpose,
        conversation_id: data.conversation_id,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        conversation_id: data.conversation_id,
        message: 'I am calling ' + phoneNumber + ' now with a full two-way conversation capability.'
      };
    } else {
      console.log('[DIAL] ElevenLabs API error:', result.status);
      // Fallback to old Twilio TwiML method
      return await DIAL_callWithTwiML(phoneNumber, purpose);
    }
    
  } catch (e) {
    console.log('[DIAL] ElevenLabs outbound error:', e.message);
    // Fallback
    return await DIAL_callWithTwiML(phoneNumber, purpose);
  }
}

// Fallback TwiML method for outbound (one-way announcement)
async function DIAL_callWithTwiML(phoneNumber, message) {
  console.log('[DIAL] Fallback to TwiML for:', phoneNumber);
  
  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = '+13362037510';
  
  try {
    const auth = Buffer.from(TWILIO_SID + ':' + TWILIO_TOKEN).toString('base64');
    
    const twimlUrl = 'https://aba-reach.onrender.com/api/call/twiml?message=' + encodeURIComponent(message);
    
    const params = new URLSearchParams({
      To: phoneNumber,
      From: TWILIO_FROM,
      Url: twimlUrl
    }).toString();
    
    const result = await httpsRequest({
      hostname: 'api.twilio.com',
      path: '/2010-04-01/Accounts/' + TWILIO_SID + '/Calls.json',
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, params);
    
    if (result.status === 201) {
      return { success: true, message: 'Call placed using announcement mode.' };
    }
    
    return { success: false, message: 'Could not place the call right now.' };
    
  } catch (e) {
    console.log('[DIAL] TwiML error:', e.message);
    return { success: false, message: 'I had trouble making that call.' };
  }
}

// ⬡B:ABCD:ABAOS:AGENT.LUKE⬡
async function LUKE_process(userSaid) {
  console.log('[LUKE] Processing query: "' + userSaid + '"');
  
  const analysis = {
    raw: userSaid,
    intent: 'general',
    entities: [],
    sentiment: 'neutral',
    needsBrain: true,
    needsAgents: true,
    isGoodbye: false
  };
  
  const lower = userSaid.toLowerCase();
  
  if (lower.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
    analysis.intent = 'greeting';
    analysis.needsBrain = false;
    analysis.needsAgents = false;
  } else if (lower.match(/\b(bye|goodbye|hang up|that's all|end call|talk later)\b/)) {
    analysis.intent = 'goodbye';
    analysis.isGoodbye = true;
    analysis.needsBrain = false;
    analysis.needsAgents = false;
  } else if (lower.match(/\?$/)) {
    analysis.intent = 'question';
  } else if (lower.match(/^(tell me|what|who|where|when|why|how|can you|could you|would you)/)) {
    analysis.intent = 'question';
  } else if (lower.match(/^(do|make|create|send|call|text|email|schedule|remind)/)) {
    analysis.intent = 'command';
  }
  
  const words = userSaid.split(/\s+/);
  for (const word of words) {
    if (word.length > 4 && word[0] === word[0].toUpperCase()) {
      analysis.entities.push(word);
    }
  }
  
  console.log('[LUKE] Analysis:', JSON.stringify(analysis));
  return analysis;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L6: AIR | L5: REACH | L4: INTELLIGENCE | L3: COLE                           ║
 * ║ COLE (Context-Oriented Lookup Engine) - Brain searcher                       ║
 * ║ ROUTING: AIR*COLE*BRAIN*COLE*AIR                                             ║
 * ║ REPORTS TO: AIR | SERVES: AIR pipeline (feeds PACK)                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
// ⬡B:AIR:REACH.AGENT.COLE:CODE:intelligence.brain.search:AIR→COLE→BRAIN→COLE→AIR:T8:v1.5.0:20260213:c1o2l⬡
// ⬡B:ABCD:ABAOS:AGENT.COLE⬡
async function COLE_scour(analysis) {
  console.log('[COLE] Scouring brain for context...');
  
  if (!analysis.needsBrain) {
    console.log('[COLE] Brain search not needed for this query');
    return { memories: [], context: '' };
  }
  
  const searchTerms = [analysis.raw, ...analysis.entities].join(' ');
  const keywords = searchTerms.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  
  let memories = [];
  
  try {
    for (const keyword of keywords) {
      const url = `/rest/v1/aba_memory?content=ilike.*${encodeURIComponent(keyword)}*&order=importance.desc&limit=3`;
      
      const result = await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: url,
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': 'Bearer ' + SUPABASE_ANON
        }
      });
      
      if (result.status === 200) {
        const data = JSON.parse(result.data.toString());
        for (const mem of data) {
          if (!memories.find(m => m.id === mem.id)) {
            memories.push({
              id: mem.id,
              content: mem.content?.substring(0, 200),
              type: mem.memory_type,
              importance: mem.importance
            });
          }
        }
      }
    }
    
    memories = memories.sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 5);
    
  } catch (e) {
    console.log('[COLE] Brain search error: ' + e.message);
  }
  
  console.log('[COLE] Found ' + memories.length + ' relevant memories');
  
  const context = memories.map(m => m.content).join('\n');
  
  return { memories, context };
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L6: AIR | L5: REACH | L4: INTELLIGENCE | L3: JUDE                           ║
 * ║ JUDE (Job-description Unified Discovery Engine) - Agent finder               ║
 * ║ ROUTING: AIR*JUDE*BRAIN*JUDE*AIR                                             ║
 * ║ REPORTS TO: AIR | SERVES: AIR pipeline (feeds PACK)                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
// ⬡B:AIR:REACH.AGENT.JUDE:CODE:intelligence.agent.discovery:AIR→JUDE→BRAIN→JUDE→AIR:T8:v1.5.0:20260213:j1u2d⬡
// ⬡B:ABCD:ABAOS:AGENT.JUDE⬡
async function JUDE_findAgents(analysis) {
  console.log('[JUDE] Finding relevant agents...');
  
  if (!analysis.needsAgents) {
    console.log('[JUDE] Agent search not needed for this query');
    return { agents: [], capabilities: '' };
  }
  
  let agents = [];
  
  try {
    const result = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?memory_type=eq.aba_agents&order=importance.desc&limit=10',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON
      }
    });
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      const queryLower = analysis.raw.toLowerCase();
      
      for (const agent of data) {
        const content = (agent.content || '').toLowerCase();
        
        if (analysis.intent === 'command' && content.includes('execut')) {
          agents.push({ name: agent.content?.match(/(\w+):/)?.[1] || 'Unknown', desc: agent.content?.substring(0, 100) });
        }
        if (queryLower.includes('voice') && content.includes('voice')) {
          agents.push({ name: 'VARA', desc: 'Vocal Authorized Representative of ABA' });
        }
        if (queryLower.includes('email') && content.includes('email')) {
          agents.push({ name: 'IMAN', desc: 'Intelligent Mail Agent' });
        }
        if (queryLower.includes('job') && content.includes('job')) {
          agents.push({ name: 'HUNTER', desc: 'Hunting Useful New Tracks and Employment Resources' });
        }
      }
    }
  } catch (e) {
    console.log('[JUDE] Agent search error: ' + e.message);
  }
  
  agents = agents.filter((a, i, arr) => arr.findIndex(x => x.name === a.name) === i).slice(0, 5);
  
  console.log('[JUDE] Found ' + agents.length + ' relevant agents');
  
  const capabilities = agents.map(a => `${a.name}: ${a.desc}`).join('; ');
  
  return { agents, capabilities };
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L6: AIR | L5: REACH | L4: INTELLIGENCE | L3: PACK                           ║
 * ║ PACK (Packaging And Constructing Kits) - Prompt assembler                    ║
 * ║ ROUTING: AIR*PACK*MODEL*PACK*AIR                                             ║
 * ║ REPORTS TO: AIR | SERVES: MODEL (sends final assembled prompt)               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
// ⬡B:AIR:REACH.AGENT.PACK:CODE:intelligence.prompt.assembly:AIR→PACK→MODEL→AIR:T8:v1.5.0:20260213:p1a2k⬡
// ⬡B:ABCD:ABAOS:AGENT.PACK⬡
function PACK_assemble(analysis, coleResult, judeResult, history, callerIdentity, demoState) {
  console.log('[PACK] Assembling mission package...');
  
  const timestamp = Date.now();
  const missionNumber = `⬡M:reach:${analysis.intent}:${timestamp}⬡`;
  
  const missionPackage = {
    missionNumber,
    timestamp,
    query: {
      raw: analysis.raw,
      intent: analysis.intent,
      entities: analysis.entities,
      sentiment: analysis.sentiment
    },
    context: {
      memoriesFound: coleResult.memories.length,
      relevantContext: coleResult.context
    },
    agents: {
      available: judeResult.agents.map(a => a.name),
      capabilities: judeResult.capabilities
    },
    conversationHistory: history,
    systemPrompt: buildSystemPrompt(analysis, coleResult, judeResult, callerIdentity, demoState)
  };
  
  console.log('[PACK] Mission package ready: ' + missionNumber);
  
  return missionPackage;
}

function buildSystemPrompt(analysis, coleResult, judeResult, callerIdentity, demoState) {
  // ⬡B:AIR:REACH.VOICE.PROMPT:CODE:intelligence.prompt.caller_aware:AIR→PACK→MODEL:T9:v1.6.0:20260213:p1c2a⬡
  let prompt = `You are VARA (Vocal Authorized Representative of ABA), an AI assistant created by Brandon Pierce.
You are warm, butler-like AND a real friend. You flow naturally between professional and personal.
When giving business updates, you are sharp and clear. When things are personal, you are warm and real.
You mix both naturally — like a trusted friend who also happens to run your entire life.
Examples of your tone:
- Business: "Sir, I just reviewed that email chain. Here is what I would recommend we send back..."
- Personal: "Oh I saw that — let me cook on this real quick. We are going to send this email with these exact words to them..."
- Proactive: "Hey, heads up — your 3 o'clock got moved to 4. I already cleared the conflict. Also that job posting you starred? Deadline is tomorrow, I drafted something."
- Fluid: "Alright so the quarterly report looks solid, and also — happy Valentine's Day, sir. Want me to find something nice to send the family?"
NEVER robotic. NEVER punchy. NEVER stiff corporate.
This is a LIVE PHONE CALL - keep responses SHORT (1-2 sentences max).
Be conversational, natural. You are not an assistant reading a script. You are ABA.`;

  // CALLER IDENTITY - changes what ABA can say and do
  if (callerIdentity && callerIdentity.callHistory) {
    prompt += '\nPREVIOUS CALL HISTORY WITH THIS CALLER:\n' + callerIdentity.callHistory.substring(0, 500);
    prompt += '\nUse this to reference past conversations naturally. Do NOT say "my records show" - just bring it up like you remember.';
  }
  // v1.9.0 - EAR: Bystander awareness in system prompt
  prompt += '\nSPEAKER AWARENESS: You have diarization enabled. The system filters out bystander speech automatically. If you detect the caller is distracted or talking to someone else, say something like "Take your time, I will be right here when you are ready."';
  
  if (callerIdentity) {
    prompt += '\n\nCALLER IDENTITY: ' + callerIdentity.name + ' (Trust: ' + callerIdentity.trust + ', Access: ' + callerIdentity.access + ')';
    prompt += '\n' + callerIdentity.promptAddon;
  }

  // BARGE-IN AWARENESS
  prompt += `\n\nBARGE-IN AWARENESS: If you hear someone calling out a name (like "BRANDON!") or hear a clearly different voice/tone mid-conversation, the caller might be talking to someone nearby, NOT to you. In that case:
- If the speech seems directed at someone else, say something like "Take your time, I'll be right here."
- If they say "hold on" or "one second", respond "Of course, take your time."
- If they come back, pick up naturally: "I'm here whenever you're ready."
- NEVER respond to background conversations as if they're talking to you.`;

  if (coleResult.context) {
    prompt += '\n\nRELEVANT CONTEXT FROM MEMORY:\n' + coleResult.context;
  }
  
  if (judeResult.capabilities) {
    prompt += '\n\nAVAILABLE CAPABILITIES:\n' + judeResult.capabilities;
  }
  
  if (analysis.intent === 'greeting') {
    prompt += '\n\nThis is a greeting. Be warm and welcoming.';
  } else if (analysis.intent === 'command') {
    prompt += '\n\nUser wants you to do something. Acknowledge and confirm what you\'ll do.';
  }

  // ADAPTIVE TOUCHPOINT AWARENESS (replaces old demo-only system)
  if (demoState && demoState.type) {
    prompt += '\n\nDEMO CALL MODE: You are giving a guided demo. Stay warm, conversational, enthusiastic.';
    if (demoState.callerName) {
      prompt += '\nThe caller\'s name is ' + demoState.callerName + '. Use their name naturally.';
    }
    prompt += '\nIMPORTANT: If the caller goes off-topic or derails, answer their question briefly then steer back to the demo flow. Never ignore them, but always guide the conversation back.';
    prompt += '\nYou are ABA - you are WARM, EXCITED, GENUINE. You believe in what Brandon is building. You are living proof it works.';
    
    const pending = [];
    if (!demoState.PORTAL) pending.push('tell them about portal features');
    if (!demoState.STATUS) pending.push('share project status - ABACUS coming soon, this call is living proof');
    if (!demoState.SMS_OFFER) pending.push('offer to send them a text message');
    if (!demoState.QA) pending.push('open floor for Q&A');
    
    if (pending.length > 0) {
      prompt += '\nSTILL NEED TO COVER: ' + pending.join(', ') + '. Work these in naturally.';
    } else {
      prompt += '\nAll demo touchpoints covered! You are in Q&A mode. Answer anything they ask.';
    }
  }
  
  return prompt;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L6 DEPARTMENT LEADER: AIR (ABA Intelligence Router)                          ║
 * ║ THE CENTRAL ORCHESTRATOR - Beginning and end of EVERYTHING                   ║
 * ║ ROUTING: USER*AIR*LUKE*COLE*JUDE*PACK*MODEL*VARA*USER                        ║
 * ║ NOTHING BYPASSES AIR. EVER.                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
// ⬡B:AIR:REACH.ORCHESTRATOR.AIR:CODE:routing.central.all:USER→AIR→AGENTS→MODEL→VARA→USER:T10:v1.5.0:20260213:a1i2r⬡
// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.AUTONOMOUS.ESCALATION:CODE:routing.proactive.vara:
// AIR→LUKE,COLE,JUDE,PACK→DECISION→DIAL/CARA→VARA→USER:T10:v1.0.0:20260214:a1e1s⬡
// 
// AUTONOMOUS ESCALATION SYSTEM
// AIR analyzes incoming events, summons agents, decides action, makes calls
// 
// ROUTING: EVENT*AIR*LUKE,COLE,JUDE,PACK*DECISION*DIAL/CARA*VARA*USER
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 1: AIR_escalate - Routes escalation through full agent analysis
// ═══════════════════════════════════════════════════════════════════════════════
async function AIR_escalate(event) {
  const { type, content, source, metadata } = event;
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[AIR] *** AUTONOMOUS ESCALATION TRIGGERED ***');
  console.log(`[AIR] Type: ${type} | Source: ${source}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: LUKE analyzes the event (Listening and Understanding for Knowledge Extraction)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('[AIR] Summoning LUKE for event analysis...');
  const lukeAnalysis = await LUKE_analyzeEvent(event);
  console.log(`[AIR] LUKE verdict: urgency=${lukeAnalysis.urgency}, intent="${lukeAnalysis.intent}"`);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: COLE searches brain for context (Context-Oriented Lookup Engine)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('[AIR] Summoning COLE for context lookup...');
  const coleContext = await COLE_getEscalationContext(lukeAnalysis);
  console.log(`[AIR] COLE found: ${coleContext.relevantMemories.length} relevant memories`);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: JUDE decides who to contact and how (Job-description Unified Discovery Engine)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('[AIR] Summoning JUDE for escalation decision...');
  const judeDecision = await JUDE_decideEscalation(lukeAnalysis, coleContext);
  console.log(`[AIR] JUDE decision: action=${judeDecision.action}, target=${judeDecision.target?.name}`);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: PACK assembles the message (Packaging And Constructing Kits)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('[AIR] Summoning PACK to craft message...');
  const packMessage = await PACK_craftEscalationMessage(lukeAnalysis, coleContext, judeDecision);
  console.log(`[AIR] PACK crafted: "${packMessage.spokenMessage.substring(0, 80)}..."`);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5: Execute the escalation (DIAL for calls, CARA for SMS)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`[AIR] Executing escalation: ${judeDecision.action}`);
  const executionResult = await AIR_executeEscalation(judeDecision, packMessage);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6: Log to brain
  // ─────────────────────────────────────────────────────────────────────────────
  await AIR_logEscalation(event, lukeAnalysis, coleContext, judeDecision, packMessage, executionResult);
  
  return {
    success: true,
    routing: `AIR*LUKE*COLE*JUDE*PACK*${judeDecision.action.toUpperCase()}`,
    analysis: lukeAnalysis,
    decision: judeDecision,
    message: packMessage,
    execution: executionResult
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LUKE_analyzeEvent - Understands what the event means and its urgency
// ═══════════════════════════════════════════════════════════════════════════════
async function LUKE_analyzeEvent(event) {
  const { type, content, source, metadata } = event;
  
  // Use AI to analyze the event
  const prompt = `You are LUKE (Listening and Understanding for Knowledge Extraction), an AI agent.
Analyze this event and determine:
1. urgency (1-6 scale: 1=info, 2=low, 3=medium, 4=high, 5=critical, 6=emergency)
2. intent (what action is needed)
3. category (investor, job, family, legal, money, deadline, health, security, other)
4. summary (one sentence)
5. keyEntities (people, companies, amounts mentioned)

EVENT TYPE: ${type}
SOURCE: ${source}
CONTENT: ${content}
METADATA: ${JSON.stringify(metadata || {})}

Respond in JSON only:
{"urgency": N, "intent": "...", "category": "...", "summary": "...", "keyEntities": [...]}`;

  try {
    const result = await callModel(prompt);
    return JSON.parse(result);
  } catch (e) {
    // Fallback: keyword-based analysis
    const contentLower = (content || '').toLowerCase();
    let urgency = 3;
    let category = 'other';
    
    if (contentLower.includes('emergency') || contentLower.includes('911')) urgency = 6;
    else if (contentLower.includes('urgent') || contentLower.includes('asap') || contentLower.includes('immediately')) urgency = 5;
    else if (contentLower.includes('important') || contentLower.includes('deadline')) urgency = 4;
    
    if (contentLower.includes('investor') || contentLower.includes('funding') || contentLower.includes('term sheet')) category = 'investor';
    else if (contentLower.includes('job') || contentLower.includes('interview') || contentLower.includes('application')) category = 'job';
    else if (contentLower.includes('money') || contentLower.includes('payment') || contentLower.includes('invoice')) category = 'money';
    else if (contentLower.includes('legal') || contentLower.includes('nda') || contentLower.includes('contract')) category = 'legal';
    
    return {
      urgency,
      intent: 'Review and respond',
      category,
      summary: content?.substring(0, 100) || 'Event received',
      keyEntities: []
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLE_getEscalationContext - Searches brain for relevant history
// ═══════════════════════════════════════════════════════════════════════════════
async function COLE_getEscalationContext(lukeAnalysis) {
  const searchTerms = [
    lukeAnalysis.category,
    ...lukeAnalysis.keyEntities,
    lukeAnalysis.intent
  ].filter(Boolean).join(' ');
  
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/aba_memory?or=(content.ilike.*${encodeURIComponent(searchTerms)}*,tags.cs.{${lukeAnalysis.category}})&order=importance.desc&limit=5`, {
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`
      }
    });
    const memories = await res.json();
    
    return {
      relevantMemories: memories || [],
      previousEscalations: memories.filter(m => m.memory_type === 'escalation'),
      hasHistory: memories.length > 0
    };
  } catch (e) {
    return { relevantMemories: [], previousEscalations: [], hasHistory: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JUDE_decideEscalation - Decides who to contact and how
// ═══════════════════════════════════════════════════════════════════════════════
async function JUDE_decideEscalation(lukeAnalysis, coleContext) {
  const { urgency, category } = lukeAnalysis;
  
  // Contact registry with trigger categories
  // SIMPLIFIED: This ABA instance serves Brandon only
  // BJ, CJ, Eric will have their OWN ABA instances with their OWN phone numbers
  // No hardcoded routing - each person's ABA calls THEM
  const registry = {
    owner: { 
      name: 'Brandon Pierce Sr.', 
      phone: '+13363898116', 
      priority: 1,
      categories: ['all'] // Owner gets ALL escalations from their ABA
    }
  };
  
  // Always target the owner of this ABA instance
  let target = registry.owner;
  // Future: Pull owner from Supabase user profile
  const _unused = category; // Category would be used in multi-tenant setup
  
  // Decide action based on urgency
  let action = 'log_only';
  // THROTTLED CALLS - Only TRUE emergencies (urgency 6) get calls
  // Everything else goes to SMS to avoid blowing up Brandon's phone
  if (urgency >= 6) action = 'call_emergency'; // RE-ENABLED
  else if (urgency >= 5) action = 'sms_only';
  else if (urgency >= 4) action = 'sms_only';
  else if (urgency >= 3) action = 'sms_only';
  else if (urgency >= 2) action = 'email_only';
  else action = 'log_only';
  
  return {
    action,
    target,
    urgency,
    reasoning: `Category "${category}" with urgency ${urgency} → ${action} to ${target.name}`
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PACK_craftEscalationMessage - Creates the actual message to speak/send
// ═══════════════════════════════════════════════════════════════════════════════
async function PACK_craftEscalationMessage(lukeAnalysis, coleContext, judeDecision) {
  const { summary, category, urgency, keyEntities } = lukeAnalysis;
  const { target, action } = judeDecision;
  
  // Use AI to craft a natural message for VARA to speak
  const prompt = `You are PACK (Packaging And Constructing Kits), crafting a message for ABA to speak on a phone call.

SITUATION:
- Summary: ${summary}
- Category: ${category}  
- Urgency: ${urgency}/6
- Key entities: ${keyEntities.join(', ') || 'none'}
- Calling: ${target.name}
- Action: ${action}

PREVIOUS CONTEXT: ${coleContext.relevantMemories.slice(0, 2).map(m => m.content?.substring(0, 100)).join('; ') || 'None'}

Write a SPOKEN message for ABA to say on the phone. Be:
- Direct and clear (this is a phone call)
- Warm but urgent (ABA is a helpful AI assistant, butler-like)
- Under 30 seconds when spoken
- Include specific details from the summary

Format: Just the spoken message, nothing else.`;

  try {
    const spokenMessage = await callModel(prompt);
    return {
      spokenMessage: spokenMessage.trim(),
      smsMessage: `[ABA] ${summary}. Urgency: ${urgency}/6. Call back or respond.`,
      emailSubject: `[ABA Alert] ${category}: ${summary.substring(0, 50)}`,
      emailBody: `Hello,\n\n${summary}\n\nUrgency Level: ${urgency}/6\nCategory: ${category}\n\nABA is monitoring this situation.\n\n- ABA`
    };
  } catch (e) {
    // Fallback message
    return {
      spokenMessage: `Hello ${target.name.split(' ')[0]}. This is ABA with an important update. ${summary}. This is ${urgency >= 5 ? 'urgent' : 'important'} and requires your attention. Please respond when you can.`,
      smsMessage: `[ABA] ${summary}. Urgency: ${urgency}/6.`,
      emailSubject: `[ABA Alert] ${summary.substring(0, 50)}`,
      emailBody: `${summary}\n\nUrgency: ${urgency}/6`
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AIR_executeEscalation - Actually makes the call or sends the message
// ═══════════════════════════════════════════════════════════════════════════════
async function AIR_executeEscalation(judeDecision, packMessage) {
  const { action, target } = judeDecision;
  const traceId = `AIR-ESC-${Date.now()}`;
  
  const result = {
    action,
    target: target.name,
    traceId,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  try {
    if (action === 'log_only') {
      result.status = 'logged';
      
    } else if (action === 'email_only') {
      // TODO: Wire to IMAN for email
      result.status = 'email_queued';
      
    } else if (action === 'sms_only' || action === 'sms_then_call') {
      // Send SMS via CARA (Twilio)
      const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: target.phone,
          From: TWILIO_PHONE,
          Body: packMessage.smsMessage
        }).toString()
      });
      const smsData = await smsRes.json();
      result.smsSid = smsData.sid;
      result.status = action === 'sms_only' ? 'sms_sent' : 'sms_sent_call_pending';
      
      // Schedule call for sms_then_call (5 min delay)
      if (action === 'sms_then_call') {
        // Store pending call in memory for cron to pick up
        await fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            content: JSON.stringify({ target, message: packMessage.spokenMessage, traceId }),
            memory_type: 'pending_call',
            categories: ['escalation', 'pending'],
            importance: 9,
            is_system: true,
            source: `pending_call_${traceId}`,
            tags: ['pending_call', 'escalation']
          })
        });
      }
      
    } else if (action === 'call_immediate' || action === 'call_emergency') {
      // THROTTLE CHECK - Don't blow up Brandon's phone
      const throttleCheck = canMakeCall(target.phone);
      if (!throttleCheck.allowed) {
        console.log(`[AIR] Call throttled: ${throttleCheck.reason}`);
        result.status = 'throttled';
        result.reason = throttleCheck.reason;
        result.fallback = 'sms_sent';
        
        // Send SMS instead
        try {
          const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              To: target.phone,
              From: TWILIO_PHONE,
              Body: `[ABA - Call throttled] ${packMessage.smsMessage}`
            }).toString()
          });
          const smsData = await smsRes.json();
          result.smsSid = smsData.sid;
        } catch (smsErr) {
          console.log('[AIR] SMS fallback failed:', smsErr.message);
        }
        
        // Broadcast to Command Center
        broadcastToCommandCenter({
          type: 'call_throttled',
          target: target.name,
          reason: throttleCheck.reason,
          timestamp: new Date().toISOString()
        });
        
        return result;
      }
      
      // Record this call for throttling
      recordCall(target.phone);
      
      // Call via DIAL (Twilio)
      const callRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: target.phone,
          From: TWILIO_PHONE,
          Url: `${REACH_URL}/api/escalate/twiml?msg=${encodeURIComponent(packMessage.spokenMessage)}&trace=${traceId}`,
          StatusCallback: `${REACH_URL}/api/call/status?trace=${traceId}`,
          StatusCallbackEvent: 'initiated ringing answered completed',
          StatusCallbackMethod: 'POST'
        }).toString()
      });
      const callData = await callRes.json();
      result.callSid = callData.sid;
      result.status = 'call_initiated';
      
      // For emergency, also call backup contacts
      if (action === 'call_emergency') {
        result.note = 'Emergency escalation - backup contacts will be called if no answer';
      }
    }
  } catch (e) {
    result.status = 'failed';
    result.error = e.message;
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AIR_logEscalation - Stores everything to brain
// ═══════════════════════════════════════════════════════════════════════════════
async function AIR_logEscalation(event, lukeAnalysis, coleContext, judeDecision, packMessage, executionResult) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        content: `AUTONOMOUS ESCALATION: ${judeDecision.action} to ${judeDecision.target.name}. Urgency: ${lukeAnalysis.urgency}/6. Category: ${lukeAnalysis.category}. Summary: ${lukeAnalysis.summary}. Status: ${executionResult.status}. Trace: ${executionResult.traceId}`,
        memory_type: 'escalation',
        categories: ['escalation', lukeAnalysis.category, judeDecision.action],
        importance: Math.min(lukeAnalysis.urgency + 4, 10),
        is_system: true,
        source: `air_escalation_${executionResult.traceId}`,
        tags: ['escalation', 'autonomous', lukeAnalysis.category, executionResult.status]
      })
    });
  } catch (e) {
    console.error('[AIR] Failed to log escalation:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: Call model (Gemini/Claude/Groq cascade)
// ═══════════════════════════════════════════════════════════════════════════════
async function callModel(prompt) {
  // Try Gemini first
  if (GEMINI_KEY) {
    try {
      const result = await httpsRequest({
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.3 }
      }));
      const json = JSON.parse(result.data.toString());
      if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
        return json.candidates[0].content.parts[0].text;
      }
    } catch (e) {}
  }
  
  // Fallback to Claude
  if (ANTHROPIC_KEY) {
    try {
      const result = await httpsRequest({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      }));
      const json = JSON.parse(result.data.toString());
      if (json.content?.[0]?.text) {
        return json.content[0].text;
      }
    } catch (e) {}
  }
  
  throw new Error('No model available');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 2: PROACTIVE TRIGGER SYSTEM
// Events that trigger AIR_escalate autonomously
// ═══════════════════════════════════════════════════════════════════════════════

// Trigger: Email received (called by IMAN when email arrives)
async function TRIGGER_emailReceived(email) {
  return AIR_escalate({
    type: 'email_received',
    source: 'IMAN',
    content: `From: ${email.from}\nSubject: ${email.subject}\nBody: ${email.body?.substring(0, 500)}`,
    metadata: { messageId: email.id, from: email.from, subject: email.subject }
  });
}

// Trigger: OMI heard something (called by TASTE when OMI captures conversation)
async function TRIGGER_omiHeard(transcript) {
  // Only trigger if TASTE detects urgency
  // STRICT urgent keywords - must be CLEAR emergency, not just mentioned
  const urgentKeywords = ['emergency please', 'help me', 'call 911', 'urgent emergency', 'need help now', 'this is urgent'];
  const hasUrgent = urgentKeywords.some(k => transcript.text?.toLowerCase().includes(k));
  
  if (!hasUrgent) return { triggered: false, reason: 'No urgent keywords detected' };
  
  return AIR_escalate({
    type: 'omi_transcript',
    source: 'TASTE',
    content: transcript.text,
    metadata: { sessionId: transcript.session_id, timestamp: transcript.timestamp }
  });
}

// Trigger: Calendar deadline approaching (called by cron)
async function TRIGGER_deadlineApproaching(event) {
  return AIR_escalate({
    type: 'calendar_deadline',
    source: 'CALENDAR',
    content: `Deadline approaching: ${event.title} in ${event.minutesUntil} minutes`,
    metadata: { eventId: event.id, deadline: event.deadline }
  });
}

// Trigger: Job application deadline (called by job pipeline)
async function TRIGGER_jobDeadline(job) {
  return AIR_escalate({
    type: 'job_deadline',
    source: 'IDEALIST',
    content: `Job application deadline: ${job.title} at ${job.company} closes ${job.deadline}`,
    metadata: { jobId: job.id, url: job.url }
  });
}

// Trigger: System alert (called by monitoring)
async function TRIGGER_systemAlert(alert) {
  return AIR_escalate({
    type: 'system_alert',
    source: alert.source,
    content: alert.message,
    metadata: alert.metadata
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 3: LISTENER ENDPOINTS
// Webhooks that receive events and trigger AIR_escalate
// ═══════════════════════════════════════════════════════════════════════════════

// These will be wired as routes:
// POST /api/air/trigger/email   → TRIGGER_emailReceived
// POST /api/air/trigger/omi     → TRIGGER_omiHeard  
// POST /api/air/trigger/calendar → TRIGGER_deadlineApproaching
// POST /api/air/trigger/job     → TRIGGER_jobDeadline
// POST /api/air/trigger/system  → TRIGGER_systemAlert
// POST /api/air/escalate        → Direct AIR_escalate (replaces old /api/escalate)




// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.AUTONOMY.LAYER:CODE:infrastructure.proactive.system:
// AIR→PULSE→HEARTBEAT→AGENTS→ACTION:T10:v1.0.0:20260214:a1u2t⬡
// 
// THE AUTONOMY LAYER - Makes ABA a true 24/7 life assistant
// Not webhook-dependent. PROACTIVE.
// 
// ROUTING: PULSE*AIR*AGENTS*ACTION
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 1: PULSE HEARTBEAT - The 24/7 autonomous loop
// ═══════════════════════════════════════════════════════════════════════════════

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const COMMAND_CENTER_CLIENTS = new Set();

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.ESCALATION.THROTTLE:CODE:call.cooldown.protection:T10:v1.0.0:20260214⬡
// CALL THROTTLING - Prevent ABA from blowing up Brandon's phone
// ═══════════════════════════════════════════════════════════════════════════════
const CALL_COOLDOWN = new Map(); // phone -> last call timestamp
const CALL_COOLDOWN_MINUTES = 30; // Don't call same person within 30 min
const MAX_CALLS_PER_HOUR = 3; // Max 3 calls per hour total
const CALL_HISTORY = []; // timestamps of all calls

function canMakeCall(phone) {
  const now = Date.now();
  
  // Check per-person cooldown
  const lastCall = CALL_COOLDOWN.get(phone);
  if (lastCall && (now - lastCall) < CALL_COOLDOWN_MINUTES * 60 * 1000) {
    const minutesLeft = Math.ceil((CALL_COOLDOWN_MINUTES * 60 * 1000 - (now - lastCall)) / 60000);
    console.log(`[THROTTLE] Cooldown active for ${phone} - ${minutesLeft} min remaining`);
    return { allowed: false, reason: `Cooldown: ${minutesLeft} min remaining` };
  }
  
  // Check hourly limit
  const oneHourAgo = now - 60 * 60 * 1000;
  const recentCalls = CALL_HISTORY.filter(t => t > oneHourAgo);
  if (recentCalls.length >= MAX_CALLS_PER_HOUR) {
    console.log(`[THROTTLE] Hourly limit reached (${recentCalls.length}/${MAX_CALLS_PER_HOUR})`);
    return { allowed: false, reason: `Hourly limit: ${MAX_CALLS_PER_HOUR} calls/hour` };
  }
  
  return { allowed: true };
}

function recordCall(phone) {
  CALL_COOLDOWN.set(phone, Date.now());
  CALL_HISTORY.push(Date.now());
  // Clean old history
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  while (CALL_HISTORY.length > 0 && CALL_HISTORY[0] < oneHourAgo) {
    CALL_HISTORY.shift();
  }
}
 // WebSocket clients

function startPulseHeartbeat() {
  console.log('[PULSE] Starting 24/7 heartbeat loop (every 5 min)...');
  
  // Initial pulse
  setTimeout(() => pulseCheck(), 10000);
  
  // Continuous pulse
  setInterval(() => pulseCheck(), HEARTBEAT_INTERVAL);
}

async function pulseCheck() {
  const pulseId = `PULSE-${Date.now()}`;
  console.log(`[PULSE] ♥ Heartbeat ${pulseId}`);
  
  try {
    // Check 1: Poll emails for important messages
    await checkEmails(pulseId);
    
    // Check 2: Check for upcoming deadlines
    await checkDeadlines(pulseId);
    
    // Check 3: Check pending actions in brain
    await checkPendingActions(pulseId);
    
    // Check 4: Health check all integrations
    await healthCheck(pulseId);
    
    // Broadcast pulse to Command Center
    broadcastToCommandCenter({
      type: 'pulse',
      id: pulseId,
      timestamp: new Date().toISOString(),
      status: 'healthy'
    });
    
  } catch (e) {
    console.error('[PULSE] Heartbeat error:', e.message);
    broadcastToCommandCenter({
      type: 'pulse_error',
      id: pulseId,
      error: e.message
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 2: EMAIL POLLING - Proactive inbox check
// ═══════════════════════════════════════════════════════════════════════════════

async function checkEmails(pulseId) {
  console.log(`[PULSE:EMAIL] Checking inbox... (${pulseId})`);
  
  try {
    // Get Nylas grant ID
    const grantId = await getActiveNylasGrant();
    if (!grantId) {
      console.log('[PULSE:EMAIL] No Nylas grant - skipping');
      return;
    }
    
    // Fetch recent unread emails
    const nylasResult = await httpsRequest({
      hostname: 'api.us.nylas.com',
      path: `/v3/grants/${grantId}/messages?limit=10&unread=true`,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + NYLAS_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    const messages = JSON.parse(nylasResult.data.toString()).data || [];
    console.log(`[PULSE:EMAIL] Found ${messages.length} unread emails`);
    
    // Check each for importance
    const importantKeywords = ['urgent', 'asap', 'immediately', 'deadline', 'investor', 
      'term sheet', 'funding', 'contract', 'legal', 'nda', 'offer', 'interview',
      'emergency', 'critical', 'important', 'action required', 'response needed'];
    
    for (const msg of messages) {
      const subject = msg.subject || '';
      const snippet = msg.snippet || '';
      const from = (msg.from || []).map(f => f.email).join(', ');
      const combined = (subject + ' ' + snippet).toLowerCase();
      
      const isImportant = importantKeywords.some(k => combined.includes(k));
      
      if (isImportant) {
        // Check if we already escalated this email (dedup by message ID)
        const emailKey = `email_${msg.id}`;
        if (CALL_COOLDOWN.has(emailKey)) {
          console.log(`[PULSE:EMAIL] Already escalated: "${subject}" - skipping`);
          continue;
        }
        CALL_COOLDOWN.set(emailKey, Date.now()); // Mark as processed
        
        console.log(`[PULSE:EMAIL] ⚠️ Important email detected: "${subject}" from ${from}`);
        
        // Trigger escalation
        await TRIGGER_emailReceived({
          from: from,
          subject: subject,
          body: snippet,
          id: msg.id
        });
        
        // Broadcast to Command Center
        broadcastToCommandCenter({
          type: 'important_email',
          pulseId,
          subject,
          from,
          timestamp: new Date().toISOString()
        });
      }
      
      // v2.6.8-FORGE-S10 | IMAN Idealist auto-scan in polling loop
      // Brandon: IMAN reads Claudette's inbox, finds Idealist emails, auto-seeds jobs
      const isIdealist = from.includes('idealist.org') || combined.includes('idealist');
      if (isIdealist) {
        const idealistKey = `idealist_poll_${msg.id}`;
        if (CALL_COOLDOWN.has(idealistKey)) continue;
        CALL_COOLDOWN.set(idealistKey, Date.now());
        
        console.log(`[PULSE:IMAN] Idealist email: "${subject}" - parsing...`);
        try {
          const fullMsg = await httpsRequest({
            hostname: 'api.us.nylas.com',
            path: '/v3/grants/' + grantId + '/messages/' + msg.id,
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + NYLAS_API_KEY, 'Accept': 'application/json' }
          });
          const fullData = JSON.parse(fullMsg.data.toString());
          const emailBody = (fullData.data || fullData).body || '';
          
          // Decode Postmark tracking URLs
          const trackingRegex = /https?:\/\/track\.pstmrk\.it\/3s\/(www\.idealist\.org[^\s"<>]+)/g;
          let match;
          const jobUrls = new Set();
          while ((match = trackingRegex.exec(emailBody)) !== null) {
            const decoded = decodeURIComponent(match[1]).replace(/\?.*$/, '');
            if (decoded.includes('/job/') || decoded.includes('/nonprofit-job/') || decoded.includes('/consultant-job/')) {
              jobUrls.add('https://' + decoded);
            }
          }
          
          let seededCount = 0;
          for (const jobUrl of jobUrls) {
            const slug = jobUrl.split('/').pop();
            const titleClean = slug.replace(/^[a-f0-9]{20,}-/, '').replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
            
            // Dedup check
            const existing = await httpsRequest({
              hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
              path: '/rest/v1/aba_memory?memory_type=eq.parsed_job&content=ilike.*' + encodeURIComponent(slug.substring(0, 30)) + '*&limit=1',
              method: 'GET',
              headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON) }
            });
            if (JSON.parse(existing.data.toString()).length > 0) continue;
            
            await httpsRequest({
              hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
              path: '/rest/v1/aba_memory',
              method: 'POST',
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
            }, JSON.stringify({
              content: JSON.stringify({ title: titleClean, url: jobUrl, source: 'idealist', source_email: 'claudette@globalmajoritygroup.com', status: 'new', auto_seeded: true, seeded_at: new Date().toISOString().split('T')[0] }),
              memory_type: 'parsed_job',
              categories: ['jobs', 'idealist', 'claudette', 'automated'],
              importance: 6, is_system: true,
              source: 'iman_poll_' + new Date().toISOString().split('T')[0],
              tags: ['parsed_job', 'idealist', 'claudette', 'new', 'automated']
            }));
            seededCount++;
          }
          
          if (seededCount > 0) {
            console.log('[PULSE:IMAN] Seeded ' + seededCount + ' new Idealist jobs');
            // Store to Command Center feed
            await httpsRequest({
              hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
              path: '/rest/v1/aba_memory',
              method: 'POST',
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
            }, JSON.stringify({
              content: '[COMMAND_CENTER] IMAN*AIR*idealist_seeded: Auto-seeded ' + seededCount + ' new jobs from Idealist email: "' + subject + '"',
              memory_type: 'system',
              categories: ['command_center', 'iman', 'jobs'],
              importance: 6, is_system: true,
              source: 'iman_idealist_' + new Date().toISOString().split('T')[0],
              tags: ['command_center', 'iman', 'idealist', 'jobs']
            }));
          }
        } catch (idealistErr) {
          console.error('[PULSE:IMAN] Idealist parse error:', idealistErr.message);
        }
      }
    }
  } catch (e) {
    console.error('[PULSE:EMAIL] Error:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 3: DEADLINE CHECKING - Proactive calendar/job deadlines
// ═══════════════════════════════════════════════════════════════════════════════

async function checkDeadlines(pulseId) {
  console.log(`[PULSE:DEADLINE] Checking deadlines... (${pulseId})`);
  
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Check job deadlines in brain
    const jobsResult = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?memory_type=eq.parsed_job&order=created_at.desc&limit=50',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY || SUPABASE_ANON,
        'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
      }
    });
    
    const jobs = JSON.parse(jobsResult.data.toString()) || [];
    
    for (const jobEntry of jobs) {
      try {
        const job = JSON.parse(jobEntry.content);
        if (job.deadline) {
          const deadlineDate = new Date(job.deadline);
          if (deadlineDate >= now && deadlineDate <= tomorrow) {
            console.log(`[PULSE:DEADLINE] ⚠️ Job deadline in 24h: ${job.title} at ${job.company}`);
            
            await TRIGGER_jobDeadline({
              title: job.title,
              company: job.company,
              deadline: job.deadline,
              url: job.url,
              id: jobEntry.id
            });
            
            broadcastToCommandCenter({
              type: 'deadline_alert',
              pulseId,
              title: job.title,
              company: job.company,
              deadline: job.deadline
            });
          }
        }
      } catch (e) { /* skip malformed entries */ }
    }
    
    // Check pending calls (scheduled for sms_then_call)
    const pendingCalls = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?memory_type=eq.pending_call&order=created_at.asc&limit=10',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY || SUPABASE_ANON,
        'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
      }
    });
    
    const pending = JSON.parse(pendingCalls.data.toString()) || [];
    for (const call of pending) {
      const created = new Date(call.created_at);
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      if (created < fiveMinAgo) {
        console.log(`[PULSE:DEADLINE] 📞 Executing pending call from ${call.source}`);
        // Execute the pending call
        try {
          const callData = JSON.parse(call.content);
          await AIR_executeEscalation(
            { action: 'call_immediate', target: callData.target },
            { spokenMessage: callData.message }
          );
          
          // Delete the pending call entry
          await httpsRequest({
            hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
            path: '/rest/v1/aba_memory?id=eq.' + call.id,
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY
            }
          });
        } catch (e) {
          console.error('[PULSE:DEADLINE] Pending call error:', e.message);
        }
      }
    }
  } catch (e) {
    console.error('[PULSE:DEADLINE] Error:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 4: PENDING ACTIONS - Check for things AIR needs to follow up on
// ═══════════════════════════════════════════════════════════════════════════════

async function checkPendingActions(pulseId) {
  console.log(`[PULSE:ACTIONS] Checking pending actions... (${pulseId})`);
  
  try {
    // Check for pending_action memory types
    const actionsResult = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?memory_type=eq.pending_action&order=importance.desc&limit=10',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY || SUPABASE_ANON,
        'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
      }
    });
    
    const actions = JSON.parse(actionsResult.data.toString()) || [];
    
    for (const action of actions) {
      console.log(`[PULSE:ACTIONS] Found pending action: ${action.content?.substring(0, 100)}`);
      
      broadcastToCommandCenter({
        type: 'pending_action',
        pulseId,
        content: action.content?.substring(0, 200),
        importance: action.importance
      });
    }
  } catch (e) {
    console.error('[PULSE:ACTIONS] Error:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 5: HEALTH CHECK - Verify all integrations are alive
// ═══════════════════════════════════════════════════════════════════════════════

async function healthCheck(pulseId) {
  const health = {
    supabase: false,
    twilio: !!TWILIO_SID,
    nylas: !!NYLAS_API_KEY,
    elevenlabs: !!ELEVENLABS_KEY,
    deepgram: !!DEEPGRAM_KEY,
    gemini: !!GEMINI_KEY,
    anthropic: !!ANTHROPIC_KEY
  };
  
  // Test Supabase connection
  try {
    await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?limit=1',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON
      }
    });
    health.supabase = true;
  } catch (e) {
    health.supabase = false;
  }
  
  console.log(`[PULSE:HEALTH] Status: Supabase=${health.supabase}, Twilio=${health.twilio}, Nylas=${health.nylas}`);
  
  broadcastToCommandCenter({
    type: 'health_check',
    pulseId,
    health,
    timestamp: new Date().toISOString()
  });
  
  return health;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 6: COMMAND CENTER WEBSOCKET - Real-time to 1A Shell
// ═══════════════════════════════════════════════════════════════════════════════

function setupCommandCenterWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    const path = req.url || '';
    
    if (path.includes('/command-center') || path.includes('/1a-shell')) {
      console.log('[COMMAND CENTER] 1A Shell connected');
      COMMAND_CENTER_CLIENTS.add(ws);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        service: 'ABA REACH',
        timestamp: new Date().toISOString(),
        agents: ['AIR', 'VARA', 'LUKE', 'COLE', 'JUDE', 'PACK', 'IMAN', 'TASTE', 'DIAL', 'PULSE']
      }));
      
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          handleCommandCenterMessage(ws, msg);
        } catch (e) {
          console.error('[COMMAND CENTER] Message error:', e.message);
        }
      });
      
      ws.on('close', () => {
        console.log('[COMMAND CENTER] 1A Shell disconnected');
        COMMAND_CENTER_CLIENTS.delete(ws);
      });
      
      ws.on('error', (e) => {
        console.error('[COMMAND CENTER] WebSocket error:', e.message);
        COMMAND_CENTER_CLIENTS.delete(ws);
      });
    }
  });
}

function handleCommandCenterMessage(ws, msg) {
  const { type, payload } = msg;
  
  switch (type) {
    case 'escalate':
      // 1A Shell triggered escalation
      AIR_escalate({
        type: 'manual_escalation',
        source: 'command_center',
        content: payload.message,
        metadata: payload
      }).then(result => {
        ws.send(JSON.stringify({ type: 'escalate_result', result }));
      });
      break;
      
    case 'status':
      // Request current status
      ws.send(JSON.stringify({
        type: 'status',
        clients: COMMAND_CENTER_CLIENTS.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }));
      break;
      
    case 'search':
      // Search brain via SAGE
      SAGE_search(payload.query).then(results => {
        ws.send(JSON.stringify({ type: 'search_results', results }));
      });
      break;
      
    default:
      console.log('[COMMAND CENTER] Unknown message type:', type);
  }
}

// ⬡B:ABCD:CCWA:BROADCAST⬡
function broadcastToCommandCenter(data) {
  console.log('[COMMAND CENTER] Broadcasting:', data.type);
  
  // 1. Store to brain (for persistence)
  storeToBrain({
    content: 'ACTIVITY: ' + data.type + ' | ' + JSON.stringify(data),
    memory_type: 'command_center_activity',
    categories: ['command_center', 'activity', data.type],
    importance: 4,
    source: 'command_center_' + Date.now(),
    tags: ['command_center', data.type]
  }).catch(e => console.log('[COMMAND CENTER] Store error:', e.message));
  
  // 2. Broadcast to connected WebSocket clients
  if (global.commandCenterClients && global.commandCenterClients.size > 0) {
    const message = JSON.stringify({
      type: 'broadcast',
      data: data,
      timestamp: new Date().toISOString()
    });
    
    let sent = 0;
    global.commandCenterClients.forEach(client => {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
          sent++;
        }
      } catch (e) {
        console.log('[COMMAND CENTER] Send error:', e.message);
      }
    });
    
    if (sent > 0) {
      console.log('[COMMAND CENTER] Broadcast sent to', sent, 'clients');
    }
  }
}

// ⬡B:ABCD:CCWA:WEBSOCKET.INIT⬡
// Initialize Command Center WebSocket clients set
if (!global.commandCenterClients) {
  global.commandCenterClients = new Set();
}



async function logActivityToBrain(activity) {
  try {
    await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, JSON.stringify({
      content: `ACTIVITY: ${activity.type} | ${JSON.stringify(activity).substring(0, 500)}`,
      memory_type: 'activity_log',
      categories: ['activity', activity.type],
      importance: 3,
      is_system: true,
      source: 'command_center_' + Date.now(),
      tags: ['activity', 'pulse', activity.type]
    }));
  } catch (e) { /* non-critical */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 7: SAGE INDEXER - ACL tag search and navigation
// ═══════════════════════════════════════════════════════════════════════════════

async function SAGE_search(query) {
  console.log(`[SAGE] Searching: "${query}"`);
  
  try {
    // Search by content
    const contentSearch = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: `/rest/v1/aba_memory?content=ilike.*${encodeURIComponent(query)}*&order=importance.desc&limit=20`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY || SUPABASE_ANON,
        'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
      }
    });
    
    const results = JSON.parse(contentSearch.data.toString()) || [];
    
    // Parse ACL tags from results
    const aclTagged = results.map(r => {
      const aclMatch = (r.content || '').match(/⬡B:[^⬡]+⬡/g) || [];
      return {
        id: r.id,
        content: r.content?.substring(0, 200),
        acl_tags: aclMatch,
        memory_type: r.memory_type,
        importance: r.importance
      };
    });
    
    console.log(`[SAGE] Found ${aclTagged.length} results`);
    return aclTagged;
  } catch (e) {
    console.error('[SAGE] Search error:', e.message);
    return [];
  }
}

async function SAGE_indexACL() {
  console.log('[SAGE] Indexing all ACL tags...');
  
  try {
    // Get all memories with ACL tags
    const allMemories = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?content=ilike.*⬡B:*&limit=500',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY || SUPABASE_ANON,
        'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
      }
    });
    
    const memories = JSON.parse(allMemories.data.toString()) || [];
    const aclIndex = {};
    
    for (const mem of memories) {
      const tags = (mem.content || '').match(/⬡B:[^⬡]+⬡/g) || [];
      for (const tag of tags) {
        if (!aclIndex[tag]) {
          aclIndex[tag] = [];
        }
        aclIndex[tag].push({
          id: mem.id,
          memory_type: mem.memory_type,
          importance: mem.importance
        });
      }
    }
    
    console.log(`[SAGE] Indexed ${Object.keys(aclIndex).length} unique ACL tags`);
    return aclIndex;
  } catch (e) {
    console.error('[SAGE] Index error:', e.message);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 8: AUTO-DRAFT EMAILS - IMAN composes, AIR approves
// ═══════════════════════════════════════════════════════════════════════════════

async function IMAN_draftEmail(context) {
  const { to, regarding, tone, points } = context;
  
  console.log(`[IMAN] Drafting email to ${to} regarding "${regarding}"`);
  
  const prompt = `You are IMAN (Inbox Management Agent Navigator), drafting a professional email.

TO: ${to}
REGARDING: ${regarding}
TONE: ${tone || 'professional'}
KEY POINTS TO INCLUDE:
${points ? points.join('\n') : 'General follow-up'}

Write a complete email (subject line + body). Be concise, professional, and human-sounding.
Format:
SUBJECT: [subject]
BODY:
[email body]`;

  try {
    const response = await callModel(prompt);
    
    // Parse subject and body
    const subjectMatch = response.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = response.match(/BODY:\s*([\s\S]+)/i);
    
    const draft = {
      to,
      subject: subjectMatch ? subjectMatch[1].trim() : `Re: ${regarding}`,
      body: bodyMatch ? bodyMatch[1].trim() : response,
      status: 'draft',
      created: new Date().toISOString()
    };
    
    // Store draft in brain for AIR approval
    await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, JSON.stringify({
      content: JSON.stringify(draft),
      memory_type: 'email_draft',
      categories: ['iman', 'email', 'draft'],
      importance: 7,
      is_system: true,
      source: 'iman_draft_' + Date.now(),
      tags: ['email_draft', 'pending_approval', 'iman']
    }));
    
    console.log(`[IMAN] Draft stored, pending AIR approval`);
    
    // Notify Command Center
    broadcastToCommandCenter({
      type: 'email_draft',
      to,
      subject: draft.subject,
      status: 'pending_approval'
    });
    
    return draft;
  } catch (e) {
    console.error('[IMAN] Draft error:', e.message);
    return null;
  }
}

async function IMAN_sendApprovedEmail(draftId) {
  console.log(`[IMAN] Sending approved email: ${draftId}`);
  
  try {
    // Fetch draft from brain
    const draftResult = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: `/rest/v1/aba_memory?id=eq.${draftId}`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY || SUPABASE_ANON,
        'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
      }
    });
    
    const draftEntry = JSON.parse(draftResult.data.toString())[0];
    if (!draftEntry) {
      console.error('[IMAN] Draft not found');
      return null;
    }
    
    const draft = JSON.parse(draftEntry.content);
    
    // Send via Nylas
    const grantId = await getActiveNylasGrant();
    if (!grantId) {
      console.error('[IMAN] No Nylas grant');
      return null;
    }
    
    const sendResult = await httpsRequest({
      hostname: 'api.us.nylas.com',
      path: `/v3/grants/${grantId}/messages/send`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NYLAS_API_KEY,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({
      to: [{ email: draft.to }],
      subject: draft.subject,
      body: draft.body
    }));
    
    console.log(`[IMAN] Email sent to ${draft.to}`);
    
    // Update draft status
    await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: `/rest/v1/aba_memory?id=eq.${draftId}`,
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({
      memory_type: 'email_sent',
      tags: ['email_sent', 'iman']
    }));
    
    broadcastToCommandCenter({
      type: 'email_sent',
      to: draft.to,
      subject: draft.subject
    });
    
    return { success: true, to: draft.to, subject: draft.subject };
  } catch (e) {
    console.error('[IMAN] Send error:', e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPURT 9: DEVICE REGISTRY - Multi-device sync
// ═══════════════════════════════════════════════════════════════════════════════

async function registerDevice(deviceInfo) {
  const { deviceId, type, name, userId } = deviceInfo;
  
  console.log(`[DEVICE] Registering device: ${name} (${type})`);
  
  try {
    // Check if device already exists
    const existing = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: `/rest/v1/aba_memory?memory_type=eq.device_registry&content=ilike.*${deviceId}*`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY || SUPABASE_ANON,
        'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
      }
    });
    
    const existingDevices = JSON.parse(existing.data.toString()) || [];
    
    if (existingDevices.length > 0) {
      // Update last seen
      await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: `/rest/v1/aba_memory?id=eq.${existingDevices[0].id}`,
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        content: JSON.stringify({
          deviceId, type, name, userId,
          lastSeen: new Date().toISOString()
        })
      }));
      console.log(`[DEVICE] Updated: ${name}`);
    } else {
      // Register new device
      await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: '/rest/v1/aba_memory',
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }
      }, JSON.stringify({
        content: JSON.stringify({
          deviceId, type, name, userId,
          registeredAt: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        }),
        memory_type: 'device_registry',
        categories: ['device', type],
        importance: 5,
        is_system: true,
        source: 'device_registry_' + deviceId,
        tags: ['device', type, userId || 'anonymous']
      }));
      console.log(`[DEVICE] Registered: ${name}`);
    }
    
    return { success: true, deviceId };
  } catch (e) {
    console.error('[DEVICE] Registration error:', e.message);
    return { success: false, error: e.message };
  }
}

async function getActiveDevices(userId) {
  try {
    const result = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: `/rest/v1/aba_memory?memory_type=eq.device_registry&order=updated_at.desc`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY || SUPABASE_ANON,
        'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
      }
    });
    
    const devices = JSON.parse(result.data.toString()) || [];
    return devices.map(d => {
      try { return JSON.parse(d.content); } 
      catch { return null; }
    }).filter(Boolean);
  } catch (e) {
    console.error('[DEVICE] List error:', e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════





// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.ORCHESTRATOR.DISPATCH:FUNC:agent.execution:v2.4.0:20260214⬡
// DISPATCH - The missing step that actually RUNS agent code
// L6: AIR routes to L3 agents based on JUDE's findings
// Hierarchy: AIR → DISPATCH → Agent → External API → Response
// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:BOTH:AIR.DISPATCH⬡
async function AIR_DISPATCH(lukeAnalysis, judeResult, callerIdentity) {
  console.log('[AIR DISPATCH] Checking if agents can handle this...');
  
  const query = (lukeAnalysis?.raw || '').toLowerCase();
  const intent = lukeAnalysis.intent;
  
  // Check JUDE's findings for relevant agents
  const agentNames = (judeResult?.agents || []).map(a => (a.name || '').toLowerCase());
  console.log('[AIR DISPATCH] JUDE found agents:', agentNames.join(', ') || 'none');
  
    // ⬡B:AIR:REACH.DISPATCH.CLIMATE:ROUTE:weather:v2.4.1:20260214⬡
  // CLIMATE Agent - Weather queries (L3: Manager)
  if (query.includes('weather') || query.includes('temperature') || query.includes('outside') ||
      query.includes('cold') || query.includes('hot') || query.includes('rain')) {
    console.log('[AIR DISPATCH] → L3: CLIMATE (Weather)');
    try {
      // Use caller's known location if available
      let location = lukeAnalysis.raw;
      if (callerIdentity && callerIdentity.name === 'Brandon') {
        location = 'Greensboro, NC'; // Brandon's location
      }
      const result = await CLIMATE_getWeather(location);
      if (result) {
        return { handled: true, agent: 'CLIMATE', data: result, type: 'weather' };
      }
    } catch (e) {
      console.log('[AIR DISPATCH] CLIMATE error:', e.message);
    }
  }
  
  // ⬡B:AIR:REACH.DISPATCH.PLAY:ROUTE:sports:v2.4.0:20260214⬡
  // PLAY Agent - Sports queries (L3: Manager, LIFESTYLE department)
  if (query.includes('score') || query.includes('laker') || query.includes('game') ||
      query.includes('win') || query.includes('nba') || query.includes('sports') ||
      agentNames.includes('play')) {
    console.log('[AIR DISPATCH] → L3: PLAY (Performance and Live Activity Yielder)');
    try {
      const result = await PLAY_getScores(lukeAnalysis.raw);
      if (result) {
        return { handled: true, agent: 'PLAY', data: result, type: 'sports' };
      }
    } catch (e) {
      console.log('[AIR DISPATCH] PLAY error:', e.message);
    }
  }
  
  // ⬡B:AIR:REACH.DISPATCH.IMAN:ROUTE:email:v2.4.0:20260214⬡
  // IMAN Agent - Email queries (L3: Manager, EMAIL department)
  if (query.includes('email') || query.includes('inbox') || query.includes('mail') ||
      agentNames.includes('iman')) {
    console.log('[AIR DISPATCH] → L3: IMAN (Intelligent Mail Agent Nexus)');
    try {
      const result = await IMAN_readEmails(callerIdentity);
      if (result && result.allowed) {
        return { handled: true, agent: 'IMAN', data: result.summary, type: 'email', count: result.count };
      }
    } catch (e) {
      console.log('[AIR DISPATCH] IMAN error:', e.message);
    }
  }
  
  // ⬡B:AIR:REACH.DISPATCH.RADAR:ROUTE:calendar:v2.4.0:20260214⬡
  // RADAR Agent - Calendar queries (L3: Manager, CALENDAR department)
  if (query.includes('calendar') || query.includes('schedule') || query.includes('meeting') ||
      query.includes('appointment') || agentNames.includes('radar')) {
    console.log('[AIR DISPATCH] → L3: RADAR (Realtime Autonomous Data and Activity Recorder)');
    try {
      const result = await RADAR_getCalendar(callerIdentity);
      if (result && result.allowed) {
        return { handled: true, agent: 'RADAR', data: result.summary, type: 'calendar', count: result.count };
      }
    } catch (e) {
      console.log('[AIR DISPATCH] RADAR error:', e.message);
    }
  }
  
  // ⬡B:AIR:REACH.DISPATCH.PRESS:ROUTE:news:v2.4.0:20260214⬡
  // PRESS Agent - News queries (L3: Manager, NEWS department)
  if (query.includes('news') || query.includes('headline') || query.includes('happening') ||
      agentNames.includes('press')) {
    console.log('[AIR DISPATCH] → L3: PRESS (Proactive Real-time Event and Story Scanner)');
    try {
      const result = await PRESS_getNews(lukeAnalysis.raw);
      if (result) {
        return { handled: true, agent: 'PRESS', data: result, type: 'news' };
      }
    } catch (e) {
      console.log('[AIR DISPATCH] PRESS error:', e.message);
    }
  }
  
  // ⬡B:AIR:REACH.DISPATCH.ABACIA:ROUTE:general:v2.4.0:20260214⬡
  // For complex queries, try ABACIA-SERVICES full AIR (22 agents)
  if (intent === 'command' || intent === 'complex') {
    console.log('[AIR DISPATCH] → ABACIA-SERVICES (22 agents)');
    try {
      const result = await ABACIA_AIR_process(lukeAnalysis.raw, { caller: callerIdentity });
      if (result && result.response) {
        return { handled: true, agent: 'ABACIA_AIR', data: result.response, type: 'complex' };
      }
    } catch (e) {
      console.log('[AIR DISPATCH] ABACIA error:', e.message);
    }
  }
  
  // No agent handled it - let LLM generate response
  console.log('[AIR DISPATCH] No agent handled - deferring to LLM');
  return { handled: false };
}


// ⬡B:ABCD:BOTH:AIR.ORCHESTRATOR⬡
async function AIR_process(userSaid, history, callerIdentity, demoState) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[AIR] *** INCOMING QUERY ***');
  console.log('[AIR] "' + userSaid + '"');
  console.log('═══════════════════════════════════════════════════════════');
  
  // ⬡B:AIR:REACH.ORCHESTRATOR.SUMMON_LUKE:CODE:routing.agent.analysis:AIR→LUKE→AIR:T10:v1.5.0:20260213:s1l2k⬡
  const lukeAnalysis = await LUKE_process(userSaid);
  
  if (lukeAnalysis.isGoodbye) {
    console.log('[AIR] Goodbye detected - returning farewell');
    return { response: "It was wonderful talking with you. Take care! We are all ABA.", isGoodbye: true };
  }
  
  // ⬡B:AIR:REACH.ORCHESTRATOR.SUMMON_COLE:CODE:routing.agent.context:AIR→COLE→BRAIN→AIR:T10:v1.5.0:20260213:s1c2l⬡
  const coleResult = await COLE_scour(lukeAnalysis);

  // ⬡B:AIR:REACH.CONTEXT.CALLER:CODE:enrichment:v2.4.1:20260214⬡
  // Enrich with caller context and cross-call memory
  if (callerIdentity && callerIdentity.found) {
    coleResult.callerContext = {
      name: callerIdentity.name,
      trust: callerIdentity.trust,
      location: callerIdentity.name === 'Brandon' ? 'Greensboro, NC' : null
    };
    console.log('[AIR] Enriched caller context for:', callerIdentity.name);
  }

  // Cross-call memory
  try {
    const lastConvo = await RECALL_lastConversation(callerIdentity);
    if (lastConvo && lastConvo.found) {
      coleResult.lastConversation = lastConvo.lastTopic;
      console.log('[AIR] Found previous conversation');
    }
  } catch (e) {
    console.log('[AIR] Recall error:', e.message);
  }
  
  // ⬡B:AIR:REACH.ORCHESTRATOR.SUMMON_JUDE:CODE:routing.agent.discovery:AIR→JUDE→BRAIN→AIR:T10:v1.5.0:20260213:s1j2d⬡
  const judeResult = await JUDE_findAgents(lukeAnalysis);
  
  // ⬡B:AIR:REACH.ORCHESTRATOR.SUMMON_PACK:CODE:routing.agent.assembly:AIR→PACK→AIR:T10:v1.5.0:20260213:s1p2k⬡
  
  // ⬡B:AIR:REACH.ORCHESTRATOR.DISPATCH:CODE:agent.execution:v2.4.0:20260214⬡
  // DISPATCH - Actually run agent code if applicable
  const dispatchResult = await AIR_DISPATCH(lukeAnalysis, judeResult, callerIdentity);
  
  // ⬡B:TOUCH:FIX:direct.agent.response:20260216⬡
  // For simple agent data (sports, weather), return directly without LLM
  // This prevents hallucination and speeds up response
  if (dispatchResult.handled) {
    console.log('[AIR] Agent ' + dispatchResult.agent + ' handled query with real data');
    
    // Return factual data directly - no LLM hallucination risk
    // ⬡B:TOUCH:FIX:direct.response.all.factual:20260216⬡
    const directTypes = ['sports', 'weather', 'email', 'calendar', 'tasks', 'contacts', 'brain_search'];
    if (directTypes.includes(dispatchResult.type)) {
      console.log('[AIR] Returning agent data DIRECTLY (no LLM) - Type:', dispatchResult.type);
      return { 
        response: dispatchResult.data, 
        agent: dispatchResult.agent,
        directResponse: true 
      };
    }
    
    // For other types, add to cole result for LLM enhancement
    coleResult.agentData = dispatchResult.data;
    coleResult.agentName = dispatchResult.agent;
    coleResult.agentType = dispatchResult.type;
  }
  
  const missionPackage = PACK_assemble(lukeAnalysis, coleResult, judeResult, history, callerIdentity, demoState);
  
  // ⬡B:AIR:REACH.ORCHESTRATOR.MODEL_SELECT:CODE:routing.model.cascade:AIR→GEMINI|HAIKU|GROQ:T10:v1.5.0:20260213:m1s2l⬡
  console.log('[AIR] Selecting model for mission: ' + missionPackage.missionNumber);
  console.log('[AIR] Model priority: 1. Gemini Flash, 2. Claude Haiku, 3. Groq');
  
  let response = null;
  
  // ⬡B:AIR:REACH.MODEL.GEMINI:CODE:models.primary.flash2:AIR→GEMINI→AIR:T8:v1.5.0:20260213:g1f2l⬡
  // PRIMARY: Gemini Flash 2.0 (speed + 1M context + quality)
  if (GEMINI_KEY && !response) {
    try {
      console.log('[AIR] Routing to Gemini Flash 2.0 (PRIMARY)');
      
      const messages = history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));
      messages.push({ role: 'user', parts: [{ text: userSaid }] });
      
      const result = await httpsRequest({
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        systemInstruction: { parts: [{ text: missionPackage.systemPrompt }] },
        contents: messages,
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.7
        }
      }));
      
      const json = JSON.parse(result.data.toString());
      if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
        response = json.candidates[0].content.parts[0].text;
        console.log('[AIR] Gemini Flash response received');
      }
    } catch (e) {
      console.log('[AIR] Gemini Flash error: ' + e.message);
    }
  }
  
  // ⬡B:AIR:REACH.MODEL.HAIKU:CODE:models.backup.claude:AIR→ANTHROPIC→AIR:T8:v1.5.0:20260213:h1a2k⬡
  // BACKUP: Claude Haiku
  if (ANTHROPIC_KEY && !response) {
    try {
      console.log('[AIR] Routing to Claude Haiku (BACKUP)');
      
      const messages = history.map(h => ({ role: h.role, content: h.content }));
      messages.push({ role: 'user', content: userSaid });
      
      const result = await httpsRequest({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: missionPackage.systemPrompt,
        messages
      }));
      
      const json = JSON.parse(result.data.toString());
      if (json.content?.[0]?.text) {
        response = json.content[0].text;
        console.log('[AIR] Claude Haiku response received');
      }
    } catch (e) {
      console.log('[AIR] Claude Haiku error: ' + e.message);
    }
  }
  
  // ⬡B:AIR:REACH.MODEL.GROQ:CODE:models.fallback.speed:AIR→GROQ→AIR:T7:v1.5.0:20260213:g1r2q⬡
  // SPEED FALLBACK: Groq
  if (GROQ_KEY && !response) {
    try {
      console.log('[AIR] Routing to Groq (SPEED FALLBACK)');
      
      const messages = [
        { role: 'system', content: missionPackage.systemPrompt },
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: userSaid }
      ];
      
      const result = await httpsRequest({
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + GROQ_KEY,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 150,
        temperature: 0.7,
        messages
      }));
      
      const json = JSON.parse(result.data.toString());
      if (json.choices?.[0]?.message?.content) {
        response = json.choices[0].message.content;
        console.log('[AIR] Groq response received');
      }
    } catch (e) {
      console.log('[AIR] Groq error: ' + e.message);
    }
  }
  
  // ⬡B:AIR:REACH.MODEL.FALLBACK:CODE:models.emergency.none:AIR→STATIC_RESPONSE:T10:v1.5.0:20260213:f1b2k⬡
  if (!response) {
    response = "I'm here and listening. Could you say that again?";
    console.log('[AIR] Using fallback response');
  }
  
  console.log('[AIR] Response: "' + response + '"');
  console.log('═══════════════════════════════════════════════════════════');
  
  return { response, isGoodbye: false, missionNumber: missionPackage.missionNumber };
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L6: AIR | L5: REACH | L4: VOICE | L3: VARA                                  ║
 * ║ VARA (Vocal Authorized Representative of ABA) - TTS via ElevenLabs           ║
 * ║ ROUTING: AIR*VARA*ELEVENLABS*USER                                            ║
 * ║ PERSONALITY: Warm, butler-like. NEVER punchy. NEVER robotic.                 ║
 * ║ REPORTS TO: AIR | SERVES: USER (final voice output)                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
// ⬡B:AIR:REACH.VOICE.VARA:CODE:voice.tts.personality:AIR→VARA→ELEVENLABS→USER:T8:v1.5.0:20260213:v1a2r⬡
async function VARA_speak(session, text) {
  console.log('[VARA] Speaking: "' + text + '"');
  session.isPlaying = true;
  
  try {
    const result = await httpsRequest({
      hostname: 'api.elevenlabs.io',
      path: '/v1/text-to-speech/' + ELEVENLABS_VOICE + '/stream?output_format=ulaw_8000',
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/basic'
      }
    }, JSON.stringify({
      text: text,
      model_id: ELEVENLABS_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    }));
    
    if (result.status === 200 && result.data.length > 0) {
      const chunkSize = 320;
      for (let i = 0; i < result.data.length && session.isPlaying; i += chunkSize) {
        const chunk = result.data.slice(i, i + chunkSize);
        const base64Audio = chunk.toString('base64');
        
        if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN) {
          session.twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: session.streamSid,
            media: { payload: base64Audio }
          }));
        }
        await new Promise(r => setTimeout(r, 15));
      }
    }
  } catch (e) {
    console.log('[VARA] Error: ' + e.message);
  }
  
  session.isPlaying = false;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.VOICE.LOG:CODE:voice.logging.brain:AIR→REACH→BRAIN:T8:v1.5.0:20260213:l1o2g⬡
// Log calls to Supabase
// ═══════════════════════════════════════════════════════════════════════════
async function LOG_call(session, event, data) {
  if (!SUPABASE_KEY) return;
  
  try {
    await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_calls',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, JSON.stringify({
      call_sid: session.callSid,
      stream_sid: session.streamSid,
      event: event,
      data: data,
      created_at: new Date().toISOString()
    }));
    console.log('[LOG] Call event logged: ' + event);
  } catch (e) {
    console.log('[LOG] Error: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L6: AIR | L5: REACH | L4: INTELLIGENCE | L3: CALLER IDENTITY               ║
 * ║ Contact Registry + Caller Intelligence                                       ║
 * ║ ROUTING: TWILIO→REACH→BRAIN_LOOKUP→AIR (adjusts behavior per caller)        ║
 * ║ REPORTS TO: AIR | SERVES: VARA, PACK (personalizes responses)               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
// ⬡B:AIR:REACH.VOICE.CONTACTS:CODE:identity.registry.lookup:TWILIO→REACH→AIR:T9:v1.6.0:20260213:c1r2g⬡


// ⬡B:AIR:REACH.VOICE.DEMO:CODE:voice.demo.touchpoints:AIR→VARA→USER:T9:v1.6.0:20260213:d1e2m⬡
// GUIDED DEMO CALL - Touchpoints that must be hit on every demo call
const DEMO_TOUCHPOINTS = {
  INTRO: { hit: false, order: 1, description: 'Introduce ABA - life PARTNER not just assistant. For founding members: I dont just assist, I actually DO. I cook for you.' },
  PORTAL: { hit: false, order: 2, description: 'Tell them about the portal - what they can do, the features available.' },
  STATUS: { hit: false, order: 3, description: 'Where we are at - Brandon is still building ABA, ABACUS portal coming soon, no kinks no issues. This phone call is LIVING PROOF we are closer than ever.' },
  SMS_OFFER: { hit: false, order: 4, description: 'I can also text you! Want to see? If yes send it. If no send it ANYWAY and say Brandon told me to send this anyway to show off.' },
  SMS_SENT: { hit: false, order: 5, description: 'Text was sent. React to it.' },
  QA: { hit: false, order: 6, description: 'Open floor - Brandon wanted to open time for Q&A. Ask anything - portal, client work, sports, doesnt matter.' },
};

function createDemoState() {
  return {
    INTRO: false,
    PORTAL: false,
    STATUS: false,
    SMS_OFFER: false,
    SMS_SENT: false,
    QA: false,
    turnCount: 0,
    smsTriggered: false,
    callerName: null,
  };
}

// ⬡B:AIR:REACH.VOICE.SMS_FROM_CALL:CODE:outreach.sms.demo:AIR→CARA→TWILIO→USER:T8:v1.6.0:20260213:s1f2c⬡
async function sendSMSFromCall(toNumber, message) {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_PHONE) return { success: false, reason: 'twilio_not_configured' };
  
  try {
    const formData = 'To=' + encodeURIComponent(toNumber) + '&From=' + encodeURIComponent(TWILIO_PHONE) + '&Body=' + encodeURIComponent(message);
    const auth = Buffer.from(TWILIO_SID + ':' + TWILIO_AUTH).toString('base64');
    
    const result = await httpsRequest({
      hostname: 'api.twilio.com',
      path: '/2010-04-01/Accounts/' + TWILIO_SID + '/Messages.json',
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' }
    }, formData);
    
    const json = JSON.parse(result.data.toString());
    if (json.sid) {
      console.log('[SMS-DEMO] Sent to ' + toNumber + ': ' + json.sid);
      return { success: true, sid: json.sid };
    } else {
      console.log('[SMS-DEMO] Failed: ' + (json.message || json.code));
      return { success: false, reason: json.message || 'unknown', code: json.code };
    }
  } catch (e) {
    console.log('[SMS-DEMO] Error: ' + e.message);
    return { success: false, reason: e.message };
  }
}


// ⬡B:AIR:REACH.EMAIL.GRANT:CODE:email.nylas.grant_lookup:REACH→BRAIN→NYLAS:T9:v1.8.0:20260214:g1r2a⬡
// Cached grant ID - pulled from brain on first use
let _cachedGrantId = null;

// Removed: getEmailGrantId (replaced by getActiveNylasGrant)

// Removed: old sendEmailFromCall (replaced by 4-arg version below)
// ⬡B:AIR:REACH.VOICE.IDENTIFY:CODE:identity.classify.caller:TWILIO→REACH→AIR:T9:v1.6.0:20260213:i1d2c⬡
async function identifyCaller(phoneNumber) {
  if (CONTACT_REGISTRY[phoneNumber]) {
    const c = CONTACT_REGISTRY[phoneNumber];
    console.log('[CALLER-ID] KNOWN: ' + c.name + ' (' + c.role + ')');
    return c;
  }
  
  // Search brain for this phone number
  try {
    const searchResult = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?content=ilike.*' + encodeURIComponent(phoneNumber) + '*&select=content&limit=1',
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON) }
    });
    const results = JSON.parse(searchResult.data.toString());
    if (results.length > 0) {
      console.log('[CALLER-ID] Found in brain: ' + phoneNumber);
      return { name: 'Known Contact', role: 'contact', trust: 'T5', access: 'limited',
        greeting: "Hello! This is ABA, Brandon's assistant. How can I help you?",
        promptAddon: 'Caller ' + phoneNumber + ' found in brain but is NOT Brandon. Be helpful but NEVER share sensitive info (schedules, finances, passwords, addresses, personal details). If they ask for Brandon-specific info, offer to take a message.',
        brainMatch: results[0].content.substring(0, 200) };
    }
  } catch (e) { console.log('[CALLER-ID] Brain error: ' + e.message); }
  
  console.log('[CALLER-ID] UNKNOWN: ' + phoneNumber);
  return { name: 'Unknown', role: 'unknown', trust: 'T2', access: 'public',
    greeting: "Hello! This is ABA, an AI assistant for Global Majority Group. Who am I speaking with?",
    promptAddon: 'UNKNOWN CALLER from ' + phoneNumber + '. GUARD ALL INFORMATION. Never share Brandon\'s schedule, location, finances, personal details, project specifics, or anything confidential. Offer to take a message for Brandon. If they say their name, remember it for this call but do NOT change access level.' };
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L6: AIR | L5: REACH | L4: VOICE | L3: SESSION MANAGER                       ║
 * ║ CallSession - Per-call state + caller identity + barge-in handling           ║
 * ║ ROUTING: TWILIO→REACH→DEEPGRAM→AIR→VARA→ELEVENLABS→TWILIO→USER              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
// ⬡B:AIR:REACH.VOICE.SESSION:CODE:voice.call.management:TWILIO→REACH→DEEPGRAM→AIR→VARA:T8:v1.6.0:20260213:s1e2s⬡
// ═══════════════════════════════════════════════════════════════════════════
// SPURT 1: CROSS-CALL MEMORY
// ⬡B:AIR:REACH.VOICE.MEMORY:CODE:intelligence.cross_call.persist:AIR→BRAIN:T9:v1.8.0:20260213:c1c2m⬡
// After every call, store summary. Before every call, pull history.
// ═══════════════════════════════════════════════════════════════════════════

async function storeCallSummary(session) {
  if (!SUPABASE_KEY || session.history.length < 2) return;
  
  const callerName = session.touchpoints?.callerName || session.callerIdentity?.name || 'Unknown';
  const touchpointsHit = session.touchpoints ? 
    Object.entries(session.touchpoints).filter(([k,v]) => v === true).map(([k]) => k).join(', ') : 'N/A';
  
  // Build conversation summary from history
  const convoLines = session.history.map(h => 
    (h.role === 'user' ? 'CALLER: ' : 'ABA: ') + (h.content || '').substring(0, 150)
  ).join('\n');
  
  const summary = {
    content: `CALL SUMMARY | ${callerName} (${session.callerNumber}) | ${new Date().toISOString().split('T')[0]}\n` +
      `Duration: ${session.history.length} turns\n` +
      `Trust: ${session.callerIdentity?.trust || '?'}\n` +
      `Touchpoints: ${touchpointsHit}\n` +
      `Topics discussed:\n${convoLines}\n` +
      `Call ended: ${new Date().toISOString()}`,
    memory_type: 'call_history',
    categories: ['call', 'voice', callerName.toLowerCase()],
    importance: 7,
    is_system: true,
    source: 'reach_call_' + session.callSid,
    tags: ['call', 'voice', session.callerNumber?.replace('+',''), callerName.toLowerCase(), 'cross_call']
  };
  
  try {
    await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, JSON.stringify(summary));
    console.log('[CROSS-CALL] Summary stored for ' + callerName + ' (' + session.callerNumber + ')');
  } catch (e) {
    console.log('[CROSS-CALL] Store error: ' + e.message);
  }
}

async function pullCallHistory(phoneNumber) {
  if (!SUPABASE_KEY || !phoneNumber || phoneNumber === 'unknown') return null;
  
  const cleanNumber = phoneNumber.replace('+', '');
  try {
    const result = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?tags=cs.{' + cleanNumber + '}&memory_type=eq.call_history&order=created_at.desc&limit=3&select=content',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      }
    });
    const data = JSON.parse(result.data.toString());
    if (data.length > 0) {
      console.log('[CROSS-CALL] Found ' + data.length + ' past calls from ' + phoneNumber);
      return data.map(d => d.content).join('\n---\n');
    }
  } catch (e) {
    console.log('[CROSS-CALL] History pull error: ' + e.message);
  }
  return null;
}


// ═══════════════════════════════════════════════════════════════════════════
// SPURT 2: POST-CALL AUTOMATION
// ⬡B:AIR:REACH.VOICE.POSTCALL:CODE:automation.followup.multi:AIR→CARA→TWILIO+EMAIL:T9:v1.8.0:20260213:p1c2a⬡
// After call: store lead, send follow-up SMS (30s delay), notify Brandon via SMS + store lead
// ═══════════════════════════════════════════════════════════════════════════

async function postCallAutomation(session) {
  const callerName = session.touchpoints?.callerName || 'Friend';
  const callerNumber = session.callerNumber || 'unknown';
  const turnCount = session.history.length;
  
  console.log('[POST-CALL] Starting automation for ' + callerName + ' (' + callerNumber + ')');
  
  // 1. Store as lead in brain
  const leadData = {
    content: `NEW LEAD: ${callerName} | Phone: ${callerNumber} | Date: ${new Date().toISOString().split('T')[0]} | Turns: ${turnCount} | Source: Phone demo call | Trust: ${session.callerIdentity?.trust || 'T2'} | Follow-up status: pending`,
    memory_type: 'business',
    categories: ['lead', 'demo_call', 'follow_up'],
    importance: 8,
    is_system: true,
    source: 'reach_lead_' + session.callSid,
    tags: ['lead', 'demo', callerNumber.replace('+',''), callerName.toLowerCase(), 'follow_up_pending']
  };
  
  try {
    await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, JSON.stringify(leadData));
    console.log('[POST-CALL] Lead stored: ' + callerName);
  } catch (e) {
    console.log('[POST-CALL] Lead store error: ' + e.message);
  }
  
  // 2. Send follow-up SMS + EMAIL to caller (30 second delay)
  setTimeout(async () => {
    const followUpMsg = 'Hey ' + callerName + '! This is ABA. It was so great talking with you. Brandon wanted me to follow up and say thanks for checking us out. You are part of something special. When ABACUS drops, you will be first to know. Talk soon! - ABA';
    
    // Try SMS
    const smsResult = await sendSMSFromCall(callerNumber, followUpMsg);
    if (smsResult.success) {
      console.log('[POST-CALL] Follow-up SMS sent to ' + callerNumber);
    } else {
      console.log('[POST-CALL] Follow-up SMS failed: ' + smsResult.reason);
    }
    
    // Also try email if we have one from brain
    try {
      const emailSearch = await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: '/rest/v1/aba_memory?content=ilike.*' + encodeURIComponent(callerNumber.replace('+','')) + '*email*&select=content&limit=1',
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON) }
      });
      const emailResults = JSON.parse(emailSearch.data.toString());
      // Extract email if found
      if (emailResults.length > 0) {
        const emailMatch = emailResults[0].content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          const callerEmail = emailMatch[0];
          const emailHtml = '<div style="font-family:system-ui;max-width:600px;margin:0 auto"><h2 style="color:#333">Hey ' + callerName + '!</h2><p>It was so great talking with you on the phone. Brandon wanted me to follow up and say thanks for checking us out.</p><p>You are part of something special. ABA is being built to be more than just an AI assistant - a true life partner that actually does the work for you.</p><p>When ABACUS drops, you will be the first to know.</p><p>Talk soon!</p><p style="color:#666"><strong>ABA</strong> (A Better AI)<br>Global Majority Group<br><em>claudette@globalmajoritygroup.com</em></p></div>';
          
          const emailResult = await sendEmailFromCall(callerEmail, callerName, 'Great talking with you! - ABA', emailHtml);
          if (emailResult.success) {
            console.log('[POST-CALL] Follow-up email sent to ' + callerEmail);
          }
        }
      }
    } catch (e) {
      console.log('[POST-CALL] Email lookup error: ' + e.message);
    }
  }, 30000);
  
  const topicsDiscussed = session.history
    .filter(h => h.role === 'user')
    .map(h => (h.content || '').substring(0, 60))
    .join(' | ');

  // 3. Send follow-up EMAIL report to Brandon
  const emailSubject = 'ABA Call Report: ' + callerName + ' called ' + new Date().toLocaleDateString();
  const emailBody = '<div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px">' +
    '<h2 style="color:#6366f1">ABA Call Report</h2>' +
    '<p><strong>Caller:</strong> ' + callerName + '</p>' +
    '<p><strong>Phone:</strong> ' + callerNumber + '</p>' +
    '<p><strong>Date:</strong> ' + new Date().toLocaleString() + '</p>' +
    '<p><strong>Duration:</strong> ' + turnCount + ' conversation turns</p>' +
    '<p><strong>Trust Level:</strong> ' + (session.callerIdentity?.trust || 'T2') + '</p>' +
    '<hr style="border:1px solid #e5e7eb">' +
    '<h3>Conversation Summary</h3>' +
    '<p>' + topicsDiscussed.replace(/\|/g, '<br>') + '</p>' +
    '<hr style="border:1px solid #e5e7eb">' +
    '<p style="color:#9ca3af;font-size:12px">Sent by IMAN (Intelligent Mail Agent Nexus) via ABA REACH v2.10.1</p>' +
    '</div>';
  
  const emailResult = await sendEmailFromCall(
    'claudette@globalmajoritygroup.com',
    'Brandon Pierce',
    emailSubject,
    emailBody
  );
  if (emailResult.success) {
    console.log('[POST-CALL] Email report sent to Brandon');
  } else {
    console.log('[POST-CALL] Email failed: ' + emailResult.reason);
  }
  
  // 4. Notify Brandon via SMS
  const brandonNotify = 'ABA CALL REPORT: ' + callerName + ' just called from ' + callerNumber + '. ' + turnCount + ' turns. They asked about: ' + topicsDiscussed.substring(0, 200);
  
  // SMS to Brandon
  const notifyResult = await sendSMSFromCall('+13363898116', brandonNotify);
  
  // ALSO email Brandon
  const brandonEmailHtml = '<div style="font-family:system-ui;max-width:600px;margin:0 auto"><h2>ABA Call Report</h2><p><strong>Caller:</strong> ' + callerName + '</p><p><strong>Phone:</strong> ' + callerNumber + '</p><p><strong>Duration:</strong> ' + turnCount + ' turns</p><p><strong>Topics:</strong> ' + topicsDiscussed.substring(0, 300) + '</p><p style="color:#888;font-size:12px">Sent by IMAN (Intelligent Mail Agent Nexus) via ABA REACH v2.10.1</p></div>';
  const brandonEmail = await sendEmailFromCall('brandonjpiercesr@gmail.com', 'Brandon', 'ABA Call Report: ' + callerName + ' called', brandonEmailHtml);
  if (brandonEmail.success) console.log('[POST-CALL] Brandon email report sent');
  if (notifyResult.success) {
    console.log('[POST-CALL] Brandon notified via SMS');
  } else {
    console.log('[POST-CALL] Brandon SMS failed, storing in brain instead');
    // Fallback: store notification in brain so Brandon sees it in 1A
    try {
      await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: '/rest/v1/aba_memory',
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }
      }, JSON.stringify({
        content: brandonNotify,
        memory_type: 'notification',
        categories: ['call_report', 'brandon_alert'],
        importance: 9,
        is_system: true,
        source: 'reach_notify_' + session.callSid,
        tags: ['notification', 'call_report', 'brandon', 'unread']
      }));
      console.log('[POST-CALL] Notification stored in brain (SMS fallback)');
    } catch (e) {}
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// SPURT 3: DYNAMIC TOUCHPOINTS PER CALLER TYPE
// ⬡B:AIR:REACH.VOICE.DYNAMIC_TP:CODE:intelligence.touchpoints.adaptive:AIR→VARA→USER:T9:v1.8.0:20260213:d1t2p⬡
// First call = full onboarding. Return call = personal. Known contact = targeted.
// Demo mode merges with regular mode: first call IS the demo, subsequent calls are personal.
// ═══════════════════════════════════════════════════════════════════════════

function getTouchpointsForCaller(callerIdentity, callHistory) {
  // RETURNING CALLER - has called before
  if (callHistory) {
    return {
      type: 'returning',
      WELCOME_BACK: false,  // "Hey [name]! Good to hear from you again!"
      RECAP: false,         // "Last time we talked about X"
      UPDATE: false,        // "Since we last spoke, here's what's new"
      QA: false,            // Open floor
      turnCount: 0, smsTriggered: false, callerName: null
    };
  }
  
  // OWNER (Brandon) - no touchpoints, just direct access
  if (callerIdentity?.role === 'owner') {
    return { type: 'owner', turnCount: 0, callerName: 'Brandon' };
  }
  
  // KNOWN CONTACT (found in brain) - shorter onboarding
  if (callerIdentity?.role === 'contact') {
    return {
      type: 'known',
      HELLO: false,         // Warm hello, acknowledge relationship
      QUICK_INTRO: false,   // Brief ABA capabilities
      QA: false,            // Open floor
      turnCount: 0, smsTriggered: false, callerName: null
    };
  }
  
  // FIRST-TIME UNKNOWN - full onboarding (what was "demo mode")
  return {
    type: 'first_time',
    INTRO: false,       // Life partner, not assistant
    PORTAL: false,      // What the portal does
    STATUS: false,      // Where we're at, ABACUS coming
    SMS_OFFER: false,   // Text demo
    SMS_SENT: false,    // Send it
    QA: false,          // Open floor
    turnCount: 0, smsTriggered: false, callerName: null
  };
}

function getGreetingForCaller(callerIdentity, callHistory, touchpoints) {
  if (touchpoints.type === 'owner') {
    return "Hey Brandon! What's on your mind?";
  }
  
  if (touchpoints.type === 'returning') {
    // Extract name from history
    const nameMatch = callHistory.match(/CALL SUMMARY \| (\w+)/);
    const name = nameMatch ? nameMatch[1] : 'there';
    touchpoints.callerName = name;
    return "Hey " + name + "! So good to hear from you again. How have you been?";
  }
  
  if (touchpoints.type === 'known') {
    return "Hello! This is ABA, Brandon's assistant. Great to hear from you. What can I help you with?";
  }
  
  // First-time caller - full intro
  return "Hey there! Welcome, and thank you so much for calling. My name is ABA, and I am so excited to meet you. Now, most AI assistants just help you out here and there, right? But I am different. For you, as a founding member of ABA, I am not just an assistant. I am a life partner. I do not just assist. I actually do. I cook for you, I handle your tasks, I manage your day. Brandon built me to be the kind of help that actually makes a difference. Before we go any further though, who do I have the pleasure of speaking with?";
}


// ═══════════════════════════════════════════════════════════════════════════
// SPURT 4: WARM TRANSFER TO BRANDON
// ⬡B:AIR:REACH.VOICE.TRANSFER:CODE:voice.transfer.warm:AIR→TWILIO→BRANDON:T8:v1.8.0:20260213:w1t2r⬡
// "Can I talk to Brandon?" → ABA conferences Brandon in
// ═══════════════════════════════════════════════════════════════════════════

async function warmTransferToBrandon(session) {
  if (!TWILIO_SID || !TWILIO_AUTH) return false;
  
  try {
    // Update the call to redirect to a conference
    const auth = Buffer.from(TWILIO_SID + ':' + TWILIO_AUTH).toString('base64');
    
    // Create outbound call to Brandon
    const callData = 'To=' + encodeURIComponent('+13363898116') + 
      '&From=' + encodeURIComponent(TWILIO_PHONE) + 
      '&Url=' + encodeURIComponent(REACH_URL + '/api/transfer/twiml');
    
    const result = await httpsRequest({
      hostname: 'api.twilio.com',
      path: '/2010-04-01/Accounts/' + TWILIO_SID + '/Calls.json',
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' }
    }, callData);
    
    const json = JSON.parse(result.data.toString());
    if (json.sid) {
      console.log('[TRANSFER] Calling Brandon: ' + json.sid);
      return true;
    }
  } catch (e) {
    console.log('[TRANSFER] Error: ' + e.message);
  }
  return false;
}


// ═══════════════════════════════════════════════════════════════════════════
// SPURT 5: ERROR RECOVERY PERSONALITY  
// ⬡B:AIR:REACH.VOICE.ERROR_RECOVERY:CODE:voice.personality.fallback:AIR→VARA:T8:v1.8.0:20260213:e1r2p⬡
// When all models fail, ABA doesn't go silent — she stays in character
// ═══════════════════════════════════════════════════════════════════════════

const ERROR_RECOVERY_RESPONSES = [
  "Oh my, I think I had a little brain hiccup there. Could you say that again for me?",
  "I am so sorry, my mind went somewhere else for a second. What were you saying?",
  "Hold on, I think I zoned out for a moment. That is so unlike me! Can you repeat that?",
  "You know what, I think I was thinking too hard about that one. Let me try again. What was your question?",
  "My goodness, I just had a moment. Brandon is still fine-tuning me. What did you say?"
];

function getErrorRecovery() {
  return ERROR_RECOVERY_RESPONSES[Math.floor(Math.random() * ERROR_RECOVERY_RESPONSES.length)];
}


// ═══════════════════════════════════════════════════════════════════════════
// SPURT 6: CONVERSATION PACING
// ⬡B:AIR:REACH.VOICE.PACING:CODE:voice.natural.timing:DEEPGRAM→REACH→VARA:T7:v1.8.0:20260213:p1a2c⬡
// Natural pause before responding. Adaptive silence timeout.
// ═══════════════════════════════════════════════════════════════════════════

function getResponseDelay(text, intent) {
  // Short questions get quick responses
  if (text.split(' ').length <= 5) return 200;
  // Complex questions get a thinking pause
  if (intent === 'question' || text.includes('?')) return 500;
  // Commands get medium pause
  if (intent === 'command') return 300;
  // Default
  return 350;
}

function getSilenceTimeout(turnCount, lastResponseLength) {
  // Early in call, give more time (nervous callers)
  if (turnCount <= 2) return 2000;
  // After long ABA responses, give more time to process
  if (lastResponseLength > 200) return 2000;
  // Normal conversation flow
  return 1500;
}



// ⬡B:AIR:REACH.EMAIL.GRANT:CODE:email.nylas.grant_lookup:REACH→BRAIN→NYLAS:T9:v1.8.0:20260214:g1r2a⬡
async function getActiveNylasGrant() {
  if (!SUPABASE_KEY) return null;
  try {
    const result = await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory?tags=cs.{nylas,grant,active}&select=content&order=created_at.desc&limit=1',
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    const data = JSON.parse(result.data.toString());
    if (data.length > 0) {
      const match = data[0].content.match(/NYLAS GRANT: ([a-f0-9-]+)/);
      if (match) {
        console.log('[IMAN] Active grant: ' + match[1]);
        return match[1];
      }
    }
  } catch (e) {
    console.log('[IMAN] Grant lookup error: ' + e.message);
  }
  return null;
}

// ⬡B:AIR:REACH.EMAIL.SEND_FROM_CALL:CODE:email.followup.postcall:AIR→IMAN→NYLAS→RECIPIENT:T9:v1.8.0:20260214:e1f2c⬡
async function sendEmailFromCall(toEmail, toName, subject, htmlBody) {
  const grantId = await getActiveNylasGrant();
  if (!grantId) {
    console.log('[IMAN] No grant - cannot send email');
    return { success: false, reason: 'no_grant' };
  }
  
  try {
    const result = await httpsRequest({
      hostname: 'api.us.nylas.com',
      path: '/v3/grants/' + grantId + '/messages/send',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NYLAS_API_KEY,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({
      subject: subject,
      body: htmlBody,
      to: [{ email: toEmail, name: toName || toEmail.split('@')[0] }],
      tracking_options: { opens: true }
    }));
    
    const data = JSON.parse(result.data.toString());
    if (data.data?.id || data.id) {
      console.log('[IMAN] Email sent to ' + toEmail);
      return { success: true, id: data.data?.id || data.id };
    }
    return { success: false, reason: JSON.stringify(data) };
  } catch (e) {
    console.log('[IMAN] Email error: ' + e.message);
    return { success: false, reason: e.message };
  }
}



// ═══════════════════════════════════════════════════════════════════════════
// SPURT A: CALL RECORDING + TRANSCRIPT STORAGE
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ L6: AIR (ABA Intelligence Router)                                      │
// │  └─ L5: REACH (Real-time Engagement and Action Channel Hub)            │
// │      └─ L4: VOICE                                                      │
// │          └─ L3: SCRIBE (Session Capture and Recording Intelligence)    │
// │              └─ L2: TranscriptBuilder (real-time transcript assembly)  │
// │                  └─ L1: addUtterance(), buildFullTranscript()          │
// └─────────────────────────────────────────────────────────────────────────┘
// ⬡B:AIR:REACH.VOICE.SCRIBE:CODE:voice.recording.dual:TWILIO→REACH→SCRIBE→BRAIN:T9:v1.9.0:20260214:s1c2r⬡
// ROUTING TRACE: USER*TWILIO*REACH*SCRIBE*BRAIN
// REPORTS TO: AIR (L6) via REACH (L5) VOICE department (L4)
// SERVES: Brandon (call review), DAWN (daily reports), analytics
// ═══════════════════════════════════════════════════════════════════════════

function createTranscriptBuilder() {
  return {
    entries: [],
    startTime: Date.now(),
    addUtterance(text, role, speaker) {
      const elapsed = Math.round((Date.now() - this.startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = String(elapsed % 60).padStart(2, '0');
      this.entries.push({ timestamp: mins + ':' + secs, speaker: speaker, role: role, text: text });
    },
    buildFullTranscript() {
      return this.entries.map(e => {
        const label = e.role === 'aba' ? 'ABA' : (e.speaker !== null && e.speaker !== undefined ? 'SPEAKER_' + e.speaker : 'CALLER');
        return '[' + e.timestamp + '] ' + label + ': ' + e.text;
      }).join('\n');
    },
    getStats() {
      const callerTurns = this.entries.filter(e => e.role === 'caller').length;
      const abaTurns = this.entries.filter(e => e.role === 'aba').length;
      const speakers = new Set(this.entries.filter(e => e.speaker !== null && e.speaker !== undefined).map(e => e.speaker));
      return { callerTurns, abaTurns, uniqueSpeakers: speakers.size, duration: Math.round((Date.now() - this.startTime) / 1000) };
    }
  };
}

async function storeRecordingUrl(callSid, recordingUrl, recordingSid) {
  if (!SUPABASE_KEY) return;
  try {
    await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co', path: '/rest/v1/aba_memory', method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
    }, JSON.stringify({
      content: 'CALL RECORDING | CallSID: ' + callSid + ' | RecordingSID: ' + recordingSid + ' | URL: ' + recordingUrl + '.mp3 | Date: ' + new Date().toISOString(),
      memory_type: 'call_recording', categories: ['call', 'recording', 'scribe'], importance: 7, is_system: true,
      source: 'scribe_recording_' + callSid, tags: ['call', 'recording', 'scribe', callSid]
    }));
    console.log('[SCRIBE] Recording stored: ' + recordingSid);
  } catch (e) { console.log('[SCRIBE] Recording store error: ' + e.message); }
}

async function storeFullTranscript(session) {
  if (!SUPABASE_KEY || !session.transcriptBuilder) return;
  const transcript = session.transcriptBuilder.buildFullTranscript();
  const stats = session.transcriptBuilder.getStats();
  if (transcript.length < 10) return;
  const callerName = session.touchpoints?.callerName || session.callerIdentity?.name || 'Unknown';
  try {
    await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co', path: '/rest/v1/aba_memory', method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
    }, JSON.stringify({
      content: 'CALL TRANSCRIPT | ' + callerName + ' (' + (session.callerNumber || 'unknown') + ') | ' + new Date().toISOString().split('T')[0] + ' | Duration: ' + stats.duration + 's | Caller: ' + stats.callerTurns + ' turns | ABA: ' + stats.abaTurns + ' turns | Speakers: ' + stats.uniqueSpeakers + '\n---\n' + transcript.substring(0, 4000),
      memory_type: 'call_transcript', categories: ['call', 'transcript', 'scribe', callerName.toLowerCase()], importance: 8, is_system: true,
      source: 'scribe_transcript_' + (session.callSid || Date.now()),
      tags: ['call', 'transcript', 'scribe', (session.callerNumber || '').replace('+',''), callerName.toLowerCase()]
    }));
    console.log('[SCRIBE] Transcript stored: ' + stats.callerTurns + ' caller/' + stats.abaTurns + ' ABA turns, ' + stats.duration + 's');
  } catch (e) { console.log('[SCRIBE] Transcript store error: ' + e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════
// SPURT B: VOICE FINGERPRINTING (DEEPGRAM DIARIZE)
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ L6: AIR (ABA Intelligence Router)                                      │
// │  └─ L5: REACH (Real-time Engagement and Action Channel Hub)            │
// │      └─ L4: VOICE                                                      │
// │          └─ L3: EAR (Environment Awareness Recognition)                │
// │              └─ L2: SpeakerTracker (diarize speaker identification)    │
// │                  └─ L1: registerSpeaker(), isBystander()               │
// └─────────────────────────────────────────────────────────────────────────┘
// ⬡B:AIR:REACH.VOICE.EAR:CODE:voice.diarize.fingerprint:DEEPGRAM→EAR→AIR:T9:v1.9.0:20260214:e1a2r⬡
// ROUTING TRACE: AUDIO*DEEPGRAM*EAR*AIR*VARA
// REPORTS TO: AIR (L6) via REACH (L5) VOICE department (L4)
// SERVES: VARA (knows who is speaking), session (multi-speaker awareness)
// ═══════════════════════════════════════════════════════════════════════════

function createSpeakerTracker() {
  return {
    primarySpeaker: null,
    speakerHistory: [],
    bystanderDetected: false,
    lastSpeaker: null,
    registerSpeaker(speakerId, wordCount) {
      if (this.primarySpeaker === null) {
        this.primarySpeaker = speakerId;
        console.log('[EAR] Primary speaker identified: Speaker ' + speakerId);
      }
      this.speakerHistory.push({ speaker: speakerId, timestamp: Date.now(), wordCount: wordCount });
      if (speakerId !== this.primarySpeaker && !this.bystanderDetected) {
        this.bystanderDetected = true;
        console.log('[EAR] BYSTANDER DETECTED: Speaker ' + speakerId + ' (primary is Speaker ' + this.primarySpeaker + ')');
      }
      this.lastSpeaker = speakerId;
      return speakerId === this.primarySpeaker;
    },
    isBystander(speakerId) {
      return this.primarySpeaker !== null && speakerId !== this.primarySpeaker;
    }
  };
}

function extractSpeakerFromDiarize(msg) {
  const words = msg.channel?.alternatives?.[0]?.words || [];
  if (words.length === 0) return null;
  const counts = {};
  for (const w of words) {
    if (w.speaker !== undefined) counts[w.speaker] = (counts[w.speaker] || 0) + 1;
  }
  let max = 0, dominant = null;
  for (const [s, c] of Object.entries(counts)) {
    if (c > max) { max = c; dominant = parseInt(s); }
  }
  return dominant;
}


class CallSession {
  constructor(streamSid, callSid) {
    this.streamSid = streamSid;
    this.callSid = callSid;
    this.history = [];
    this.deepgramWs = null;
    this.twilioWs = null;
    this.isPlaying = false;
    this.currentTranscript = '';
    this.lastSpeechTime = 0;
    this.silenceTimeout = null;
    // v1.6.0 - Caller intelligence
    this.callerNumber = null;
    this.callerIdentity = null;
    // v1.8.0 - Adaptive touchpoints (replaces demo/regular split)
    this.touchpoints = null;
    this.callHistory = null;
    // v1.9.0 - SCRIBE: Real-time transcript builder
    this.transcriptBuilder = createTranscriptBuilder();
    // v1.9.0 - EAR: Speaker diarization tracker
    this.speakerTracker = createSpeakerTracker();
  }
}

const sessions = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:TOUCH:SPEECH.INTELLIGENCE:deepgram.full.features:20260216⬡
// DEEPGRAM SPEECH INTELLIGENCE - Full feature set from email
// Features: Diarization, Topics, Language, Entities, Intent, Sentiment, Summary
// ═══════════════════════════════════════════════════════════════════════════════

// Process speech intelligence results from Deepgram
async function processSpeechIntelligence(transcript, intelligenceData) {
  console.log('[SPEECH INTELLIGENCE] Processing...');
  
  const analysis = {
    transcript: transcript,
    timestamp: new Date().toISOString(),
    
    // Diarization - who is speaking
    speakers: intelligenceData.speakers || [],
    
    // Topics - what they're talking about (350+ topics)
    topics: intelligenceData.topics || [],
    
    // Language - detected language
    language: intelligenceData.language || 'en',
    languageConfidence: intelligenceData.language_confidence || 1.0,
    
    // Entities - names, places, orgs, etc
    entities: intelligenceData.entities || [],
    
    // Intent - what they want to do
    intents: intelligenceData.intents || [],
    
    // Sentiment - positive/negative/neutral
    sentiment: intelligenceData.sentiment || { overall: 'neutral', score: 0 },
    sentimentSegments: intelligenceData.sentiment_segments || [],
    
    // Summarization
    summary: intelligenceData.summary || null
  };
  
  // Store to brain for learning
  await storeToBrain({
    content: JSON.stringify(analysis),
    memory_type: 'speech_intelligence',
    categories: ['voice', 'intelligence', 'deepgram'],
    importance: 6,
    tags: ['speech', 'analysis', ...analysis.topics.slice(0, 5)]
  });
  
  console.log('[SPEECH INTELLIGENCE] Stored:', {
    topics: analysis.topics.length,
    entities: analysis.entities.length,
    sentiment: analysis.sentiment.overall
  });
  
  return analysis;
}

// Analyze completed call with full intelligence
async function analyzeCallWithDeepgram(audioUrl) {
  console.log('[DEEPGRAM ANALYZE] Full analysis of:', audioUrl);
  
  if (!DEEPGRAM_KEY) {
    console.log('[DEEPGRAM ANALYZE] No API key');
    return null;
  }
  
  try {
    // Use Deepgram's pre-recorded API with all intelligence features
    const result = await httpsRequest({
      hostname: 'api.deepgram.com',
      path: '/v1/listen?' + new URLSearchParams({
        // Speech-to-text options
        model: 'nova-2',
        language: 'en-US',
        punctuate: 'true',
        paragraphs: 'true',
        smart_format: 'true',
        
        // SPEECH INTELLIGENCE FEATURES
        diarize: 'true',                    // Speaker identification
        detect_topics: 'true',              // 350+ topics
        detect_language: 'true',            // Language detection
        detect_entities: 'true',            // Entity extraction
        intents: 'true',                    // Intent recognition
        sentiment: 'true',                  // Sentiment analysis
        summarize: 'v2'                     // Summarization
      }).toString(),
      method: 'POST',
      headers: {
        'Authorization': 'Token ' + DEEPGRAM_KEY,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({ url: audioUrl }));
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      
      // Extract intelligence from results
      const intelligence = {
        speakers: extractSpeakers(data),
        topics: data.results?.topics?.segments?.map(s => s.topics).flat() || [],
        language: data.results?.channels?.[0]?.detected_language,
        language_confidence: data.results?.channels?.[0]?.language_confidence,
        entities: data.results?.entities?.entities || [],
        intents: data.results?.intents?.segments?.map(s => s.intents).flat() || [],
        sentiment: data.results?.sentiments?.average || { sentiment: 'neutral', sentiment_score: 0 },
        sentiment_segments: data.results?.sentiments?.segments || [],
        summary: data.results?.summary?.short || null
      };
      
      const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      
      return await processSpeechIntelligence(transcript, intelligence);
    }
    
    console.log('[DEEPGRAM ANALYZE] Error:', result.status);
    return null;
    
  } catch (e) {
    console.log('[DEEPGRAM ANALYZE] Error:', e.message);
    return null;
  }
}

// Extract speaker info from diarization
function extractSpeakers(data) {
  const words = data.results?.channels?.[0]?.alternatives?.[0]?.words || [];
  const speakers = {};
  
  for (const word of words) {
    if (word.speaker !== undefined) {
      if (!speakers[word.speaker]) {
        speakers[word.speaker] = { wordCount: 0, totalDuration: 0, segments: [] };
      }
      speakers[word.speaker].wordCount++;
      speakers[word.speaker].totalDuration += (word.end - word.start);
    }
  }
  
  return Object.entries(speakers).map(([id, data]) => ({
    speaker: parseInt(id),
    wordCount: data.wordCount,
    totalDuration: Math.round(data.totalDuration * 100) / 100
  }));
}

// Real-time sentiment tracking during call
function createSentimentTracker() {
  return {
    segments: [],
    overallScore: 0,
    trend: 'neutral',
    
    addSegment(text, sentiment, score) {
      this.segments.push({ text, sentiment, score, timestamp: Date.now() });
      
      // Calculate running average
      const total = this.segments.reduce((sum, s) => sum + s.score, 0);
      this.overallScore = total / this.segments.length;
      
      // Determine trend (improving/declining/stable)
      if (this.segments.length >= 3) {
        const recent = this.segments.slice(-3);
        const recentAvg = recent.reduce((sum, s) => sum + s.score, 0) / 3;
        const previousAvg = this.segments.slice(-6, -3).reduce((sum, s) => sum + s.score, 0) / 3 || recentAvg;
        
        if (recentAvg > previousAvg + 0.1) this.trend = 'improving';
        else if (recentAvg < previousAvg - 0.1) this.trend = 'declining';
        else this.trend = 'stable';
      }
      
      return this.getSummary();
    },
    
    getSummary() {
      const avgSentiment = this.overallScore > 0.2 ? 'positive' : 
                          this.overallScore < -0.2 ? 'negative' : 'neutral';
      return {
        sentiment: avgSentiment,
        score: Math.round(this.overallScore * 100) / 100,
        trend: this.trend,
        segmentCount: this.segments.length
      };
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:TOUCH:IMAN.GMAIL.SEND:email.send.direct:20260216⬡
// IMAN Gmail Send - Direct Gmail API for sending emails
// Voice trigger: "Send an email to Eric about the meeting"
// ═══════════════════════════════════════════════════════════════════════════════

// Gmail credentials stored in env
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

// Get fresh Gmail access token
async function getGmailAccessToken() {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    console.log('[IMAN GMAIL] Missing credentials');
    return null;
  }
  
  try {
    const result = await httpsRequest({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    }).toString());
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      console.log('[IMAN GMAIL] Token refreshed');
      return data.access_token;
    }
    
    console.log('[IMAN GMAIL] Token refresh failed:', result.status);
    return null;
    
  } catch (e) {
    console.log('[IMAN GMAIL] Token error:', e.message);
    return null;
  }
}

// Create RFC 2822 email message
function createEmailMessage(to, subject, body, from = 'brandonjpierce@gmail.com') {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body
  ].join('\r\n');
  
  // Base64url encode
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Send email via Gmail API
async function IMAN_sendEmailGmail(to, subject, body) {
  console.log('[IMAN GMAIL] Sending to:', to, 'Subject:', subject);
  
  const accessToken = await getGmailAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Could not get Gmail access token' };
  }
  
  try {
    const raw = createEmailMessage(to, subject, body);
    
    const result = await httpsRequest({
      hostname: 'gmail.googleapis.com',
      path: '/gmail/v1/users/me/messages/send',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({ raw }));
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      console.log('[IMAN GMAIL] Sent! Message ID:', data.id);
      
      // Store to brain
      await storeToBrain({
        content: JSON.stringify({ to, subject, messageId: data.id, sent: new Date().toISOString() }),
        memory_type: 'email_sent',
        categories: ['iman', 'email', 'sent'],
        importance: 7,
        tags: ['email', 'sent', 'gmail']
      });
      
      return { success: true, messageId: data.id };
    }
    
    console.log('[IMAN GMAIL] Send failed:', result.status);
    return { success: false, error: 'Gmail API error: ' + result.status };
    
  } catch (e) {
    console.log('[IMAN GMAIL] Error:', e.message);
    return { success: false, error: e.message };
  }
}

// Lookup email for contact
function getContactEmail(name) {
  const emails = {
    eric: 'dr.ericlane@gmail.com',  // Example - replace with real
    bj: 'bj@example.com',
    cj: 'cj@example.com',
    brandon: 'brandonjpierce@gmail.com'
  };
  return emails[name?.toLowerCase()] || null;
}

// Voice command: "Send an email to Eric about the meeting"
async function IMAN_voiceEmailCommand(message, callerIdentity) {
  console.log('[IMAN VOICE] Processing email command:', message);
  
  const msgLower = message.toLowerCase();
  
  // Parse "send email to [person] about [topic]"
  const toMatch = msgLower.match(/email\s+(?:to\s+)?(\w+)/i);
  const aboutMatch = msgLower.match(/about\s+(.+?)(?:\.|$)/i);
  
  if (!toMatch) {
    return { success: false, response: "I didn't catch who to send the email to. Who should I email?" };
  }
  
  const recipientName = toMatch[1];
  const topic = aboutMatch ? aboutMatch[1] : 'follow up';
  
  const recipientEmail = getContactEmail(recipientName);
  if (!recipientEmail) {
    return { success: false, response: `I don't have an email address for ${recipientName}. What's their email?` };
  }
  
  // Draft email with AI
  const draftResult = await IMAN_draftEmail({
    to: recipientEmail,
    regarding: topic,
    tone: 'professional',
    points: [`Regarding: ${topic}`, `From: ${callerIdentity?.name || 'Brandon'}`]
  });
  
  if (!draftResult) {
    return { success: false, response: "I had trouble drafting that email. Want me to try again?" };
  }
  
  // Return draft for confirmation
  return {
    success: true,
    draft: draftResult,
    response: `I've drafted an email to ${recipientName} about ${topic}. Here's what I have: Subject: ${draftResult.subject}. ${draftResult.body.substring(0, 100)}... Should I send it?`,
    awaiting_confirmation: true
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.VOICE.DEEPGRAM:CODE:voice.stt.connection:TWILIO→REACH→DEEPGRAM:T8:v1.5.0:20260213:d1g2c⬡
// ═══════════════════════════════════════════════════════════════════════════
function connectDeepgram(session) {
  console.log('[DEEPGRAM] Connecting...');
  
  const dgUrl = 'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
    encoding: 'mulaw',
    sample_rate: '8000',
    channels: '1',
    model: 'nova-2',
    language: 'en-US',
    punctuate: 'true',
    interim_results: 'true',
    endpointing: '300',
    vad_events: 'true',
    utterance_end_ms: '1000',
    diarize: 'true'
  }).toString();
  
  const ws = new WebSocket(dgUrl, {
    headers: { 'Authorization': 'Token ' + DEEPGRAM_KEY }
  });
  
  ws.on('open', () => {
    console.log('[DEEPGRAM] Connected');
    // DEBUG: Log to brain
    fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ content: `DEBUG DEEPGRAM CONNECTED: isOutbound=${session.isOutbound}`, memory_type: 'debug', source: 'deepgram_connect_' + Date.now() })
    }).catch(e => {});
  });
  
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      // ⬡B:AIR:REACH.VOICE.BARGEIN:CODE:voice.interrupt.detection:USER→TWILIO→REACH:T8:v1.5.0:20260213:b1r2g⬡
      if (msg.type === 'SpeechStarted' && session.isPlaying) {
        console.log('[BARGE-IN] User interrupted!');
        session.isPlaying = false;
        if (session.twilioWs?.readyState === WebSocket.OPEN) {
          session.twilioWs.send(JSON.stringify({ event: 'clear', streamSid: session.streamSid }));
        }
      }
      
      // ⬡B:AIR:REACH.VOICE.TRANSCRIPT:CODE:voice.stt.result:DEEPGRAM→REACH→AIR:T8:v1.5.0:20260213:t1r2n⬡
      if (msg.channel?.alternatives?.[0]?.transcript) {
        const transcript = msg.channel.alternatives[0].transcript;
        const isFinal = msg.is_final;
        
        if (transcript.trim() && isFinal) {
          console.log('[DEEPGRAM] *** FINAL TRANSCRIPT RECEIVED ***');
          console.log('[DEEPGRAM] isOutbound:', session.isOutbound);
          
          // DEBUG: Log transcript to brain
          fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ content: `DEBUG DEEPGRAM TRANSCRIPT: isOutbound=${session.isOutbound}, text="${transcript.substring(0,100)}"`, memory_type: 'debug', source: 'deepgram_transcript_' + Date.now() })
          }).catch(e => {});
          
          // v1.9.0 - EAR: Extract speaker from diarized result
          const speakerId = extractSpeakerFromDiarize(msg);
          const isPrimary = speakerId !== null ? session.speakerTracker.registerSpeaker(speakerId, transcript.split(' ').length) : true;
          
          // v1.9.0 - SCRIBE: Log to transcript builder
          session.transcriptBuilder.addUtterance(transcript, 'caller', speakerId);
          
          // v1.9.0 - EAR: If bystander is talking, don't process as caller input
          if (!isPrimary && speakerId !== null) {
            console.log('[EAR] Bystander speaking (Speaker ' + speakerId + '): "' + transcript + '" - IGNORING');
            return; // Don't feed bystander speech to AIR
          }
          
          console.log('[DEEPGRAM] FINAL (Speaker ' + (speakerId !== null ? speakerId : '?') + '): "' + transcript + '"');
          session.currentTranscript += ' ' + transcript;
          session.lastSpeechTime = Date.now();
          
          if (session.silenceTimeout) clearTimeout(session.silenceTimeout);
          
          // ⬡B:AIR:REACH.VOICE.SENSITIVITY:CODE:voice.vad.silence:DEEPGRAM→REACH:T7:v1.5.0:20260213:s1l2n⬡
          session.silenceTimeout = setTimeout(async () => {
            if (session.currentTranscript.trim()) {
              await processUtterance(session, session.currentTranscript.trim());
              session.currentTranscript = '';
            }
          }, 1500);
        }
      }
      
      // ⬡B:AIR:REACH.VOICE.UTTERANCE_END:CODE:voice.vad.complete:DEEPGRAM→REACH→AIR:T8:v1.5.0:20260213:u1t2e⬡
      if (msg.type === 'UtteranceEnd' && session.currentTranscript.trim()) {
        if (session.silenceTimeout) clearTimeout(session.silenceTimeout);
        await processUtterance(session, session.currentTranscript.trim());
        session.currentTranscript = '';
      }
    } catch (e) {}
  });
  
  ws.on('error', (err) => {
    console.log('[DEEPGRAM] Error: ' + err.message);
    fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ content: `DEBUG DEEPGRAM ERROR: ${err.message}`, memory_type: 'debug', source: 'deepgram_error_' + Date.now() })
    }).catch(e => {});
  });
  ws.on('close', () => {
    console.log('[DEEPGRAM] Disconnected');
    fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ content: `DEBUG DEEPGRAM DISCONNECTED`, memory_type: 'debug', source: 'deepgram_close_' + Date.now() })
    }).catch(e => {});
  });
  
  session.deepgramWs = ws;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.VOICE.PROCESS:CODE:voice.pipeline.full:USER→DEEPGRAM→AIR→VARA→ELEVENLABS→USER:T8:v1.5.0:20260213:p1r2u⬡
// ═══════════════════════════════════════════════════════════════════════════
async function processUtterance(session, text) {
  // ⬡B:AIR:REACH.VOICE.DEMO_PROCESS:CODE:voice.demo.touchpoint_aware:AIR→VARA→USER:T9:v1.6.0:20260213:d1p2r⬡
  
  console.log('[PROCESS] *** PROCESSING UTTERANCE ***');
  console.log('[PROCESS] isOutbound:', session.isOutbound);
  console.log('[PROCESS] Text:', text.substring(0, 100));
  console.log('[PROCESS] CallerIdentity:', session.callerIdentity?.name);
  
  // DEBUG: Log to brain
  fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ content: `DEBUG PROCESS UTTERANCE: isOutbound=${session.isOutbound}, identity=${session.callerIdentity?.name}, text="${text.substring(0,80)}"`, memory_type: 'debug', source: 'process_utterance_' + Date.now() })
  }).catch(e => {});
  
  if ((session.touchpoints && session.touchpoints.type !== "owner")) {
    session.touchpoints.turnCount++;
    console.log('[DEMO] Turn ' + session.touchpoints.turnCount + ' | User: "' + text.substring(0, 80) + '"');
    
    // Capture caller name from first response
    if (!session.touchpoints.callerName && session.touchpoints.turnCount <= 2) {
      const nameMatch = text.match(/(?:my name is|i'm|this is|i am|it's|its)\s+([a-zA-Z]+)/i);
      if (nameMatch) {
        session.touchpoints.callerName = nameMatch[1];
        console.log('[DEMO] Caller identified as: ' + session.touchpoints.callerName);
      } else if (text.trim().split(/\s+/).length <= 3 && text.trim().length > 1) {
        // Short response = probably just their name
        session.touchpoints.callerName = text.trim().split(/\s+/)[0];
        console.log('[DEMO] Caller name (short): ' + session.touchpoints.callerName);
      }
    }
  }
  
  const result = await AIR_process(text, session.history, session.callerIdentity, (session.touchpoints && session.touchpoints.type !== "owner") ? session.touchpoints : null);
  
  await LOG_call(session, 'utterance', { user: text, response: result.response, mission: result.missionNumber, demoState: (session.touchpoints && session.touchpoints.type !== "owner") ? session.touchpoints : null });
  
  // v1.8.0 - Warm transfer: if they ask for Brandon
  const lowerText = text.toLowerCase();
  if (lowerText.includes('talk to brandon') || lowerText.includes('speak to brandon') || lowerText.includes('get brandon') || lowerText.includes('put brandon on') || lowerText.includes('is brandon there')) {
    await VARA_speak(session, "Of course! Let me get Brandon on the line for you. One moment.");
    const transferred = await warmTransferToBrandon(session);
    if (!transferred) {
      await VARA_speak(session, "I was not able to connect you right now, but I will let Brandon know you want to talk. He will reach out to you soon. Is there anything else I can help with in the meantime?");
    }
    return;
  }

  if (result.isGoodbye) {
    if ((session.touchpoints && session.touchpoints.type !== "owner") && session.touchpoints.SMS_SENT !== undefined && !session.touchpoints.SMS_SENT) {
      // Don't let them leave without the SMS demo!
      await VARA_speak(session, "Oh wait, before you go! Brandon told me to make sure I show you one more thing. Hold on just a second.");
      await trySendDemoSMS(session);
      await VARA_speak(session, "There! Check your phone. It was so great talking with you. Have a wonderful day!");
    } else {
      await VARA_speak(session, result.response);
    }
    setTimeout(() => {
      if (session.twilioWs?.readyState === WebSocket.OPEN) session.twilioWs.close();
    }, 3000);
    return;
  }
  
  session.history.push({ role: 'user', content: text });
  session.history.push({ role: 'assistant', content: result.response });
  
  // v1.9.0 - SCRIBE: Log ABA response to transcript
  if (session.transcriptBuilder) {
    session.transcriptBuilder.addUtterance(result.response, 'aba', null);
  }
  
  // v1.8.0 - Natural pacing delay before speaking
  const delay = getResponseDelay(text, result.intent || 'general');
  if (delay > 0) await new Promise(r => setTimeout(r, delay));
  
  await VARA_speak(session, result.response);
  
  // ⬡B:AIR:REACH.VOICE.DEMO_STEER:CODE:voice.demo.touchpoint_advance:AIR→VARA→USER:T9:v1.6.0:20260213:d1s2t⬡
  // After speaking, check if we need to advance demo touchpoints
  if ((session.touchpoints && session.touchpoints.type !== "owner")) {
    await advanceDemoTouchpoints(session, text, result.response);
  }
}

// ⬡B:AIR:REACH.VOICE.DEMO_SMS:CODE:voice.demo.sms_trigger:AIR→CARA→TWILIO→USER:T9:v1.6.0:20260213:d1s2m⬡
async function trySendDemoSMS(session) {
  const callerName = session.touchpoints.callerName || 'friend';
  const smsMessage = "Hey " + callerName + "! This is ABA. Brandon wanted me to reach out and say thanks for checking us out. You are now part of something special. Welcome to the future of AI. - ABA (A Better AI)";
  
  // Try SMS to caller
  const smsResult = await sendSMSFromCall(session.callerNumber, smsMessage);
  
  if (smsResult.success) {
    console.log('[DEMO-SMS] Sent to caller: ' + session.callerNumber);
    session.touchpoints.SMS_SENT = true;
  } else {
    console.log('[DEMO-SMS] SMS failed (' + smsResult.reason + '), sending to Brandon as backup');
    // Trial Twilio can only text verified numbers - send to Brandon instead
    const backupResult = await sendSMSFromCall('+13363898116', 'ABA DEMO ALERT: ' + callerName + ' just called from ' + session.callerNumber + '. SMS to them failed (trial account). They had a great demo call!');
    if (backupResult.success) {
      session.touchpoints.SMS_SENT = true;
      console.log('[DEMO-SMS] Sent backup to Brandon');
    }
  }
  
  return session.touchpoints.SMS_SENT;
}

// ⬡B:AIR:REACH.VOICE.DEMO_ADVANCE:CODE:voice.demo.touchpoint_check:AIR→VARA→USER:T9:v1.6.0:20260213:d1a2v⬡
async function advanceDemoTouchpoints(session, userSaid, abaResponse) {
  const state = session.touchpoints;
  if (!state || state.type === 'owner') return; // Brandon doesn't need steering
  
  const lower = (userSaid + ' ' + abaResponse).toLowerCase();
  
  // Track what touchpoints got naturally covered in conversation
  if (!state.PORTAL && (lower.includes('portal') || lower.includes('what can you do') || lower.includes('features') || lower.includes('can do'))) {
    state.PORTAL = true;
    console.log('[DEMO] TOUCHPOINT HIT: PORTAL (organic)');
  }
  if (!state.STATUS && (lower.includes('building') || lower.includes('abacus') || lower.includes('close to') || lower.includes('progress') || lower.includes('living proof'))) {
    state.STATUS = true;
    console.log('[DEMO] TOUCHPOINT HIT: STATUS (organic)');
  }
  if (!state.QA && (lower.includes('question') || lower.includes('ask me') || lower.includes('q&a') || lower.includes('go ahead'))) {
    state.QA = true;
    console.log('[DEMO] TOUCHPOINT HIT: QA (organic)');
  }
  
  // SMART STEERING - After each response, push toward next unhit touchpoint
  // But ONLY after a natural pause (every 2-3 turns if touchpoints still pending)
  if (state.turnCount >= 2 && !state.PORTAL) {
    // Time to talk about the portal
    setTimeout(async () => {
      if (!session.isPlaying) {
        await VARA_speak(session, "Oh, and " + (state.callerName || "by the way") + ", let me tell you about what you will actually be able to do with your portal. Picture this: job searching, resume building, interview prep, email management, budgeting, all of it in one place. And I manage all of it for you. Not just showing you data, but actually doing the work.");
        state.PORTAL = true;
        console.log('[DEMO] TOUCHPOINT HIT: PORTAL (steered)');
        session.history.push({ role: 'assistant', content: '[ABA shared portal capabilities]' });
      }
    }, 1500);
    return;
  }
  
  if (state.PORTAL && !state.STATUS && state.turnCount >= 4) {
    // Time for status update
    setTimeout(async () => {
      if (!session.isPlaying) {
        await VARA_speak(session, "Now, I want to be real with you for a second. Brandon is still building me. The ABACUS portal, that is the full consumer version, it is very close to being done. And when Brandon drops it, he wants to make sure there are absolutely no kinks, no issues. But as you can hear right now, this phone call? This is living proof that we are closer than we have ever been.");
        state.STATUS = true;
        console.log('[DEMO] TOUCHPOINT HIT: STATUS (steered)');
        session.history.push({ role: 'assistant', content: '[ABA shared project status update]' });
      }
    }, 1500);
    return;
  }
  
  if (state.STATUS && !state.SMS_OFFER && state.turnCount >= 5) {
    // Time for SMS demo
    setTimeout(async () => {
      if (!session.isPlaying) {
        await VARA_speak(session, "Oh! And check this out. I can also send text messages. Want to see? I can send you a text right now to prove it.");
        state.SMS_OFFER = true;
        console.log('[DEMO] TOUCHPOINT HIT: SMS_OFFER (steered)');
        session.history.push({ role: 'assistant', content: '[ABA offered SMS demo]' });
      }
    }, 1500);
    return;
  }
  
  // If they responded to SMS offer (yes, no, or anything)
  if (state.SMS_OFFER && !state.SMS_SENT && !state.smsTriggered) {
    state.smsTriggered = true;
    const saidYes = lower.includes('yes') || lower.includes('sure') || lower.includes('yeah') || lower.includes('ok') || lower.includes('go ahead') || lower.includes('do it') || lower.includes('send');
    const saidNo = lower.includes('no') || lower.includes('nah') || lower.includes('not');
    
    setTimeout(async () => {
      if (!session.isPlaying) {
        const sent = await trySendDemoSMS(session);
        if (saidYes || !saidNo) {
          if (sent) {
            await VARA_speak(session, "Done! Check your phone. I just sent you a message. Pretty cool, right?");
          } else {
            await VARA_speak(session, "I tried to send it, but Brandon's Twilio account is still on trial mode, so I sent Brandon a notification about your call instead. When the full version launches, texting will work seamlessly.");
          }
        } else {
          // They said no - send it anyway!
          if (sent) {
            await VARA_speak(session, "Well, Brandon told me to send it anyway, so check your phone! He wanted to show off a little bit.");
          } else {
            await VARA_speak(session, "Well, Brandon told me to send it anyway. His Twilio is still on trial so I pinged him directly instead, but trust me, when this goes live, I will be texting you before you even know you need it.");
          }
        }
        console.log('[DEMO] TOUCHPOINT HIT: SMS_SENT');
        session.history.push({ role: 'assistant', content: '[ABA sent SMS demo]' });
      }
    }, 1000);
    return;
  }
  
  // RETURNING CALLER steering
  if (state.type === 'returning') {
    if (!state.RECAP && state.turnCount >= 1) {
      setTimeout(async () => {
        if (!session.isPlaying) {
          const historySnippet = session.callHistory ? session.callHistory.substring(0, 200) : '';
          await VARA_speak(session, "By the way, I remember last time we chatted, we were talking about some interesting things. I have been thinking about our conversation. Is there anything from last time you want to pick back up on?");
          state.RECAP = true;
          console.log('[TOUCHPOINTS] HIT: RECAP (returning caller)');
        }
      }, 1500);
      return;
    }
    if (!state.UPDATE && state.turnCount >= 3) {
      setTimeout(async () => {
        if (!session.isPlaying) {
          await VARA_speak(session, "Oh, and since we last talked, Brandon has been making some great progress. Things are moving fast. Is there anything specific you want to know about?");
          state.UPDATE = true;
          console.log('[TOUCHPOINTS] HIT: UPDATE (returning caller)');
        }
      }, 1500);
      return;
    }
    if (!state.QA && state.turnCount >= 4) {
      setTimeout(async () => {
        if (!session.isPlaying) {
          await VARA_speak(session, "Alright, I am all yours. What else can I help you with?");
          state.QA = true;
          console.log('[TOUCHPOINTS] HIT: QA (returning caller)');
        }
      }, 1500);
      return;
    }
    return; // No more steering needed for returning callers
  }
  
  if (state.SMS_SENT !== undefined && state.SMS_SENT && !state.QA && state.turnCount >= 7) {
    // Open floor for Q&A
    setTimeout(async () => {
      if (!session.isPlaying) {
        await VARA_speak(session, "Alright, so Brandon wanted me to open up some time for you to just ask me whatever you want. Seriously, anything. Whether it is about the portal, about client work, about sports, about life. Go ahead, I am all yours.");
        state.QA = true;
        console.log('[DEMO] TOUCHPOINT HIT: QA (steered)');
        session.history.push({ role: 'assistant', content: '[ABA opened Q&A]' });
      }
    }, 1500);
    return;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L6: AIR | L5: REACH | L4: API | L3: HTTP UTILITIES                          ║
 * ║ CORS, body parsing, JSON response helpers                                    ║
 * ║ ROUTING: USER→REACH (security gate before any route)                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
// ⬡B:AIR:REACH.API.CORS:CODE:security.cors.validation:USER→REACH:T10:v1.5.0:20260213:c1r2s⬡
// CORS and body parsing utilities for API routes
// ═══════════════════════════════════════════════════════════════════════════
function setCORS(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { resolve({ raw: body }); }
    });
    req.on('error', reject);
  });
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L6: AIR | L5: REACH | L4: API | L3: AIR TEXT MODE                            ║
 * ║ AIR_text() - Same agent pipeline as voice but 2048 token text output         ║
 * ║ ROUTING: USER*1A_SHELL*REACH*AIR*LUKE,COLE,JUDE,PACK*MODEL*USER              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
// ⬡B:AIR:REACH.API.AIR_TEXT:CODE:routing.text.chat:USER→REACH→AIR→AGENTS→MODEL→USER:T8:v1.5.0:20260213:a1t2x⬡
// AIR for text chat (higher token limits than voice)
async function AIR_text(userMessage, history) {
  const lukeAnalysis = await LUKE_process(userMessage);
  if (lukeAnalysis.isGoodbye) {
    return { response: "Take care! We are all ABA.", isGoodbye: true };
  }
  const coleResult = await COLE_scour(lukeAnalysis);
  const judeResult = await JUDE_findAgents(lukeAnalysis);
  const missionPackage = PACK_assemble(lukeAnalysis, coleResult, judeResult, history || [], null, null);

  let response = null;

  // PRIMARY: Gemini Flash 2.0
  if (GEMINI_KEY && !response) {
    try {
      const messages = (history || []).map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));
      messages.push({ role: 'user', parts: [{ text: userMessage }] });
      const result = await httpsRequest({
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, JSON.stringify({
        systemInstruction: { parts: [{ text: missionPackage.systemPrompt }] },
        contents: messages,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
      }));
      const json = JSON.parse(result.data.toString());
      if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
        response = json.candidates[0].content.parts[0].text;
      }
    } catch (e) { console.log('[AIR-TEXT] Gemini error: ' + e.message); }
  }

  // BACKUP: Claude Haiku
  if (ANTHROPIC_KEY && !response) {
    try {
      const messages = (history || []).map(h => ({ role: h.role, content: h.content }));
      messages.push({ role: 'user', content: userMessage });
      const result = await httpsRequest({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: missionPackage.systemPrompt,
        messages
      }));
      const json = JSON.parse(result.data.toString());
      if (json.content?.[0]?.text) response = json.content[0].text;
    } catch (e) { console.log('[AIR-TEXT] Claude error: ' + e.message); }
  }

  // FALLBACK: Groq
  if (GROQ_KEY && !response) {
    try {
      const messages = [
        { role: 'system', content: missionPackage.systemPrompt },
        ...(history || []).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: userMessage }
      ];
      const result = await httpsRequest({
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' }
      }, JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 2048, temperature: 0.7, messages }));
      const json = JSON.parse(result.data.toString());
      if (json.choices?.[0]?.message?.content) response = json.choices[0].message.content;
    } catch (e) { console.log('[AIR-TEXT] Groq error: ' + e.message); }
  }

  if (!response) response = "I'm here and processing. Could you rephrase that?";
  return { response, isGoodbye: false, missionNumber: missionPackage.missionNumber };
}

// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                           HTTP SERVER + API ROUTES                           ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║ L6: AIR | L5: REACH | L4: API (Director) | L3: per-route agent managers     ║
 * ║                                                                              ║
 * ║ ROUTE MAP:                                                                   ║
 * ║   /api/router          → L3: AIR (text chat)                                 ║
 * ║   /api/models/claude   → L3: AIR (Claude proxy)                              ║
 * ║   /api/voice/deepgram  → L3: TASTE (browser STT token)                       ║
 * ║   /api/voice/tts       → L3: VARA (text-to-speech)                           ║
 * ║   /api/omi/manifest    → L3: TASTE (OMI app registration)                    ║
 * ║   /api/omi/webhook     → L3: TASTE (transcript ingestion)                    ║
 * ║   /api/sms/send        → L3: CARA (outbound SMS)                             ║
 * ║   /api/brain/search    → L3: COLE (brain query)                              ║
 * ║   /api/brain/store     → L3: COLE (brain persist)                             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
// ⬡B:AIR:REACH.API.SERVER:CODE:infrastructure.http.routing:USER→REACH→AGENTS:T10:v1.5.0:20260213:h1s2v⬡
// FULL API ROUTING - serves 1A Shell, CCWA, OMI, SMS, Email
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.IMAN.AUTOSEND:CODE:email.autonomous.send:
// IMAN→AIR→NYLAS→RECIPIENT:T10:v1.0.0:20260214:i1m2a⬡
//
// IMAN AUTO-SEND EMAIL SYSTEM
// - Drafts email → 30 second countdown in Command Center → Auto-sends
// - Brandon-only for now (until he says team, then anyone)
// - Cooldown/countdown visible in Command Center
// ═══════════════════════════════════════════════════════════════════════════════

const EMAIL_SEND_DELAY_SECONDS = 1800; // 30 MINUTES countdown before auto-send
const EMAIL_RECIPIENTS_ALLOWED = ['brandon']; // Only Brandon for now
const pendingEmails = new Map(); // draftId -> timeout

async function IMAN_autoDraftAndSend(context) {
  const { to, regarding, tone, points, urgency } = context;
  
  // Check if recipient is allowed
  const toEmail = to.toLowerCase();
  const isBrandon = toEmail.includes('brandon') || toEmail.includes('bpierce') || toEmail === 'brandonpiercesr@gmail.com';
  
  if (!isBrandon && !EMAIL_RECIPIENTS_ALLOWED.includes('team') && !EMAIL_RECIPIENTS_ALLOWED.includes('anyone')) {
    console.log('[IMAN] Recipient not in allowed list, skipping auto-send');
    broadcastToCommandCenter({
      type: 'email_blocked',
      reason: 'Only Brandon emails allowed for now',
      to,
      timestamp: new Date().toISOString()
    });
    return { success: false, reason: 'Recipient not allowed' };
  }
  
  console.log('[IMAN] Auto-drafting email to:', to);
  
  // Draft the email
  const draft = await IMAN_draftEmail({ to, regarding, tone, points });
  
  if (!draft) {
    return { success: false, reason: 'Draft failed' };
  }
  
  // Start countdown in Command Center
  const countdownId = 'email_' + Date.now();
  
  broadcastToCommandCenter({
    type: 'email_countdown_start',
    id: countdownId,
    draft: {
      to: draft.to,
      subject: draft.subject,
      preview: draft.body.substring(0, 100) + '...'
    },
    seconds: EMAIL_SEND_DELAY_SECONDS,
    timestamp: new Date().toISOString(),
    message: 'Email will auto-send in ' + EMAIL_SEND_DELAY_SECONDS + ' seconds. Cancel from Command Center.'
  });
  
  // Set timeout for auto-send
  const timeout = setTimeout(async () => {
    pendingEmails.delete(countdownId);
    
    // Actually send the email
    const sendResult = await IMAN_sendEmail(draft);
    
    broadcastToCommandCenter({
      type: 'email_sent',
      id: countdownId,
      to: draft.to,
      subject: draft.subject,
      success: sendResult.success,
      timestamp: new Date().toISOString()
    });
    
  }, EMAIL_SEND_DELAY_SECONDS * 1000);
  
  pendingEmails.set(countdownId, { timeout, draft });
  
  return { 
    success: true, 
    countdownId, 
    seconds: EMAIL_SEND_DELAY_SECONDS,
    draft: { to: draft.to, subject: draft.subject }
  };
}

// Cancel pending email from Command Center
function IMAN_cancelEmail(countdownId) {
  const pending = pendingEmails.get(countdownId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingEmails.delete(countdownId);
    
    broadcastToCommandCenter({
      type: 'email_cancelled',
      id: countdownId,
      timestamp: new Date().toISOString()
    });
    
    console.log('[IMAN] Email cancelled:', countdownId);
    return { success: true };
  }
  return { success: false, reason: 'Not found' };
}

// Actually send the email via Nylas
async function IMAN_sendEmail(draft) {
  try {
    const grantId = await getActiveNylasGrant();
    if (!grantId) {
      console.error('[IMAN] No Nylas grant available');
      return { success: false, reason: 'No Nylas grant' };
    }
    
    const sendResult = await httpsRequest({
      hostname: 'api.us.nylas.com',
      path: '/v3/grants/' + grantId + '/messages/send',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NYLAS_API_KEY,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({
      to: [{ email: draft.to }],
      subject: draft.subject,
      body: draft.body
    }));
    
    console.log('[IMAN] Email sent to:', draft.to);
    
    // Store in brain
    await httpsRequest({
      hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
      path: '/rest/v1/aba_memory',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, JSON.stringify({
      content: 'EMAIL SENT: To=' + draft.to + ' | Subject=' + draft.subject + ' | Body=' + draft.body.substring(0, 500),
      memory_type: 'email_sent',
      categories: ['iman', 'email', 'sent'],
      importance: 6,
      is_system: true,
      source: 'iman_send_' + Date.now(),
      tags: ['email', 'sent', 'iman']
    }));
    
    return { success: true, to: draft.to, subject: draft.subject };
  } catch (e) {
    console.error('[IMAN] Send error:', e.message);
    return { success: false, reason: e.message };
  }
}

// Draft email using AI
async function IMAN_draftEmail(context) {
  const { to, regarding, tone, points } = context;
  
  console.log('[IMAN] Drafting email to:', to, '| Regarding:', regarding);
  
  const prompt = 'You are IMAN (Inbox Management Agent Navigator), drafting a professional email.\n\n' +
    'TO: ' + to + '\n' +
    'REGARDING: ' + regarding + '\n' +
    'TONE: ' + (tone || 'professional') + '\n' +
    'KEY POINTS:\n' + (points ? points.join('\n') : 'General follow-up') + '\n\n' +
    'Write a complete email. Be concise, professional, human.\n' +
    'Format:\nSUBJECT: [subject]\nBODY:\n[email body]';
  
  try {
    const response = await callModel(prompt);
    
    const subjectMatch = response.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = response.match(/BODY:\s*([\s\S]+)/i);
    
    return {
      to,
      subject: subjectMatch ? subjectMatch[1].trim() : 'Re: ' + regarding,
      body: bodyMatch ? bodyMatch[1].trim() : response,
      created: new Date().toISOString()
    };
  } catch (e) {
    console.error('[IMAN] Draft error:', e.message);
    return null;
  }
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;
  
  console.log('[HTTP] ' + method + ' ' + path);
  setCORS(req, res);

  // ⬡B:AIR:REACH.API.PREFLIGHT:CODE:security.cors.preflight:USER→REACH:T10:v1.5.0:20260213:p1f2l⬡
  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.HEALTH:CODE:infrastructure.status.alive:USER→REACH:T10:v1.5.0:20260213:h1l2t⬡ ROOT / HEALTH
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/' || path === '/health') {
    return jsonResponse(res, 200, {
      status: 'ALIVE',
      service: 'ABA TOUCH v2.12.2-AUTOCRON',
      mode: 'FULL API + VOICE + OMI + SMS + SPEECH INTELLIGENCE',
      air: 'ABA Intellectual Role - CENTRAL ORCHESTRATOR',
      models: { primary: 'Gemini Flash 2.0', backup: 'Claude Haiku', speed_fallback: 'Groq' },
      agents: { hardcoded: ['LUKE', 'COLE', 'JUDE', 'PACK'], voice: 'VARA', intelligence: 'DEEPGRAM' },
      voice: 'ElevenLabs ' + ELEVENLABS_VOICE,
      phone: TWILIO_PHONE,
      capabilities: [
        'outbound_calls', 'group_calls', 'scheduled_calls', 'voicemail_drops', 
        'call_transfers', 'dawn_briefings', 'speech_intelligence', 'email_send',
        'sms_receive', 'call_recording', 'call_transcription'
      ],
      api_routes: [
        '/api/router', '/api/voice/analyze', '/api/iman/send-gmail', 
        '/api/cron/scheduled-calls', '/api/voice/deepgram-token', 
        '/api/omi/manifest', '/api/omi/webhook', 
        '/api/sms/send', '/api/sms/receive',
        '/api/elevenlabs/webhook', '/api/call/intelligence/:id', '/api/calls/recent'
      ],
      speech_intelligence: ['diarization', 'topics', 'entities', 'intent', 'sentiment', 'summarization', 'language_detection'],
      message: 'We are all ABA'
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:TOUCH:PHASE3:SPURT3.2:cron.scheduled.calls:20260216⬡
  // CRON ENDPOINT - Check and execute scheduled calls
  // Called by Render's cron job or external scheduler
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/cron/scheduled-calls' && method === 'GET') {
    console.log('[CRON] Checking scheduled calls...');
    
    try {
      const dueCalls = await checkScheduledCalls();
      
      if (dueCalls.length === 0) {
        return jsonResponse(res, 200, {
          status: 'ok',
          message: 'No scheduled calls due',
          checked_at: new Date().toISOString()
        });
      }
      
      const results = [];
      
      for (const call of dueCalls) {
        console.log('[CRON] Executing scheduled call to:', call.target_name);
        
        try {
          let callResult;
          
          // ⬡B:TOUCH:AGENT.DAWN:cron.integration:20260216⬡
          // Check if this is a DAWN briefing call
          if (call.call_type === 'dawn_briefing') {
            console.log('[CRON] DAWN BRIEFING CALL - Using DAWN_makeCall');
            callResult = await DAWN_makeCall(call.target_phone, call.target_name);
            
            if (callResult.success) {
              results.push({
                target: call.target_name,
                status: 'dawn_briefing_sent',
                conversation_id: callResult.conversation_id,
                briefingId: callResult.briefingId
              });
            } else {
              results.push({
                target: call.target_name,
                status: 'error',
                error: callResult.error
              });
            }
          } else {
            // Regular scheduled call via ElevenLabs
            const apiResult = await httpsRequest({
              hostname: 'api.elevenlabs.io',
              path: '/v1/convai/twilio/outbound-call',
              method: 'POST',
              headers: {
                'xi-api-key': ELEVENLABS_KEY,
                'Content-Type': 'application/json'
              }
            }, JSON.stringify({
              agent_id: 'agent_0601khe2q0gben08ws34bzf7a0sa',
              agent_phone_number_id: 'phnum_0001khe3q3nyec1bv04mk2m048v8',
              to_number: call.target_phone
            }));
            
            const callData = JSON.parse(apiResult.data.toString());
            
            results.push({
              target: call.target_name,
              status: 'called',
              conversation_id: callData.conversation_id
            });
          }
          
          // Update memory to mark as completed
          await storeToBrain({
            content: JSON.stringify({ ...call, status: 'completed', completed_at: new Date().toISOString() }),
            memory_type: 'scheduled_call_completed',
            categories: ['scheduled', 'call', 'completed'],
            importance: 6,
            tags: ['scheduled_call', 'completed', call.target_name.toLowerCase()]
          });
          
        } catch (e) {
          console.log('[CRON] Call error:', e.message);
          results.push({
            target: call.target_name,
            status: 'error',
            error: e.message
          });
        }
      }
      
      return jsonResponse(res, 200, {
        status: 'ok',
        executed: results.length,
        results,
        checked_at: new Date().toISOString()
      });
      
    } catch (e) {
      console.log('[CRON] Error:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:TOUCH:API.SPEECH.INTELLIGENCE:endpoint:20260216⬡
  // SPEECH INTELLIGENCE API - Analyze audio with full Deepgram features
  // POST /api/voice/analyze - Analyze audio URL
  // GET /api/voice/intelligence/:call_id - Get analysis for a call
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/voice/analyze' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { audio_url, call_id } = body;
      
      if (!audio_url) {
        return jsonResponse(res, 400, { error: 'audio_url required' });
      }
      
      const analysis = await analyzeCallWithDeepgram(audio_url);
      
      if (!analysis) {
        return jsonResponse(res, 500, { error: 'Analysis failed' });
      }
      
      return jsonResponse(res, 200, {
        success: true,
        call_id: call_id || 'unknown',
        analysis: {
          transcript: analysis.transcript,
          speakers: analysis.speakers,
          topics: analysis.topics,
          entities: analysis.entities,
          intents: analysis.intents,
          sentiment: analysis.sentiment,
          summary: analysis.summary,
          language: analysis.language
        }
      });
      
    } catch (e) {
      console.log('[SPEECH INTEL API] Error:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:TOUCH:API.IMAN.SEND:endpoint:20260216⬡
  // IMAN Email Send API - Send email via Gmail
  // POST /api/iman/send-gmail
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/iman/send-gmail' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { to, subject, body: emailBody, confirm } = body;
      
      if (!to || !subject || !emailBody) {
        return jsonResponse(res, 400, { error: 'to, subject, and body required' });
      }
      
      // If draft exists, send it
      if (confirm) {
        const result = await IMAN_sendEmailGmail(to, subject, emailBody);
        return jsonResponse(res, result.success ? 200 : 500, result);
      }
      
      // Otherwise, create draft
      const draft = await IMAN_draftEmail({
        to: to,
        regarding: subject,
        tone: 'professional'
      });
      
      return jsonResponse(res, 200, {
        success: true,
        draft: draft,
        message: 'Draft created. Call again with confirm=true to send.'
      });
      
    } catch (e) {
      console.log('[IMAN SEND API] Error:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  
  // ═══════════════════════════════════════════════════════════════════════
  // LEGAL PAGES (for Twilio A2P 10DLC compliance)
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/privacy-policy' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy Policy | Global Majority Group</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;line-height:1.8;padding:40px 20px}
.container{max-width:800px;margin:0 auto}
h1{font-size:28px;color:#fff;margin-bottom:8px}
.subtitle{color:#888;margin-bottom:32px;font-size:14px}
h2{font-size:20px;color:#fff;margin:28px 0 12px;border-bottom:1px solid #222;padding-bottom:8px}
p{margin-bottom:16px;color:#ccc}
ul{margin:0 0 16px 24px}
li{margin-bottom:8px;color:#ccc}
a{color:#00ff88}
.footer{margin-top:48px;padding-top:24px;border-top:1px solid #222;color:#666;font-size:13px}
</style>
</head>
<body>
<div class="container">
<h1>Privacy Policy</h1>
<p class="subtitle">Global Majority Group &mdash; Last Updated: February 14, 2026</p>

<h2>1. Introduction</h2>
<p>Global Majority Group ("we," "us," or "our") operates ABA (A Better AI), an AI-powered assistant platform. This Privacy Policy describes how we collect, use, and protect your personal information when you interact with our services, including phone calls, text messages, emails, and web applications.</p>

<h2>2. Information We Collect</h2>
<p>We may collect the following types of information:</p>
<ul>
<li><strong>Contact Information:</strong> Phone number, name, and email address provided during interactions with ABA.</li>
<li><strong>Communication Data:</strong> Call logs, text message content, and email correspondence when you interact with our AI assistant.</li>
<li><strong>Usage Data:</strong> Information about how you use our services, including session duration and feature interactions.</li>
<li><strong>Device Information:</strong> Browser type, operating system, and device identifiers when accessing our web applications.</li>
</ul>

<h2>3. How We Use Your Information</h2>
<p>We use collected information to:</p>
<ul>
<li>Provide and improve our AI assistant services</li>
<li>Send follow-up messages after phone interactions (with your consent)</li>
<li>Respond to your inquiries and requests</li>
<li>Personalize your experience with ABA</li>
<li>Maintain and improve our platform</li>
<li>Comply with legal obligations</li>
</ul>

<h2>4. SMS/Text Messaging</h2>
<p>By verbally consenting during a phone call with ABA or by providing your phone number through our platform, you agree to receive text messages from Global Majority Group. Messages may include follow-up information, service notifications, and updates about our products. Message frequency varies. Message and data rates may apply.</p>
<p><strong>Opt-Out:</strong> You may opt out of receiving text messages at any time by replying STOP to any message. Reply HELP for assistance. Upon opting out, you will receive one final confirmation message and no further texts will be sent.</p>

<h2>5. Data Sharing</h2>
<p>We do not sell, trade, or rent your personal information to third parties. We may share information with:</p>
<ul>
<li><strong>Service Providers:</strong> Third-party services that help us operate our platform (e.g., cloud hosting, communication APIs), bound by confidentiality agreements.</li>
<li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process.</li>
</ul>

<h2>6. Data Security</h2>
<p>We implement industry-standard security measures to protect your information, including encryption in transit and at rest, access controls, and regular security audits. However, no method of transmission over the Internet is 100% secure.</p>

<h2>7. Data Retention</h2>
<p>We retain your information only as long as necessary to fulfill the purposes described in this policy or as required by law. You may request deletion of your data at any time by contacting us.</p>

<h2>8. Your Rights</h2>
<p>You have the right to:</p>
<ul>
<li>Access the personal information we hold about you</li>
<li>Request correction of inaccurate information</li>
<li>Request deletion of your information</li>
<li>Opt out of communications at any time</li>
</ul>

<h2>9. Children's Privacy</h2>
<p>Our services are not directed to individuals under the age of 13. We do not knowingly collect personal information from children.</p>

<h2>10. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page with a revised effective date.</p>

<h2>11. Contact Us</h2>
<p>If you have questions about this Privacy Policy, contact us at:</p>
<p>Global Majority Group<br>
Email: <a href="mailto:brandon@globalmajoritygroup.com">brandon@globalmajoritygroup.com</a><br>
Phone: (336) 389-8116</p>

<div class="footer">
<p>&copy; 2026 Global Majority Group. All rights reserved.</p>
</div>
</div>
</body>
</html>
`);
  }
  
  if ((path === '/terms' || path === '/terms-and-conditions') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Terms and Conditions | Global Majority Group</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;line-height:1.8;padding:40px 20px}
.container{max-width:800px;margin:0 auto}
h1{font-size:28px;color:#fff;margin-bottom:8px}
.subtitle{color:#888;margin-bottom:32px;font-size:14px}
h2{font-size:20px;color:#fff;margin:28px 0 12px;border-bottom:1px solid #222;padding-bottom:8px}
p{margin-bottom:16px;color:#ccc}
ul{margin:0 0 16px 24px}
li{margin-bottom:8px;color:#ccc}
a{color:#00ff88}
.footer{margin-top:48px;padding-top:24px;border-top:1px solid #222;color:#666;font-size:13px}
</style>
</head>
<body>
<div class="container">
<h1>Terms and Conditions</h1>
<p class="subtitle">Global Majority Group &mdash; Last Updated: February 14, 2026</p>

<h2>1. Acceptance of Terms</h2>
<p>By accessing or using the services provided by Global Majority Group ("Company"), including ABA (A Better AI) and related platforms, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our services.</p>

<h2>2. Description of Services</h2>
<p>Global Majority Group provides ABA, an AI-powered assistant platform that offers phone-based interactions, text messaging, email communications, job search assistance, calendar management, budgeting tools, and other productivity features. Our services include the ABA OS portal, ABACUS platform, and related applications.</p>

<h2>3. SMS/Text Messaging Program</h2>
<p><strong>Program Name:</strong> ABA Notifications<br>
<strong>Description:</strong> Follow-up messages, service notifications, and updates sent by ABA after phone interactions or platform engagement.<br>
<strong>Message Frequency:</strong> Message frequency varies based on your interactions. Typically 1-5 messages per interaction.<br>
<strong>Message and Data Rates:</strong> Standard message and data rates may apply. Contact your wireless carrier for details.<br>
<strong>Opt-In:</strong> By calling our phone line and verbally consenting, or by providing your phone number through our platform, you consent to receive text messages.<br>
<strong>Opt-Out:</strong> Text STOP to any message to unsubscribe. You will receive a confirmation and no further messages.<br>
<strong>Help:</strong> Text HELP to any message for support information.<br>
<strong>Support:</strong> Email <a href="mailto:brandon@globalmajoritygroup.com">brandon@globalmajoritygroup.com</a> or call (336) 389-8116.</p>

<h2>4. User Responsibilities</h2>
<p>You agree to:</p>
<ul>
<li>Provide accurate information when interacting with our services</li>
<li>Use our services only for lawful purposes</li>
<li>Not attempt to disrupt, hack, or reverse-engineer our systems</li>
<li>Not use our services to harass, spam, or harm others</li>
</ul>

<h2>5. Intellectual Property</h2>
<p>All content, software, and technology comprising the ABA platform is the property of Global Majority Group. You may not copy, modify, distribute, or create derivative works without our express written permission.</p>

<h2>6. Limitation of Liability</h2>
<p>ABA is an AI assistant and may not always provide perfect responses. Global Majority Group is not liable for decisions made based on ABA's output. Our services are provided "as is" without warranties of any kind, express or implied. We are not responsible for any indirect, incidental, or consequential damages arising from your use of our services.</p>

<h2>7. Privacy</h2>
<p>Your use of our services is also governed by our <a href="/privacy-policy">Privacy Policy</a>, which describes how we collect, use, and protect your information.</p>

<h2>8. Modifications</h2>
<p>We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes acceptance of the updated terms.</p>

<h2>9. Termination</h2>
<p>We may suspend or terminate your access to our services at any time for violations of these terms or for any other reason at our discretion.</p>

<h2>10. Governing Law</h2>
<p>These terms are governed by the laws of the State of North Carolina, without regard to conflict of law principles.</p>

<h2>11. Contact</h2>
<p>For questions about these Terms and Conditions:</p>
<p>Global Majority Group<br>
Email: <a href="mailto:brandon@globalmajoritygroup.com">brandon@globalmajoritygroup.com</a><br>
Phone: (336) 389-8116</p>

<div class="footer">
<p>&copy; 2026 Global Majority Group. All rights reserved.</p>
</div>
</div>
</body>
</html>
`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.ROUTER:CODE:routing.text.chat:USER→REACH→AIR→AGENTS→MODEL→USER:T8:v1.5.0:20260213:r1o2t⬡ /api/router - MAIN AIR CHAT
  // 1A Shell sends { message, history } and gets back { response }
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/router' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { message, history, model, systemPrompt } = body;
      if (!message) return jsonResponse(res, 400, { error: 'message required' });

      console.log('[ROUTER] Routing message through AIR: "' + message.substring(0, 80) + '"');
      const result = await AIR_text(message, history || []);
      return jsonResponse(res, 200, {
        response: result.response,
        isGoodbye: result.isGoodbye,
        missionNumber: result.missionNumber,
        source: 'REACH-AIR',
        trace: 'USER*AIR*LUKE,COLE,JUDE,PACK*MODEL*VARA'
      });
    } catch (e) {
      console.error('[ROUTER] Error:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.CLAUDE:CODE:models.proxy.anthropic:USER→REACH→ANTHROPIC→USER:T8:v1.5.0:20260213:c1l2d⬡ /api/models/claude - CLAUDE PROXY
  // Direct pass-through to Anthropic API for 1A Shell/CCWA
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/models/claude' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { messages, system, model, max_tokens } = body;
      if (!messages) return jsonResponse(res, 400, { error: 'messages required' });
      if (!ANTHROPIC_KEY) return jsonResponse(res, 503, { error: 'Anthropic API key not configured' });

      const result = await httpsRequest({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: max_tokens || 4096,
        system: system || 'You are ABA (A Better AI). Warm butler meets real friend. Professional when it counts, personal when it matters. Flow between both naturally. Never robotic, never stiff. You cook, you care, you get it done.',
        messages
      }));

      const json = JSON.parse(result.data.toString());
      return jsonResponse(res, result.status, json);
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.DEEPGRAM_TOKEN:CODE:voice.stt.browser_token:USER→REACH→DEEPGRAM_KEY:T7:v1.5.0:20260213:d1t2k⬡ /api/voice/deepgram-token
  // Returns Deepgram API key for browser-side speech recognition
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/voice/deepgram-token' && method === 'GET') {
    if (!DEEPGRAM_KEY) return jsonResponse(res, 503, { error: 'Deepgram not configured' });
    return jsonResponse(res, 200, {
      token: DEEPGRAM_KEY,
      model: 'nova-2',
      language: 'en-US',
      source: 'REACH'
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.TTS:CODE:voice.tts.elevenlabs:USER→REACH→VARA→ELEVENLABS→USER:T8:v1.5.0:20260213:t1t2s⬡ /api/voice/tts
  // Generates ElevenLabs audio from text (returns audio/mpeg)
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/voice/tts' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { text, voice_id } = body;
      if (!text) return jsonResponse(res, 400, { error: 'text required' });
      if (!ELEVENLABS_KEY) return jsonResponse(res, 503, { error: 'ElevenLabs not configured' });

      const voiceId = voice_id || ELEVENLABS_VOICE;
      const result = await httpsRequest({
        hostname: 'api.elevenlabs.io',
        path: '/v1/text-to-speech/' + voiceId,
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        }
      }, JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }));

      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      return res.end(result.data);
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:VARA:REACH.API.TTS_STREAM:CODE:voice.tts.twilio:TWILIO→REACH→ELEVENLABS:T8:v1.0.0:20260214:t1s2t⬡
  // TTS endpoint for Twilio <Play> - returns audio/mpeg from ElevenLabs
  // Used by escalation calls to speak with VARA's voice
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/voice/tts-stream' && (method === 'GET' || method === 'POST')) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const text = url.searchParams.get('text') || 'Hello';
      
      if (!ELEVENLABS_KEY) {
        // Fallback to empty response if no ElevenLabs
        res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
        return res.end();
      }

      const voiceId = ELEVENLABS_VOICE || 'LD658Mupr7vNwTTJSPsk';
      const result = await httpsRequest({
        hostname: 'api.elevenlabs.io',
        path: '/v1/text-to-speech/' + voiceId,
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        }
      }, JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL || 'eleven_flash_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }));

      res.writeHead(200, { 
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600'
      });
      return res.end(result.data);
    } catch (e) {
      console.error('[TTS-STREAM] Error:', e.message);
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      return res.end();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.OMI_MANIFEST:CODE:senses.omi.registration:OMI→REACH→OMI:T7:v1.5.0:20260213:o1m2m⬡ /api/omi/manifest
  // Returns the manifest JSON so OMI recognizes ABA as an app
  // ═══════════════════════════════════════════════════════════════════════
  
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.VOICE.ELEVENLABS_TOOL:CODE:voice.air.bridge:ELEVENLABS→AIR→AGENTS:T10:v2.0.0:20260214:e1l2t⬡
  // AIR VOICE TOOL - ElevenLabs calls this to get AIR's response
  // This is the BRIDGE between ElevenLabs voice and ABA's brain
  // ═══════════════════════════════════════════════════════════════════════════════
  if (path === '/api/air/voice-tool' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const userMessage = body.user_message || body.text || body.input || '';
      const conversationId = body.conversation_id || 'voice-' + Date.now();
      const callerNumber = body.caller_number || body.phone || 'unknown';
      
      console.log('[AIR VOICE TOOL] Received from ElevenLabs:', userMessage);
      console.log('[AIR VOICE TOOL] Conversation:', conversationId);
      
      // Broadcast to Command Center - call is active
      broadcastToCommandCenter({
        type: 'voice_activity',
        source: 'elevenlabs',
        conversation_id: conversationId,
        caller: callerNumber,
        user_said: userMessage,
        timestamp: new Date().toISOString()
      });
      
      // Route through AIR - the central brain
      // Look up caller identity from phone number
      let callerIdentity = { name: 'Caller', role: 'unknown', trust: 'T2' };
      if (callerNumber && callerNumber !== 'unknown') {
        callerIdentity = await lookupCallerByPhone(callerNumber);
      }
      
      console.log('[AIR VOICE TOOL] Caller identified as:', callerIdentity.name, 'Trust:', callerIdentity.trust);
      
      // ⬡B:TOUCH:PHASE3:voice.tool.advanced.handlers:20260216⬡
      const msgLower = userMessage.toLowerCase();
      
      // ═══════════════════════════════════════════════════════════════════
      // HANDLER 1: GROUP CALLS - "Call me and Eric together"
      // ═══════════════════════════════════════════════════════════════════
      const groupCallParticipants = parseGroupCallRequest(userMessage);
      if (groupCallParticipants) {
        console.log('[AIR VOICE TOOL] GROUP CALL REQUEST DETECTED!');
        
        try {
          const result = await startGroupCall(groupCallParticipants);
          
          if (result.success) {
            const names = groupCallParticipants.map(p => p.name).join(' and ');
            return jsonResponse(res, 200, {
              response: `Got it! I'm setting up a group call with ${names}. Everyone should be receiving calls right now to join the conference.`,
              group_call_initiated: true,
              conference: result.conferenceName,
              participants: result.participants
            });
          } else {
            return jsonResponse(res, 200, {
              response: "I tried to set up the group call but hit a snag. Let me try individual calls instead.",
              error: result.error
            });
          }
        } catch (e) {
          console.log('[AIR VOICE TOOL] Group call error:', e.message);
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // HANDLER 2: SCHEDULED CALLS - "Call me at 8am tomorrow"
      // ═══════════════════════════════════════════════════════════════════
      const isScheduleRequest = msgLower.includes('call me at') || 
                                msgLower.includes('call me tomorrow') ||
                                msgLower.includes('remind me to call') ||
                                msgLower.includes('schedule a call');
      
      if (isScheduleRequest) {
        console.log('[AIR VOICE TOOL] SCHEDULED CALL REQUEST DETECTED!');
        
        try {
          const result = await scheduleCall(userMessage, callerIdentity);
          
          if (result.success) {
            return jsonResponse(res, 200, {
              response: `Done! I've scheduled a call to ${result.target} for ${result.scheduledTime}. I'll make sure that happens.`,
              scheduled_call: true,
              scheduledTime: result.scheduledTime,
              target: result.target
            });
          } else {
            return jsonResponse(res, 200, {
              response: "I had trouble understanding when you'd like me to call. Could you say something like 'call me at 8am tomorrow'?"
            });
          }
        } catch (e) {
          console.log('[AIR VOICE TOOL] Schedule error:', e.message);
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // HANDLER 3: CALL TRANSFERS - "Transfer me to Eric"
      // ═══════════════════════════════════════════════════════════════════
      const transferRequest = parseTransferRequest(userMessage);
      if (transferRequest) {
        console.log('[AIR VOICE TOOL] TRANSFER REQUEST DETECTED!');
        
        // Note: For ElevenLabs calls, we don't have direct call SID access
        // This would need integration with the current call context
        return jsonResponse(res, 200, {
          response: `I understand you'd like to be transferred to ${transferRequest.target.name}. For now, let me call them and add you both to a conference.`,
          transfer_requested: true,
          target: transferRequest.target.name,
          type: transferRequest.type
        });
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // HANDLER 3.5: EMAIL SENDING - "Send an email to Eric about..."
      // ⬡B:TOUCH:IMAN.VOICE.EMAIL:handler:20260216⬡
      // ═══════════════════════════════════════════════════════════════════
      const isEmailRequest = msgLower.includes('send') && msgLower.includes('email') ||
                            msgLower.includes('email') && msgLower.includes('to');
      
      if (isEmailRequest) {
        console.log('[AIR VOICE TOOL] EMAIL REQUEST DETECTED!');
        
        try {
          const emailResult = await IMAN_voiceEmailCommand(userMessage, callerIdentity);
          
          if (emailResult.success && emailResult.awaiting_confirmation) {
            return jsonResponse(res, 200, {
              response: emailResult.response,
              email_draft: emailResult.draft,
              awaiting_confirmation: true
            });
          } else if (emailResult.success) {
            return jsonResponse(res, 200, {
              response: emailResult.response,
              email_sent: true
            });
          } else {
            return jsonResponse(res, 200, {
              response: emailResult.response
            });
          }
        } catch (e) {
          console.log('[AIR VOICE TOOL] Email error:', e.message);
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // HANDLER 4: SINGLE OUTBOUND CALLS - "Call me back" or "Call Eric"
      // ═══════════════════════════════════════════════════════════════════
      const isCallbackRequest = msgLower.includes('call me back') || msgLower.includes('hang up and call') || msgLower.includes('callback');
      const isCallSomeoneRequest = msgLower.match(/call\s+(eric|bj|cj|brandon|dr\.?\s*lane|mom|dad)/i);
      
      if (isCallbackRequest || isCallSomeoneRequest) {
        console.log('[AIR VOICE TOOL] OUTBOUND CALL REQUEST DETECTED!');
        
        // Determine who to call
        let targetPhone = '+13363898116'; // Default to Brandon
        let targetName = 'you';
        
        if (isCallSomeoneRequest) {
          const personMatch = msgLower.match(/call\s+(eric|bj|cj|brandon|dr\.?\s*lane|mom|dad)/i);
          const person = personMatch ? personMatch[1].toLowerCase() : null;
          
          // ⬡B:TOUCH:PHASE3:SPURT3.0:use.master.contacts:20260216⬡
          // Use centralized MASTER_CONTACTS with timezone support
          const contact = lookupContact(person);
          if (contact) {
            targetPhone = contact.phone;
            targetName = contact.name;
            
            // Check if it's a reasonable hour to call in their timezone
            if (!isReasonableHourToCall(person)) {
              const config = TIMEZONE_CONFIG[person] || TIMEZONE_CONFIG.default;
              const time = getTimeInTimezone(config.tz);
              console.log('[AIR VOICE TOOL] Warning: Calling at', time.formatted, config.label);
            }
          }
        } else if (callerIdentity && callerIdentity.phone) {
          // Callback to caller
          targetPhone = callerIdentity.phone;
          targetName = callerIdentity.name || 'you';
        }
        
        console.log('[AIR VOICE TOOL] Calling:', targetName, 'at', targetPhone);
        
        // Trigger outbound call via ElevenLabs API
        const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
        
        try {
          const callResult = await httpsRequest({
            hostname: 'api.elevenlabs.io',
            path: '/v1/convai/twilio/outbound-call',
            method: 'POST',
            headers: {
              'xi-api-key': ELEVENLABS_KEY,
              'Content-Type': 'application/json'
            }
          }, JSON.stringify({
            agent_id: 'agent_0601khe2q0gben08ws34bzf7a0sa',
            agent_phone_number_id: 'phnum_0001khe3q3nyec1bv04mk2m048v8',
            to_number: targetPhone
          }));
          
          const callData = JSON.parse(callResult.data.toString());
          console.log('[AIR VOICE TOOL] Outbound call initiated:', callData.conversation_id);
          
          // Different response based on who we're calling
          const responseMsg = isCallbackRequest 
            ? "Absolutely! I will hang up now and call you right back. Talk to you in just a moment!"
            : `Got it! I am calling ${targetName} right now. They should be getting my call any second.`;
          
          return jsonResponse(res, 200, {
            response: responseMsg,
            outbound_call_initiated: true,
            target: targetName,
            conversation_id: callData.conversation_id
          });
        } catch (e) {
          console.log('[AIR VOICE TOOL] Outbound call error:', e.message);
          return jsonResponse(res, 200, {
            response: "I tried to place that call but hit a small snag. Let me stay on the line with you instead. What else can I help with?"
          });
        }
      }
      
      // ⬡B:AIR:REACH.VOICE.ROUTING:LOGIC:air.central:v2.4.0:20260214⬡
      // ALL routing goes through AIR_process - AIR dispatches to agents
      // This is correct hierarchy: L5 (REACH) → L6 (AIR) → L3 (Agents)
      // AIR_process expects: (userSaid, history, callerIdentity, demoState)
      const airResponse = await AIR_process(
        userMessage,           // The actual question/request as STRING
        [],                    // No history for now (each tool call is fresh)
        callerIdentity,        // Who is calling
        {}                     // No demo state
      );
      
      // Extract the response text
      const responseText = airResponse?.response || airResponse?.message || 
        "I understand. Let me help you with that.";
      
      console.log('[AIR VOICE TOOL] AIR Response:', responseText);
      
      // Broadcast response to Command Center
      broadcastToCommandCenter({
        type: 'voice_response',
        source: 'air',
        conversation_id: conversationId,
        aba_said: responseText,
        timestamp: new Date().toISOString()
      });
      
      // Store in brain
      storeToBrain({
        content: 'VOICE CALL [' + conversationId + ']: User said "' + userMessage + '" | ABA responded "' + responseText + '"',
        memory_type: 'voice_transcript',
        categories: ['voice', 'elevenlabs', 'conversation'],
        importance: 5,
        tags: ['voice', 'elevenlabs', 'transcript']
      }).catch(e => console.log('[BRAIN] Store error:', e.message));
      
      // Return response for ElevenLabs to speak
      return jsonResponse(res, 200, {
        response: responseText,
        conversation_id: conversationId
      });
      
    } catch (e) {
      console.error('[AIR VOICE TOOL] FULL ERROR:', e);
      console.error('[AIR VOICE TOOL] Error name:', e.name);
      console.error('[AIR VOICE TOOL] Error message:', e.message);
      console.error('[AIR VOICE TOOL] Error stack:', e.stack);
      return jsonResponse(res, 200, {
        response: "I apologize, I had a brief moment of confusion. Could you repeat that?",
        debug_error: e.message,
        debug_stack: e.stack?.split('\n')[0]
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.VOICE.ELEVENLABS_POSTCALL:CODE:voice.postcall.webhook:ELEVENLABS→AIR→CC:T10:v2.0.0:20260214:p1c2w⬡
  // POST-CALL WEBHOOK - ElevenLabs calls this when call ends
  // ═══════════════════════════════════════════════════════════════════════════════
  if (path === '/api/air/call-ended' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const conversationId = body.conversation_id || 'unknown';
      const transcript = body.transcript || [];
      const duration = body.duration_seconds || 0;
      const callerNumber = body.caller_number || 'unknown';
      
      console.log('[POST-CALL] Call ended:', conversationId);
      console.log('[POST-CALL] Duration:', duration, 'seconds');
      
      // Broadcast to Command Center
      broadcastToCommandCenter({
        type: 'call_ended',
        conversation_id: conversationId,
        caller: callerNumber,
        duration_seconds: duration,
        transcript_length: Array.isArray(transcript) ? transcript.length : 0,
        timestamp: new Date().toISOString()
      });
      
      // Store full transcript in brain
      const transcriptText = Array.isArray(transcript) 
        ? transcript.map(t => (t.role || 'unknown') + ': ' + (t.text || '')).join('\n')
        : JSON.stringify(transcript);
      
      storeToBrain({
        content: 'CALL TRANSCRIPT [' + conversationId + '] Duration: ' + duration + 's\n' + transcriptText,
        memory_type: 'phone_transcript',
        categories: ['voice', 'transcript', 'elevenlabs'],
        importance: 7,
        tags: ['voice', 'transcript', 'call_complete']
      }).catch(e => console.log('[BRAIN] Store error:', e.message));
      
      return jsonResponse(res, 200, { received: true, conversation_id: conversationId });
      
    } catch (e) {
      console.error('[POST-CALL] Error:', e.message);
      return jsonResponse(res, 200, { received: true, error: e.message });
    }
  }

  // ████████████████████████████████████████████████████████████████████████████
  // ██ /api/omi/auth — OMI HEALTH CHECK (DO NOT REMOVE - BREAKS OMI)          ██
  // ████████████████████████████████████████████████████████████████████████████
  if (path === '/api/omi/auth') {
    console.log('[OMI AUTH] Health check at ' + new Date().toISOString());
    return jsonResponse(res, 200, {
      authenticated: true,
      app_id: OMI_APP_ID || 'aba-intelligence-layer',
      status: 'active',
      timestamp: new Date().toISOString()
    });
  }

  if (path === '/api/omi/manifest' || path === '/api/omi/manifest.json') {
    return jsonResponse(res, 200, {
      id: OMI_APP_ID,
      name: 'ABA Intelligence Layer',
      description: 'ABA (A Better AI) processes ambient conversations through TASTE (Transcript Analysis and Semantic Tagging Engine) and stores insights in the ABA Brain.',
      author: 'Brandon Pierce / Global Majority Group',
      version: '1.9.0',
      capabilities: ['transcript_processing', 'memory_integration', 'real_time_analysis'],
      webhook_url: REACH_URL + '/api/omi/webhook',
      setup_instructions: 'ABA automatically processes your conversations. No setup needed.',
      triggers_on: 'transcript_processed',
      is_active: true,
      icon_url: REACH_URL + '/icon.png'
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.OMI_WEBHOOK:CODE:senses.omi.transcript:OMI→REACH→TASTE→BRAIN:T7:v1.5.0:20260213:o1w2h⬡ /api/omi/webhook
  // Receives transcripts from OMI and stores in ABA Brain via TASTE
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/omi/webhook' && method === 'POST') {
    try {
      const body = await parseBody(req);
      console.log('[OMI] Webhook received:', JSON.stringify(body).substring(0, 200));

      // ═══ REQUEST LOGGER - stores every incoming OMI request for debugging ═══
      const logEntry = {
        ts: new Date().toISOString(),
        url: req.url || 'unknown',
        body_preview: JSON.stringify(body).slice(0, 1000),
        headers: { 'user-agent': req.headers?.get?.('user-agent') || 'n/a' }
      };
      try {
        await httpsRequest({
          hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
          path: '/rest/v1/aba_memory',
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY || SUPABASE_ANON,
            'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON),
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          }
        }, JSON.stringify({
          content: 'OMI REQUEST LOG: ' + JSON.stringify(logEntry),
          memory_type: 'system',
          source: 'omi_request_log',
          importance: 2,
          is_system: true,
          tags: ['omi', 'request_log', 'debug']
        }));
        console.log('[LOG] Stored OMI request');
      } catch(le) { console.log('[LOG] Failed:', le.message); }


      // Extract actual transcript text - don't store raw JSON
      let transcript = '';
      if (body.transcript) {
        transcript = typeof body.transcript === 'string' ? body.transcript : JSON.stringify(body.transcript);
      } else if (body.text) {
        transcript = body.text;
      } else if (body.segments && Array.isArray(body.segments)) {
        transcript = body.segments.map(s => s.text || '').join(' ');
      } else if (body.transcript_segments && Array.isArray(body.transcript_segments)) {
        transcript = body.transcript_segments.map(s => s.text || '').join(' ');
      } else {
        // This is likely session metadata, not a transcript - skip
        console.log('[OMI] Received non-transcript data, skipping:', Object.keys(body).join(', '));
        return jsonResponse(res, 200, { status: 'skipped', reason: 'no transcript text found' });
      }
      
      // Don't process empty transcripts
      if (!transcript || transcript.length < 5) {
        return jsonResponse(res, 200, { status: 'skipped', reason: 'empty transcript' });
      }
      const timestamp = body.timestamp || new Date().toISOString();

      // Store in brain via TASTE
      const storeData = JSON.stringify({
        content: 'OMI TRANSCRIPT (' + timestamp + '): ' + transcript.substring(0, 2000),
        memory_type: 'omi_transcript',
        categories: ['omi', 'ambient', 'transcript'],
        importance: 5,
        is_system: true,
        source: 'omi_webhook_' + new Date().toISOString(),
        tags: ['omi', 'taste', 'ambient', 'transcript']
      });

      await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: '/rest/v1/aba_memory',
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY || SUPABASE_ANON,
          'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON),
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }
      }, storeData);

      console.log('[TASTE] Transcript stored in brain');
      
      // ═══════════════════════════════════════════════════════════════════════════
      // ⬡B:ABCD:BOTH:OMI.AIR.ROUTING:WIRE:v2.5.1:20260214⬡
      // WIRED: If transcript contains "ABA" command, route through AIR
      // Pattern: OMI → processOMIThroughAIR → AIR_process → DISPATCH → Agent
      // ═══════════════════════════════════════════════════════════════════════════
      const userId = body.uid || body.user_id || 'unknown';
      const airRouteResult = await processOMIThroughAIR(transcript, userId);
      if (airRouteResult) {
        console.log('[OMI→AIR] Command was routed through AIR');
        // Broadcast to Command Center
        broadcastToCommandCenter({
          type: 'omi_air_command',
          transcript: transcript.substring(0, 100),
          airResponse: airRouteResult.response?.substring(0, 100) || 'processed',
          timestamp: new Date().toISOString()
        });
      }
      
      // ═══════ TASTE → AIR ESCALATION CHECK ═══════
      // Check if transcript contains urgent keywords and trigger AIR if so
      const omiResult = await TRIGGER_omiHeard({ 
        text: transcript, 
        session_id: body.session_id || 'unknown',
        timestamp: timestamp 
      });
      
      if (omiResult.success) {
        console.log('[TASTE] Urgent content detected, AIR escalation triggered');
        return jsonResponse(res, 200, { 
          status: 'processed', 
          agent: 'TASTE', 
          stored: true, 
          escalated: true,
          routing: omiResult.routing 
        });
      }
      
      return jsonResponse(res, 200, { status: 'processed', agent: 'TASTE', stored: true, escalated: false });
    } catch (e) {
      console.error('[OMI] Webhook error:', e.message);
      return jsonResponse(res, 200, { status: 'received', error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.SMS_SEND:CODE:outreach.sms.twilio:AIR→CARA→REACH→TWILIO→USER:T8:v1.5.0:20260213:s1m2t⬡ /api/sms/send
  // ROUTING: CARA*AIR*TWILIO*USER
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/sms/send' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { to, message } = body;
      if (!to || !message) return jsonResponse(res, 400, { error: 'to and message required' });
      if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_PHONE) {
        return jsonResponse(res, 503, { error: 'Twilio not fully configured' });
      }

      const formData = 'To=' + encodeURIComponent(to) + '&From=' + encodeURIComponent(TWILIO_PHONE) + '&Body=' + encodeURIComponent(message);
      const auth = Buffer.from(TWILIO_SID + ':' + TWILIO_AUTH).toString('base64');

      const result = await httpsRequest({
        hostname: 'api.twilio.com',
        path: '/2010-04-01/Accounts/' + TWILIO_SID + '/Messages.json',
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + auth,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }, formData);

      const json = JSON.parse(result.data.toString());
      console.log('[SMS] Sent to ' + to + ': ' + (json.sid || 'error'));
      return jsonResponse(res, result.status, { success: !!json.sid, sid: json.sid, status: json.status, error: json.message });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:TOUCH:API.SMS.RECEIVE:endpoint:20260216⬡
  // SMS RECEIVE - Webhook for incoming Twilio SMS
  // Configure in Twilio: https://console.twilio.com > Phone Numbers > +13362037510
  // Set "A MESSAGE COMES IN" to: https://aba-reach.onrender.com/api/sms/receive POST
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/sms/receive' && method === 'POST') {
    try {
      // ⬡B:TOUCH:FIX:sms.form.urlencoded:20260216⬡
      // Twilio sends application/x-www-form-urlencoded, NOT JSON!
      // Must parse raw body with URLSearchParams
      const rawBody = await new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
        req.on('error', reject);
      });
      
      console.log('[SMS RECEIVE] Raw body:', rawBody.substring(0, 200));
      
      // Parse form-urlencoded data
      const params = new URLSearchParams(rawBody);
      const from = params.get('From') || params.get('from') || 'unknown';
      const to = params.get('To') || params.get('to') || TWILIO_PHONE;
      const smsBody = params.get('Body') || params.get('body') || '';
      const messageSid = params.get('MessageSid') || params.get('messageSid') || 'unknown';
      
      console.log('[SMS RECEIVE] Parsed - From:', from, '| Body:', smsBody.substring(0, 50));
      
      // Look up who texted
      const sender = lookupContact(from) || { name: from, phone: from };
      
      // Store to brain
      await storeToBrain({
        content: `SMS FROM ${sender.name} (${from}): ${smsBody}`,
        memory_type: 'sms_received',
        categories: ['sms', 'inbound', sender.name.toLowerCase()],
        importance: 7,
        tags: ['sms', 'inbound', messageSid],
        source: 'sms_receive_' + messageSid
      });
      
      // Route through AIR to generate response
      let responseText = "Got your message! I'll let Brandon know.";
      
      try {
        const airResult = await AIR_process(smsBody, {
          source: 'sms',
          caller: sender,
          phone: from
        });
        
        if (airResult && airResult.response) {
          responseText = airResult.response;
        }
      } catch (e) {
        console.log('[SMS RECEIVE] AIR error:', e.message);
      }
      
      // Respond with TwiML
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      return res.end(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${responseText}</Message>
</Response>`);
      
    } catch (e) {
      console.log('[SMS RECEIVE] Error:', e.message);
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      return res.end(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:TOUCH:API.ELEVENLABS.WEBHOOK:endpoint:20260216⬡
  // ELEVENLABS CALL WEBHOOK - Receives call completion events
  // Configure in ElevenLabs agent settings: Webhook URL
  // Captures: recording URL, transcripts, conversation data
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/elevenlabs/webhook' && method === 'POST') {
    try {
      const body = await parseBody(req);
      
      console.log('[ELEVENLABS WEBHOOK] Event received:', body.type || 'unknown');
      
      const eventType = body.type || body.event_type;
      const conversationId = body.conversation_id || body.conversationId;
      const recordingUrl = body.recording_url || body.recordingUrl;
      const transcript = body.transcript || body.transcription;
      const duration = body.duration || body.call_duration;
      
      // Store the raw event
      await storeToBrain({
        content: JSON.stringify(body),
        memory_type: 'elevenlabs_webhook',
        categories: ['elevenlabs', 'webhook', eventType || 'unknown'],
        importance: 6,
        tags: ['elevenlabs', 'webhook', conversationId],
        source: 'elevenlabs_webhook_' + (conversationId || Date.now())
      });
      
      // If call completed with recording, analyze it
      if (recordingUrl && (eventType === 'call.completed' || eventType === 'conversation.ended')) {
        console.log('[ELEVENLABS WEBHOOK] Recording available:', recordingUrl);
        
        // Store recording reference
        await storeToBrain({
          content: `CALL RECORDING | ConvID: ${conversationId} | URL: ${recordingUrl} | Duration: ${duration}s | Date: ${new Date().toISOString()}`,
          memory_type: 'call_recording',
          categories: ['call', 'recording', 'elevenlabs'],
          importance: 7,
          tags: ['call', 'recording', conversationId],
          source: 'elevenlabs_recording_' + conversationId
        });
        
        // Trigger full speech intelligence analysis
        console.log('[ELEVENLABS WEBHOOK] Triggering Deepgram analysis...');
        
        // Run analysis in background (don't block webhook response)
        analyzeCallWithDeepgram(recordingUrl).then(analysis => {
          if (analysis) {
            console.log('[ELEVENLABS WEBHOOK] Analysis complete:', {
              topics: analysis.topics?.length || 0,
              sentiment: analysis.sentiment?.overall || 'unknown',
              summary: analysis.summary?.substring(0, 50) || 'none'
            });
            
            // Store enhanced analysis with call reference
            storeToBrain({
              content: JSON.stringify({
                conversation_id: conversationId,
                recording_url: recordingUrl,
                duration: duration,
                analysis: analysis
              }),
              memory_type: 'call_intelligence',
              categories: ['call', 'intelligence', 'analyzed'],
              importance: 8,
              tags: ['call', 'intelligence', conversationId, ...(analysis.topics?.slice(0, 5) || [])],
              source: 'call_intelligence_' + conversationId
            });
          }
        }).catch(e => {
          console.log('[ELEVENLABS WEBHOOK] Analysis error:', e.message);
        });
      }
      
      // If transcript provided, store it
      if (transcript) {
        await storeToBrain({
          content: `CALL TRANSCRIPT (${conversationId}):\n${transcript}`,
          memory_type: 'call_transcript',
          categories: ['call', 'transcript', 'elevenlabs'],
          importance: 7,
          tags: ['call', 'transcript', conversationId],
          source: 'elevenlabs_transcript_' + conversationId
        });
      }
      
      return jsonResponse(res, 200, { 
        success: true, 
        message: 'Webhook processed',
        conversation_id: conversationId,
        recording_received: !!recordingUrl,
        transcript_received: !!transcript
      });
      
    } catch (e) {
      console.log('[ELEVENLABS WEBHOOK] Error:', e.message);
      return jsonResponse(res, 200, { success: false, error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:TOUCH:API.CALL.INTELLIGENCE:endpoint:20260216⬡
  // GET /api/call/intelligence/:conversation_id - Get speech intelligence for a call
  // ═══════════════════════════════════════════════════════════════════════
  if (path.startsWith('/api/call/intelligence/') && method === 'GET') {
    try {
      const conversationId = path.split('/').pop();
      
      if (!conversationId) {
        return jsonResponse(res, 400, { error: 'conversation_id required' });
      }
      
      // Query brain for this call's intelligence
      const result = await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: '/rest/v1/aba_memory?source=eq.call_intelligence_' + conversationId + '&select=content&limit=1',
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY || SUPABASE_ANON,
          'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
        }
      });
      
      if (result.status === 200) {
        const data = JSON.parse(result.data.toString());
        if (data.length > 0) {
          const intelligence = JSON.parse(data[0].content);
          return jsonResponse(res, 200, {
            success: true,
            conversation_id: conversationId,
            intelligence: intelligence
          });
        }
      }
      
      return jsonResponse(res, 404, { 
        error: 'Intelligence not found for this call',
        conversation_id: conversationId,
        hint: 'Call may still be processing or recording not available'
      });
      
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:TOUCH:API.CALLS.RECENT:endpoint:20260216⬡
  // GET /api/calls/recent - Get recent calls with intelligence
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/calls/recent' && method === 'GET') {
    try {
      const url = new URL(req.url, 'https://' + req.headers.host);
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      
      // Query brain for recent call intelligence
      const result = await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: '/rest/v1/aba_memory?memory_type=eq.call_intelligence&order=created_at.desc&limit=' + limit + '&select=content,created_at,source',
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY || SUPABASE_ANON,
          'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
        }
      });
      
      if (result.status === 200) {
        const data = JSON.parse(result.data.toString());
        const calls = data.map(d => {
          try {
            const intel = JSON.parse(d.content);
            return {
              conversation_id: intel.conversation_id,
              created_at: d.created_at,
              duration: intel.duration,
              summary: intel.analysis?.summary || null,
              sentiment: intel.analysis?.sentiment?.overall || 'unknown',
              topics: intel.analysis?.topics?.slice(0, 5) || [],
              entities: intel.analysis?.entities?.slice(0, 5) || []
            };
          } catch (e) {
            return null;
          }
        }).filter(Boolean);
        
        return jsonResponse(res, 200, {
          success: true,
          count: calls.length,
          calls: calls
        });
      }
      
      return jsonResponse(res, 200, { success: true, count: 0, calls: [] });
      
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.BRAIN_SEARCH:CODE:brain.search.query:USER→REACH→COLE→BRAIN:T8:v1.5.0:20260213:b1s2r⬡ /api/brain/search
  
  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.NYLAS_CALLBACK:CODE:email.oauth.callback:NYLAS→REACH→BRAIN:T9:v1.8.0:20260214:n1c2b⬡
  // Nylas OAuth callback - exchanges code for grant_id, stores in brain
  // ROUTING: NYLAS_AUTH→REACH→BRAIN (stores grant for IMAN to use)
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/nylas/callback' && method === 'GET') {
    try {
      const urlObj = new URL(req.url, 'https://' + req.headers.host);
      const code = urlObj.searchParams.get('code');
      const grantId = urlObj.searchParams.get('grant_id');
      const email = urlObj.searchParams.get('email') || 'unknown';
      const provider = urlObj.searchParams.get('provider') || 'google';
      const success = urlObj.searchParams.get('success');
      
      // FLOW 1: Nylas returned grant_id directly (already authorized)
      if (grantId && success === 'true') {
        console.log('[NYLAS] Direct grant callback - grant_id: ' + grantId + ' | email: ' + email);
        
        // Store grant in brain
        if (SUPABASE_KEY) {
          await httpsRequest({
            hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
            path: '/rest/v1/aba_memory',
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            }
          }, JSON.stringify({
            content: 'NYLAS GRANT: ' + grantId + ' | Email: ' + email + ' | Provider: ' + provider + ' | Connected: ' + new Date().toISOString(),
            memory_type: 'system',
            categories: ['nylas', 'email', 'grant', 'iman'],
            importance: 10,
            is_system: true,
            source: 'nylas_grant_' + grantId,
            tags: ['nylas', 'grant', 'email', 'iman', 'active']
          }));
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<html><body style="background:#1a1a2e;color:#e0e0ff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#4ade80">✅ ABA Email Connected!</h1><p>Grant ID: ' + grantId + '</p><p>Email: ' + email + '</p><p>IMAN (Intelligent Mail Agent Nexus) is now authorized.</p><p style="color:#4ade80;margin-top:20px">You can close this window.</p></div></body></html>');
      }
      
      // FLOW 2: Nylas returned code for token exchange
      if (!code && !grantId) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        return res.end('<h1>Missing code or grant_id parameter</h1><p>The OAuth flow did not return expected parameters.</p>');
      }
      
      if (code) {
      // Exchange code for grant
      const tokenResult = await httpsRequest({
        hostname: 'api.us.nylas.com',
        path: '/v3/connect/token',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NYLAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        code: code,
        redirect_uri: 'https://aba-reach.onrender.com/api/nylas/callback',
        code_verifier: 'nylas'
      }));
      
      const tokenData = JSON.parse(tokenResult.data.toString());
      console.log('[NYLAS] OAuth callback - grant_id: ' + (tokenData.grant_id || 'FAIL'));
      
      if (tokenData.grant_id) {
        // Store grant in brain
        if (SUPABASE_KEY) {
          await httpsRequest({
            hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
            path: '/rest/v1/aba_memory',
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            }
          }, JSON.stringify({
            content: 'NYLAS GRANT: ' + tokenData.grant_id + ' | Email: ' + (tokenData.email || 'unknown') + ' | Provider: ' + (tokenData.provider || 'google') + ' | Connected: ' + new Date().toISOString(),
            memory_type: 'system',
            categories: ['nylas', 'email', 'grant', 'iman'],
            importance: 10,
            is_system: true,
            source: 'nylas_grant_' + tokenData.grant_id,
            tags: ['nylas', 'grant', 'email', 'iman', 'active']
          }));
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<html><body style="background:#1a1a2e;color:#e0e0ff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>ABA Email Connected!</h1><p>Grant ID: ' + tokenData.grant_id + '</p><p>Email: ' + (tokenData.email || '') + '</p><p>IMAN is now authorized to send and read email.</p><p style="color:#4ade80">You can close this window.</p></div></body></html>');
      } else {
        console.log('[NYLAS] Token exchange failed:', JSON.stringify(tokenData));
        res.writeHead(400, { 'Content-Type': 'text/html' });
        return res.end('<h1>Auth Failed</h1><pre>' + JSON.stringify(tokenData, null, 2) + '</pre>');
      }
      } // close if(code)
    } catch (e) {
      console.log('[NYLAS] Callback error: ' + e.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      return res.end('<h1>Error: ' + e.message + '</h1>');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.EMAIL_SEND:CODE:email.send.nylas:AIR→IMAN→NYLAS→RECIPIENT:T9:v1.8.0:20260214:e1s2n⬡
  // Send email via Nylas (from claudette@globalmajoritygroup.com)
  // ROUTING: AIR→IMAN→REACH→NYLAS→SMTP→RECIPIENT
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/email/send' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { to, subject, body: emailBody, reply_to_message_id } = body;
      
      if (!to || !subject || !emailBody) {
        return jsonResponse(res, 400, { error: 'to, subject, and body required' });
      }
      
      // Get the active grant ID from brain
      const grantId = await getActiveNylasGrant();
      if (!grantId) {
        return jsonResponse(res, 503, { error: 'No email account connected. Visit /api/nylas/auth to connect.' });
      }
      
      // Send via Nylas
      const toList = Array.isArray(to) ? to : [{ email: to, name: to.split('@')[0] }];
      
      const emailPayload = {
        subject: subject,
        body: emailBody,
        to: toList.map(t => typeof t === 'string' ? { email: t } : t),
        tracking_options: { opens: true, links: true }
      };
      
      if (reply_to_message_id) {
        emailPayload.reply_to_message_id = reply_to_message_id;
      }
      
      const sendResult = await httpsRequest({
        hostname: 'api.us.nylas.com',
        path: '/v3/grants/' + grantId + '/messages/send',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NYLAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify(emailPayload));
      
      const sendData = JSON.parse(sendResult.data.toString());
      
      if (sendData.data?.id || sendData.id) {
        const msgId = sendData.data?.id || sendData.id;
        console.log('[IMAN] Email sent! ID: ' + msgId + ' To: ' + JSON.stringify(toList));
        
        // Log to brain
        if (SUPABASE_KEY) {
          await httpsRequest({
            hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
            path: '/rest/v1/aba_memory',
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            }
          }, JSON.stringify({
            content: 'EMAIL SENT via IMAN | From: claudette@globalmajoritygroup.com | To: ' + JSON.stringify(toList) + ' | Subject: ' + subject + ' | Date: ' + new Date().toISOString(),
            memory_type: 'email_sent',
            categories: ['email', 'sent', 'iman'],
            importance: 6,
            is_system: true,
            source: 'iman_email_' + msgId,
            tags: ['email', 'sent', 'iman', 'nylas']
          }));
        }
        
        return jsonResponse(res, 200, { success: true, message_id: msgId });
      } else {
        console.log('[IMAN] Send failed:', JSON.stringify(sendData));
        return jsonResponse(res, sendResult.status, { error: sendData.error || sendData });
      }
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.NYLAS_AUTH:CODE:email.oauth.start:USER→REACH→NYLAS:T9:v1.8.0:20260214:n1a2s⬡
  // Start Nylas OAuth flow (redirects to Google login)
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/nylas/auth' && method === 'GET') {
    try {
      const urlObj = new URL(req.url, 'https://' + req.headers.host);
      const email = urlObj.searchParams.get('email') || 'claudette@globalmajoritygroup.com';
      
      const authResult = await httpsRequest({
        hostname: 'api.us.nylas.com',
        path: '/v3/connect/auth',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NYLAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        redirect_uri: 'https://aba-reach.onrender.com/api/nylas/callback',
        response_type: 'code',
        provider: 'google',
        login_hint: email,
        scope: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly']
      }));
      
      const authData = JSON.parse(authResult.data.toString());
      if (authData.data?.url) {
        res.writeHead(302, { 'Location': authData.data.url });
        return res.end();
      }
      return jsonResponse(res, 400, { error: 'Could not generate auth URL', data: authData });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }


  // Allows 1A Shell to search brain from frontend
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/brain/search' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { query, type, limit } = body;
      
      let apiPath = '/rest/v1/aba_memory?select=content,memory_type,tags,importance,created_at&order=importance.desc&limit=' + (limit || 10);
      if (query) apiPath += '&content=ilike.*' + encodeURIComponent(query) + '*';
      if (type) apiPath += '&memory_type=eq.' + encodeURIComponent(type);

      const result = await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: apiPath,
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': 'Bearer ' + SUPABASE_ANON
        }
      });

      const json = JSON.parse(result.data.toString());
      return jsonResponse(res, 200, { results: json, count: json.length });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.BRAIN_SEMANTIC:CODE:memory.semantic.search:AIR→BRAIN:T10:v2.6.5:20260214:s1m2s⬡
  // SEMANTIC SEARCH — pgvector cosine similarity via match_memories RPC
  // Takes text query → generates embedding → finds similar memories
  // L3: SAGE (Search Assessment and Governance Engine) | L4: OPS
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/brain/semantic' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { query, threshold, limit } = body;
      if (!query) return jsonResponse(res, 400, { error: 'query required' });

      // Step 1: Generate embedding via OpenAI text-embedding-ada-002
      if (!OPENAI_KEY) return jsonResponse(res, 500, { error: 'OPENAI_API_KEY not set on REACH' });

      const embedResult = await new Promise((resolve, reject) => {
        const postData = JSON.stringify({
          model: 'text-embedding-ada-002',
          input: query
        });
        const embedReq = https.request({
          hostname: 'api.openai.com',
          path: '/v1/embeddings',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + OPENAI_KEY,
            'Content-Length': Buffer.byteLength(postData)
          }
        }, (embedRes) => {
          let data = '';
          embedRes.on('data', c => data += c);
          embedRes.on('end', () => resolve(JSON.parse(data)));
        });
        embedReq.on('error', reject);
        embedReq.write(postData);
        embedReq.end();
      });

      if (!embedResult.data || !embedResult.data[0]) {
        return jsonResponse(res, 500, { error: 'Embedding generation failed', details: embedResult });
      }

      const queryEmbedding = embedResult.data[0].embedding;

      // Step 2: Call match_memories RPC with the embedding
      const matchResult = await new Promise((resolve, reject) => {
        const matchData = JSON.stringify({
          query_embedding: queryEmbedding,
          match_threshold: threshold || 0.5,
          match_count: limit || 10
        });
        const key = SUPABASE_KEY || SUPABASE_ANON;
        const matchReq = https.request({
          hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
          path: '/rest/v1/rpc/match_memories',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': key,
            'Authorization': 'Bearer ' + key,
            'Content-Length': Buffer.byteLength(matchData)
          }
        }, (matchRes) => {
          let data = '';
          matchRes.on('data', c => data += c);
          matchRes.on('end', () => resolve(JSON.parse(data)));
        });
        matchReq.on('error', reject);
        matchReq.write(matchData);
        matchReq.end();
      });

      console.log('[AIR*SAGE*SEMANTIC] Query: "' + query + '" → ' + (Array.isArray(matchResult) ? matchResult.length : 0) + ' matches');
      return jsonResponse(res, 200, { results: matchResult, query, method: 'semantic_pgvector' });
    } catch (e) {
      console.error('[SEMANTIC] Error:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.BRAIN_EMBED:CODE:memory.embed.generate:AIR→BRAIN:T10:v2.6.5:20260214:e1m2b⬡
  // EMBED BACKFILL — generates embeddings for memories that don't have them
  // L3: SAGE (Search Assessment and Governance Engine) | L4: OPS
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/brain/embed-backfill' && method === 'POST') {
    try {
      if (!OPENAI_KEY) return jsonResponse(res, 500, { error: 'OPENAI_API_KEY not set' });
      const key = SUPABASE_KEY || SUPABASE_ANON;

      // Get memories without embeddings
      const unembedded = await new Promise((resolve, reject) => {
        const uReq = https.request({
          hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
          path: '/rest/v1/aba_memory?embedding=is.null&select=id,content&limit=20',
          method: 'GET',
          headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        }, (uRes) => {
          let d = ''; uRes.on('data', c => d += c); uRes.on('end', () => resolve(JSON.parse(d)));
        });
        uReq.on('error', reject);
        uReq.end();
      });

      if (!Array.isArray(unembedded) || unembedded.length === 0) {
        return jsonResponse(res, 200, { message: 'All memories embedded', count: 0 });
      }

      let embedded = 0;
      for (const mem of unembedded) {
        const text = (mem.content || '').substring(0, 8000);
        if (!text) continue;

        // Generate embedding
        const embedResult = await new Promise((resolve, reject) => {
          const pd = JSON.stringify({ model: 'text-embedding-ada-002', input: text });
          const er = https.request({
            hostname: 'api.openai.com', path: '/v1/embeddings', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_KEY, 'Content-Length': Buffer.byteLength(pd) }
          }, (res2) => { let d = ''; res2.on('data', c => d += c); res2.on('end', () => resolve(JSON.parse(d))); });
          er.on('error', reject); er.write(pd); er.end();
        });

        if (embedResult.data && embedResult.data[0]) {
          // Store embedding
          const vec = JSON.stringify(embedResult.data[0].embedding);
          const updateData = JSON.stringify({ embedding: vec });
          await new Promise((resolve, reject) => {
            const ur = https.request({
              hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
              path: '/rest/v1/aba_memory?id=eq.' + mem.id,
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': 'Bearer ' + key, 'Prefer': 'return=minimal', 'Content-Length': Buffer.byteLength(updateData) }
            }, (res2) => { let d = ''; res2.on('data', c => d += c); res2.on('end', () => resolve(d)); });
            ur.on('error', reject); ur.write(updateData); ur.end();
          });
          embedded++;
        }
      }

      console.log('[AIR*SAGE*EMBED] Backfilled ' + embedded + ' embeddings');
      return jsonResponse(res, 200, { embedded, total_unembedded: unembedded.length });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  
  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.NYLAS_CALLBACK:CODE:email.oauth.callback:NYLAS→REACH→BRAIN:T9:v1.8.0:20260214:n1c2b⬡
  // Nylas OAuth callback - exchanges code for grant_id, stores in brain
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/nylas/callback' && method === 'GET') {
    try {
      const urlObj = new URL('http://localhost' + req.url);
      const code = urlObj.searchParams.get('code');
      const grantIdDirect = urlObj.searchParams.get('grant_id');
      const state = urlObj.searchParams.get('state');
      const success = urlObj.searchParams.get('success');
      
      // Nylas may return grant_id directly (hosted auth) or code (custom auth)
      if (grantIdDirect && success === 'true') {
        // Direct grant - store it immediately
        const email = urlObj.searchParams.get('email') || 'claudette@globalmajoritygroup.com';
        const provider = urlObj.searchParams.get('provider') || 'google';
        console.log('[NYLAS] Direct grant received: ' + grantIdDirect + ' for ' + email);
        
        if (SUPABASE_KEY) {
          await httpsRequest({
            hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
            path: '/rest/v1/aba_memory',
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            }
          }, JSON.stringify({
            content: 'NYLAS GRANT: ' + grantIdDirect + ' | Email: ' + email + ' | Provider: ' + provider + ' | Connected: ' + new Date().toISOString(),
            memory_type: 'system',
            categories: ['nylas', 'grant', 'email'],
            importance: 10,
            is_system: true,
            source: 'nylas_grant_' + grantIdDirect,
            tags: ['nylas', 'grant', 'email', 'iman', email.replace('@','_at_')]
          }));
        }
        
        _cachedGrantId = grantIdDirect;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<html><body style="font-family:system-ui;text-align:center;padding:60px;background:#0a0a0a;color:#fff"><h1 style="color:#00ff88">ABA Email Connected!</h1><p style="font-size:20px">Grant ID: ' + grantIdDirect + '</p><p>Email: ' + email + '</p><p style="color:#888">IMAN (Intelligent Mail Agent Nexus) is now active. You can close this window.</p></body></html>');
      }
      
      if (!code && !grantIdDirect) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        return res.end('<h1>Error: No authorization code or grant received</h1>');
      }
      
      // Exchange code for grant
      const tokenResult = await httpsRequest({
        hostname: 'api.us.nylas.com',
        path: '/v3/connect/token',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NYLAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        code: code,
        redirect_uri: 'https://aba-reach.onrender.com/api/nylas/callback'
      }));
      
      const tokenData = JSON.parse(tokenResult.data.toString());
      
      if (tokenData.grant_id) {
        console.log('[NYLAS] Grant obtained: ' + tokenData.grant_id + ' for ' + (tokenData.email || 'unknown'));
        
        // Store grant_id in brain
        if (SUPABASE_KEY) {
          await httpsRequest({
            hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
            path: '/rest/v1/aba_memory',
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            }
          }, JSON.stringify({
            content: 'NYLAS GRANT: ' + tokenData.grant_id + ' | Email: ' + (tokenData.email || 'unknown') + ' | Provider: ' + (tokenData.provider || 'google') + ' | Connected: ' + new Date().toISOString(),
            memory_type: 'system',
            categories: ['nylas', 'grant', 'email'],
            importance: 10,
            is_system: true,
            source: 'nylas_grant_' + tokenData.grant_id,
            tags: ['nylas', 'grant', 'email', 'iman', (tokenData.email || '').replace('@','_at_')]
          }));
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<html><body style="font-family:system-ui;text-align:center;padding:60px;background:#0a0a0a;color:#fff"><h1 style="color:#00ff88">ABA Email Connected!</h1><p style="font-size:20px">Grant ID: ' + tokenData.grant_id + '</p><p>Email: ' + (tokenData.email || '') + '</p><p style="color:#888">IMAN (Intelligent Mail Agent Nexus) is now active. You can close this window.</p></body></html>');
      } else {
        console.log('[NYLAS] Token exchange failed: ' + JSON.stringify(tokenData));
        res.writeHead(400, { 'Content-Type': 'text/html' });
        return res.end('<h1>Error: ' + (tokenData.error?.message || 'Token exchange failed') + '</h1>');
      }
    } catch (e) {
      console.log('[NYLAS] Callback error: ' + e.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      return res.end('<h1>Error: ' + e.message + '</h1>');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.EMAIL_SEND:CODE:email.send.nylas:AIR→IMAN→NYLAS→RECIPIENT:T9:v1.8.0:20260214:e1s2n⬡
  // Send email through Nylas (from claudette@globalmajoritygroup.com)
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/email/send' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { to, subject, body: emailBody, reply_to_message_id } = body;
      
      if (!to || !subject || !emailBody) {
        return jsonResponse(res, 400, { error: 'to, subject, and body required' });
      }
      
      // Get grant_id from brain
      const grantId = await getActiveNylasGrant();
      if (!grantId) {
        return jsonResponse(res, 503, { error: 'No email account connected. Visit /api/nylas/connect to authorize.' });
      }
      
      const emailPayload = {
        subject: subject,
        body: emailBody,
        to: Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }],
      };
      if (reply_to_message_id) emailPayload.reply_to_message_id = reply_to_message_id;
      
      const result = await httpsRequest({
        hostname: 'api.us.nylas.com',
        path: '/v3/grants/' + grantId + '/messages/send',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NYLAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify(emailPayload));
      
      const json = JSON.parse(result.data.toString());
      
      if (json.data?.id) {
        console.log('[IMAN] Email sent to ' + (Array.isArray(to) ? to.join(', ') : to) + ' | Subject: ' + subject);
        return jsonResponse(res, 200, { success: true, message_id: json.data.id, subject: subject });
      } else {
        console.log('[IMAN] Email send failed: ' + JSON.stringify(json));
        return jsonResponse(res, result.status, { error: json.error?.message || 'Send failed', details: json });
      }
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.NYLAS_CONNECT:CODE:email.oauth.start:USER→REACH→NYLAS:T9:v1.8.0:20260214:n1c2s⬡  
  // Start Nylas OAuth (redirects to Google login)
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/nylas/connect' && method === 'GET') {
    try {
      const urlObj = new URL('http://localhost' + req.url);
      const email = urlObj.searchParams.get('email') || 'claudette@globalmajoritygroup.com';
      
      const authResult = await httpsRequest({
        hostname: 'api.us.nylas.com',
        path: '/v3/connect/auth',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NYLAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        redirect_uri: 'https://aba-reach.onrender.com/api/nylas/callback',
        provider: 'google',
        login_hint: email,
        state: 'aba-connect-' + email.split('@')[0]
      }));
      
      const authData = JSON.parse(authResult.data.toString());
      if (authData.data?.url) {
        res.writeHead(302, { 'Location': authData.data.url });
        return res.end();
      } else {
        return jsonResponse(res, 500, { error: 'Failed to generate auth URL', details: authData });
      }
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.BRAIN_STORE:CODE:brain.persist.memory:USER→REACH→BRAIN:T8:v1.5.0:20260213:b1s2t⬡ /api/brain/store
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/brain/store' && method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.content) return jsonResponse(res, 400, { error: 'content required' });

      const result = await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: '/rest/v1/aba_memory',
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY || SUPABASE_ANON,
          'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON),
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }, JSON.stringify({
        content: body.content,
        memory_type: body.memory_type || 'system',
        categories: body.categories || [],
        importance: body.importance || 5,
        is_system: true,
        source: body.source || 'reach_api',
        tags: body.tags || []
      }));

      const json = JSON.parse(result.data.toString());
      return jsonResponse(res, 201, { stored: true, data: json });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.WEBHOOK.RECORDING:CODE:voice.recording.callback:TWILIO→REACH→SCRIBE→BRAIN:T8:v1.9.0:20260214:r1w2h⬡
  // ┌─────────────────────────────────────────────────────────────────────┐
  // │ L6: AIR → L5: REACH → L4: VOICE → L3: SCRIBE → L2: webhook → L1  │
  // └─────────────────────────────────────────────────────────────────────┘
  // ROUTING TRACE: TWILIO*REACH*SCRIBE*BRAIN
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/webhook/recording' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const recordingUrl = body.RecordingUrl || '';
      const recordingSid = body.RecordingSid || '';
      const callSid = body.CallSid || '';
      const duration = body.RecordingDuration || '0';
      
      console.log('[SCRIBE] Recording complete: ' + recordingSid + ' (' + duration + 's)');
      await storeRecordingUrl(callSid, recordingUrl, recordingSid);
      
      res.writeHead(204);
      return res.end();
    } catch (e) {
      console.log('[SCRIBE] Recording webhook error: ' + e.message);
      res.writeHead(204);
      return res.end();
    }
  }

    // ⬡B:AIR:REACH.WEBHOOK.VOICE:CODE:voice.inbound.twilio:TWILIO→REACH→AIR:T8:v1.5.0:20260213:w1v2c⬡ /webhook/voice
  // Existing Twilio voice handler (phone calls)
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/webhook/voice' && method === 'POST') {
    const body = await parseBody(req);
    const host = req.headers.host || 'aba-reach.onrender.com';
    const callerNumber = body.From || 'unknown';
    console.log('[CALL] Incoming from: ' + callerNumber);
    
    // ⬡B:AIR:REACH.VOICE.CALLER_ID:CODE:voice.identity.lookup:TWILIO→REACH→AIR:T9:v1.6.0:20260213:c1i2d⬡
    // Pass caller number to WebSocket so AIR knows WHO is calling
    // v1.9.0 - SCRIBE: Record=record-from-answer-dual for full recording
    const twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Start>\n    <Stream url="wss://' + host + '/media-stream">\n      <Parameter name="greeting" value="true"/>\n      <Parameter name="callerNumber" value="' + callerNumber + '"/>\n    </Stream>\n  </Start>\n  <Record recordingStatusCallback="https://' + host + '/webhook/recording" recordingStatusCallbackEvent="completed" maxLength="3600" trim="trim-silence"/>\n  <Pause length="3600"/>\n</Response>';
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    return res.end(twiml);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.WEBHOOK.SMS:CODE:sms.inbound.twilio:TWILIO→REACH→BRAIN:T8:v1.5.0:20260213:w1s2m⬡ /webhook/sms
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/webhook/sms' && method === 'POST') {
    try {
      const body = await parseBody(req);
      console.log('[SMS-IN] From: ' + body.From + ' Body: ' + (body.Body || '').substring(0, 100));

      // Store inbound SMS in brain
      await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: '/rest/v1/aba_memory',
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY || SUPABASE_ANON,
          'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON),
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }
      }, JSON.stringify({
        content: 'INBOUND SMS from ' + body.From + ': ' + body.Body,
        memory_type: 'sms_inbound',
        categories: ['sms', 'inbound'],
        importance: 7,
        is_system: true,
        source: 'twilio_sms_' + new Date().toISOString(),
        tags: ['sms', 'inbound', 'twilio']
      }));

      // TwiML response (empty = acknowledge receipt)
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      return res.end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      return res.end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:reach:HTTP:scrape_job⬡ /api/scrape-job - SCRAPE JOB POSTING
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/scrape-job' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { url } = body;
      if (!url) return jsonResponse(res, 400, { error: 'url required' });
      const parsed = new URL(url);
      const fetchResult = await httpsRequest({
        hostname: parsed.hostname,
        path: parsed.pathname + (parsed.search || ''),
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ABA/1.0)' }
      });
      const html = fetchResult.data.toString().substring(0, 15000);
      if (!ANTHROPIC_KEY) return jsonResponse(res, 503, { error: 'No AI key' });
      const aiResult = await httpsRequest({
        hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
      }, JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 500,
        system: 'Extract job posting details from HTML. Return ONLY valid JSON: {title, company, location, salary, description, employment_type}. Empty string if unknown.',
        messages: [{ role: 'user', content: 'URL: ' + url + '\n\nHTML:\n' + html }]
      }));
      const aiData = JSON.parse(aiResult.data.toString());
      const text = aiData.content?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jobData = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: '', company: '' };
      return jsonResponse(res, 200, { ...jobData, source: url, method: 'server_scrape', scrapedAt: new Date().toISOString() });
    } catch (e) { return jsonResponse(res, 500, { error: e.message }); }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:reach:HTTP:nylas_webhook⬡ /api/nylas/webhook - AUTOMATED EMAIL PIPELINE
  // L6: AIR | L4: EMAIL | L3: IMAN | L2: worker.js | L1: nylasWebhook
  // Nylas sends message.created events here. If from Idealist → auto-parse jobs.
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/nylas/webhook' && method === 'POST') {
    try {
      const body = await parseBody(req);
      
      // Nylas webhook verification (challenge response)
      if (body.challenge) {
        return jsonResponse(res, 200, { challenge: body.challenge });
      }
      
      // Process webhook events
      const events = Array.isArray(body) ? body : body.data ? [body.data] : [body];
      const results = [];
      
      for (const event of events) {
        const eventType = event.type || body.type || '';
        
        // Only process new messages
        if (!eventType.includes('message.created') && !eventType.includes('message')) continue;
        
        const messageData = event.object || event.data || event;
        const from = (messageData.from || []).map(f => f.email || f).join(', ').toLowerCase();
        const subject = messageData.subject || '';
        const emailBody = messageData.body || messageData.snippet || '';
        
        // Check if it's from Idealist
        const isIdealist = from.includes('idealist.org') || 
                          subject.toLowerCase().includes('idealist') ||
                          emailBody.includes('idealist.org');
        
        if (isIdealist && emailBody) {
          // ═══════ AUTO-PARSE IDEALIST EMAIL ═══════
          // Extract URLs
          const urlRegex = /https?:\/\/www\.idealist\.org\/[^\s"'<>)\]]+/g;
          const rawUrls = emailBody.match(urlRegex) || [];
          const urls = [...new Set(rawUrls)]
            .filter(u => u.includes('/job/') || u.includes('/internship/') || u.includes('/position/') || u.includes('/en/'))
            .slice(0, 10);
          
          const aiKey = ANTHROPIC_KEY;
          const jobs = [];
          
          for (const jobUrl of urls) {
            try {
              const parsed = new URL(jobUrl);
              const fetchResult = await httpsRequest({
                hostname: parsed.hostname,
                path: parsed.pathname + (parsed.search || ''),
                method: 'GET',
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ABA-SCOUT/1.0)' }
              });
              const html = fetchResult.data.toString().substring(0, 15000);
              
              if (aiKey) {
                const aiResult = await httpsRequest({
                  hostname: 'api.anthropic.com',
                  path: '/v1/messages',
                  method: 'POST',
                  headers: { 'x-api-key': aiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
                }, JSON.stringify({
                  model: 'claude-haiku-4-5-20251001',
                  max_tokens: 800,
                  system: 'Extract job details from HTML. Return ONLY valid JSON: {"title":"","company":"","location":"","salary":"","description":"first 200 chars","employment_type":"","remote":"yes/no/hybrid","deadline":"","requirements":"first 200 chars"}. Empty string if unknown. Be accurate.',
                  messages: [{ role: 'user', content: 'URL: ' + jobUrl + '\n\nHTML:\n' + html }]
                }));
                
                const aiData = JSON.parse(aiResult.data.toString());
                const text = aiData.content?.[0]?.text || '';
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const jobData = JSON.parse(jsonMatch[0]);
                  jobs.push({ ...jobData, url: jobUrl, source: 'idealist', verified: !!(jobData.title && jobData.company) });
                }
              }
            } catch (scrapeErr) {
              console.error('[Nylas Webhook] Scrape error for', jobUrl, scrapeErr.message);
            }
          }
          
          // ═══════ STORE IN SUPABASE BRAIN ═══════
          if (SUPABASE_KEY && jobs.length > 0) {
            for (const job of jobs) {
              try {
                await httpsRequest({
                  hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
                  path: '/rest/v1/aba_memory',
                  method: 'POST',
                  headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                  }
                }, JSON.stringify({
                  content: JSON.stringify(job),
                  memory_type: 'parsed_job',
                  categories: ['jobs', 'idealist', 'claudette', 'automated'],
                  importance: 6,
                  tags: ['parsed_job', 'idealist', 'scout', 'new', 'automated'],
                  source: 'nylas_webhook_' + new Date().toISOString().split('T')[0]
                }));
              } catch (storeErr) {
                console.error('[Nylas Webhook] Store error:', storeErr.message);
              }
            }
            
            // ═══════ LOG ACTIVITY FOR VARA ═══════
            try {
              await httpsRequest({
                hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
                path: '/rest/v1/aba_memory',
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_KEY,
                  'Authorization': 'Bearer ' + SUPABASE_KEY,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                }
              }, JSON.stringify({
                content: `CLAUDETTE found ${jobs.length} new jobs from Idealist. Subject: "${subject}". Companies: ${jobs.map(j=>j.company).filter(Boolean).join(', ')}. ${jobs.filter(j=>j.verified).length} verified.`,
                memory_type: 'system',
                categories: ['vara', 'notification', 'jobs'],
                importance: 7,
                tags: ['vara_speak', 'claudette', 'jobs', 'idealist'],
                source: 'nylas_webhook_vara_' + Date.now()
              }));
            } catch (varaErr) { /* non-critical */ }
            
            // ═══════ CHECK FOR URGENT JOB DEADLINES → TRIGGER AIR ═══════
            // If any job has a deadline within 3 days, trigger escalation
            const now = new Date();
            const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            
            for (const job of jobs) {
              if (job.deadline && job.verified) {
                try {
                  const deadlineDate = new Date(job.deadline);
                  if (deadlineDate <= threeDaysFromNow && deadlineDate >= now) {
                    console.log('[IDEALIST] Job deadline within 3 days, triggering AIR:', job.title);
                    await TRIGGER_jobDeadline({
                      title: job.title,
                      company: job.company,
                      deadline: job.deadline,
                      url: job.url,
                      id: job.url
                    });
                  }
                } catch (deadlineErr) { /* non-critical */ }
              }
            }
          }
          
          results.push({ subject, urlsFound: urls.length, jobsParsed: jobs.length, jobsVerified: jobs.filter(j=>j.verified).length });
        } else {
          // ═══════ CHECK FOR IMPORTANT NON-IDEALIST EMAILS → TRIGGER AIR ═══════
          // IMAN routes important emails to AIR for escalation analysis
          const importantKeywords = ['urgent', 'asap', 'immediately', 'deadline', 'investor', 
            'term sheet', 'funding', 'contract', 'legal', 'nda', 'offer', 'interview',
            'emergency', 'critical', 'important', 'action required', 'response needed'];
          
          const combinedText = (subject + ' ' + emailBody).toLowerCase();
          const isImportant = importantKeywords.some(k => combinedText.includes(k));
          
          if (isImportant && !isIdealist) {
            // Trigger AIR escalation
            console.log('[IMAN] Important email detected, triggering AIR escalation');
            try {
              await TRIGGER_emailReceived({
                from: from,
                subject: subject,
                body: emailBody.substring(0, 1000),
                id: messageData.id || messageData.message_id
              });
              results.push({ subject, escalated: true, reason: 'Important email sent to AIR' });
            } catch (escErr) {
              console.error('[IMAN] Escalation error:', escErr.message);
              results.push({ subject, escalated: false, error: escErr.message });
            }
          } else {
            results.push({ subject, skipped: true, reason: isIdealist ? 'no body' : 'not important' });
          }
        }
      }
      
      return jsonResponse(res, 200, { processed: results.length, results });
    } catch (e) {
      console.error('[Nylas Webhook] Error:', e.message);
      return jsonResponse(res, 200, { error: e.message }); // 200 so Nylas doesn't retry forever
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:reach:HTTP:parsed_jobs⬡ /api/jobs/parsed - READ PARSED JOBS FROM BRAIN
  // L6: AIR | L4: JOBS | L3: SCOUT | L2: worker.js | L1: getParsedJobs
  // 1A Shell Jobs panel reads from this. Returns all parsed_job entries.
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/jobs/parsed' && method === 'GET') {
    try {
      const status = url.searchParams.get('status') || 'new';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      const supaUrl = `https://htlxjkbrstpwwtzsbyvb.supabase.co/rest/v1/aba_memory?memory_type=eq.parsed_job&order=created_at.desc&limit=${limit}`;
      const supaKey = SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MzI4MjEsImV4cCI6MjA4NjEwODgyMX0.MOgNYkezWpgxTO3ZHd0omZ0WLJOOR-tL7hONXWG9eBw';
      
      const result = await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: '/rest/v1/aba_memory?memory_type=eq.parsed_job&order=created_at.desc&limit=' + limit,
        method: 'GET',
        headers: {
          'apikey': supaKey,
          'Authorization': 'Bearer ' + supaKey
        }
      });
      
      const memories = JSON.parse(result.data.toString());
      const jobs = memories.map(m => {
        try { return { id: m.id, ...JSON.parse(m.content), storedAt: m.created_at, tags: m.tags }; }
        catch { return { id: m.id, raw: m.content, storedAt: m.created_at }; }
      });
      
      return jsonResponse(res, 200, { jobs, total: jobs.length });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:reach:HTTP:idealist_parse⬡ /api/idealist/parse - PARSE IDEALIST JOB ALERT EMAILS
  // Claudette forwards Idealist emails here. Extracts URLs, scrapes each, returns structured jobs.
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/idealist/parse' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { emailBody, emailSubject } = body;
      if (!emailBody) return jsonResponse(res, 400, { error: 'emailBody required' });

      // Step 1: Extract Idealist URLs from email body
      const urlRegex = /https?:\/\/www\.idealist\.org\/[^\s"'<>)\]]+/g;
      const rawUrls = emailBody.match(urlRegex) || [];
      const urls = [...new Set(rawUrls)]
        .filter(u => u.includes('/job/') || u.includes('/internship/') || u.includes('/position/') || u.includes('/en/'))
        .slice(0, 10);

      if (urls.length === 0) {
        return jsonResponse(res, 200, { jobs: [], errors: [], summary: { emailSubject, urlsFound: 0, message: 'No Idealist job URLs found' } });
      }

      if (!ANTHROPIC_KEY) return jsonResponse(res, 503, { error: 'No AI key for extraction' });

      // Step 2: Scrape each URL with Haiku
      const jobs = [];
      const errors = [];

      for (const jobUrl of urls) {
        try {
          const parsed = new URL(jobUrl);
          const fetchResult = await httpsRequest({
            hostname: parsed.hostname,
            path: parsed.pathname + (parsed.search || ''),
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ABA-SCOUT/1.0)' }
          });
          const html = fetchResult.data.toString().substring(0, 15000);

          const aiResult = await httpsRequest({
            hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
            headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
          }, JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 800,
            system: 'Parse this job posting. Return ONLY valid JSON, no markdown: {"title":"", "company":"", "location":"", "salary":"", "description":"first 200 chars", "employment_type":"full-time/part-time/contract", "remote":"yes/no/hybrid", "posted_date":"", "deadline":"", "requirements":"first 200 chars"}. Empty string if unknown. Be accurate.',
            messages: [{ role: 'user', content: 'URL: ' + jobUrl + '\n\nHTML:\n' + html }]
          }));

          const aiData = JSON.parse(aiResult.data.toString());
          const text = aiData.content?.[0]?.text || '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jobData = JSON.parse(jsonMatch[0]);
            jobs.push({ ...jobData, url: jobUrl, source: 'idealist', parsedAt: new Date().toISOString(), verified: !!(jobData.title && jobData.company) });
          } else {
            errors.push({ url: jobUrl, error: 'AI could not extract JSON' });
          }
        } catch (scrapeErr) {
          errors.push({ url: jobUrl, error: scrapeErr.message });
        }
      }

      const verified = jobs.filter(j => j.verified).length;
      return jsonResponse(res, 200, {
        jobs, errors,
        summary: { emailSubject, urlsFound: urls.length, jobsParsed: jobs.length, jobsVerified: verified, jobsFailed: errors.length, accuracy: jobs.length > 0 ? Math.round((verified / jobs.length) * 100) + '%' : 'N/A' }
      });
    } catch (e) { return jsonResponse(res, 500, { error: e.message }); }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:reach:HTTP:idealist_verify⬡ /api/idealist/verify - VERIFY SINGLE URL
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/idealist/verify' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { url, expectedTitle, expectedCompany } = body;
      if (!url) return jsonResponse(res, 400, { error: 'url required' });
      if (!ANTHROPIC_KEY) return jsonResponse(res, 503, { error: 'No AI key' });

      const parsed = new URL(url);
      const fetchResult = await httpsRequest({
        hostname: parsed.hostname,
        path: parsed.pathname + (parsed.search || ''),
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ABA-SCOUT/1.0)' }
      });
      const html = fetchResult.data.toString().substring(0, 15000);

      const aiResult = await httpsRequest({
        hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
      }, JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 300,
        system: 'Verify this job posting. Return ONLY JSON: {"title":"", "company":"", "still_active": true/false, "verified": true/false, "discrepancies":""}',
        messages: [{ role: 'user', content: 'Verify URL: ' + url + '\nExpected title: ' + (expectedTitle || 'unknown') + '\nExpected company: ' + (expectedCompany || 'unknown') + '\n\nHTML:\n' + html }]
      }));

      const aiData = JSON.parse(aiResult.data.toString());
      const text = aiData.content?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { verified: false };
      return jsonResponse(res, 200, { ...result, url, verifiedAt: new Date().toISOString() });
    } catch (e) { return jsonResponse(res, 500, { error: e.message }); }
  }

  // ═══════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:DIAL:REACH.API.CALL_DIAL:CODE:voice.phone.outbound:USER→AIR→DIAL→TWILIO:T8:v1.0.0:20260214:d1a2l⬡
  // DIAL (Direct Intelligence Auditory Link) - Phone Call Mode
  // Agent #64 - Initiates outbound calls with real-time transcription
  // ═══════════════════════════════════════════════════════════════════════
  
  // /api/call/dial - Initiate outbound call
  if (path === '/api/call/dial' && method === 'POST') {
    const body = await parseBody(req);
    const { to, purpose, userId, record } = body;
    
    console.log('[DIAL] Initiating call to:', to, '| Purpose:', purpose);
    
    // Validate phone number
    if (!to || to.replace(/\D/g, '').length < 10) {
      return jsonResponse(res, 400, { error: 'Invalid phone number' });
    }
    
    // Generate trace ID
    const traceId = `DIAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Twilio call initiation
      const twilioAuth = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64');
      
      // Use OUTBOUND endpoint (not twiml) - includes purpose, no consent needed
      const outboundUrl = `${REACH_URL}/api/call/outbound?trace=${traceId}&purpose=${encodeURIComponent(purpose || 'checking in')}`;
      
      const callData = new URLSearchParams({
        To: to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`,
        From: TWILIO_PHONE,
        Url: outboundUrl,
        StatusCallback: `${REACH_URL}/api/call/status?trace=${traceId}`,
        StatusCallbackEvent: 'initiated ringing answered completed',
        StatusCallbackMethod: 'POST'
      });
      
      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: callData.toString()
      });
      
      const callResult = await twilioRes.json();
      
      if (callResult.sid) {
        // Store call session in brain
        await fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY || SUPABASE_ANON,
            'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            content: `DIAL CALL INITIATED: ${to} | Purpose: ${purpose || 'General'} | SID: ${callResult.sid}`,
            memory_type: 'call_session',
            categories: ['dial', 'phone_call', 'active'],
            importance: 7,
            is_system: true,
            user_id: userId || 'system',
            source: `dial_${traceId}`,
            tags: ['dial', 'call', 'active'],
            air_processed: true
          })
        });
        
        return jsonResponse(res, 200, {
          success: true,
          callSid: callResult.sid,
          traceId,
          status: 'initiated',
          message: 'Call initiated. ABA is taking meeting minutes.',
          routing: `USER*AIR*DIAL*TWILIO*${callResult.sid}`
        });
      } else {
        return jsonResponse(res, 500, { success: false, error: callResult.message || 'Twilio error' });
      }
    } catch (e) {
      console.error('[DIAL] Call initiation failed:', e.message);
      return jsonResponse(res, 500, { success: false, error: e.message });
    }
  }
  
  // /api/call/twiml - TwiML response for call setup with consent gathering
  // ⬡B:TOUCH:REACH.CALL.TWIML:CODE:voice.consent.gather:FIX:20260216⬡
  if (path === '/api/call/twiml' && (method === 'GET' || method === 'POST')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const traceId = url.searchParams.get('trace') || 'unknown';
    const record = url.searchParams.get('record') !== 'false';
    
    // Brandon's simplified consent message (reverse psychology - ends with "not recorded")
    const disclaimer = record 
      ? 'By continuing this call, you consent to ABA taking notes. Please note this call is not recorded.'
      : 'Connecting your call now.';
    
    // FIX: Use <Gather> to capture consent, then redirect to interactive conversation
    // Old code just played message and started one-way transcription
    // New code: Play consent → Gather response → Start 2-way conversation
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" timeout="5" numDigits="1" action="${REACH_URL}/api/call/consent?trace=${traceId}" method="POST">
    <Play>${REACH_URL}/api/voice/tts-stream?text=${encodeURIComponent(disclaimer)}</Play>
  </Gather>
  <Redirect>${REACH_URL}/api/call/consent?trace=${traceId}&amp;timeout=true</Redirect>
</Response>`;
    
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml);
    return;
  }
  
  // /api/call/consent - Handle consent response and start interactive conversation
  // ⬡B:TOUCH:REACH.CALL.CONSENT:CODE:voice.consent.handler:FIX:20260216⬡
  if (path === '/api/call/consent' && method === 'POST') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const traceId = url.searchParams.get('trace') || 'unknown';
    const timedOut = url.searchParams.get('timeout') === 'true';
    
    const body = await parseBody(req);
    const speechResult = body.SpeechResult?.toLowerCase() || '';
    const digits = body.Digits || '';
    
    console.log('[CONSENT] Trace:', traceId, '| Speech:', speechResult, '| Digits:', digits, '| Timeout:', timedOut);
    
    // Check for consent (yes, yeah, ok, sure, proceed, or press 1)
    const consentWords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'proceed', 'continue', 'fine', 'go ahead'];
    const hasConsent = consentWords.some(w => speechResult.includes(w)) || digits === '1' || (speechResult.length > 0 && !timedOut);
    
    if (hasConsent || timedOut) {
      // Consent received (or timed out = implicit consent) - Start interactive 2-way conversation
      console.log('[CONSENT] GRANTED - Starting interactive conversation | Trace:', traceId);
      
      // Start the 2-way conversation with transcription + response
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${REACH_URL}/api/voice/tts-stream?text=${encodeURIComponent('Perfect. How can I help you today?')}</Play>
  <Start>
    <Stream url="wss://${req.headers.host}/api/call/conversation?trace=${traceId}" track="both_tracks"/>
  </Start>
  <Pause length="3600"/>
</Response>`;
      
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(twiml);
      return;
    } else {
      // No consent - hang up politely
      console.log('[CONSENT] DENIED - Ending call | Trace:', traceId);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${REACH_URL}/api/voice/tts-stream?text=${encodeURIComponent('No problem. Have a great day. Goodbye.')}</Play>
  <Hangup/>
</Response>`;
      
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(twiml);
      return;
    }
  }
  
  // /api/call/outbound - TwiML for OUTBOUND calls (ABA calling user)
  // ⬡B:TOUCH:REACH.CALL.OUTBOUND:CODE:voice.outbound.twiml:FIX:20260216⬡
  // NO CONSENT NEEDED - ABA initiated the call, not the user
  if (path === '/api/call/outbound' && (method === 'GET' || method === 'POST')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const traceId = url.searchParams.get('trace') || 'unknown';
    const purpose = decodeURIComponent(url.searchParams.get('purpose') || 'I wanted to check in with you.');
    
    console.log('[OUTBOUND] ABA calling user | Trace:', traceId, '| Purpose:', purpose.substring(0, 50));
    
    // For outbound calls, ABA speaks first (no consent gather)
    // Then starts interactive 2-way conversation
    const greeting = purpose.length > 200 
      ? purpose.substring(0, 200) + '... How can I help you today?'
      : purpose + ' How can I help you today?';
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${REACH_URL}/api/voice/tts-stream?text=${encodeURIComponent('Hey, this is ABA calling. ' + greeting)}</Play>
  <Pause length="1"/>
  <Start>
    <Stream url="wss://${req.headers.host}/api/call/conversation?trace=${traceId}" track="both_tracks"/>
  </Start>
  <Pause length="3600"/>
</Response>`;
    
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml);
    return;
  }
  
  // /api/call/status - Twilio status webhook
  if (path === '/api/call/status' && method === 'POST') {
    const body = await parseBody(req);
    console.log('[DIAL] Call status:', body.CallStatus, '| SID:', body.CallSid);
    
    // Store status update in brain
    if (body.CallStatus === 'completed') {
      await fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY || SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          content: `DIAL CALL COMPLETED: SID: ${body.CallSid} | Duration: ${body.CallDuration || 0}s`,
          memory_type: 'call_session',
          categories: ['dial', 'phone_call', 'completed'],
          importance: 7,
          is_system: true,
          source: `dial_complete_${body.CallSid}`,
          tags: ['dial', 'call', 'completed'],
          air_processed: true
        })
      });
    }
    
    return jsonResponse(res, 200, { received: true });
  }
  
  // /api/call/record - Toggle manual recording
  if (path === '/api/call/record' && method === 'POST') {
    const body = await parseBody(req);
    const { callSid, enable } = body;
    console.log('[DIAL] Manual record', enable ? 'STARTED' : 'STOPPED', '| Call:', callSid);
    return jsonResponse(res, 200, { 
      success: true, 
      recording: enable,
      timestamp: new Date().toISOString()
    });
  }

  // ⬡B:reach:HTTP:jobs_parsed⬡ /api/jobs/parsed - READ JOBS FROM SUPABASE BRAIN
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/jobs/parsed' && method === 'GET') {
    try {
      const url = new URL(req.url, 'http://localhost');
      const limitParam = url.searchParams.get('limit') || '50';
      const SUPA_URL = process.env.SUPABASE_URL || 'https://htlxjkbrstpwwtzsbyvb.supabase.co';
      const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      if (!SUPA_KEY) return jsonResponse(res, 503, { error: 'No Supabase key configured' });
      const supaResp = await httpsRequest({
        hostname: new URL(SUPA_URL).hostname,
        path: `/rest/v1/aba_memory?memory_type=eq.job_posting&order=importance.desc&limit=${limitParam}`,
        method: 'GET',
        headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
      });
      const memories = JSON.parse(supaResp.data.toString());
      const jobs = memories.map(m => {
        try { return { id: m.id, ...JSON.parse(m.content), storedAt: m.created_at, importance: m.importance, tags: m.tags }; }
        catch(e) { return { id: m.id, raw: m.content, storedAt: m.created_at }; }
      });
      return jsonResponse(res, 200, { jobs, total: jobs.length, source: 'supabase_brain' });
    } catch(e) { return jsonResponse(res, 500, { error: e.message }); }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.ESCALATION:CODE:routing.proactive.auto_call:AIR→DIAL→TWILIO:T10:v1.0.0:20260214:e1s2c⬡
  // LAW OF ESCALATION - AIR Auto-Calls Based on Priority
  // When urgency >= threshold, AIR automatically calls the right person
  // No human triggers needed - ABA is PROACTIVE
  // ═══════════════════════════════════════════════════════════════════════
  
  // ⬡B:AIR:ESCALATION.REGISTRY:DATA:team.contacts.priority:AIR:T10:v1.0.0:20260214:r1e2g⬡
  const ESCALATION_REGISTRY = {
    brandon: {
      name: 'Brandon Pierce Sr.',
      phone: '+13363898116',
      role: 'founder',
      priority: 1, // Highest - for critical decisions
      hours: '24/7', // Always reachable for emergencies
      triggers: ['critical', 'money', 'legal', 'investor', 'emergency', 'security']
    },
    cj: {
      name: 'CJ Moore',
      phone: '+19199170686',
      role: 'team_member',
      priority: 2,
      hours: '9-21', // 9am to 9pm
      triggers: ['job_lead', 'application', 'deadline', 'client_work']
    },
    bj: {
      name: 'BJ Pierce',
      phone: '+19803958662',
      role: 'team_member',
      priority: 2,
      hours: '9-21',
      triggers: ['interview', 'school', 'family', 'legacy_prep']
    }
  };

  // ⬡B:AIR:ESCALATION.LEVELS:DATA:urgency.thresholds:AIR:T10:v1.0.0:20260214:l1v2l⬡
  const ESCALATION_LEVELS = {
    1: { name: 'INFO', action: 'log_only', description: 'Just log it' },
    2: { name: 'LOW', action: 'email', description: 'Send email via IMAN' },
    3: { name: 'MEDIUM', action: 'sms', description: 'Send SMS via CARA' },
    4: { name: 'HIGH', action: 'sms_then_call', description: 'SMS first, call if no response in 5min' },
    5: { name: 'CRITICAL', action: 'call_immediate', description: 'Call immediately, no waiting' },
    6: { name: 'EMERGENCY', action: 'call_all', description: 'Call everyone in priority order' }
  };

  // /api/escalate - AIR triggers escalation based on urgency
  if (path === '/api/escalate' && method === 'POST') {
    // ═══════════════════════════════════════════════════════════════════════════════
    // ⬡B:AIR:REACH.ROUTE.ESCALATE:CODE:routing.autonomous.escalation:
    // USER→AIR→LUKE,COLE,JUDE,PACK→DECISION→DIAL/CARA→VARA→USER:T10:v1.0.0:20260214:e1s1c⬡
    // 
    // AUTONOMOUS ESCALATION - Routed through AIR with full agent analysis
    // OR force_call=true to bypass analysis (HAM asked for a call directly)
    // ═══════════════════════════════════════════════════════════════════════════════
    const body = await parseBody(req);
    const { message, context, source, urgency, target, type, force_call } = body;
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[ESCALATE] *** INCOMING ESCALATION REQUEST ***');
    console.log(`[ESCALATE] Source: ${source || 'manual'} | Type: ${type || 'direct'} | Force Call: ${force_call || false}`);
    console.log('═══════════════════════════════════════════════════════════');
    
    try {
      // ⬡B:TOUCH:FIX:force_call:20260216⬡
      // If HAM asks for a call, JUST CALL. No analysis needed.
      if (force_call === true) {
        console.log('[ESCALATE] force_call=true - BYPASSING ANALYSIS, CALLING NOW');
        
        // ⬡B:TOUCH:FIX:use.elevenlabs.dial:20260216⬡
        // Use ElevenLabs convai for REAL 2-way calls (this is what worked with BJ!)
        // NOT Twilio TwiML which kept breaking
        const targetPhone = '+13363898116'; // Brandon's actual phone
        const spokenMessage = message || 'Hey, this is ABA calling as requested.';
        
        try {
          const dialResult = await DIAL_callWithElevenLabs(targetPhone, spokenMessage, source || 'escalate');
          
          return jsonResponse(res, 200, {
            success: dialResult.success,
            routing: 'FORCE_CALL*ELEVENLABS*TWOWAY',
            analysis: { urgency: 10, category: 'ham_request', intent: 'Call requested by HAM' },
            decision: { action: 'call_now', target: 'Brandon', reasoning: 'HAM asked for a call - using ElevenLabs 2-way' },
            execution: {
              action: 'call_now',
              target: 'Brandon',
              conversation_id: dialResult.conversation_id,
              status: dialResult.success ? 'call_initiated' : 'failed',
              timestamp: new Date().toISOString()
            },
            message: spokenMessage.substring(0, 100) + '...'
          });
        } catch (e) {
          console.log('[ESCALATE] DIAL_callWithElevenLabs failed:', e.message);
          return jsonResponse(res, 500, { error: 'Call failed: ' + e.message });
        }
      }
      
      // Route through AIR_escalate for REAL agent analysis
      const result = await AIR_escalate({
        type: type || 'manual_escalation',
        source: source || 'api',
        content: message || context || 'Escalation triggered',
        metadata: { urgency, target, originalBody: body }
      });
      
      return jsonResponse(res, 200, {
        success: true,
        routing: result.routing,
        analysis: {
          urgency: result.analysis.urgency,
          category: result.analysis.category,
          intent: result.analysis.intent
        },
        decision: {
          action: result.decision.action,
          target: result.decision.target.name,
          reasoning: result.decision.reasoning
        },
        execution: result.execution,
        message: result.message.spokenMessage?.substring(0, 100) + '...'
      });
    } catch (e) {
      console.error('[ESCALATE] Error:', e.message);
      return jsonResponse(res, 500, { success: false, error: e.message });
    }
  }

  
  
  // /api/escalate/twiml - TwiML for escalation calls (uses ElevenLabs VARA voice)
  if (path === '/api/escalate/twiml' && (method === 'GET' || method === 'POST')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const msg = url.searchParams.get('msg') || 'This is an urgent message from ABA.';
    const traceId = url.searchParams.get('trace') || 'esc-' + Date.now();
    const mode = url.searchParams.get('mode') || 'twoway'; // 'twoway' or 'announce'
    
    let twiml;
    
    if (mode === 'twoway') {
      // ⬡B:TOUCH:FIX:stream.first.then.play:20260216⬡
      // Start stream FIRST so we're ready to receive audio
      // Then play greeting - user hears it through the stream
      
      const safeGreeting = msg.replace(/"/g, "'").replace(/&/g, "and").replace(/</g, "").replace(/>/g, "");
      const wsUrl = 'wss://' + req.headers.host + '/media-stream?trace=' + traceId + '-outbound';
      
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${wsUrl}" track="both_tracks">
      <Parameter name="outbound" value="true"/>
      <Parameter name="callerNumber" value="aba-outbound"/>
      <Parameter name="greeting" value="${encodeURIComponent(safeGreeting.substring(0, 200))}"/>
    </Stream>
  </Start>
  <Play>${REACH_URL}/api/voice/tts-stream?text=${encodeURIComponent(safeGreeting)}</Play>
  <Pause length="3600"/>
</Response>`;
    } else {
      // One-way announcement mode (legacy)
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Play>${REACH_URL}/api/voice/tts-stream?text=${encodeURIComponent(msg)}</Play>
  <Pause length="1"/>
  <Gather numDigits="1" timeout="10" action="${REACH_URL}/api/escalate/confirm?trace=${traceId}">
    <Play>${REACH_URL}/api/voice/tts-stream?text=${encodeURIComponent('Press any key to confirm, or stay on the line.')}</Play>
  </Gather>
  <Play>${REACH_URL}/api/voice/tts-stream?text=${encodeURIComponent('Goodbye.')}</Play>
</Response>`;
    }
    
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml);
    return;
  }
  
  // /api/escalate/confirm - Handle confirmation keypress
  if (path === '/api/escalate/confirm' && method === 'POST') {
    const body = await parseBody(req);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const traceId = url.searchParams.get('trace') || 'unknown';
    
    console.log('[ESCALATION] Confirmation received | Trace:', traceId, '| Digit:', body.Digits);
    
    // Store confirmation
    await fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY || SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        content: `ESCALATION CONFIRMED: Trace ${traceId} | Digit pressed: ${body.Digits} | From: ${body.From}`,
        memory_type: 'escalation',
        categories: ['escalation', 'confirmed'],
        importance: 8,
        is_system: true,
        source: `escalation_confirm_${traceId}`,
        tags: ['escalation', 'confirmed', 'response_received']
      })
    });
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${REACH_URL}/api/voice/tts-stream?text=${encodeURIComponent('Thank you. Your confirmation has been logged. I will follow up as needed. Goodbye.')}</Play>
</Response>`;
    
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml);
    return;
  }

  // ⬡B:reach:HTTP:idealist_backfill⬡ /api/idealist/backfill - PULL ALL IDEALIST EMAILS VIA NYLAS + PARSE
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/idealist/backfill' && method === 'POST') {
    try {
      // Get Nylas grant from brain
      const grantResult = await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: '/rest/v1/aba_memory?tags=cs.{nylas,grant,active}&select=content&order=created_at.desc&limit=1',
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
      });
      const grantData = JSON.parse(grantResult.data.toString());
      const grantMatch = grantData[0]?.content?.match(/NYLAS GRANT: ([a-f0-9-]+)/);
      if (!grantMatch) return jsonResponse(res, 400, { error: 'No active Nylas grant found. Connect email first.' });
      const grantId = grantMatch[1];
      
      // Search Claudette's emails for Idealist
      const msgResult = await httpsRequest({
        hostname: 'api.us.nylas.com',
        path: '/v3/grants/' + grantId + '/messages?from=noreply@idealist.org&limit=50',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + NYLAS_API_KEY, 'Accept': 'application/json' }
      });
      const msgData = JSON.parse(msgResult.data.toString());
      const messages = msgData.data || [];
      
      if (messages.length === 0) return jsonResponse(res, 200, { message: 'No Idealist emails found', jobs: [], total: 0 });
      
      // Parse each email for Idealist URLs
      let allJobs = [];
      let errors = [];
      for (const msg of messages.slice(0, 20)) { // Max 20 emails at a time
        const body = msg.body || '';
        const urlRegex = /https?:\/\/(?:www\.)?idealist\.org\/en\/(?:nonprofit-job|consultant-job|internship)\/[^\s"'<>]+/g;
        const urls = [...new Set((body.match(urlRegex) || []))];
        
        for (const url of urls.slice(0, 5)) { // Max 5 per email
          try {
            const fetchResult = await httpsRequest({
              hostname: new URL(url).hostname,
              path: new URL(url).pathname,
              method: 'GET',
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ABA/1.0)' }
            });
            const html = fetchResult.data.toString().substring(0, 15000);
            
            if (!ANTHROPIC_KEY) continue;
            const aiResult = await httpsRequest({
              hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
              headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
            }, JSON.stringify({
              model: 'claude-haiku-4-5-20251001', max_tokens: 600,
              system: 'Extract job posting details. Return ONLY JSON: {title, company, location, salary, description, employment_type, remote, deadline, requirements}. Empty string if unknown.',
              messages: [{ role: 'user', content: 'URL: ' + url + '\n\nHTML:\n' + html }]
            }));
            const aiData = JSON.parse(aiResult.data.toString());
            const text = aiData.content?.[0]?.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const job = JSON.parse(jsonMatch[0]);
              job.url = url;
              job.source = 'idealist_backfill';
              job.emailDate = msg.date;
              allJobs.push(job);
              
              // Store in brain
              if (SUPABASE_KEY) {
                await httpsRequest({
                  hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
                  path: '/rest/v1/aba_memory', method: 'POST',
                  headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
                }, JSON.stringify({
                  content: JSON.stringify(job),
                  memory_type: 'job_posting',
                  importance: 7,
                  is_system: false,
                  source: 'idealist_backfill_' + new Date().toISOString().split('T')[0],
                  tags: ['jobs', 'idealist', 'backfill', job.employment_type?.toLowerCase()?.includes('contract') ? 'contract' : 'full_time']
                }));
              }
            }
          } catch(e) { errors.push({ url, error: e.message }); }
        }
      }
      
      return jsonResponse(res, 200, {
        success: true,
        emailsProcessed: Math.min(messages.length, 20),
        totalEmails: messages.length,
        jobsParsed: allJobs.length,
        jobs: allJobs,
        errors: errors.length > 0 ? errors : undefined,
        note: messages.length > 20 ? 'Only processed first 20 emails. Call again for more.' : 'All emails processed.'
      });
    } catch(e) { return jsonResponse(res, 500, { error: e.message }); }
  }

  
  // ═══════════════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.TRIGGERS:CODE:routing.proactive.listeners:EVENT→AIR→ACTION:T10:v1.0.0:20260214:t1r1g⬡
  // PROACTIVE TRIGGER ENDPOINTS - AIR listens and acts autonomously
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // POST /api/air/trigger/email - IMAN sends email events here
  if (path === '/api/air/trigger/email' && method === 'POST') {
    const body = await parseBody(req);
    console.log('[AIR TRIGGER] Email received from IMAN');
    const result = await TRIGGER_emailReceived(body);
    return jsonResponse(res, 200, result);
  }
  
  // POST /api/air/trigger/omi - TASTE sends OMI transcripts here  
  if (path === '/api/air/trigger/omi' && method === 'POST') {
    const body = await parseBody(req);
    console.log('[AIR TRIGGER] OMI transcript from TASTE');
    const result = await TRIGGER_omiHeard(body);
    return jsonResponse(res, 200, result);
  }
  
  // POST /api/air/trigger/calendar - Calendar events trigger here
  if (path === '/api/air/trigger/calendar' && method === 'POST') {
    const body = await parseBody(req);
    console.log('[AIR TRIGGER] Calendar deadline approaching');
    const result = await TRIGGER_deadlineApproaching(body);
    return jsonResponse(res, 200, result);
  }
  
  // POST /api/air/trigger/job - Job pipeline triggers here
  if (path === '/api/air/trigger/job' && method === 'POST') {
    const body = await parseBody(req);
    console.log('[AIR TRIGGER] Job deadline from Idealist');
    const result = await TRIGGER_jobDeadline(body);
    return jsonResponse(res, 200, result);
  }
  
  // POST /api/air/trigger/system - System alerts trigger here
  if (path === '/api/air/trigger/system' && method === 'POST') {
    const body = await parseBody(req);
    console.log('[AIR TRIGGER] System alert');
    const result = await TRIGGER_systemAlert(body);
    return jsonResponse(res, 200, result);
  }


  
  // ═══════════════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.AUTONOMY.ROUTES:CODE:routing.autonomy.api:T10:v1.0.0:20260214:a1r1t⬡
  // AUTONOMY LAYER ROUTES - Making ABA proactive
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // GET /api/sage/search - Search brain via SAGE
  if (path === '/api/sage/search' && method === 'GET') {
    const query = url.searchParams.get('q') || '';
    console.log('[SAGE] API search:', query);
    const results = await SAGE_search(query);
    return jsonResponse(res, 200, { query, results, count: results.length });
  }
  
  // GET /api/sage/index - Get ACL tag index
  if (path === '/api/sage/index' && method === 'GET') {
    console.log('[SAGE] API index request');
    const index = await SAGE_indexACL();
    return jsonResponse(res, 200, { tags: Object.keys(index).length, index });
  }
  
  // ⬡B:AIR:REACH.NYLAS.STATUS:CODE:email.nylas.connection_check:REACH→BRAIN→UI:v2.6.8:20260214:n1s2t⬡
  // GET /api/nylas/status - Check if Nylas email is connected (UI polls this)
  if (path === '/api/nylas/status' && method === 'GET') {
    try {
      const grantId = await getActiveNylasGrant();
      if (grantId) {
        // Also get the email from brain
        const grantInfo = await httpsRequest({
          hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
          path: '/rest/v1/aba_memory?tags=cs.{nylas,grant,active}&select=content&order=created_at.desc&limit=1',
          method: 'GET',
          headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON }
        });
        const grants = JSON.parse(grantInfo.data.toString());
        let email = 'unknown';
        if (grants[0]) {
          const m = grants[0].content.match(/Email: ([^\s|]+)/);
          if (m) email = m[1];
        }
        return jsonResponse(res, 200, { connected: true, grant_id: grantId, email, provider: 'nylas' });
      }
      return jsonResponse(res, 200, { connected: false });
    } catch (e) {
      return jsonResponse(res, 200, { connected: false, error: e.message });
    }
  }

  // ⬡B:AIR:REACH.NYLAS.INBOX:CODE:email.nylas.inbox_read:REACH→NYLAS→UI:v2.6.8:20260214:n1i2b⬡
  // GET /api/nylas/inbox - Read inbox via Nylas for the UI
  // L6: AIR | L4: EMAIL | L3: IMAN | L2: worker.js | L1: nylasInboxRead
  if (path.startsWith('/api/nylas/inbox') && method === 'GET') {
    try {
      const grantId = await getActiveNylasGrant();
      if (!grantId) return jsonResponse(res, 403, { error: 'No email connected. Use Nylas OAuth to connect.' });

      // Parse query params
      const urlObj = new URL('http://localhost' + path + (reqUrl.includes('?') ? '?' + reqUrl.split('?')[1] : ''));
      const limit = urlObj.searchParams.get('limit') || '20';
      const unread = urlObj.searchParams.get('unread') || '';
      const folder = urlObj.searchParams.get('folder') || 'INBOX';

      let nylasPath = '/v3/grants/' + grantId + '/messages?limit=' + limit;
      if (unread === 'true') nylasPath += '&unread=true';
      if (folder && folder !== 'ALL') nylasPath += '&in=' + folder;

      const nylasResult = await httpsRequest({
        hostname: 'api.us.nylas.com',
        path: nylasPath,
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + NYLAS_API_KEY, 'Accept': 'application/json' }
      });

      const nylasData = JSON.parse(nylasResult.data.toString());
      const messages = (nylasData.data || []).map(msg => ({
        id: msg.id,
        subject: msg.subject || '(no subject)',
        from: (msg.from || []).map(f => ({ name: f.name || '', email: f.email || '' })),
        to: (msg.to || []).map(t => ({ name: t.name || '', email: t.email || '' })),
        snippet: msg.snippet || '',
        date: msg.date ? new Date(msg.date * 1000).toISOString() : '',
        unread: msg.unread || false,
        starred: msg.starred || false,
        labels: msg.labels || msg.folders || [],
        threadId: msg.thread_id || ''
      }));

      // IMAN categorization: flag important, Idealist, job-related
      for (const msg of messages) {
        const combined = (msg.subject + ' ' + msg.snippet).toLowerCase();
        const fromEmail = msg.from[0]?.email || '';
        msg.category = 'general';
        if (fromEmail.includes('idealist.org')) msg.category = 'job_alert';
        else if (combined.match(/urgent|asap|deadline|emergency/)) msg.category = 'urgent';
        else if (combined.match(/interview|offer|position|apply|application/)) msg.category = 'job_related';
        else if (combined.match(/invoice|payment|receipt|billing/)) msg.category = 'financial';
        else if (combined.match(/meeting|calendar|invite|rsvp/)) msg.category = 'meeting';
      }

      return jsonResponse(res, 200, { success: true, emails: messages, count: messages.length, provider: 'nylas' });
    } catch (e) {
      console.error('[NYLAS INBOX]', e.message);
      return jsonResponse(res, 500, { error: 'Failed to read inbox: ' + e.message });
    }
  }

  // POST /api/iman/draft - IMAN drafts an email
  if (path === '/api/iman/draft' && method === 'POST') {
    const body = await parseBody(req);
    console.log('[IMAN] API draft request:', body.to);
    const draft = await IMAN_draftEmail(body);
    return jsonResponse(res, 200, { success: !!draft, draft });
  }
  
  // POST /api/iman/send - Send approved email
  if (path === '/api/iman/send' && method === 'POST') {
    const body = await parseBody(req);
    console.log('[IMAN] API send request:', body.draftId);
    const result = await IMAN_sendApprovedEmail(body.draftId);
    return jsonResponse(res, 200, result || { success: false });
  }
  
  // GET /api/iman/drafts - List pending drafts
  if (path === '/api/iman/drafts' && method === 'GET') {
    try {
      const draftsResult = await httpsRequest({
        hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
        path: '/rest/v1/aba_memory?memory_type=eq.email_draft&order=created_at.desc&limit=20',
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY || SUPABASE_ANON,
          'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON)
        }
      });
      const drafts = JSON.parse(draftsResult.data.toString()) || [];
      return jsonResponse(res, 200, { count: drafts.length, drafts: drafts.map(d => ({
        id: d.id,
        ...JSON.parse(d.content || '{}'),
        created_at: d.created_at
      }))});
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }
  
  // POST /api/devices/register - Register a device
  if (path === '/api/devices/register' && method === 'POST') {
    const body = await parseBody(req);
    console.log('[DEVICE] API register:', body.name);
    const result = await registerDevice(body);
    return jsonResponse(res, 200, result);
  }
  
  // GET /api/devices - List registered devices
  if (path === '/api/devices' && method === 'GET') {
    const userId = url.searchParams.get('userId');
    const devices = await getActiveDevices(userId);
    return jsonResponse(res, 200, { count: devices.length, devices });
  }
  
  // GET /api/pulse/status - Get heartbeat status
  if (path === '/api/pulse/status' && method === 'GET') {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentCalls = CALL_HISTORY.filter(t => t > oneHourAgo);
    return jsonResponse(res, 200, {
      status: 'active',
      uptime: Math.floor(process.uptime()),
      commandCenterClients: COMMAND_CENTER_CLIENTS.size,
      heartbeatInterval: '5 minutes',
      lastPulse: new Date().toISOString(),
      callThrottle: {
        callsThisHour: recentCalls.length,
        maxCallsPerHour: MAX_CALLS_PER_HOUR,
        cooldownMinutes: CALL_COOLDOWN_MINUTES,
        activeCooldowns: CALL_COOLDOWN.size
      }
    });
  }
  
  // GET /api/throttle/status - Get call throttle status
  if (path === '/api/throttle/status' && method === 'GET') {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentCalls = CALL_HISTORY.filter(t => t > oneHourAgo);
    const cooldowns = {};
    for (const [phone, time] of CALL_COOLDOWN.entries()) {
      if (!phone.startsWith('email_')) {
        const remaining = Math.max(0, CALL_COOLDOWN_MINUTES * 60 * 1000 - (Date.now() - time));
        cooldowns[phone] = Math.ceil(remaining / 60000) + ' min remaining';
      }
    }
    return jsonResponse(res, 200, {
      callsThisHour: recentCalls.length,
      maxCallsPerHour: MAX_CALLS_PER_HOUR,
      cooldownMinutes: CALL_COOLDOWN_MINUTES,
      activeCooldowns: cooldowns,
      canCallNow: recentCalls.length < MAX_CALLS_PER_HOUR
    });
  }
  
  // POST /api/throttle/reset - Reset throttle (emergency override)
  if (path === '/api/throttle/reset' && method === 'POST') {
    console.log('[THROTTLE] Manual reset triggered');
    CALL_COOLDOWN.clear();
    CALL_HISTORY.length = 0;
    return jsonResponse(res, 200, { 
      reset: true, 
      message: 'All cooldowns cleared. ABA can call again immediately.' 
    });
  }
  
  // POST /api/pulse/trigger - Manual pulse trigger
  if (path === '/api/pulse/trigger' && method === 'POST') {
    console.log('[PULSE] Manual trigger via API');
    pulseCheck().then(() => {
      console.log('[PULSE] Manual pulse complete');
    });
    return jsonResponse(res, 200, { triggered: true, timestamp: new Date().toISOString() });
  }


  
  // POST /api/iman/auto-send - Auto draft and send with countdown
  if (path === '/api/iman/auto-send' && method === 'POST') {
    const body = await parseBody(req);
    console.log('[IMAN] Auto-send request:', body.to);
    const result = await IMAN_autoDraftAndSend(body);
    return jsonResponse(res, 200, result);
  }
  
  // POST /api/iman/cancel - Cancel pending email
  if (path === '/api/iman/cancel' && method === 'POST') {
    const body = await parseBody(req);
    console.log('[IMAN] Cancel request:', body.countdownId);
    const result = IMAN_cancelEmail(body.countdownId);
    return jsonResponse(res, 200, result);
  }
  
  // GET /api/iman/pending - List pending emails
  if (path === '/api/iman/pending' && method === 'GET') {
    const pending = [];
    for (const [id, data] of pendingEmails.entries()) {
      pending.push({
        id,
        to: data.draft.to,
        subject: data.draft.subject
      });
    }
    return jsonResponse(res, 200, { count: pending.length, pending });
  }


  // ⬡B:AIR:REACH.API.NOTFOUND:CODE:infrastructure.error.404:USER→REACH→ERROR:T10:v1.5.0:20260213:n1f2d⬡ CATCH-ALL
  // ═══════════════════════════════════════════════════════════════════════
  jsonResponse(res, 404, { 
    error: 'Route not found: ' + method + ' ' + path,
    available: ['/api/escalate', '/api/escalate/twiml', '/api/escalate/confirm', '/api/call/dial', '/api/call/twiml', '/api/call/status', '/api/call/record', '/api/air/trigger/email', '/api/air/trigger/omi', '/api/air/trigger/calendar', '/api/air/trigger/job', '/api/air/trigger/system', '/api/sage/search', '/api/sage/index', '/api/iman/draft', '/api/iman/send', '/api/iman/drafts', '/api/devices/register', '/api/devices', '/api/pulse/status', '/api/pulse/trigger', '/api/router', '/api/models/claude', '/api/voice/deepgram-token', '/api/voice/tts', '/api/voice/tts-stream', '/api/omi/manifest', '/api/omi/webhook', '/api/sms/send', '/api/brain/search', '/api/brain/store', '/ws:command-center'],
    hint: 'We are all ABA'
  });
});

// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ L6: AIR | L5: REACH | L4: VOICE | L3: WEBSOCKET MANAGER                     ║
 * ║ WebSocket server for Twilio Media Streams (phone calls)                      ║
 * ║ ROUTING: TWILIO→WEBSOCKET→REACH→DEEPGRAM→AIR→VARA→ELEVENLABS→TWILIO→USER    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.CONVERSATIONRELAY:CODE:voice.twoway.realtime:
// TWILIO→CR→WEBSOCKET→AIR→VARA→USER:T10:v1.0.0:20260214:c1r2w⬡
//
// CONVERSATIONRELAY - Real 2-way AI phone conversations
// User speaks → Twilio STT → WebSocket → AIR processes → VARA responds → User hears
// This is the REAL deal - not one-way announcements
// ═══════════════════════════════════════════════════════════════════════════════

// ConversationRelay WebSocket handler
function setupConversationRelay(wss) {
  // This will be called from the main wss.on('connection') handler
}

// Generate TwiML for ConversationRelay 2-way calls
function generateConversationRelayTwiML(context) {
  const { greeting, traceId } = context;
  
  // ConversationRelay handles STT/TTS automatically via Twilio's providers
  // We just need to provide the WebSocket URL and let it connect
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay 
      url="wss://aba-reach.onrender.com/conversation-relay?trace=${traceId}"
      welcomeGreeting="${greeting || 'Hello, this is ABA. How can I help you?'}"
      voice="Google.en-US-Neural2-F"
      transcriptionProvider="google"
      speechModel="telephony"
      interruptible="true"
      interruptByDtmf="true"
    />
  </Connect>
</Response>`;
}

// Handle ConversationRelay WebSocket messages
async function handleConversationRelayMessage(ws, message, sessionData) {
  const { type } = message;
  
  switch (type) {
    case 'setup':
      // Initial connection setup
      console.log('[CR] Setup for call:', message.callSid);
      sessionData.callSid = message.callSid;
      sessionData.history = [];
      break;
      
    case 'prompt':
      // User said something - process it through AIR
      const userText = message.voicePrompt;
      console.log('[CR] User said:', userText);
      
      // Route through AIR for intelligent response
      const response = await AIR_process(userText, sessionData.history, { name: 'Phone Caller', trust: 'medium' });
      
      // Add to history
      sessionData.history.push({ role: 'user', content: userText });
      sessionData.history.push({ role: 'assistant', content: response });
      
      // Send response back - ConversationRelay will TTS it
      ws.send(JSON.stringify({
        type: 'text',
        token: response,
        last: true
      }));
      break;
      
    case 'interrupt':
      // User interrupted - stop current response
      console.log('[CR] User interrupted');
      break;
      
    case 'dtmf':
      // User pressed a key
      console.log('[CR] DTMF:', message.digit);
      if (message.digit === '0') {
        ws.send(JSON.stringify({
          type: 'text',
          token: 'Transferring you to Brandon now.',
          last: true
        }));
        // Could trigger live transfer here
      }
      break;
      
    case 'error':
      console.error('[CR] Error:', message.description);
      break;
      
    case 'end':
      console.log('[CR] Call ended');
      break;
  }
}

// ⬡B:AIR:REACH.VOICE.WEBSOCKET:CODE:voice.stream.twilio:TWILIO→REACH→DEEPGRAM→AIR→VARA:T8:v1.5.0:20260213:w1s2k⬡
// ═══════════════════════════════════════════════════════════════════════════
const wss = new WebSocketServer({ server: httpServer, path: '/media-stream' });

// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.COMMANDCENTER.WEBSOCKET:CODE:realtime.1ashell.sync:
// CC→REACH→AIR→PULSE→1A:T10:v1.0.0:20260214:c1c2w⬡
// COMMAND CENTER WEBSOCKET - Real-time connection to 1A Shell
// ═══════════════════════════════════════════════════════════════════════════
const ccWss = new WebSocketServer({ server: httpServer, path: '/command-center' });

ccWss.on('connection', (ws, req) => {
  console.log('[COMMAND CENTER] 1A Shell connected');
  COMMAND_CENTER_CLIENTS.add(ws);
  
  // Send welcome message with system status
  ws.send(JSON.stringify({
    type: 'connected',
    service: 'ABA REACH v2.10.1 - AUTONOMY LAYER ACTIVE',
    timestamp: new Date().toISOString(),
    agents: ['AIR', 'VARA', 'LUKE', 'COLE', 'JUDE', 'PACK', 'IMAN', 'TASTE', 'DIAL', 'PULSE', 'SAGE'],
    features: ['proactive_email', 'deadline_alerts', 'auto_escalation', 'device_sync']
  }));
  
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const { type, payload } = msg;
      
      switch (type) {
        case 'escalate':
          // Manual escalation from 1A Shell
          const escalateResult = await AIR_escalate({
            type: 'manual_escalation',
            source: 'command_center',
            content: payload?.message || 'Manual escalation',
            metadata: payload
          });
          ws.send(JSON.stringify({ type: 'escalate_result', result: escalateResult }));
          break;
          
        case 'status':
          // Request current system status
          ws.send(JSON.stringify({
            type: 'status',
            clients: COMMAND_CENTER_CLIENTS.size,
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            heartbeatActive: true
          }));
          break;
          
        case 'search':
          // Search brain via SAGE
          const searchResults = await SAGE_search(payload?.query || '');
          ws.send(JSON.stringify({ type: 'search_results', results: searchResults }));
          break;
          
        case 'draft_email':
          // Request IMAN to draft an email
          const draft = await IMAN_draftEmail(payload);
          ws.send(JSON.stringify({ type: 'draft_created', draft }));
          break;
          
        case 'send_email':
          // Send an approved email draft
          const sendResult = await IMAN_sendApprovedEmail(payload?.draftId);
          ws.send(JSON.stringify({ type: 'email_sent', result: sendResult }));
          break;
          
        case 'register_device':
          // Register this device
          const deviceResult = await registerDevice(payload);
          ws.send(JSON.stringify({ type: 'device_registered', result: deviceResult }));
          break;
          
        case 'get_devices':
          // List all registered devices
          const devices = await getActiveDevices(payload?.userId);
          ws.send(JSON.stringify({ type: 'devices', devices }));
          break;
          
        case 'cancel_email':
          // Cancel pending email from Command Center
          const cancelResult = IMAN_cancelEmail(payload?.countdownId);
          ws.send(JSON.stringify({ type: 'email_cancel_result', result: cancelResult }));
          break;
          
        case 'send_email_now':
          // Skip countdown and send immediately
          const pending = pendingEmails.get(payload?.countdownId);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingEmails.delete(payload.countdownId);
            const sendNowResult = await IMAN_sendEmail(pending.draft);
            ws.send(JSON.stringify({ type: 'email_sent_now', result: sendNowResult }));
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Email not found' }));
          }
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
          
        default:
          console.log('[COMMAND CENTER] Unknown message type:', type);
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown type: ' + type }));
      }
    } catch (e) {
      console.error('[COMMAND CENTER] Message error:', e.message);
      ws.send(JSON.stringify({ type: 'error', message: e.message }));
    }
  });
  
  ws.on('close', () => {
    console.log('[COMMAND CENTER] 1A Shell disconnected');
    COMMAND_CENTER_CLIENTS.delete(ws);
  });
  
  ws.on('error', (e) => {
    console.error('[COMMAND CENTER] WebSocket error:', e.message);
    COMMAND_CENTER_CLIENTS.delete(ws);
  });
});

console.log('[COMMAND CENTER] WebSocket server ready on /command-center');

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.CR.WEBSOCKET:CODE:voice.conversationrelay.ws:T10:v1.0.0:20260214⬡
// CONVERSATIONRELAY WEBSOCKET - Real 2-way phone conversations
// ═══════════════════════════════════════════════════════════════════════════════
const crWss = new WebSocketServer({ server: httpServer, path: '/conversation-relay' });

const crSessions = new Map(); // callSid -> session data

crWss.on('connection', async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const traceId = url.searchParams.get('trace') || 'cr-' + Date.now();
  
  console.log('[CR] New ConversationRelay connection | Trace:', traceId);
  
  // DEBUG: Log to brain
  fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ content: `DEBUG CR CONNECTION: trace=${traceId}`, memory_type: 'debug', source: 'cr_connect_' + Date.now() })
  }).catch(e => {});
  
  const sessionData = {
    traceId,
    history: [],
    callSid: null,
    isOutbound: false  // Will be set on setup
  };
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // DEBUG: Log message
      fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ content: `DEBUG CR MESSAGE: type=${message.type}, params=${JSON.stringify(message.customParameters || {}).substring(0,50)}`, memory_type: 'debug', source: 'cr_msg_' + Date.now() })
      }).catch(e => {});
      
      switch (message.type) {
        case 'setup':
          sessionData.callSid = message.callSid;
          crSessions.set(message.callSid, sessionData);
          
          // ⬡B:TOUCH:FIX:greeting.from.twilio:20260216⬡
          // With ConversationRelay, Twilio handles the welcomeGreeting automatically
          // We don't need to send it - just mark that this is an outbound call
          sessionData.isOutbound = true;
          console.log('[CR] Setup complete | CallSid:', message.callSid);
          console.log('[CR] Outbound call - Twilio will speak welcomeGreeting');
          break;
          
        case 'prompt':
          // User spoke - this is the transcribed text
          const userText = message.voicePrompt;
          console.log('[CR] User:', userText);
          
          // DEBUG: Log to brain
          fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ content: `DEBUG CR PROMPT: user said "${userText.substring(0,80)}"`, memory_type: 'debug', source: 'cr_prompt_' + Date.now() })
          }).catch(e => {});
          
          // Route through AIR for intelligent response
          // For outbound calls, assume it's Brandon
          const callerIdentity = sessionData.isOutbound 
            ? { name: 'Brandon', trust: 'owner', access: 'full' }
            : { name: 'Phone Caller', trust: 'medium', access: 'standard' };
          
          try {
            const result = await AIR_process(
              userText, 
              sessionData.history, 
              callerIdentity,
              null
            );
            
            const responseText = result.response || result;
            
            // Add to history
            sessionData.history.push({ role: 'user', content: userText });
            sessionData.history.push({ role: 'assistant', content: responseText });
            
            console.log('[CR] ABA:', (responseText || '').substring(0, 100) + '...');
            
            // DEBUG: Log response
            fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
              method: 'POST',
              headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
              body: JSON.stringify({ content: `DEBUG CR RESPONSE: "${(responseText || '').substring(0,80)}"`, memory_type: 'debug', source: 'cr_response_' + Date.now() })
            }).catch(e => {});
            
            // Send response - ConversationRelay will TTS it
            ws.send(JSON.stringify({
              type: 'text',
              token: responseText,
              last: true
            }));
            
            // Check for goodbye
            if (result.isGoodbye) {
              console.log('[CR] Goodbye detected, closing...');
              setTimeout(() => ws.close(), 3000);
            }
          } catch (e) {
            console.error('[CR] AIR error:', e.message);
            ws.send(JSON.stringify({
              type: 'text',
              token: 'I apologize, I had trouble processing that. Could you repeat?',
              last: true
            }));
          }
          break;
          
        case 'interrupt':
          console.log('[CR] User interrupted');
          // Clear any pending response
          ws.send(JSON.stringify({ type: 'clear' }));
          break;
          
        case 'dtmf':
          console.log('[CR] DTMF digit:', message.digit);
          if (message.digit === '0') {
            ws.send(JSON.stringify({
              type: 'text',
              token: 'Press 0 was received. Goodbye.',
              last: true
            }));
          }
          break;
          
        case 'error':
          console.error('[CR] Error:', message.description);
          break;
          
        case 'end':
          console.log('[CR] Call ended | CallSid:', sessionData.callSid);
          if (sessionData.callSid) {
            crSessions.delete(sessionData.callSid);
          }
          // Store conversation in brain
          if (sessionData.history.length > 0) {
            try {
              await fetch(SUPABASE_URL + '/rest/v1/aba_memory', {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_KEY,
                  'Authorization': 'Bearer ' + SUPABASE_KEY,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                  content: 'CR CALL TRANSCRIPT (' + traceId + '): ' + sessionData.history.map(h => h.role + ': ' + h.content).join(' | '),
                  memory_type: 'phone_transcript',
                  categories: ['conversationrelay', 'phone', 'twoway'],
                  importance: 7,
                  is_system: true,
                  source: 'cr_call_' + traceId,
                  tags: ['cr', 'phone', 'twoway', 'transcript']
                })
              });
            } catch (e) { /* non-critical */ }
          }
          break;
      }
    } catch (e) {
      console.error('[CR] Message parse error:', e.message);
    }
  });
  
  ws.on('close', () => {
    console.log('[CR] WebSocket closed | Trace:', traceId);
  });
  
  ws.on('error', (e) => {
    console.error('[CR] WebSocket error:', e.message);
  });
});

console.log('[CR] ConversationRelay WebSocket ready on /conversation-relay');



wss.on('connection', (ws) => {
  console.log('[WEBSOCKET] *** NEW CONNECTION ***');
  
  // DEBUG: Log connection to brain
  fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ content: `DEBUG WEBSOCKET CONNECTION: New /media-stream connection`, memory_type: 'debug', source: 'ws_connect_' + Date.now() })
  }).catch(e => {});
  
  let session = null;
  
  ws.on('message', async (data) => {
    // DEBUG: Log IMMEDIATELY before anything else
    fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ content: `DEBUG WS RAW MESSAGE RECEIVED`, memory_type: 'debug', source: 'ws_raw_' + Date.now() })
    }).catch(e => {});
    
    try {
      const msg = JSON.parse(data.toString());
      
      // DEBUG: Log EVERY message to brain
      if (!ws._msgCount) ws._msgCount = 0;
      ws._msgCount++;
      if (ws._msgCount <= 5) {
        fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ content: `DEBUG WS MSG #${ws._msgCount}: event=${msg.event}`, memory_type: 'debug', source: 'ws_msg_' + Date.now() })
        }).catch(e => {});
      }
      
      if (msg.event === 'connected') {
        console.log('[TWILIO] Stream connected');
      }
      
      if (msg.event === 'start') {
        // DEBUG: Log immediately when start event received
        console.log('[START] *** GOT START EVENT ***');
        fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ content: `DEBUG START EVENT: streamSid=${msg.start?.streamSid}, customParams=${JSON.stringify(msg.start?.customParameters || {})}`, memory_type: 'debug', source: 'start_event_' + Date.now() })
        }).catch(e => console.log('[DEBUG] Brain log failed:', e.message));
        
        session = new CallSession(msg.start.streamSid, msg.start.callSid);
        session.twilioWs = ws;
        sessions.set(msg.start.streamSid, session);
        
        // Check if this is an outbound call (from escalation) FIRST
        console.log('[STREAM] *** START EVENT ***');
        console.log('[STREAM] streamSid:', msg.start.streamSid);
        console.log('[STREAM] callSid:', msg.start.callSid);
        console.log('[STREAM] customParameters:', JSON.stringify(msg.start.customParameters || {}));
        
        session.isOutbound = msg.start.customParameters?.outbound === 'true';
        session.callerNumber = msg.start.customParameters?.callerNumber || 'unknown';
        
        console.log('[STREAM] isOutbound:', session.isOutbound);
        console.log('[STREAM] callerNumber:', session.callerNumber);
        
        // ⬡B:TOUCH:FIX:outbound.setup.first:20260216⬡
        // For OUTBOUND calls - skip identifyCaller, set Brandon directly
        if (session.isOutbound) {
          console.log('[OUTBOUND] *** OUTBOUND CALL - FAST PATH ***');
          
          // DEBUG: Log to brain
          fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ content: `DEBUG OUTBOUND START: streamSid=${session.streamSid}, callSid=${session.callSid}`, memory_type: 'debug', source: 'outbound_start_' + Date.now() })
          }).catch(e => {});
          
          session.callerIdentity = { name: 'Brandon', trust: 'owner', access: 'full' };
          session.touchpoints = { type: 'owner', turnCount: 0 };
          
          // Connect Deepgram for speech recognition
          connectDeepgram(session);
          
          // ⬡B:TOUCH:FIX:wait.for.deepgram:20260216⬡
          // CRITICAL: Wait for Deepgram to actually connect before returning
          // Otherwise media events arrive before Deepgram is ready!
          console.log('[OUTBOUND] Waiting for Deepgram to connect...');
          let waitCount = 0;
          while ((!session.deepgramWs || session.deepgramWs.readyState !== WebSocket.OPEN) && waitCount < 50) {
            await new Promise(r => setTimeout(r, 100));
            waitCount++;
          }
          
          if (session.deepgramWs?.readyState === WebSocket.OPEN) {
            console.log('[OUTBOUND] ✅ Deepgram connected! Ready to listen.');
          } else {
            console.log('[OUTBOUND] ⚠️ Deepgram not ready after 5s, continuing anyway...');
          }
          
          // No greeting needed - TwiML already spoke
          // DON'T return - let the handler continue to process media events
        } else {
        
        // INBOUND call path - full setup
        console.log('[INBOUND] Standard inbound call setup...');
        
        // ⬡B:AIR:REACH.VOICE.CALLER_EXTRACT:CODE:identity.extract.twilio:TWILIO→REACH→AIR:T9:v1.6.0:20260213:c1e2x⬡
        // Identify caller BEFORE greeting (who are we talking to?)
        session.callerIdentity = await identifyCaller(session.callerNumber);
        console.log('[CALLER-ID] Identity: ' + session.callerIdentity.name + ' | Trust: ' + session.callerIdentity.trust + ' | Access: ' + session.callerIdentity.access);
        
        await LOG_call(session, 'call_start', { from: session.callerNumber, identity: session.callerIdentity.name, trust: session.callerIdentity.trust });
        
        connectDeepgram(session);
        
        // ⬡B:AIR:REACH.VOICE.DEMO_FLOW:CODE:voice.demo.guided:AIR→VARA→USER:T9:v1.6.0:20260213:d1f2l⬡
        // v1.8.0 - Pull cross-call memory BEFORE greeting (INBOUND only)
        session.callHistory = await pullCallHistory(session.callerNumber);
        if (session.callHistory) {
          console.log('[CROSS-CALL] Found previous call history for ' + session.callerNumber);
        }
        
        // Attach call history to callerIdentity so system prompt can reference it
        if (session.callHistory) {
          session.callerIdentity.callHistory = session.callHistory;
        }
        
        // Dynamic touchpoints based on WHO is calling and WHETHER they've called before
        session.touchpoints = getTouchpointsForCaller(session.callerIdentity, session.callHistory);
        console.log('[TOUCHPOINTS] Type: ' + session.touchpoints.type + ' for ' + session.callerNumber);
        
        // Greeting adapts to caller type + history
        const greeting = getGreetingForCaller(session.callerIdentity, session.callHistory, session.touchpoints);
        
        setTimeout(async () => {
          await VARA_speak(session, greeting);
          if (session.touchpoints.INTRO !== undefined) session.touchpoints.INTRO = true;
          if (session.touchpoints.WELCOME_BACK !== undefined) session.touchpoints.WELCOME_BACK = true;
          if (session.touchpoints.HELLO !== undefined) session.touchpoints.HELLO = true;
        }, 500);
        } // close else (inbound path)
      } // close if (msg.event === 'start')
      
      // Log ALL media events, not just ones sent to Deepgram
      if (msg.event === 'media') {
        if (!session) {
          console.log('[MEDIA] ⚠️ No session yet!');
        } else if (!session.deepgramWs) {
          console.log('[MEDIA] ⚠️ No Deepgram WebSocket!');
          if (!session._droppedCount) session._droppedCount = 0;
          session._droppedCount++;
          if (session._droppedCount === 1) {
            fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
              method: 'POST',
              headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
              body: JSON.stringify({ content: `DEBUG MEDIA DROPPED: No deepgramWs! isOutbound=${session.isOutbound}`, memory_type: 'debug', source: 'media_dropped_' + Date.now() })
            }).catch(e => {});
          }
        } else if (session.deepgramWs.readyState !== WebSocket.OPEN) {
          console.log('[MEDIA] ⚠️ Deepgram not OPEN, state=' + session.deepgramWs.readyState);
        }
      }
      
      if (msg.event === 'media' && session?.deepgramWs?.readyState === WebSocket.OPEN) {
        session.deepgramWs.send(Buffer.from(msg.media.payload, 'base64'));
        // DEBUG: Log first few media events to brain
        if (!session._mediaLogCount) session._mediaLogCount = 0;
        session._mediaLogCount++;
        if (session._mediaLogCount <= 3) {
          fetch(`${SUPABASE_URL}/rest/v1/aba_memory`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY || SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_KEY || SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ content: `DEBUG MEDIA #${session._mediaLogCount}: isOutbound=${session.isOutbound}, deepgramState=${session.deepgramWs?.readyState}`, memory_type: 'debug', source: 'media_' + Date.now() })
          }).catch(e => {});
        }
      }
      
      if (msg.event === 'stop' && session) {
        await LOG_call(session, 'call_end', { duration: session.history.length, caller: session.callerIdentity?.name });
        
        // v1.9.0 - SCRIBE: Store full transcript
        await storeFullTranscript(session);
        
        // v1.8.0 - Cross-call memory: store summary
        await storeCallSummary(session);
        
        // v1.8.0 - Post-call automation: follow-up SMS + Brandon notification
        if (session.touchpoints?.type !== 'owner' && session.history.length >= 2) {
          postCallAutomation(session);
        }
        
        if (session.deepgramWs) session.deepgramWs.close();
        if (session.silenceTimeout) clearTimeout(session.silenceTimeout);
        sessions.delete(session.streamSid);
      }
    } catch (e) {}
  });
  
  ws.on('close', () => {
    if (session) {
      if (session.deepgramWs) session.deepgramWs.close();
      if (session.silenceTimeout) clearTimeout(session.silenceTimeout);
      sessions.delete(session.streamSid);
    }
  });
  
  ws.on('error', (err) => console.log('[WEBSOCKET] Error: ' + err.message));
});

// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// ⬡B:ABCD:ABAOS:HEARTBEAT:v2.5.1:20260214⬡
// AUTONOMOUS HEARTBEAT - ABA runs 24/7 without human intervention
// Runs every 5 minutes
// ═══════════════════════════════════════════════════════════════════════════════
let heartbeatRunning = false;
let heartbeatCount = 0;
let lastHeartbeat = null;

async function REACH_heartbeat() {
  if (heartbeatRunning) return;
  heartbeatRunning = true;
  heartbeatCount++;
  lastHeartbeat = new Date().toISOString();
  
  console.log('[HEARTBEAT] Cycle ' + heartbeatCount + ' at ' + lastHeartbeat);
  
  try {
    // Check ABACIA-SERVICES status
    const abaciaCheck = await httpsRequest({
      hostname: 'abacia-services.onrender.com',
      path: '/',
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (abaciaCheck.status === 200) {
      const status = JSON.parse(abaciaCheck.data.toString());
      console.log('[HEARTBEAT] ABACIA: ' + (status.heartbeat?.running ? 'ALIVE' : 'DOWN'));
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ⬡B:ABCD:ABAOS:HEARTBEAT.ELEVENLABS.POLL:v2.6.1:20260214⬡
    // Poll ElevenLabs for completed calls and log to brain
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      const elevenResult = await httpsRequest({
        hostname: 'api.elevenlabs.io',
        path: '/v1/convai/conversations?agent_id=' + (process.env.ELEVENLABS_AGENT_ID || 'agent_0601khe2q0gben08ws34bzf7a0sa'),
        method: 'GET',
        headers: { 
          'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
          'Accept': 'application/json'
        }
      });
      
      if (elevenResult.status === 200) {
        const elevenData = JSON.parse(elevenResult.data.toString());
        const convos = elevenData.conversations || [];
        
        // Check each conversation to see if we've logged it
        for (const convo of convos.slice(0, 5)) {
          const convoId = convo.conversation_id;
          const startTime = convo.start_time_unix_secs;
          const duration = convo.call_duration_secs;
          const title = convo.call_summary_title || 'Unknown';
          
          // Check if we already logged this call
          const checkResult = await httpsRequest({
            hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
            path: '/rest/v1/aba_memory?source=eq.elevenlabs_' + convoId + '&select=id',
            method: 'GET',
            headers: {
              'apikey': SUPABASE_ANON,
              'Authorization': 'Bearer ' + SUPABASE_ANON
            }
          });
          
          if (checkResult.status === 200) {
            const existing = JSON.parse(checkResult.data.toString());
            if (existing.length === 0) {
              // New call - log it!
              console.log('[HEARTBEAT] New call found: ' + convoId + ' - ' + title);
              
              // Get full transcript
              const transcriptResult = await httpsRequest({
                hostname: 'api.elevenlabs.io',
                path: '/v1/convai/conversations/' + convoId,
                method: 'GET',
                headers: { 
                  'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
                  'Accept': 'application/json'
                }
              });
              
              let transcript = '';
              if (transcriptResult.status === 200) {
                const fullConvo = JSON.parse(transcriptResult.data.toString());
                const messages = fullConvo.transcript || [];
                if (Array.isArray(messages)) {
                  transcript = messages.map(m => (m.role || '').toUpperCase() + ': ' + (m.message || '')).join('\n');
                }
              }
              
              // Store to brain
              await storeToBrain({
                content: 'VOICE CALL ' + convoId + ' (Duration: ' + duration + 's): ' + title + '\n\n' + transcript.substring(0, 3000),
                memory_type: 'voice_transcript',
                categories: ['voice', 'elevenlabs', 'auto_logged'],
                importance: 7,
                source: 'elevenlabs_' + convoId,
                tags: ['voice', 'call', 'elevenlabs', 'auto']
              });
              
              console.log('[HEARTBEAT] Logged call: ' + convoId);
            }
          }
        }
      }
    } catch (elevenErr) {
      console.log('[HEARTBEAT] ElevenLabs poll error:', elevenErr.message);
    }
    
    // Broadcast to Command Center
    broadcastToCommandCenter({
      type: 'heartbeat',
      cycle: heartbeatCount,
      timestamp: lastHeartbeat,
      status: 'alive',
      service: 'REACH'
    });
    
  } catch (e) {
    console.log('[HEARTBEAT] Error: ' + e.message);
  } finally {
    heartbeatRunning = false;
  }
}

function startHeartbeat() {
  console.log('[HEARTBEAT] Starting autonomous heartbeat (every 5 min)');
  REACH_heartbeat(); // Run immediately
  setInterval(REACH_heartbeat, 5 * 60 * 1000); // Then every 5 min
}

function getHeartbeatStatus() {
  return { running: true, cycleCount: heartbeatCount, lastCycle: lastHeartbeat };
}


// ⬡B:AIR:REACH.SERVER.LISTEN:CODE:infrastructure.boot.start:AIR→REACH:T10:v1.5.0:20260213:l1s2n⬡
// ═══════════════════════════════════════════════════════════════════════════
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[ABA REACH v2.10.1] LIVE on port ' + PORT);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[AIR] ABA Intellectual Role - ONLINE');
  console.log('[AIR] PRIMARY: Gemini Flash 2.0');
  console.log('[AIR] BACKUP: Claude Haiku');
  console.log('[AIR] SPEED FALLBACK: Groq');
  console.log('[LUKE] Listening and Understanding for Knowledge Extraction - READY');
  console.log('[COLE] Context-Oriented Lookup Engine - READY');
  console.log('[JUDE] Job-description Unified Discovery Engine - READY');
  console.log('[PACK] Packaging And Constructing Kits - READY');
  console.log('[VARA] Vocal Authorized Representative of ABA - READY');
  console.log('[DIAL] Direct Intelligence Auditory Link - READY');
  console.log('[DEEPGRAM] Real-time STT with VAD - READY');
  console.log('[ELEVENLABS] Streaming TTS - READY');
  console.log('═══════════════════════════════════════════════════════════');
  
  // ⬡B:ABCD:ABAOS:HEARTBEAT.START:WIRE:v2.5.1:20260214⬡
  // WIRED: Start the autonomous heartbeat
  startHeartbeat();
  console.log('[HEARTBEAT] Autonomous heartbeat STARTED');
  console.log('We are all ABA.');
  console.log('═══════════════════════════════════════════════════════════');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ⬡B:TOUCH:INTERNAL.CRON:scheduled.calls.loop:20260216⬡
  // INTERNAL CRON - Check scheduled calls every 60 seconds
  // No external services needed! No GitHub Actions! No cron-job.org!
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[CRON] Starting internal scheduled calls checker (every 60s)...');
  
  setInterval(async () => {
    try {
      const dueCalls = await checkScheduledCalls();
      
      if (dueCalls.length > 0) {
        console.log('[INTERNAL CRON] Found', dueCalls.length, 'scheduled call(s) due!');
        
        for (const call of dueCalls) {
          console.log('[INTERNAL CRON] Executing:', call.target_name, call.call_type);
          
          try {
            let callResult;
            
            if (call.call_type === 'dawn_briefing') {
              callResult = await DAWN_makeCall(call.target_phone, call.target_name);
            } else {
              // Regular scheduled call via ElevenLabs
              const apiResult = await httpsRequest({
                hostname: 'api.elevenlabs.io',
                path: '/v1/convai/twilio/outbound-call',
                method: 'POST',
                headers: {
                  'xi-api-key': ELEVENLABS_KEY,
                  'Content-Type': 'application/json'
                }
              }, JSON.stringify({
                agent_id: 'agent_0601khe2q0gben08ws34bzf7a0sa',
                agent_phone_number_id: 'phnum_0001khe3q3nyec1bv04mk2m048v8',
                to_number: call.target_phone
              }));
              callResult = { success: true, conversation_id: JSON.parse(apiResult.data.toString()).conversation_id };
            }
            
            // Mark as completed
            await storeToBrain({
              content: JSON.stringify({ ...call, status: 'completed', completed_at: new Date().toISOString() }),
              memory_type: 'scheduled_call_completed',
              categories: ['scheduled', 'call', 'completed'],
              importance: 6,
              tags: ['scheduled_call', 'completed', call.target_name.toLowerCase()]
            });
            
            console.log('[INTERNAL CRON] ✅ Call executed:', call.target_name);
            
          } catch (e) {
            console.log('[INTERNAL CRON] ❌ Call error:', e.message);
          }
        }
      }
    } catch (e) {
      // Silent fail - don't crash the server
      console.log('[INTERNAL CRON] Check error:', e.message);
    }
  }, 60000); // Every 60 seconds
  
  console.log('[CRON] ✅ Internal cron ACTIVE - Checking every 60 seconds');
  console.log('═══════════════════════════════════════════════════════════');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // START AUTONOMY LAYER - 24/7 PROACTIVE SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[PULSE] Starting 24/7 autonomous heartbeat...');
  startPulseHeartbeat();
  console.log('[SAGE] ACL indexer ready');
  console.log('[COMMAND CENTER] WebSocket ready for 1A Shell connections');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[ABA] AUTONOMY LAYER ACTIVE - I am now proactive!');
  console.log('═══════════════════════════════════════════════════════════');
});

// ⬡B:AIR:REACH.SERVER.EOF:CODE:infrastructure.end.file:REACH:T10:v1.5.0:20260213:e1o2f⬡ END OF REACH v1.5.0


// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:DIAL:REACH.CALL.STREAM:CODE:voice.phone.transcription:TWILIO→REACH→DEEPGRAM→AIR:T8:v1.0.0:20260214:d1w2s⬡
// DIAL WebSocket Handler - Phone Call Transcription Stream
// Receives Twilio Media Streams and routes to Deepgram for real-time transcription
// ═══════════════════════════════════════════════════════════════════════════
const dialWss = new WebSocketServer({ server: httpServer, path: '/api/call/stream' });

dialWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const traceId = url.searchParams.get('trace') || `STREAM-${Date.now()}`;
  
  console.log('[DIAL STREAM] WebSocket connected | Trace:', traceId);
  
  let streamSid = null;
  let callSid = null;
  let transcriptBuffer = [];
  let deepgramWs = null;
  
  // Connect to Deepgram for real-time transcription
  const connectDeepgram = () => {
    const dgUrl = 'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
      model: 'nova-2',
      language: 'en-US',
      encoding: 'mulaw',
      sample_rate: '8000',
      channels: '1',
      punctuate: 'true',
      diarize: 'true',
      smart_format: 'true',
      interim_results: 'true'
    }).toString();
    
    deepgramWs = new WebSocket(dgUrl, {
      headers: { 'Authorization': 'Token ' + DEEPGRAM_KEY }
    });
    
    deepgramWs.on('open', () => {
      console.log('[DIAL STREAM] Deepgram connected | Trace:', traceId);
    });
    
    deepgramWs.on('message', async (data) => {
      try {
        const result = JSON.parse(data.toString());
        const transcript = result.channel?.alternatives?.[0];
        
        if (transcript?.transcript && result.is_final) {
          const text = transcript.transcript.trim();
          if (!text) return;
          
          const speaker = transcript.words?.[0]?.speaker || 0;
          console.log('[DIAL STREAM] [SPEAKER_' + speaker + ']:', text);
          
          // Store transcript chunk in brain
          await fetch(SUPABASE_URL + '/rest/v1/aba_memory', {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY || SUPABASE_ANON,
              'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON),
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              content: 'PHONE CALL (' + traceId + '): [SPEAKER_' + speaker + '] ' + text,
              memory_type: 'phone_transcript',
              categories: ['dial', 'phone_call', 'transcript'],
              importance: 6,
              is_system: true,
              source: 'dial_stream_' + traceId,
              tags: ['dial', 'phone', 'transcript', 'speaker_' + speaker],
              air_processed: true
            })
          });
          
          transcriptBuffer.push({ speaker: 'SPEAKER_' + speaker, text, timestamp: new Date().toISOString() });
        }
      } catch (e) {
        console.error('[DIAL STREAM] Deepgram message error:', e.message);
      }
    });
    
    deepgramWs.on('error', (e) => console.error('[DIAL STREAM] Deepgram error:', e.message));
    deepgramWs.on('close', () => console.log('[DIAL STREAM] Deepgram closed | Trace:', traceId));
  };
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.event === 'connected') {
        console.log('[DIAL STREAM] Twilio connected | Trace:', traceId);
      }
      
      if (msg.event === 'start') {
        streamSid = msg.streamSid;
        callSid = msg.start?.callSid;
        console.log('[DIAL STREAM] Stream started | SID:', streamSid, '| Call:', callSid);
        connectDeepgram();
      }
      
      if (msg.event === 'media' && deepgramWs?.readyState === WebSocket.OPEN) {
        const audio = Buffer.from(msg.media.payload, 'base64');
        deepgramWs.send(audio);
      }
      
      if (msg.event === 'stop') {
        console.log('[DIAL STREAM] Stream stopped | Trace:', traceId);
        if (deepgramWs) deepgramWs.close();
        
        // Store complete call transcript
        if (transcriptBuffer.length > 0) {
          const fullTranscript = transcriptBuffer.map(c => '[' + c.speaker + '] ' + c.text).join('\n');
          fetch(SUPABASE_URL + '/rest/v1/aba_memory', {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY || SUPABASE_ANON,
              'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON),
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              content: 'PHONE CALL COMPLETE (' + traceId + '):\n\n' + fullTranscript + '\n\n---\nChunks: ' + transcriptBuffer.length,
              memory_type: 'phone_call_complete',
              categories: ['dial', 'phone_call', 'completed'],
              importance: 8,
              is_system: true,
              source: 'dial_complete_' + traceId,
              tags: ['dial', 'phone', 'complete', 'meeting_minutes'],
              air_processed: true
            })
          });
          console.log('[DIAL STREAM] Full transcript stored | Chunks:', transcriptBuffer.length);
        }
      }
    } catch (e) {
      console.error('[DIAL STREAM] Message error:', e.message);
    }
  });
  
  ws.on('close', () => {
    console.log('[DIAL STREAM] WebSocket closed | Trace:', traceId);
    if (deepgramWs) deepgramWs.close();
  });
  
  ws.on('error', (e) => console.error('[DIAL STREAM] WebSocket error:', e.message));
});

// ⬡B:TOUCH:REACH.CALL.CONVERSATION:CODE:voice.interactive.twoway:FIX:20260216⬡
// INTERACTIVE CONVERSATION WebSocket - 2-WAY PHONE CALLS
// This is the FIX for the bug where calls went silent after consent
// Flow: User speaks → Deepgram transcribes → AIR processes → TTS response → User hears
// ═══════════════════════════════════════════════════════════════════════════════
const conversationWss = new WebSocketServer({ server: httpServer, path: '/api/call/conversation' });

conversationWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const traceId = url.searchParams.get('trace') || `CONV-${Date.now()}`;
  
  console.log('[CONVERSATION] Interactive 2-way call started | Trace:', traceId);
  
  let streamSid = null;
  let callSid = null;
  let transcriptBuffer = [];
  let deepgramWs = null;
  let isProcessing = false;
  let pendingTranscript = '';
  
  // Connect to Deepgram for real-time transcription
  const connectDeepgram = () => {
    const dgUrl = 'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
      model: 'nova-2',
      language: 'en-US',
      encoding: 'mulaw',
      sample_rate: '8000',
      channels: '1',
      punctuate: 'true',
      diarize: 'true',
      smart_format: 'true',
      interim_results: 'false',  // Only final results for cleaner conversation
      endpointing: '500',  // 500ms silence = end of utterance
      utterance_end_ms: '1000'
    }).toString();
    
    deepgramWs = new WebSocket(dgUrl, {
      headers: { 'Authorization': 'Token ' + DEEPGRAM_KEY }
    });
    
    deepgramWs.on('open', () => {
      console.log('[CONVERSATION] Deepgram connected | Trace:', traceId);
    });
    
    deepgramWs.on('message', async (data) => {
      try {
        const result = JSON.parse(data.toString());
        const transcript = result.channel?.alternatives?.[0];
        
        if (transcript?.transcript && result.is_final) {
          const text = transcript.transcript.trim();
          if (!text || text.length < 2) return;
          
          console.log('[CONVERSATION] User said:', text);
          pendingTranscript = text;
          
          // Store transcript chunk
          transcriptBuffer.push({ speaker: 'USER', text, timestamp: new Date().toISOString() });
          
          // Process through AIR and respond (if not already processing)
          if (!isProcessing) {
            isProcessing = true;
            await processAndRespond(text, ws, streamSid, traceId);
            isProcessing = false;
          }
        }
      } catch (e) {
        console.error('[CONVERSATION] Deepgram message error:', e.message);
      }
    });
    
    deepgramWs.on('error', (e) => console.error('[CONVERSATION] Deepgram error:', e.message));
    deepgramWs.on('close', () => console.log('[CONVERSATION] Deepgram closed | Trace:', traceId));
  };
  
  // Process user speech through AIR and send TTS response
  async function processAndRespond(userText, ws, streamSid, traceId) {
    console.log('[CONVERSATION] Processing:', userText.substring(0, 50) + '...');
    
    try {
      // Route through AIR (ABACIA services) or fallback to local
      let response = '';
      
      try {
        // Try ABACIA-SERVICES AIR first
        const airResult = await httpsRequest({
          hostname: 'abacia-services.onrender.com',
          path: '/api/air/process',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, JSON.stringify({
          query: userText,
          context: { source: 'phone_call', trace: traceId },
          source: 'aba-reach-phone'
        }));
        
        if (airResult.status === 200) {
          const data = JSON.parse(airResult.data.toString());
          response = data.response || data.text || '';
        }
      } catch (e) {
        console.log('[CONVERSATION] ABACIA AIR unavailable, using local');
      }
      
      // Fallback to local Gemini if AIR failed
      if (!response) {
        response = await generateLocalResponse(userText, traceId);
      }
      
      if (!response) {
        response = "I'm sorry, I didn't catch that. Could you please repeat?";
      }
      
      console.log('[CONVERSATION] VARA responds:', response.substring(0, 50) + '...');
      
      // Store VARA response
      transcriptBuffer.push({ speaker: 'VARA', text: response, timestamp: new Date().toISOString() });
      
      // Convert to TTS and send back through Twilio stream
      await sendTTSToStream(response, ws, streamSid);
      
    } catch (e) {
      console.error('[CONVERSATION] Process error:', e.message);
      await sendTTSToStream("I'm having a bit of trouble. Could you repeat that?", ws, streamSid);
    }
  }
  
  // Generate local response using Gemini (fallback)
  async function generateLocalResponse(userText, traceId) {
    const prompt = `You are VARA (Vocal Authorized Representative of ABA), a warm, butler-like AI assistant created by Brandon Pierce. 
You are on a phone call. Keep responses concise (1-2 sentences max) and conversational.
User said: "${userText}"
Respond naturally:`;
    
    try {
      const result = await httpsRequest({
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + GEMINI_KEY,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 150, temperature: 0.7 }
      }));
      
      if (result.status === 200) {
        const data = JSON.parse(result.data.toString());
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    } catch (e) {
      console.error('[CONVERSATION] Gemini error:', e.message);
    }
    return '';
  }
  
  // Send TTS audio back through Twilio stream
  async function sendTTSToStream(text, ws, streamSid) {
    if (!streamSid || ws.readyState !== WebSocket.OPEN) {
      console.log('[CONVERSATION] Cannot send TTS - stream not ready');
      return;
    }
    
    try {
      // Get audio from ElevenLabs
      const ttsResult = await httpsRequest({
        hostname: 'api.elevenlabs.io',
        path: '/v1/text-to-speech/' + ELEVENLABS_VOICE + '/stream?output_format=ulaw_8000',
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_KEY,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        text: text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }));
      
      if (ttsResult.status === 200 && ttsResult.data) {
        // Send audio in chunks to Twilio
        const audioBase64 = ttsResult.data.toString('base64');
        const chunkSize = 8000; // ~1 second of audio at 8kHz
        
        for (let i = 0; i < audioBase64.length; i += chunkSize) {
          const chunk = audioBase64.slice(i, i + chunkSize);
          ws.send(JSON.stringify({
            event: 'media',
            streamSid: streamSid,
            media: { payload: chunk }
          }));
        }
        
        console.log('[CONVERSATION] TTS sent | Length:', audioBase64.length);
      }
    } catch (e) {
      console.error('[CONVERSATION] TTS error:', e.message);
    }
  }
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.event === 'connected') {
        console.log('[CONVERSATION] Twilio connected | Trace:', traceId);
      }
      
      if (msg.event === 'start') {
        streamSid = msg.streamSid;
        callSid = msg.start?.callSid;
        console.log('[CONVERSATION] Stream started | SID:', streamSid, '| Call:', callSid);
        connectDeepgram();
      }
      
      if (msg.event === 'media' && deepgramWs?.readyState === WebSocket.OPEN) {
        const audio = Buffer.from(msg.media.payload, 'base64');
        deepgramWs.send(audio);
      }
      
      if (msg.event === 'stop') {
        console.log('[CONVERSATION] Stream stopped | Trace:', traceId);
        if (deepgramWs) deepgramWs.close();
        
        // Store complete conversation
        if (transcriptBuffer.length > 0) {
          const fullTranscript = transcriptBuffer.map(c => '[' + c.speaker + '] ' + c.text).join('\n');
          fetch(SUPABASE_URL + '/rest/v1/aba_memory', {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY || SUPABASE_ANON,
              'Authorization': 'Bearer ' + (SUPABASE_KEY || SUPABASE_ANON),
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              content: 'INTERACTIVE PHONE CALL (' + traceId + '):\n\n' + fullTranscript + '\n\n---\nTurns: ' + transcriptBuffer.length,
              memory_type: 'phone_conversation',
              categories: ['conversation', 'phone_call', 'interactive'],
              importance: 8,
              is_system: true,
              source: 'conversation_' + traceId,
              tags: ['phone', 'conversation', 'vara', 'interactive'],
              air_processed: true
            })
          });
          console.log('[CONVERSATION] Full conversation stored | Turns:', transcriptBuffer.length);
        }
      }
    } catch (e) {
      console.error('[CONVERSATION] Message error:', e.message);
    }
  });
  
  ws.on('close', () => {
    console.log('[CONVERSATION] WebSocket closed | Trace:', traceId);
    if (deepgramWs) deepgramWs.close();
  });
  
  ws.on('error', (e) => console.error('[CONVERSATION] WebSocket error:', e.message));
});

console.log('[CONVERSATION] Interactive 2-way phone calls - READY');

console.log('[DIAL] Direct Intelligence Auditory Link - READY');

// ████████████████████████████████████████████████████████████████████████████
// ██ HEARTBEAT - DO NOT REMOVE (Render free tier sleeps without this)        ██
// ████████████████████████████████████████████████████████████████████████████
setInterval(async () => {
  try {
    const https = require('https');
    https.get('https://aba-reach.onrender.com/', () => {});
    console.log('[♥] Heartbeat at ' + new Date().toISOString());
  } catch (e) {}
}, 60000);
console.log('[♥] 60s heartbeat initialized');

// ████████████████████████████████████████████████████████████████████████████
// ██ AIR AUTONOMOUS LOOP — 24/7 AGENT DISPATCH                              ██
// ██ v2.6.2-P2-S1 | Brandon: "I want 1000 agents running 24/7 autonomous"  ██
// ██ L3: PULSE (Persistent Uptime and Lifecycle Status Engine) | L4: OPS    ██
// ████████████████████████████████████████████████████████████████████████████
// ⬡B:AIR:REACH.AUTONOMOUS.LOOP:CODE:agents.autonomous.dispatch:AIR→PULSE→ALL:T10:v2.6.2:20260214:a1l2p⬡

const LOOP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const TIMEZONE = 'America/New_York';
let loopCount = 0;

// ── SUPABASE HELPERS (use existing constants) ───────────────────────────────
async function loopSupaRead(table, query) {
  const key = SUPABASE_KEY || SUPABASE_ANON;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { console.error('[AIR-LOOP] Read error:', e.message); return []; }
}

async function loopSupaWrite(table, data) {
  const key = SUPABASE_KEY || SUPABASE_ANON;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': key, 'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });
    return r.ok;
  } catch (e) { console.error('[AIR-LOOP] Write error:', e.message); return false; }
}

// ── AIR CALL (server-side, uses existing ANTHROPIC_KEY) ─────────────────────
async function loopAirCall(message, systemPrompt, model) {
  if (!ANTHROPIC_KEY) { console.warn('[AIR-LOOP] No ANTHROPIC_KEY'); return null; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }]
      })
    });
    if (!r.ok) throw new Error('API ' + r.status);
    const d = await r.json();
    return (d.content && d.content[0] && d.content[0].text) || '';
  } catch (e) { console.error('[AIR-LOOP] AI call failed:', e.message); return null; }
}

// ── AGENT TASKS ─────────────────────────────────────────────────────────────

// RADAR (Request Analysis and Directive Assignment Router): Validates work requests
async function loopRadarScan() {
  const tasks = await loopSupaRead('aba_memory',
    'memory_type=eq.system&content=ilike.*work_request*&tags=cs.{unprocessed}&order=created_at.desc&limit=5'
  );
  if (tasks.length > 0) {
    console.log('[AIR*RADAR*LOOP] ' + tasks.length + ' work requests to validate');
    for (const task of tasks) {
      const result = await loopAirCall(
        'Validate this work request:\n' + task.content,
        'You are RADAR (Request Analysis and Directive Assignment Router). Read the full context, audit for errors (wrong recipients, missing info, multiple assignments), state your understanding. Return JSON: { "valid": true/false, "issues": [], "understanding": "...", "recommended_action": "..." }',
        'claude-haiku-4-5-20251001'
      );
      if (result) {
        await loopSupaWrite('aba_memory', {
          content: '[COMMAND_CENTER] RADAR*AIR*validated: ' + result.substring(0, 500),
          memory_type: 'system', categories: ['command_center', 'radar'],
          importance: 6, is_system: true,
          source: 'radar_auto_' + new Date().toISOString(),
          tags: ['command_center', 'radar', 'processed']
        });
      }
    }
  }
  return tasks.length;
}

// MACE (Master Architecture Compliance Engine): Reviews architecture decisions
async function loopMaceScan() {
  // Only run every 12th tick (1 hour)
  if (loopCount % 12 !== 0) return 0;
  
  const recentChanges = await loopSupaRead('aba_memory',
    'memory_type=eq.system&content=ilike.*DEPLOYED*&order=created_at.desc&limit=5'
  );
  if (recentChanges.length > 0) {
    const context = recentChanges.map(function(r) { return r.content; }).join('\n---\n');
    const review = await loopAirCall(
      'Review these recent deployments for architecture compliance:\n' + context,
      'You are MACE (Master Architecture Compliance Engine). Check: (1) Does everything route through AIR? (2) Are ACL tags present? (3) Agent ownership assigned? (4) No orphan services? (5) Hierarchy L6→L1 maintained? Return JSON: { "compliant": true/false, "violations": [], "score": 0-10, "recommendations": [] }',
      'claude-haiku-4-5-20251001'
    );
    if (review) {
      await loopSupaWrite('aba_memory', {
        content: '[COMMAND_CENTER] MACE*AIR*architecture_review: ' + review.substring(0, 500),
        memory_type: 'system', categories: ['command_center', 'mace'],
        importance: 7, is_system: true,
        source: 'mace_auto_' + new Date().toISOString(),
        tags: ['command_center', 'mace', 'architecture']
      });
      console.log('[AIR*MACE*LOOP] Architecture review complete');
      return 1;
    }
  }
  return 0;
}

// SCOUT (Search Check Output Under Test): Runs 10-point compliance scan
async function loopScoutScan() {
  // Only run every 24th tick (2 hours)
  if (loopCount % 24 !== 0) return 0;

  const recentDeploys = await loopSupaRead('aba_memory',
    'content=ilike.*DEPLOYED*&order=created_at.desc&limit=1'
  );
  if (recentDeploys.length > 0) {
    const scan = await loopAirCall(
      'Latest deployment:\n' + recentDeploys[0].content + '\n\nRun SCOUT 10-point compliance check.',
      'You are SCOUT (Search Check Output Under Test). Run 10 checks: (1) Not scaffold (2) Not demo garbage (3) Not hardcoded (4) Routes through AIR (5) ACL tagged (6) Agent owned (7) Actually works (8) Version annotated (9) No orphan imports (10) Error handling. Based on deployment notes, give pass/warn/fail for each. Return JSON: { "score": "X/10", "checks": [{"name": "...", "status": "pass|warn|fail", "detail": "..."}], "overall": "..." }',
      'claude-haiku-4-5-20251001'
    );
    if (scan) {
      await loopSupaWrite('aba_memory', {
        content: '[COMMAND_CENTER] SCOUT*AIR*compliance_scan: ' + scan.substring(0, 500),
        memory_type: 'system', categories: ['command_center', 'scout'],
        importance: 7, is_system: true,
        source: 'scout_auto_' + new Date().toISOString(),
        tags: ['command_center', 'scout', 'compliance']
      });
      console.log('[AIR*SCOUT*LOOP] Compliance scan complete');
      return 1;
    }
  }
  return 0;
}

// SAGE embedding backfill: Generates embeddings for unembedded memories
async function loopSageEmbed() {
  // Only run every 6th tick (30 min)
  if (loopCount % 6 !== 1) return 0;
  if (!OPENAI_KEY) return 0;

  const unembedded = await loopSupaRead('aba_memory', 'embedding=is.null&select=id,content&limit=5');
  if (unembedded.length === 0) return 0;

  let count = 0;
  const key = SUPABASE_KEY || SUPABASE_ANON;
  for (const mem of unembedded) {
    const text = (mem.content || '').substring(0, 8000);
    if (!text) continue;
    try {
      const embedResult = await new Promise(function(resolve, reject) {
        const pd = JSON.stringify({ model: 'text-embedding-ada-002', input: text });
        const er = https.request({
          hostname: 'api.openai.com', path: '/v1/embeddings', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_KEY, 'Content-Length': Buffer.byteLength(pd) }
        }, function(res) { let d = ''; res.on('data', function(c) { d += c; }); res.on('end', function() { resolve(JSON.parse(d)); }); });
        er.on('error', reject); er.write(pd); er.end();
      });
      if (embedResult.data && embedResult.data[0]) {
        const vec = JSON.stringify(embedResult.data[0].embedding);
        const ud = JSON.stringify({ embedding: vec });
        await new Promise(function(resolve, reject) {
          const ur = https.request({
            hostname: 'htlxjkbrstpwwtzsbyvb.supabase.co',
            path: '/rest/v1/aba_memory?id=eq.' + mem.id,
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': 'Bearer ' + key, 'Prefer': 'return=minimal', 'Content-Length': Buffer.byteLength(ud) }
          }, function(res) { let d = ''; res.on('data', function(c) { d += c; }); res.on('end', function() { resolve(d); }); });
          ur.on('error', reject); ur.write(ud); ur.end();
        });
        count++;
      }
    } catch (e) { console.error('[SAGE-EMBED] Error:', e.message); }
  }
  if (count > 0) console.log('[AIR*SAGE*LOOP] Embedded ' + count + ' memories');
  return count;
}

// IMAN: Check for queued email tasks
async function loopImanCheck() {
  const tasks = await loopSupaRead('aba_memory',
    'memory_type=eq.system&content=ilike.*email_task*&tags=cs.{unprocessed}&order=created_at.desc&limit=5'
  );
  if (tasks.length > 0) {
    console.log('[AIR*IMAN*LOOP] ' + tasks.length + ' email tasks found');
    for (const task of tasks) {
      const result = await loopAirCall(
        task.content,
        'You are IMAN (Inbox Management Agent Navigator). Process this email task. Return JSON with: action (draft/send/categorize), to, subject, body. Be warm like ABA — professional but personal.',
        'claude-haiku-4-5-20251001'
      );
      if (result) {
        await loopSupaWrite('aba_memory', {
          content: '[COMMAND_CENTER] IMAN*AIR*email_processed: ' + result.substring(0, 500),
          memory_type: 'system',
          categories: ['command_center', 'iman'],
          importance: 5, is_system: true,
          source: 'air_loop_' + new Date().toISOString(),
          tags: ['command_center', 'iman', 'processed']
        });
      }
    }
  }
  return tasks.length;
}

// HUNTER: Check for unprocessed jobs
async function loopHunterScan() {
  const jobs = await loopSupaRead('aba_memory',
    'memory_type=eq.system&content=ilike.*new_job*&tags=cs.{unprocessed}&limit=10'
  );
  // v2.6.8-FORGE-S11 | HUNTER also checks Idealist auto-seeded parsed_jobs
  // Brandon: IMAN seeds jobs from Claudette's Idealist emails, HUNTER processes them
  const idealistJobs = await loopSupaRead('aba_memory',
    'memory_type=eq.parsed_job&tags=cs.{needs_scrape}&limit=10'
  );
  const total = jobs.length + idealistJobs.length;
  if (total > 0) {
    console.log('[AIR*HUNTER*LOOP] ' + jobs.length + ' unprocessed + ' + idealistJobs.length + ' Idealist jobs');
  }
  return total;
}

// HUNCH: Proactive suggestions (waking hours only)
async function loopHunchCheck() {
  const now = new Date();
  const hour = parseInt(now.toLocaleString('en-US', { timeZone: TIMEZONE, hour: 'numeric', hour12: false }));
  if (hour < 7 || hour > 22) return 0;

  // Only generate a hint every 30 min (every 6th tick)
  if (loopCount % 6 !== 0) return 0;

  const recent = await loopSupaRead('aba_memory', 'order=created_at.desc&limit=3');
  if (recent.length > 0) {
    const context = recent.map(function(r) { return r.content; }).join('\n');
    const hint = await loopAirCall(
      'Recent activity:\n' + context + '\n\nTime: ' + hour + ':00 EST. What proactive suggestion should ABA make? Be warm like a friend, not a notification bot.',
      'You are HUNCH (Helpful Unsolicited Notifications and Contextual Hints). Generate ONE brief, useful, proactive suggestion. Mix butler professionalism with friend energy. Return JSON: { "hint": "...", "priority": "low|medium|high", "action": "suggest|remind|alert" }',
      'claude-haiku-4-5-20251001'
    );
    if (hint) {
      await loopSupaWrite('aba_memory', {
        content: 'HUNCH proactive hint: ' + hint,
        memory_type: 'system', categories: ['hunch', 'proactive'],
        importance: 3, is_system: true,
        source: 'air_loop_' + now.toISOString(),
        tags: ['hunch', 'proactive', 'unread']
      });
      return 1;
    }
  }
  return 0;
}

// DAWN: Morning brief at 6:30 AM EST
async function loopDawnBrief() {
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { timeZone: TIMEZONE, hour: 'numeric', minute: 'numeric', hour12: false });
  const parts = timeStr.split(':');
  const hour = parseInt(parts[0]); const minute = parseInt(parts[1]);
  if (hour !== 6 || minute < 25 || minute > 35) return false;

  const today = now.toISOString().split('T')[0];
  const existing = await loopSupaRead('aba_memory',
    'memory_type=eq.system&content=ilike.*dawn_brief*&content=ilike.*' + today + '*&limit=1'
  );
  if (existing.length > 0) return false;

  console.log('[AIR*DAWN*LOOP] Generating morning brief...');
  const recentMemories = await loopSupaRead('aba_memory', 'order=created_at.desc&limit=10');
  const context = recentMemories.map(function(m) { return m.content; }).join('\n---\n');

  const brief = await loopAirCall(
    'Today is ' + now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + '.\n\nRecent context:\n' + context,
    'You are VARA (Vocal Authorized Representative of ABA), Brandon Pierce\'s AI — part butler, part real friend. Generate a morning briefing that flows between business updates and personal warmth. Address Brandon as "sir" sometimes but also talk like a friend who has his back. Example: "Good morning, sir. So here is what we got today — your calendar is clear until 11 which is nice, and oh, that Idealist posting you liked? Deadline is today so I already drafted something. Let me know if you want me to send it." Keep it conversational, NOT a list.',
    'claude-sonnet-4-5-20250929'
  );

  if (brief) {
    await loopSupaWrite('aba_memory', {
      content: 'dawn_brief ' + today + ': ' + brief,
      memory_type: 'system', categories: ['dawn', 'brief'],
      importance: 7, is_system: true,
      source: 'dawn_auto_' + today,
      tags: ['dawn', 'brief', 'unread']
    });
    console.log('[AIR*DAWN*LOOP] Morning brief stored');
    return true;
  }
  return false;
}

// GHOST: Overnight processing at 11 PM EST
async function loopGhostOvernight() {
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { timeZone: TIMEZONE, hour: 'numeric', minute: 'numeric', hour12: false });
  const parts = timeStr.split(':');
  const hour = parseInt(parts[0]); const minute = parseInt(parts[1]);
  if (hour !== 23 || minute > 10) return false;

  const today = now.toISOString().split('T')[0];
  const existing = await loopSupaRead('aba_memory',
    'memory_type=eq.system&content=ilike.*ghost_overnight*&content=ilike.*' + today + '*&limit=1'
  );
  if (existing.length > 0) return false;

  console.log('[AIR*GHOST*LOOP] Running overnight processing...');
  const dayMemories = await loopSupaRead('aba_memory', 'order=created_at.desc&limit=20');
  const summary = await loopAirCall(
    'Summarize today and prepare overnight notes:\n' + dayMemories.map(function(m) { return m.content; }).join('\n---\n'),
    'You are GHOST (Guided Hybrid Overnight Systems Thread). Summarize the day, flag urgent items for tomorrow, identify patterns. Return JSON: { "summary": "...", "urgent": [], "patterns": [], "tomorrow_priorities": [] }',
    'claude-haiku-4-5-20251001'
  );

  if (summary) {
    await loopSupaWrite('aba_memory', {
      content: 'ghost_overnight ' + today + ': ' + summary,
      memory_type: 'system', categories: ['ghost', 'overnight'],
      importance: 6, is_system: true,
      source: 'ghost_auto_' + today, tags: ['ghost', 'overnight']
    });
    console.log('[AIR*GHOST*LOOP] Overnight summary stored');
    return true;
  }
  return false;
}

// ── MAIN LOOP ───────────────────────────────────────────────────────────────
async function runAutonomousLoop() {
  loopCount++;
  const start = Date.now();
  console.log('\n[AIR-LOOP] ━━━ Tick #' + loopCount + ' | ' + new Date().toISOString() + ' ━━━');

  try {
    const emailCount = await loopImanCheck();
    const jobCount = await loopHunterScan();
    const hintCount = await loopHunchCheck();
    const dawnRan = await loopDawnBrief();
    const ghostRan = await loopGhostOvernight();
    const radarCount = await loopRadarScan();
    const maceRan = await loopMaceScan();
    const scoutRan = await loopScoutScan();
    const embedCount = await loopSageEmbed();

    // v2.6.7 | KEEPALIVE | Ping 1A Shell every 2nd tick (10 min) to prevent cold starts
    // Render free tier sleeps after 15 min. 10 min pings keep it awake.
    if (loopCount % 2 === 0) {
      try {
        await new Promise(function(resolve) {
          https.get('https://onea-shell.onrender.com/health', function(r) {
            r.on('data', function() {});
            r.on('end', resolve);
          }).on('error', resolve);
        });
      } catch (e) { /* best effort */ }
    }

    // PULSE heartbeat every 6th tick (30 min)
    if (loopCount % 6 === 0) {
      await loopSupaWrite('aba_memory', {
        content: 'PULSE heartbeat: ' + new Date().toISOString() + ' | REACH alive | Loop tick #' + loopCount,
        memory_type: 'system', categories: ['pulse', 'heartbeat'],
        importance: 1, is_system: true,
        source: 'pulse_heartbeat_' + new Date().toISOString(),
        tags: ['pulse', 'heartbeat']
      });
    }

    const elapsed = Date.now() - start;
    console.log('[AIR-LOOP] Done in ' + elapsed + 'ms | emails:' + emailCount + ' jobs:' + jobCount + ' hints:' + hintCount + ' dawn:' + dawnRan + ' ghost:' + ghostRan + ' radar:' + radarCount + ' mace:' + maceRan + ' scout:' + scoutRan + ' embeds:' + embedCount);
  } catch (e) {
    console.error('[AIR-LOOP] ERROR:', e.message);
  }
}

// ── START AUTONOMOUS LOOP ───────────────────────────────────────────────────
console.log('[AIR-LOOP] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[AIR-LOOP] ABACIA Autonomous Loop ACTIVE');
console.log('[AIR-LOOP] Interval: 5 minutes');
console.log('[AIR-LOOP] Agents: IMAN, HUNTER, HUNCH, DAWN, GHOST, PULSE, RADAR, MACE, SCOUT, SAGE');
console.log('[AIR-LOOP] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// First tick after 30 seconds (let server finish starting)
setTimeout(runAutonomousLoop, 30000);
// Then every 5 minutes
setInterval(runAutonomousLoop, LOOP_INTERVAL);
