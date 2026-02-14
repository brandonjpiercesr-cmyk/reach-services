/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ACL MAP DECODER - The Navigation System for ABA's Code
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ⬡B:ABCD:BOTH:ACL.MAP.DECODER:v1.0.0:20260214⬡
 * 
 * ACL FORMAT: ⬡B:namespace:path:type:description:routing:trust:version:date:hash⬡
 * 
 * This file decodes ACL tags and provides navigation for ABA to find code.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ⬡B:ABCD:BOTH:ACL.MAP⬡
const ACL_MAP = {
  // AGENTS - L3 Managers
  agents: {
    LUKE: { file: 'worker.js', line: 'LUKE_process', department: 'INTELLIGENCE', abcd: 'ABAOS' },
    COLE: { file: 'worker.js', line: 'COLE_scour', department: 'INTELLIGENCE', abcd: 'ABAOS' },
    JUDE: { file: 'worker.js', line: 'JUDE_findAgents', department: 'INTELLIGENCE', abcd: 'ABAOS' },
    PACK: { file: 'worker.js', line: 'PACK_assemble', department: 'INTELLIGENCE', abcd: 'ABAOS' },
    PLAY: { file: 'worker.js', line: 'PLAY_getScores', department: 'LIFESTYLE', abcd: 'BOTH' },
    IMAN: { file: 'worker.js', line: 'IMAN_readEmails', department: 'EMAIL', abcd: 'BOTH' },
    RADAR: { file: 'worker.js', line: 'RADAR_getCalendar', department: 'CALENDAR', abcd: 'BOTH' },
    PRESS: { file: 'worker.js', line: 'PRESS_getNews', department: 'NEWS', abcd: 'BOTH' },
    CLIMATE: { file: 'worker.js', line: 'CLIMATE_getWeather', department: 'LIFESTYLE', abcd: 'BOTH' },
    DIAL: { file: 'worker.js', line: 'DIAL_callWithElevenLabs', department: 'VOICE', abcd: 'ABAOS' },
    VARA: { file: 'worker.js', line: 'buildSystemPrompt', department: 'VOICE', abcd: 'ABAOS' },
  },
  
  // CORE SYSTEMS - L6/L5
  core: {
    AIR: { file: 'worker.js', line: 'AIR_process', level: 'L6', abcd: 'BOTH' },
    DISPATCH: { file: 'worker.js', line: 'AIR_DISPATCH', level: 'L5', abcd: 'BOTH' },
    BRAIN: { file: 'worker.js', line: 'storeToBrain', level: 'L4', abcd: 'BOTH' },
    CONTACTS: { file: 'worker.js', line: 'lookupCallerByPhone', level: 'L4', abcd: 'BOTH' },
  },
  
  // MEMORY SYSTEMS
  memory: {
    RECALL: { file: 'worker.js', line: 'RECALL_lastConversation', abcd: 'ABAOS' },
    STORE: { file: 'worker.js', line: 'STORE_conversation', abcd: 'ABAOS' },
  },
  
  // ROUTING KEYWORDS -> AGENTS
  keywords: {
    'weather|temperature|outside|cold|hot|rain': 'CLIMATE',
    'score|game|laker|win|nba|sports|basketball': 'PLAY',
    'email|inbox|mail|message': 'IMAN',
    'calendar|schedule|meeting|appointment': 'RADAR',
    'news|headline|happening|latest': 'PRESS',
    'call|phone|dial': 'DIAL',
  }
};

// ⬡B:ABCD:BOTH:ACL.DECODER⬡
function decodeACL(aclTag) {
  // Parse: ⬡B:namespace:path:type:description:routing:trust:version:date:hash⬡
  const match = aclTag.match(/⬡B:([^:]+):([^:]+):([^:]+):([^:]+):?([^:]*):?([^:]*):?([^:]*):?([^:]*):?([^⬡]*)⬡/);
  if (!match) return null;
  
  return {
    namespace: match[1],
    path: match[2],
    type: match[3],
    description: match[4],
    routing: match[5] || null,
    trust: match[6] || null,
    version: match[7] || null,
    date: match[8] || null,
    hash: match[9] || null
  };
}

// ⬡B:ABCD:BOTH:ACL.FINDER⬡
function findAgentByKeyword(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  for (const [pattern, agent] of Object.entries(ACL_MAP.keywords)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(lowerKeyword)) {
      return ACL_MAP.agents[agent];
    }
  }
  return null;
}

// ⬡B:ABCD:BOTH:ACL.NAVIGATOR⬡
function navigateToAgent(agentName) {
  return ACL_MAP.agents[agentName.toUpperCase()] || null;
}

module.exports = {
  ACL_MAP,
  decodeACL,
  findAgentByKeyword,
  navigateToAgent
};
