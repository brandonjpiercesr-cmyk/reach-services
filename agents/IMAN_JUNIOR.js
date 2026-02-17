// ABA AGENT IMAN_JUNIOR (Intelligent Mail Agent Navigator - Restricted)
// Same as IMAN but CANNOT send autonomously - requires approval
// Trust Level: T4-T7 (Life Assistant Mode)
// v1.0.0 - Feb 17, 2026

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://htlxjkbrstpwwtzsbyvb.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// IMAN Junior - drafts but does NOT send
const AGENT_IMAN_JUNIOR = {
  id: 'iman_junior',
  version: '1.0.0',
  department: 'COMMAND',
  trust_required: { min: 4, max: 7 },
  
  capabilities: {
    draft: true,
    queue: true,
    approve: false,
    send: false // KEY DIFFERENCE: Cannot send
  },
  
  async execute(context) {
    const { input, hamLevel } = context;
    
    // Verify trust level
    if (hamLevel >= 8) {
      // This user should use full IMAN
      return { redirect: 'IMAN', reason: 'User has Life Partner privileges' };
    }
    
    if (hamLevel < 4) {
      // This user gets mimic mode only
      return { redirect: 'MIMIC', reason: 'User has Client privileges' };
    }
    
    // T4-T7: Junior mode - draft and queue
    switch(input.action) {
      case 'send_email':
      case 'reply':
      case 'forward':
        return await this.draftAndQueue(input);
      case 'draft':
        return await this.createDraft(input);
      default:
        return { error: 'Unknown action', allowed_actions: ['draft', 'send_email', 'reply', 'forward'] };
    }
  },
  
  async draftAndQueue(input) {
    // Create draft
    const draft = await this.createDraft(input);
    
    // Queue for approval instead of sending
    const approval = await this.queueForApproval({
      draft_id: draft.id,
      to: input.to,
      subject: input.subject,
      body: draft.body,
      requested_by: input.ham_id,
      requested_at: new Date().toISOString()
    });
    
    // Notify Command Center
    await this.notifyCommandCenter(approval);
    
    return {
      status: 'queued_for_approval',
      draft_id: draft.id,
      approval_id: approval.id,
      message: 'Email drafted and queued. Awaiting HAM approval in Command Center.'
    };
  },
  
  async createDraft(input) {
    const draft = {
      id: `draft_${Date.now()}`,
      to: input.to,
      cc: input.cc || [],
      subject: input.subject,
      body: input.body,
      created_at: new Date().toISOString(),
      created_by: 'IMAN_JUNIOR',
      status: 'pending_approval'
    };
    
    // Store draft in brain
    await supabase.from("aba_memory").insert({
      memory_type: "email_draft",
      source: `iman_junior_draft_${Date.now()}`,
      content: JSON.stringify(draft),
      air_processed: false
    });
    
    return draft;
  },
  
  async queueForApproval(draftData) {
    const approval = {
      id: `approval_${Date.now()}`,
      type: 'email_send',
      ...draftData,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    // Store approval request
    await supabase.from("aba_memory").insert({
      memory_type: "approval_request",
      source: `iman_junior_approval_${Date.now()}`,
      content: JSON.stringify(approval),
      air_processed: false
    });
    
    return approval;
  },
  
  async notifyCommandCenter(approval) {
    // Log to Command Center activity feed
    await supabase.from("aba_memory").insert({
      memory_type: "command_center_notification",
      source: `cc_notify_${Date.now()}`,
      content: JSON.stringify({
        type: 'approval_needed',
        agent: 'IMAN_JUNIOR',
        approval_id: approval.id,
        summary: `Email approval needed: "${approval.subject}" to ${approval.to}`,
        created_at: new Date().toISOString()
      }),
      air_processed: false
    });
  }
};

// Router function to choose IMAN vs IMAN_JUNIOR
async function routeEmailRequest(task, hamLevel) {
  if (hamLevel >= 8) {
    // Life Partner Mode - Full IMAN
    return { agent: 'IMAN', mode: 'life_partner' };
  } else if (hamLevel >= 4) {
    // Life Assistant Mode - IMAN Junior
    return { agent: 'IMAN_JUNIOR', mode: 'life_assistant', result: await AGENT_IMAN_JUNIOR.execute({ input: task, hamLevel }) };
  } else {
    // Client Mode - Mimic only
    return { agent: 'MIMIC', mode: 'client' };
  }
}

module.exports = {
  AGENT_IMAN_JUNIOR,
  routeEmailRequest
};
