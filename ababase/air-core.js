// ═══════════════════════════════════════════════════════════════════
// AIR CORE LOOP v2.0
// Single-threaded agentic loop with tool execution
// Part of ABABASE architecture
// ═══════════════════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');
const { ContextAssembler } = require('./context-assembler');
const { executeToolCall, TOOL_DEFINITIONS } = require('./tools');
const { compressConversation } = require('./compression');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Circuit breaker to prevent runaway loops
class CircuitBreaker {
  constructor(threshold = 3) {
    this.calls = new Map();
    this.threshold = threshold;
  }

  check(toolName, args) {
    const key = `${toolName}:${JSON.stringify(args)}`;
    const count = (this.calls.get(key) || 0) + 1;
    this.calls.set(key, count);
    
    if (count > this.threshold) {
      console.error(`[CircuitBreaker] TRIPPED: ${toolName} called ${count} times with same args`);
      return { allowed: false, count };
    }
    return { allowed: true, count };
  }
  
  reset() {
    this.calls.clear();
  }
}

// Cost tracker with Anthropic pricing
class CostTracker {
  constructor() {
    this.reset();
  }

  static PRICING = {
    'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
    'claude-haiku-4-5-20251001': { input: 0.25, output: 1.25, cacheRead: 0.03, cacheWrite: 0.30 }
  };

  add(usage, model = 'claude-sonnet-4-5-20250929') {
    this.inputTokens += usage.input_tokens || 0;
    this.outputTokens += usage.output_tokens || 0;
    this.cacheReadTokens += usage.cache_read_input_tokens || 0;
    this.cacheWriteTokens += usage.cache_creation_input_tokens || 0;
    this.model = model;
  }
  
  estimate() {
    const pricing = CostTracker.PRICING[this.model] || CostTracker.PRICING['claude-sonnet-4-5-20250929'];
    const inputCost = (this.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (this.outputTokens / 1_000_000) * pricing.output;
    const cacheReadCost = (this.cacheReadTokens / 1_000_000) * pricing.cacheRead;
    const cacheWriteCost = (this.cacheWriteTokens / 1_000_000) * pricing.cacheWrite;
    return {
      total: inputCost + outputCost + cacheReadCost + cacheWriteCost,
      breakdown: { inputCost, outputCost, cacheReadCost, cacheWriteCost },
      cacheHitRate: this.cacheReadTokens / (this.inputTokens + this.cacheReadTokens + 1)
    };
  }
  
  reset() {
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.cacheReadTokens = 0;
    this.cacheWriteTokens = 0;
    this.model = 'claude-sonnet-4-5-20250929';
  }
}

// Detect which agents to load based on message content
function detectAgents(message) {
  const agents = ['AIR'];
  const lower = message.toLowerCase();
  
  if (lower.includes('email') || lower.includes('send') || lower.includes('inbox') || lower.includes('mail')) {
    agents.push('IMAN');
  }
  if (lower.includes('call') || lower.includes('phone') || lower.includes('dial') || lower.includes('ring')) {
    agents.push('VARA');
  }
  if (lower.includes('calendar') || lower.includes('schedule') || lower.includes('meeting') || lower.includes('appointment')) {
    agents.push('CALI');
  }
  if (lower.includes('score') || lower.includes('game') || lower.includes('lakers') || lower.includes('sports') || lower.includes('nba') || lower.includes('nfl')) {
    agents.push('PLAY');
  }
  if (lower.includes('remember') || lower.includes('memory') || lower.includes('note') || lower.includes('save')) {
    agents.push('MEMO');
  }
  if (lower.includes('job') || lower.includes('cover letter') || lower.includes('resume') || lower.includes('interview') || lower.includes('application') || lower.includes('awa')) {
    agents.push('JOBA');
  }
  
  return [...new Set(agents)];
}

// Main AIR processing function
async function airProcess({ 
  supabaseClient, 
  userId, 
  conversationId = null, 
  message,
  channel = 'portal',
  maxIterations = 10,
  timeoutMs = 30000
}) {
  const assembler = new ContextAssembler(supabaseClient, userId);
  const circuitBreaker = new CircuitBreaker();
  const costTracker = new CostTracker();
  
  const agentNames = detectAgents(message);
  
  const context = await assembler.assemble({
    agentNames,
    conversationId,
    currentMessage: message,
    channel,
    tools: TOOL_DEFINITIONS
  });

  console.log(`[AIR] Context assembled: ${context.metadata.estimatedTokens} tokens (${context.metadata.utilizationPercent}%), agents: ${agentNames.join(', ')}`);

  if (context.metadata.utilizationPercent > 85) {
    console.log('[AIR] High utilization - triggering conversation compression');
    await compressConversation(supabaseClient, userId, conversationId);
    const refreshedContext = await assembler.assemble({
      agentNames,
      conversationId,
      currentMessage: message,
      channel,
      tools: TOOL_DEFINITIONS
    });
    Object.assign(context, refreshedContext);
  }

  let messages = [...context.messages];
  let iterations = 0;
  let finalResponse = null;
  let actionsExecuted = [];

  while (iterations < maxIterations) {
    iterations++;
    console.log(`[AIR] Iteration ${iterations}/${maxIterations}`);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: context.systemPrompt,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages,
        tools: context.tools
      });

