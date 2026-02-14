/**
 * ⬡B:ABCD:BOTH:AGENTS.INDEX:v1.0.0:20260214⬡
 * Agent Registry - All modular agents
 */

// NOTE: These are modular versions. worker.js still has inline versions for compatibility.
// Future: worker.js should import from here instead of inline.

module.exports = {
  // PLAY: require('./PLAY'),
  // CLIMATE: require('./CLIMATE'),
  // ... more agents to be extracted
  
  AGENT_REGISTRY: {
    PLAY: { department: 'LIFESTYLE', abcd: 'BOTH', status: 'modularized' },
    CLIMATE: { department: 'LIFESTYLE', abcd: 'BOTH', status: 'modularized' },
    IMAN: { department: 'EMAIL', abcd: 'BOTH', status: 'inline' },
    RADAR: { department: 'CALENDAR', abcd: 'BOTH', status: 'inline' },
    PRESS: { department: 'NEWS', abcd: 'BOTH', status: 'inline' },
    DIAL: { department: 'VOICE', abcd: 'ABAOS', status: 'inline' },
    LUKE: { department: 'INTELLIGENCE', abcd: 'ABAOS', status: 'inline' },
    COLE: { department: 'INTELLIGENCE', abcd: 'ABAOS', status: 'inline' },
    JUDE: { department: 'INTELLIGENCE', abcd: 'ABAOS', status: 'inline' },
    PACK: { department: 'INTELLIGENCE', abcd: 'ABAOS', status: 'inline' },
  }
};
