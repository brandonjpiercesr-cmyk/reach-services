// ═══════════════════════════════════════════════════════════════════
// ABABASE BRIDGE v1.0.0
// ═══════════════════════════════════════════════════════════════════
// Bridge module for integrating ababase into REACH worker.js
// This exposes ababase functions in a format worker.js can consume
// ⬡B:ABABASE:BRIDGE:v1.0.0:20260227⬡
// ═══════════════════════════════════════════════════════════════════

const { ContextAssembler, estimateTokens } = require('./context-assembler');
const { airProcess, CircuitBreaker, CostTracker } = require('./air-core');
const { TOOL_DEFINITIONS, executeToolCall } = require('./tools');
const { compressConversation } = require('./compression');

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://htlxjkbrstpwwtzsbyvb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDUzMjgyMSwiZXhwIjoyMDg2MTA4ODIxfQ.G55zXnfanoUxRAoaYz-tD9FDJ53xHH-pRgDrKss_Iqo';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Default user ID (Brandon) - in production this comes from auth
const BRANDON_USER_ID = '7fc4aa7a-a8e6-4b75-b066-5cc5d4ff43cc';

// ═══════════════════════════════════════════════════════════════════
// SIMPLE SUPABASE CLIENT (no external dependency)
// ═══════════════════════════════════════════════════════════════════

function createSupabaseClient(url, key) {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  return {
    from: (table) => ({
      select: (columns = '*') => ({
        _table: table,
        _columns: columns,
        _filters: [],
        eq: function(col, val) { this._filters.push(`${col}=eq.${val}`); return this; },
        in: function(col, vals) { this._filters.push(`${col}=in.(${vals.join(',')})`); return this; },
        order: function(col, opts = {}) { this._order = `${col}.${opts.ascending === false ? 'desc' : 'asc'}`; return this; },
        limit: function(n) { this._limit = n; return this; },
        single: function() { this._single = true; return this; },
        then: async function(resolve, reject) {
          try {
            let path = `/rest/v1/${this._table}?select=${this._columns}`;
            if (this._filters.length) path += '&' + this._filters.join('&');
            if (this._order) path += `&order=${this._order}`;
            if (this._limit) path += `&limit=${this._limit}`;
            
            const res = await fetch(`${url}${path}`, { headers });
            const data = await res.json();
            
            if (this._single && Array.isArray(data)) {
              resolve({ data: data[0] || null, error: null });
            } else {
              resolve({ data, error: null });
            }
          } catch (e) {
            reject ? reject(e) : resolve({ data: null, error: e });
          }
        }
      }),
      insert: (rows) => ({
        then: async function(resolve, reject) {
          try {
            const res = await fetch(`${url}/rest/v1/${table}`, {
              method: 'POST',
              headers: { ...headers, 'Prefer': 'return=representation' },
              body: JSON.stringify(rows)
            });
            const data = await res.json();
            resolve({ data, error: null });
          } catch (e) {
            reject ? reject(e) : resolve({ data: null, error: e });
          }
        }
      }),
      upsert: (rows) => ({
        then: async function(resolve, reject) {
          try {
            const res = await fetch(`${url}/rest/v1/${table}`, {
              method: 'POST',
              headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
              body: JSON.stringify(rows)
            });
            const data = await res.json();
            resolve({ data, error: null });
          } catch (e) {
            reject ? reject(e) : resolve({ data: null, error: e });
          }
        }
      }),
      update: (values) => ({
        _values: values,
        eq: function(col, val) { this._filter = `${col}=eq.${val}`; return this; },
        then: async function(resolve, reject) {
          try {
            const res = await fetch(`${url}/rest/v1/${table}?${this._filter}`, {
              method: 'PATCH',
              headers: { ...headers, 'Prefer': 'return=representation' },
              body: JSON.stringify(this._values)
            });
            const data = await res.json();
            resolve({ data, error: null });
          } catch (e) {
            reject ? reject(e) : resolve({ data: null, error: e });
          }
        }
      })
    }),
    rpc: (funcName, params) => ({
      then: async function(resolve, reject) {
        try {
          const res = await fetch(`${url}/rest/v1/rpc/${funcName}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(params)
          });
          const data = await res.json();
          resolve({ data, error: null });
        } catch (e) {
          reject ? reject(e) : resolve({ data: null, error: e });
        }
      }
    })
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PROCESS FUNCTION
// ═══════════════════════════════════════════════════════════════════
// This is what worker.js calls for /api/air/v2/process

async function processWithAbabse(request) {
  const {
    message,
    userId = BRANDON_USER_ID,
    conversationId,
    channel = 'api',
    agentHints = []
  } = request;

  // Validate message exists
  if (!message || typeof message !== 'string') {
    return {
      success: false,
      error: 'Message is required and must be a string',
      response: null
    };
  }

  console.log('[ABABASE] Processing:', { message: message.substring(0, 50), userId, channel });

  // Create Supabase client
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Build context assembler
  const assembler = new ContextAssembler(supabase, userId);

  // Detect which agents are needed based on message
  const detectedAgents = detectAgentsFromMessage(message, agentHints);

  // Assemble full context
  const context = await assembler.assemble({
    agentNames: detectedAgents,
    currentMessage: message,
    conversationId,
    channel
  });

  console.log('[ABABASE] Context assembled:', {
    tokens: context.metadata.estimatedTokens,
    agents: context.metadata.agentsLoaded,
    contacts: context.metadata.contactCount
  });

  // Call AIR core processor
  const result = await airProcess({
    supabaseClient: supabase,
    userId,
    conversationId,
    message,
    channel: channel || 'api'
  });

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// AGENT DETECTION
// ═══════════════════════════════════════════════════════════════════

function detectAgentsFromMessage(message, hints = []) {
  const agents = new Set(['AIR']); // AIR always included
  const lowerMessage = (message || '').toLowerCase();

  // Add hint agents
  hints.forEach(h => agents.add(h.toUpperCase()));

  // Keyword detection
  const patterns = {
    'IMAN': ['email', 'inbox', 'gmail', 'mail', 'send email', 'check email'],
    'VARA': ['call', 'phone', 'dial', 'ring', 'voice'],
    'CARA': ['sms', 'text', 'message'],
    'CALI': ['calendar', 'meeting', 'schedule', 'appointment', 'event'],
    'PLAY': ['sports', 'score', 'game', 'nba', 'nfl', 'football', 'basketball'],
    'MEMO': ['remember', 'save', 'store', 'memory', 'note'],
    'COLE': ['search', 'find', 'look up', 'brain']
  };

  for (const [agent, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => lowerMessage.includes(kw))) {
      agents.add(agent);
    }
  }

  return Array.from(agents);
}

// ═══════════════════════════════════════════════════════════════════
// CONTACT LOOKUP (Direct RPC - bypasses semantic search)
// ═══════════════════════════════════════════════════════════════════

async function lookupContact(name, userId = BRANDON_USER_ID) {
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  const { data, error } = await supabase.rpc('get_contact', {
    p_user_id: userId,
    p_name: name
  });

  if (error) {
    console.error('[ABABASE] Contact lookup error:', error);
    return null;
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  // Main function for worker.js
  processWithAbabse,
  
  // Individual components for advanced usage
  ContextAssembler,
  estimateTokens,
  airProcess,
  executeToolCall,
  compressConversation,
  lookupContact,
  detectAgentsFromMessage,
  createSupabaseClient,
  
  // Constants
  TOOL_DEFINITIONS,
  BRANDON_USER_ID,
  
  // Version
  VERSION: '1.0.0'
};