      costTracker.add(response.usage);

      if (response.stop_reason === 'end_turn') {
        const textBlocks = response.content.filter(b => b.type === 'text');
        finalResponse = textBlocks.map(b => b.text).join('\n');
        console.log(`[AIR] Complete after ${iterations} iterations`);
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
        
        messages.push({
          role: 'assistant',
          content: response.content
        });

        const toolResults = [];
        for (const toolUse of toolUseBlocks) {
          console.log(`[AIR] Tool call: ${toolUse.name}(${JSON.stringify(toolUse.input).substring(0, 100)}...)`);
          
          const breakerResult = circuitBreaker.check(toolUse.name, toolUse.input);
          if (!breakerResult.allowed) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({
                error: `Circuit breaker tripped - ${toolUse.name} was attempted ${breakerResult.count} times with identical arguments. This action has been blocked to prevent infinite loops.`,
                status: 'blocked'
              }),
              is_error: true
            });
            continue;
          }

          try {
            const result = await Promise.race([
              executeToolCall(toolUse.name, toolUse.input, { userId, supabaseClient, channel }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Tool timeout after ${timeoutMs}ms`)), timeoutMs)
              )
            ]);

            actionsExecuted.push({
              tool: toolUse.name,
              input: toolUse.input,
              result,
              timestamp: new Date().toISOString()
            });

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result)
            });
          } catch (toolError) {
            console.error(`[AIR] Tool error: ${toolUse.name}`, toolError.message);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({
                error: toolError.message,
                status: 'failed'
              }),
              is_error: true
            });
          }
        }

        messages.push({
          role: 'user',
          content: toolResults
        });
        
        continue;
      }

      if (response.stop_reason === 'max_tokens') {
        console.warn('[AIR] Response truncated due to max_tokens');
        const textBlocks = response.content.filter(b => b.type === 'text');
        finalResponse = textBlocks.map(b => b.text).join('\n') + '\n\n[Response truncated]';
        break;
      }

      console.warn(`[AIR] Unknown stop_reason: ${response.stop_reason}`);
      finalResponse = 'I encountered an unexpected state. Please try again.';
      break;

    } catch (apiError) {
      console.error(`[AIR] API error:`, apiError.message);
      
      if (apiError.message?.includes('context_length_exceeded') || apiError.status === 400) {
        console.log('[AIR] Context length exceeded - triggering emergency compression');
        await compressConversation(supabaseClient, userId, conversationId, { aggressive: true });
        finalResponse = 'Our conversation got quite long. I\'ve summarized our earlier discussion. Could you repeat your last request?';
        break;
      }
      
      if (apiError.status === 429) {
        console.log('[AIR] Rate limited - waiting before retry');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      finalResponse = `I encountered an error: ${apiError.message}. Please try again.`;
      break;
    }
  }

  if (iterations >= maxIterations) {
    console.warn(`[AIR] Max iterations (${maxIterations}) reached`);
    finalResponse = finalResponse || 'I took too many steps trying to complete this. Let me try a simpler approach - could you rephrase your request?';
  }

  const costEstimate = costTracker.estimate();
  console.log(`[AIR] Finished. Iterations: ${iterations}, Cost: $${costEstimate.total.toFixed(4)}, Cache hit rate: ${(costEstimate.cacheHitRate * 100).toFixed(1)}%`);

  return {
    response: finalResponse,
    actionsExecuted,
    metadata: {
      iterations,
      cost: costEstimate,
      tokens: {
        input: costTracker.inputTokens,
        output: costTracker.outputTokens,
        cacheRead: costTracker.cacheReadTokens,
        cacheWrite: costTracker.cacheWriteTokens
      },
      context: context.metadata
    }
  };
}

module.exports = { airProcess, CircuitBreaker, CostTracker, detectAgents };
