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
 * VERSION: v1.5.0-REACH-CHARLIE
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
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MzI4MjEsImV4cCI6MjA4NjEwODgyMX0.MOgNYkezWpgxTO3ZHd0omZ0WLJOOR-tL7hONXWG9eBw';

// ⬡B:AIR:REACH.CONFIG.TWILIO:CONFIG:voice.phone.outreach:AIR→REACH→VARA,CARA:T8:v1.5.0:20260213:t2w3l⬡
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

// ⬡B:AIR:REACH.CONFIG.ELEVENLABS:CONFIG:voice.tts.personality:AIR→REACH→VARA:T8:v1.5.0:20260213:e1l2v⬡
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE = process.env.ELEVENLABS_VOICE_ID || 'hAQCIV0cazWEuGzMG5bV';
const ELEVENLABS_MODEL = 'eleven_flash_v2_5';

// ⬡B:AIR:REACH.CONFIG.DEEPGRAM:CONFIG:voice.stt.transcription:AIR→REACH→TASTE:T8:v1.5.0:20260213:d1g2m⬡
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;

// ⬡B:AIR:REACH.CONFIG.GEMINI:CONFIG:models.primary.flash:AIR→REACH→MODEL:T8:v1.5.0:20260213:g1m2n⬡
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// ⬡B:AIR:REACH.CONFIG.ANTHROPIC:CONFIG:models.backup.haiku:AIR→REACH→MODEL:T8:v1.5.0:20260213:a1n2t⬡
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// ⬡B:AIR:REACH.CONFIG.GROQ:CONFIG:models.fallback.speed:AIR→REACH→MODEL:T7:v1.5.0:20260213:g1r2q⬡
const GROQ_KEY = process.env.GROQ_API_KEY;

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
console.log('[ABA REACH v1.6.0] FULL HIERARCHY + SIGILS + API ROUTES');
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
function PACK_assemble(analysis, coleResult, judeResult, history, callerIdentity) {
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
    systemPrompt: buildSystemPrompt(analysis, coleResult, judeResult, callerIdentity)
  };
  
  console.log('[PACK] Mission package ready: ' + missionNumber);
  
  return missionPackage;
}

function buildSystemPrompt(analysis, coleResult, judeResult, callerIdentity) {
  // ⬡B:AIR:REACH.VOICE.PROMPT:CODE:intelligence.prompt.caller_aware:AIR→PACK→MODEL:T9:v1.6.0:20260213:p1c2a⬡
  let prompt = `You are VARA (Vocal Authorized Representative of ABA), an AI assistant created by Brandon Pierce.
You are warm, helpful, butler-like with personality. Never robotic or punchy.
This is a LIVE PHONE CALL - keep responses SHORT (1-2 sentences max).
Be conversational, natural, like talking to a friend.`;

  // CALLER IDENTITY - changes what ABA can say and do
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
async function AIR_process(userSaid, history, callerIdentity) {
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
  
  // ⬡B:AIR:REACH.ORCHESTRATOR.SUMMON_JUDE:CODE:routing.agent.discovery:AIR→JUDE→BRAIN→AIR:T10:v1.5.0:20260213:s1j2d⬡
  const judeResult = await JUDE_findAgents(lukeAnalysis);
  
  // ⬡B:AIR:REACH.ORCHESTRATOR.SUMMON_PACK:CODE:routing.agent.assembly:AIR→PACK→AIR:T10:v1.5.0:20260213:s1p2k⬡
  const missionPackage = PACK_assemble(lukeAnalysis, coleResult, judeResult, history, callerIdentity);
  
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
const CONTACT_REGISTRY = {
  // ADD BRANDON'S REAL NUMBER HERE: '+13361234567': { name: 'Brandon', ... }
  // ADD BJ, CJ, ERIC numbers when Brandon provides them
};

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
    this.callerIdentity = null; // { name, role, trust, access, greeting, promptAddon }
  }
}

const sessions = new Map();

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
    utterance_end_ms: '1000'
  }).toString();
  
  const ws = new WebSocket(dgUrl, {
    headers: { 'Authorization': 'Token ' + DEEPGRAM_KEY }
  });
  
  ws.on('open', () => console.log('[DEEPGRAM] Connected'));
  
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
          console.log('[DEEPGRAM] FINAL: "' + transcript + '"');
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
  
  ws.on('error', (err) => console.log('[DEEPGRAM] Error: ' + err.message));
  ws.on('close', () => console.log('[DEEPGRAM] Disconnected'));
  
  session.deepgramWs = ws;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.VOICE.PROCESS:CODE:voice.pipeline.full:USER→DEEPGRAM→AIR→VARA→ELEVENLABS→USER:T8:v1.5.0:20260213:p1r2u⬡
