// ═══════════════════════════════════════════════════════════════════
// CONVERSATION COMPRESSION SYSTEM
// Part of ABABASE architecture
// ═══════════════════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic();

// Use Haiku for summarization (70% cheaper than Sonnet)
const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';

async function compressConversation(supabaseClient, userId, conversationId, options = {}) {
  const { aggressive = false, keepRecent = aggressive ? 10 : 20 } = options;

  // Load conversation
  const { data: conversation, error } = await supabaseClient
    .from('conversations')
    .select('messages, summary, full_token_count')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (error || !conversation) {
    console.error('[Compression] Failed to load conversation:', error);
    return false;
  }

  const messages = conversation.messages || [];
  
  // If fewer messages than keepRecent, nothing to compress
  if (messages.length <= keepRecent) {
    console.log('[Compression] Not enough messages to compress');
    return false;
  }

  // Split into old (to compress) and recent (to keep)
  const oldMessages = messages.slice(0, -keepRecent);
  const recentMessages = messages.slice(-keepRecent);

  // Generate summary of old messages using Haiku
  const summaryPrompt = `Summarize this conversation history into key points. Focus on:
1. Decisions made
2. Actions taken (emails sent, calls made, etc.)
3. Important information mentioned
4. User preferences expressed
5. Ongoing tasks or projects

Keep the summary under 500 words. Use bullet points for clarity.

CONVERSATION:
${oldMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}`;

  try {
    const response = await anthropic.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: summaryPrompt }]
    });

    const newSummary = response.content[0].text;
    
    // Combine with existing summary if present
    const fullSummary = conversation.summary 
      ? `${conversation.summary}\n\n---\n\n${newSummary}`
      : newSummary;

    // Update conversation with compressed data
    const { error: updateError } = await supabaseClient
      .from('conversations')
      .update({
        messages: recentMessages,
        summary: fullSummary,
        summary_token_count: Math.ceil(fullSummary.length / 4),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Compression] Failed to update conversation:', updateError);
      return false;
    }

    console.log(`[Compression] Compressed ${oldMessages.length} messages into summary, kept ${recentMessages.length} recent`);
    return true;

  } catch (apiError) {
    console.error('[Compression] API error during summarization:', apiError);
    return false;
  }
}

// Scheduled job to compress old conversations
async function runCompressionJob(supabaseAdmin) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Find conversations with >100 messages that haven't been updated in 24h
  const { data: conversations } = await supabaseAdmin
    .from('conversations')
    .select('id, user_id, messages')
    .lt('updated_at', oneDayAgo)
    .filter('messages', 'cs', '[]');

  for (const conv of conversations || []) {
    if (conv.messages?.length > 100) {
      console.log(`[CompressionJob] Compressing conversation ${conv.id}`);
      await compressConversation(supabaseAdmin, conv.user_id, conv.id);
    }
  }
}

module.exports = { compressConversation, runCompressionJob };
