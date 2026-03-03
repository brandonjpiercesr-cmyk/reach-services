// ═══════════════════════════════════════════════════════════════════
// CONTEXT ASSEMBLER v3.0 - FIXED
// ⬡B:ababase.context_assembler:FIX:load_all_88_agents:20260303⬡
// Now loads from aba_agent_jds (88 agents) and aba_memory (HAM)
// ═══════════════════════════════════════════════════════════════════

const CONTEXT_LIMITS = {
  TOTAL_BUDGET: 900000,
  SYSTEM_PROMPT: 50000,
  USER_CONTEXT: 100000,
  AGENT_JDS: 300000,  // Increased for 88 agents
  CONTACTS: 20000,
  CONVERSATION: 300000,
  SUMMARY: 50000,
  TOOLS: 30000,
  CURRENT_REQUEST: 50000
};

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

class ContextAssembler {
  constructor(supabaseClient, userId) {
    this.supabase = supabaseClient;
    this.userId = userId;
    this.tokensUsed = 0;
  }

  // FIXED: Load HAM from aba_memory where memory_type='ham_identity'
  async loadHAMIdentity(identifier) {
    // Try phone, email, or name match
    const { data, error } = await this.supabase
      .from('aba_memory')
      .select('content, tags')
      .eq('memory_type', 'ham_identity');
    
    if (error || !data) {
      console.error('[ContextAssembler] Failed to load HAM:', error);
      return null;
    }

    // Find matching identity
    for (const record of data) {
      const content = record.content.toLowerCase();
      const id = (identifier || '').toLowerCase();
      if (content.includes(id) || 
          (record.tags && record.tags.some(t => t.toLowerCase().includes(id)))) {
        return record.content;
      }
    }
    
    // Default to Brandon if no match (T10 fallback)
    const brandon = data.find(d => d.content.toLowerCase().includes('brandon'));
    return brandon?.content || null;
  }

  // FIXED: Load ALL 88 agents from aba_agent_jds
  async loadAllAgentJDs() {
    const { data, error } = await this.supabase
      .from('aba_agent_jds')
      .select('agent_id, full_name, responsibilities, tools, pre_requirements, post_validation, department, tagline, agent_type')
      .eq('status', 'active');
    
    if (error || !data) {
      console.error('[ContextAssembler] Failed to load agent JDs:', error);
      return [];
    }
    
    console.log(`[ContextAssembler] Loaded ${data.length} agent JDs from aba_agent_jds`);
    return data;
  }

  // Load contacts from aba_memory (relationships)
  async loadContacts() {
    const { data, error } = await this.supabase
      .from('aba_memory')
      .select('content')
      .eq('memory_type', 'ham_identity');
    
    if (error) {
      console.error('[ContextAssembler] Failed to load contacts:', error);
      return [];
    }
    
    // Parse contacts from HAM identities
    return (data || []).map(d => {
      const content = d.content;
      const nameMatch = content.match(/HAM IDENTITY: ([^|]+)/);
      const phoneMatch = content.match(/Phone: ([^|]+)/);
      const emailMatch = content.match(/Email: ([^|]+)/);
      const trustMatch = content.match(/Trust: (T\d+)/);
      return {
        name: nameMatch?.[1]?.trim() || 'Unknown',
        phone: phoneMatch?.[1]?.trim() || '',
        email: emailMatch?.[1]?.trim() || '',
        trust_level: trustMatch?.[1] || 'T5'
      };
    });
  }

  async loadConversation(conversationId) {
    if (!conversationId) return { messages: [], summary: null };
    
    const { data, error } = await this.supabase
      .from('conversations')
      .select('messages, summary, full_token_count, summary_token_count')
      .eq('id', conversationId)
      .single();
    
    if (error) {
      console.error('[ContextAssembler] Failed to load conversation:', error);
      return { messages: [], summary: null };
    }
    return data || { messages: [], summary: null };
  }

  // FIXED: Load relevant brain context
  async loadBrainContext(query) {
    if (!query) return [];
    
    const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
    const { data, error } = await this.supabase
      .from('aba_memory')
      .select('content, memory_type, source')
      .limit(20);
    
    if (error || !data) return [];
    
    // Simple relevance filter
    return data.filter(d => 
      keywords.some(k => d.content?.toLowerCase().includes(k))
    ).slice(0, 5);
  }

