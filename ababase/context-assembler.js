// ═══════════════════════════════════════════════════════════════════
// CONTEXT ASSEMBLER v2.0
// Builds fat prompts for AIR with user context, contacts, and history
// Part of ABABASE architecture
// ═══════════════════════════════════════════════════════════════════

const CONTEXT_LIMITS = {
  TOTAL_BUDGET: 180000,
  SYSTEM_PROMPT: 20000,
  USER_CONTEXT: 15000,
  AGENT_INSTRUCTIONS: 30000,
  CONTACTS: 10000,
  CONVERSATION: 80000,
  SUMMARY: 10000,
  TOOLS: 15000,
  CURRENT_REQUEST: 10000
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

  async loadUserContext() {
    const { data, error } = await this.supabase
      .from('user_contexts')
      .select('context_type, label, content, priority, is_protected, token_count')
      .eq('user_id', this.userId)
      .order('priority', { ascending: false });
    
    if (error) {
      console.error('[ContextAssembler] Failed to load user context:', error);
      return [];
    }
    return data || [];
  }

  async loadContacts() {
    const { data, error } = await this.supabase
      .from('contacts')
      .select('name, phone, email, relationship, trust_level, lp_tag')
      .eq('user_id', this.userId)
      .order('trust_level', { ascending: false });
    
    if (error) {
      console.error('[ContextAssembler] Failed to load contacts:', error);
      return [];
    }
    return data || [];
  }

  async loadAgentInstructions(agentNames) {
    const { data, error } = await this.supabase
      .from('agent_instructions')
      .select('agent_name, full_name, department, system_prompt, tools, token_count')
      .in('agent_name', agentNames)
      .eq('is_active', true);
    
    if (error) {
      console.error('[ContextAssembler] Failed to load agent instructions:', error);
      return [];
    }
    return data || [];
  }

  async loadConversation(conversationId) {
    if (!conversationId) return { messages: [], summary: null };
    
    const { data, error } = await this.supabase
      .from('conversations')
      .select('messages, summary, full_token_count, summary_token_count')
      .eq('id', conversationId)
      .eq('user_id', this.userId)
      .single();
    
    if (error) {
      console.error('[ContextAssembler] Failed to load conversation:', error);
      return { messages: [], summary: null };
    }
    return data || { messages: [], summary: null };
  }

  async loadUserProfile() {
    const { data, error } = await this.supabase
      .from('users')
      .select('display_name, email, phone, timezone, trust_level, preferences')
      .eq('id', this.userId)
      .single();
    
    if (error) {
      console.error('[ContextAssembler] Failed to load user profile:', error);
      return null;
    }
    return data;
  }

  async assemble({ 
    agentNames = ['AIR'], 
    conversationId = null, 
    currentMessage = '',
    tools = [],
    channel = 'portal'
  }) {
    const [userProfile, userContexts, contacts, agents, conversation] = await Promise.all([
      this.loadUserProfile(),
      this.loadUserContext(),
      this.loadContacts(),
      this.loadAgentInstructions(agentNames),
      this.loadConversation(conversationId)
    ]);

    let tokensUsed = 0;

    // LAYER 1: SYSTEM PROMPT
    let systemPrompt = `You are AIR (ABA Intelligence Router), the central brain of the ABA ecosystem.
You route requests to specialized agents and execute actions on behalf of the user.
You have access to the user's full context - their contacts, preferences, and conversation history.
You NEVER search for information that is already provided to you.
You use the EXACT data given to you, not approximations or guesses.

## CURRENT DATE/TIME
${new Date().toLocaleString('en-US', { timeZone: userProfile?.timezone || 'America/New_York' })}
Timezone: ${userProfile?.timezone || 'America/New_York'}

## CURRENT USER
Name: ${userProfile?.display_name || 'User'}
Email: ${userProfile?.email || 'Not provided'}
Phone: ${userProfile?.phone || 'Not provided'}
Trust Level: T${userProfile?.trust_level || 5}
Channel: ${channel}
`;
    tokensUsed += estimateTokens(systemPrompt);

    // LAYER 2: USER CONTEXT (HAM)
    if (userContexts.length > 0) {
      systemPrompt += '\n## USER CONTEXT (HAM - Human ABA Master)\n';
      let contextTokens = 0;
      
      const sortedContexts = userContexts.sort((a, b) => {
        if (a.is_protected && !b.is_protected) return -1;
        if (!a.is_protected && b.is_protected) return 1;
        return b.priority - a.priority;
      });
      
      for (const ctx of sortedContexts) {
        const ctxTokens = ctx.token_count || estimateTokens(ctx.content);
        if (ctx.is_protected || contextTokens + ctxTokens <= CONTEXT_LIMITS.USER_CONTEXT) {
          systemPrompt += `### ${ctx.label} [${ctx.context_type}]\n${ctx.content}\n\n`;
          contextTokens += ctxTokens;
        }
      }
      tokensUsed += contextTokens;
    }

    // LAYER 3: CONTACTS LOOKUP TABLE (EXACT MATCH - NO SEMANTIC SEARCH)
    if (contacts.length > 0) {
      systemPrompt += '\n## CONTACTS DIRECTORY\n';
      systemPrompt += 'Use this EXACT data for contact lookups. Do NOT search, guess, or approximate.\n';
      systemPrompt += 'When user says a name, match it EXACTLY to this list.\n\n';
      
      for (const contact of contacts) {
        const lpAccess = contact.lp_tag ? ` [${contact.lp_tag}]` : '';
        systemPrompt += `- **${contact.name}** (T${contact.trust_level}${lpAccess}): `;
        if (contact.phone) systemPrompt += `Phone: ${contact.phone}`;
        if (contact.email) systemPrompt += ` | Email: ${contact.email}`;
        if (contact.relationship) systemPrompt += ` | ${contact.relationship}`;
        systemPrompt += '\n';
      }
      systemPrompt += '\n';
      tokensUsed += estimateTokens(contacts.map(c => c.name + c.phone + c.email).join(''));
    }

    // LAYER 4: AGENT INSTRUCTIONS
    if (agents.length > 0) {
      systemPrompt += '\n## AGENT CAPABILITIES\n';
      systemPrompt += 'You can invoke these specialized agents by following their protocols:\n\n';
      
      for (const agent of agents) {
        systemPrompt += `### ${agent.agent_name} - ${agent.full_name} [${agent.department}]\n`;
        systemPrompt += `${agent.system_prompt}\n\n`;
        tokensUsed += agent.token_count || estimateTokens(agent.system_prompt);
      }
    }

    // LAYER 5: TOOL DEFINITIONS
    const toolTokens = estimateTokens(JSON.stringify(tools));
    tokensUsed += toolTokens;

    // BUILD MESSAGES ARRAY
    const messages = [];

    if (conversation.summary) {
      messages.push({
        role: 'user',
        content: `[CONVERSATION CONTEXT: ${conversation.summary}]`
      });
      messages.push({
        role: 'assistant',
        content: 'I have the context from our previous conversation and will continue from there.'
      });
      tokensUsed += conversation.summary_token_count || estimateTokens(conversation.summary);
    }

    if (conversation.messages && conversation.messages.length > 0) {
      const conversationBudget = CONTEXT_LIMITS.CONVERSATION - tokensUsed;
      let conversationTokens = 0;
      
      const recentMessages = [];
      for (let i = conversation.messages.length - 1; i >= 0; i--) {
        const msg = conversation.messages[i];
        const msgTokens = estimateTokens(msg.content);
        if (conversationTokens + msgTokens > conversationBudget) break;
        recentMessages.unshift(msg);
        conversationTokens += msgTokens;
      }
      
      for (const msg of recentMessages) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
      tokensUsed += conversationTokens;
    }

    if (currentMessage) {
      messages.push({
        role: 'user',
        content: currentMessage
      });
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
        agentsLoaded: agents.map(a => a.agent_name),
        contactCount: contacts.length,
        contextCount: userContexts.length,
        estimatedTokens: tokensUsed,
        tokenBudget: CONTEXT_LIMITS.TOTAL_BUDGET,
        utilizationPercent: Math.round((tokensUsed / CONTEXT_LIMITS.TOTAL_BUDGET) * 100)
      }
    };
  }
}

module.exports = { ContextAssembler, CONTEXT_LIMITS, estimateTokens };