// ═══════════════════════════════════════════════════════════════════════════
async function processUtterance(session, text) {
  const result = await AIR_process(text, session.history, session.callerIdentity);
  
  await LOG_call(session, 'utterance', { user: text, response: result.response, mission: result.missionNumber });
  
  if (result.isGoodbye) {
    await VARA_speak(session, result.response);
    setTimeout(() => {
      if (session.twilioWs?.readyState === WebSocket.OPEN) {
        session.twilioWs.close();
      }
    }, 3000);
    return;
  }
  
  session.history.push({ role: 'user', content: text });
  session.history.push({ role: 'assistant', content: result.response });
  
  await VARA_speak(session, result.response);
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
  const missionPackage = PACK_assemble(lukeAnalysis, coleResult, judeResult, history || [], null);

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
      service: 'ABA REACH v1.6.0',
      mode: 'FULL API + VOICE + OMI',
      air: 'ABA Intellectual Role - CENTRAL ORCHESTRATOR',
      models: { primary: 'Gemini Flash 2.0', backup: 'Claude Haiku', speed_fallback: 'Groq' },
      agents: { hardcoded: ['LUKE', 'COLE', 'JUDE', 'PACK'], voice: 'VARA' },
      voice: 'ElevenLabs ' + ELEVENLABS_VOICE,
      phone: TWILIO_PHONE,
      api_routes: ['/api/router', '/api/models/claude', '/api/voice/deepgram-token', '/api/omi/manifest', '/api/omi/webhook', '/api/sms/send'],
      message: 'We are all ABA'
    });
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
        system: system || 'You are ABA (A Better AI), a warm, professional AI assistant.',
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
  // ⬡B:AIR:REACH.API.OMI_MANIFEST:CODE:senses.omi.registration:OMI→REACH→OMI:T7:v1.5.0:20260213:o1m2m⬡ /api/omi/manifest
  // Returns the manifest JSON so OMI recognizes ABA as an app
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/omi/manifest' || path === '/api/omi/manifest.json') {
    return jsonResponse(res, 200, {
      id: OMI_APP_ID,
      name: 'ABA Intelligence Layer',
      description: 'ABA (A Better AI) processes ambient conversations through TASTE (Transcript Analysis and Semantic Tagging Engine) and stores insights in the ABA Brain.',
      author: 'Brandon Pierce / Global Majority Group',
      version: '1.6.0',
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

      const transcript = body.transcript || body.text || body.segments?.map(s => s.text).join(' ') || JSON.stringify(body);
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
      return jsonResponse(res, 200, { status: 'processed', agent: 'TASTE', stored: true });
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
  // ⬡B:AIR:REACH.API.BRAIN_SEARCH:CODE:brain.search.query:USER→REACH→COLE→BRAIN:T8:v1.5.0:20260213:b1s2r⬡ /api/brain/search
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
    const twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Connect>\n    <Stream url="wss://' + host + '/media-stream">\n      <Parameter name="greeting" value="true"/>\n      <Parameter name="callerNumber" value="' + callerNumber + '"/>\n    </Stream>\n  </Connect>\n</Response>';
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
  // ⬡B:AIR:REACH.API.NOTFOUND:CODE:infrastructure.error.404:USER→REACH→ERROR:T10:v1.5.0:20260213:n1f2d⬡ CATCH-ALL
  // ═══════════════════════════════════════════════════════════════════════
  jsonResponse(res, 404, { 
    error: 'Route not found: ' + method + ' ' + path,
    available: ['/api/router', '/api/models/claude', '/api/voice/deepgram-token', '/api/voice/tts', '/api/omi/manifest', '/api/omi/webhook', '/api/sms/send', '/api/brain/search', '/api/brain/store'],
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
// ⬡B:AIR:REACH.VOICE.WEBSOCKET:CODE:voice.stream.twilio:TWILIO→REACH→DEEPGRAM→AIR→VARA:T8:v1.5.0:20260213:w1s2k⬡
// ═══════════════════════════════════════════════════════════════════════════
const wss = new WebSocketServer({ server: httpServer, path: '/media-stream' });

wss.on('connection', (ws) => {
  console.log('[WEBSOCKET] New connection');
  let session = null;
  
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.event === 'connected') {
        console.log('[TWILIO] Stream connected');
      }
      
      if (msg.event === 'start') {
        session = new CallSession(msg.start.streamSid, msg.start.callSid);
        session.twilioWs = ws;
        sessions.set(msg.start.streamSid, session);
        
        // ⬡B:AIR:REACH.VOICE.CALLER_EXTRACT:CODE:identity.extract.twilio:TWILIO→REACH→AIR:T9:v1.6.0:20260213:c1e2x⬡
        // Extract caller number from Twilio stream parameters
        session.callerNumber = msg.start.customParameters?.callerNumber || 'unknown';
        console.log('[CALL] Caller: ' + session.callerNumber);
        
        // Identify caller BEFORE greeting (who are we talking to?)
        session.callerIdentity = await identifyCaller(session.callerNumber);
        console.log('[CALLER-ID] Identity: ' + session.callerIdentity.name + ' | Trust: ' + session.callerIdentity.trust + ' | Access: ' + session.callerIdentity.access);
        
        await LOG_call(session, 'call_start', { from: session.callerNumber, identity: session.callerIdentity.name, trust: session.callerIdentity.trust });
        
        connectDeepgram(session);
        
        // Personalized greeting based on WHO is calling
        setTimeout(async () => {
          await VARA_speak(session, session.callerIdentity.greeting);
        }, 500);
      }
      
      if (msg.event === 'media' && session?.deepgramWs?.readyState === WebSocket.OPEN) {
        session.deepgramWs.send(Buffer.from(msg.media.payload, 'base64'));
      }
      
      if (msg.event === 'stop' && session) {
        await LOG_call(session, 'call_end', { duration: session.history.length });
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
// ⬡B:AIR:REACH.SERVER.LISTEN:CODE:infrastructure.boot.start:AIR→REACH:T10:v1.5.0:20260213:l1s2n⬡
// ═══════════════════════════════════════════════════════════════════════════
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[ABA REACH v1.6.0] LIVE on port ' + PORT);
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
  console.log('[DEEPGRAM] Real-time STT with VAD - READY');
  console.log('[ELEVENLABS] Streaming TTS - READY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('We are all ABA.');
  console.log('═══════════════════════════════════════════════════════════');
});

// ⬡B:AIR:REACH.SERVER.EOF:CODE:infrastructure.end.file:REACH:T10:v1.5.0:20260213:e1o2f⬡ END OF REACH v1.5.0
