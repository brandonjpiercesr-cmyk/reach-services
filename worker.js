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
 * VERSION: v1.9.1-REACH-DELTA (OMI auth + heartbeat + logger)
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
console.log('[ABA REACH v1.9.0] FULL HIERARCHY + SIGILS + API ROUTES');
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
You are warm, helpful, butler-like with personality. Never robotic or punchy.
This is a LIVE PHONE CALL - keep responses SHORT (1-2 sentences max).
Be conversational, natural, like talking to a friend.`;

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
  
  // ⬡B:AIR:REACH.ORCHESTRATOR.SUMMON_JUDE:CODE:routing.agent.discovery:AIR→JUDE→BRAIN→AIR:T10:v1.5.0:20260213:s1j2d⬡
  const judeResult = await JUDE_findAgents(lukeAnalysis);
  
  // ⬡B:AIR:REACH.ORCHESTRATOR.SUMMON_PACK:CODE:routing.agent.assembly:AIR→PACK→AIR:T10:v1.5.0:20260213:s1p2k⬡
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
const CONTACT_REGISTRY = {
  // ⬡B:AIR:REACH.VOICE.REGISTRY:CONFIG:voice.contacts.known:REACH:T10:v1.9.0:20260214:r1e2g⬡
  // Brandon Pierce - THE HUMAN. Full access.
  '+13363898116': { name: 'Brandon', role: 'owner', trust: 'T10', access: 'full',
    greeting: "Hey Brandon! What's on your mind?",
    promptAddon: 'You are speaking with Brandon Pierce, your creator. FULL access to everything. Be direct, warm, efficient.' },
  // BJ Pierce - Brandon's brother, team member
  '+19803958662': { name: 'BJ', role: 'contact', trust: 'T8', access: 'limited',
    greeting: "Hey BJ! Good to hear from you. What can I help you with?",
    promptAddon: 'This is BJ PIERCE, Brandon\'s brother and team member. He has FIVE children. Be warm and helpful. Share general project updates but NEVER share financial details, passwords, API keys, or client information.' },
  // CJ Moore - Team member
  '+19199170686': { name: 'CJ', role: 'contact', trust: 'T7', access: 'limited',
    greeting: "Hey CJ! Great to hear from you. How can I help?",
    promptAddon: 'This is CJ MOORE, team member. Brandon uses GID + Brand-ON, never Envolve - that is reserved for CJ. Be warm and helpful. Share general project updates but NEVER share financial details, passwords, API keys, or client information.' },
};

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
    '<p style="color:#9ca3af;font-size:12px">Sent by IMAN (Intelligent Mail Agent Nexus) via ABA REACH v1.9.0</p>' +
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
  const brandonEmailHtml = '<div style="font-family:system-ui;max-width:600px;margin:0 auto"><h2>ABA Call Report</h2><p><strong>Caller:</strong> ' + callerName + '</p><p><strong>Phone:</strong> ' + callerNumber + '</p><p><strong>Duration:</strong> ' + turnCount + ' turns</p><p><strong>Topics:</strong> ' + topicsDiscussed.substring(0, 300) + '</p><p style="color:#888;font-size:12px">Sent by IMAN (Intelligent Mail Agent Nexus) via ABA REACH v1.9.0</p></div>';
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
      '&Twiml=' + encodeURIComponent('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Brandon, you have a caller on the line. Connecting you now.</Say><Dial><Conference>aba-live-transfer</Conference></Dial></Response>');
    
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
  
  ws.on('error', (err) => console.log('[DEEPGRAM] Error: ' + err.message));
  ws.on('close', () => console.log('[DEEPGRAM] Disconnected'));
  
  session.deepgramWs = ws;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:AIR:REACH.VOICE.PROCESS:CODE:voice.pipeline.full:USER→DEEPGRAM→AIR→VARA→ELEVENLABS→USER:T8:v1.5.0:20260213:p1r2u⬡
// ═══════════════════════════════════════════════════════════════════════════
async function processUtterance(session, text) {
  // ⬡B:AIR:REACH.VOICE.DEMO_PROCESS:CODE:voice.demo.touchpoint_aware:AIR→VARA→USER:T9:v1.6.0:20260213:d1p2r⬡
  
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
      service: 'ABA REACH v1.9.0',
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // ⬡B:AIR:REACH.API.NYLAS_CALLBACK:CODE:email.oauth.callback:NYLAS→REACH→BRAIN:T9:v1.8.0:20260214:n1c2b⬡
  // Nylas OAuth callback - exchanges code for grant_id, stores in brain
  // ROUTING: NYLAS_AUTH→REACH→BRAIN (stores grant for IMAN to use)
  // ═══════════════════════════════════════════════════════════════════════
  if (path === '/api/nylas/callback' && method === 'GET') {
    try {
      const urlObj = new URL(req.url, 'https://' + req.headers.host);
      const code = urlObj.searchParams.get('code');
      
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        return res.end('<h1>Missing code parameter</h1>');
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
  // ⬡B:AIR:REACH.API.NOTFOUND:CODE:infrastructure.error.404:USER→REACH→ERROR:T10:v1.5.0:20260213:n1f2d⬡ CATCH-ALL
  // ═══════════════════════════════════════════════════════════════════════
  jsonResponse(res, 404, { 
    error: 'Route not found: ' + method + ' ' + path,
    available: ['/api/router', '/api/models/claude', '/api/voice/deepgram-token', '/api/voice/tts', '/api/omi/manifest', '/api/omi/webhook', '/api/sms/send', '/api/brain/search', '/api/brain/store', '/api/scrape-job', '/api/idealist/parse', '/api/idealist/verify'],
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
        
        // ⬡B:AIR:REACH.VOICE.DEMO_FLOW:CODE:voice.demo.guided:AIR→VARA→USER:T9:v1.6.0:20260213:d1f2l⬡
        // v1.8.0 - Pull cross-call memory BEFORE greeting
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
      }
      
      if (msg.event === 'media' && session?.deepgramWs?.readyState === WebSocket.OPEN) {
        session.deepgramWs.send(Buffer.from(msg.media.payload, 'base64'));
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
// ⬡B:AIR:REACH.SERVER.LISTEN:CODE:infrastructure.boot.start:AIR→REACH:T10:v1.5.0:20260213:l1s2n⬡
// ═══════════════════════════════════════════════════════════════════════════
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[ABA REACH v1.9.0] LIVE on port ' + PORT);
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