  async assemble({ 
    agentNames = [], // Ignored - we load ALL 88
    conversationId = null, 
    currentMessage = '',
    tools = [],
    channel = 'portal'
  }) {
    // Load everything in parallel
    const [hamIdentity, allAgentJDs, contacts, conversation, brainContext] = await Promise.all([
      this.loadHAMIdentity(this.userId),
      this.loadAllAgentJDs(),
      this.loadContacts(),
      this.loadConversation(conversationId),
      this.loadBrainContext(currentMessage)
    ]);

    let tokensUsed = 0;
    const now = new Date();
    const timezone = 'America/New_York';

    // LAYER 1: SYSTEM PROMPT WITH NOW CONTEXT
    let systemPrompt = `You are AIR (ABA Intelligence Router), the central brain of the ABA ecosystem.
You have ALL 88 agent JDs loaded. Read them and decide which apply to this request.
You execute actions using tools. If information is missing, ASK for it.
You NEVER say "I can't" without trying all approaches (GRIT methodology).

## NOW CONTEXT (Current Time)
${now.toLocaleString('en-US', { timeZone: timezone })}
Day: ${now.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone })}
Timezone: ${timezone}
Channel: ${channel}

`;
    tokensUsed += estimateTokens(systemPrompt);

    // LAYER 2: HAM CONTEXT (User Identity)
    if (hamIdentity) {
      systemPrompt += `## HAM CONTEXT (Who You're Talking To)
${hamIdentity}

`;
      tokensUsed += estimateTokens(hamIdentity);
    }

    // LAYER 3: ALL 88 AGENT JDs
    systemPrompt += `## ALL AGENT JDs (${allAgentJDs.length} agents)
Read ALL of these. Decide which apply to the user's request.

`;
    
    // Group by type for clarity
    const agentsByType = {};
    for (const agent of allAgentJDs) {
      const type = agent.agent_type || 'OTHER';
      if (!agentsByType[type]) agentsByType[type] = [];
      agentsByType[type].push(agent);
    }

    for (const [type, agents] of Object.entries(agentsByType)) {
      systemPrompt += `### ${type} AGENTS\n`;
      for (const agent of agents) {
        systemPrompt += `**${agent.agent_id}** (${agent.full_name}) [${agent.department || 'GENERAL'}]
${agent.tagline ? `"${agent.tagline}"` : ''}
Responsibilities: ${agent.responsibilities || 'Not specified'}
Pre-requirements: ${JSON.stringify(agent.pre_requirements || [])}
Post-validation: ${JSON.stringify(agent.post_validation || [])}
Tools: ${JSON.stringify(agent.tools || [])}

`;
      }
    }
    tokensUsed += estimateTokens(systemPrompt);

    // LAYER 4: CONTACTS DIRECTORY
    if (contacts.length > 0) {
      systemPrompt += `## CONTACTS DIRECTORY
`;
      for (const contact of contacts) {
        systemPrompt += `- ${contact.name} (${contact.trust_level}): ${contact.phone} | ${contact.email}
`;
      }
      systemPrompt += '\n';
      tokensUsed += estimateTokens(contacts.map(c => c.name).join(''));
    }

    // LAYER 5: RELEVANT BRAIN CONTEXT
    if (brainContext.length > 0) {
      systemPrompt += `## RELEVANT BRAIN CONTEXT
`;
      for (const mem of brainContext) {
        systemPrompt += `[${mem.memory_type}] ${mem.content.slice(0, 500)}
`;
      }
      systemPrompt += '\n';
    }

    // LAYER 6: INSTRUCTIONS
    systemPrompt += `## INSTRUCTIONS
1. Read ALL agent JDs above
2. Identify which agents apply to this request
3. Follow their pre_requirements and post_validation
4. Use tools to complete the task
5. If information is missing (like an address), ASK for it
6. Return your response with which agents you used

## TOOLS AVAILABLE
${tools.map(t => `- ${t.name}: ${t.description || 'No description'}`).join('\n')}

`;

    // BUILD MESSAGES ARRAY
    const messages = [];

    if (conversation.summary) {
      messages.push({
        role: 'user',
        content: `[PREVIOUS CONVERSATION SUMMARY: ${conversation.summary}]`
      });
      messages.push({
        role: 'assistant',
        content: 'I have the context from our previous conversation.'
      });
    }

    if (conversation.messages && conversation.messages.length > 0) {
      for (const msg of conversation.messages.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    if (currentMessage) {
      messages.push({ role: 'user', content: currentMessage });
      tokensUsed += estimateTokens(currentMessage);
    }

    return {
      systemPrompt,
      messages,
      tools,
      metadata: {
        userId: this.userId,
        conversationId,
        channel,
        agentsLoaded: allAgentJDs.length,
        agentIds: allAgentJDs.map(a => a.agent_id),
        contactCount: contacts.length,
        hamLoaded: !!hamIdentity,
        brainContextCount: brainContext.length,
        estimatedTokens: tokensUsed,
        tokenBudget: CONTEXT_LIMITS.TOTAL_BUDGET,
        utilizationPercent: Math.round((tokensUsed / CONTEXT_LIMITS.TOTAL_BUDGET) * 100)
      }
    };
  }
}

module.exports = { ContextAssembler, CONTEXT_LIMITS, estimateTokens };
