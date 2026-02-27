// ═══════════════════════════════════════════════════════════════════
// REACH v2.0 - Wired to Ababase
// Part of ABABASE architecture
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { airProcess } = require('./air-core');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));

// Rate limiting - 60 requests per minute per user
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.userId || req.ip,
  message: { error: 'Too many requests. Please slow down.' }
});
app.use('/api/', limiter);

// Supabase clients
const supabaseUrl = process.env.SUPABASE_URL || 'https://htlxjkbrstpwwtzsbyvb.supabase.co';
const supabaseAnon = process.env.SUPABASE_ANON_KEY;
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Service-role client for credential access (server-side only)
const supabaseAdmin = createClient(supabaseUrl, supabaseService);

// ═══════════════════════════════════════════════════════════════════
// MIDDLEWARE: Authenticate user from JWT
// ═══════════════════════════════════════════════════════════════════
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];
  
  // Create user-scoped client (respects RLS)
  const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  // Verify token and get user
  const { data: { user }, error } = await supabaseUser.auth.getUser();
  if (error || !user) {
    console.error('[Auth] Token validation failed:', error?.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = user.id;
  req.userEmail = user.email;
  req.supabaseUser = supabaseUser;
  
  console.log(`[Auth] User authenticated: ${user.email}`);
  next();
}

// ═══════════════════════════════════════════════════════════════════
// VALIDATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════
function validateRequest(schema) {
  return (req, res, next) => {
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];
      if (rules.required && !value) {
        return res.status(400).json({ error: `${field} is required` });
      }
      if (rules.type && value && typeof value !== rules.type) {
        return res.status(400).json({ error: `${field} must be a ${rules.type}` });
      }
      if (rules.maxLength && value?.length > rules.maxLength) {
        return res.status(400).json({ error: `${field} exceeds maximum length of ${rules.maxLength}` });
      }
    }
    next();
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN AIR ENDPOINT
// ═══════════════════════════════════════════════════════════════════
app.post('/api/air/process', 
  authenticateUser,
  validateRequest({
    message: { required: true, type: 'string', maxLength: 10000 },
    conversationId: { required: false, type: 'string' },
    channel: { required: false, type: 'string' }
  }),
  async (req, res) => {
    const { message, conversationId, channel = 'portal' } = req.body;
    const startTime = Date.now();

    try {
      console.log(`[REACH] Processing request for ${req.userEmail} via ${channel}`);

      const result = await airProcess({
        supabaseClient: req.supabaseUser,
        userId: req.userId,
        conversationId,
        message,
        channel
      });

      const processingTime = Date.now() - startTime;
      console.log(`[REACH] Request completed in ${processingTime}ms, cost: $${result.metadata.cost.total.toFixed(4)}`);

      res.json({
        success: true,
        response: result.response,
        actionsExecuted: result.actionsExecuted,
        metadata: {
          ...result.metadata,
          processingTimeMs: processingTime
        }
      });

    } catch (error) {
      console.error(`[REACH] Error:`, error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        errorType: error.name
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// STREAMING ENDPOINT (for portal real-time display)
// ═══════════════════════════════════════════════════════════════════
app.post('/api/air/stream',
  authenticateUser,
  validateRequest({
    message: { required: true, type: 'string', maxLength: 10000 }
  }),
  async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const { message, conversationId, channel = 'portal' } = req.body;

    try {
      res.write(`data: ${JSON.stringify({ type: 'start', timestamp: Date.now() })}\n\n`);

      const result = await airProcess({
        supabaseClient: req.supabaseUser,
        userId: req.userId,
        conversationId,
        message,
        channel
      });

      for (const action of result.actionsExecuted || []) {
        res.write(`data: ${JSON.stringify({ type: 'action', action })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: 'complete', response: result.response, metadata: result.metadata })}\n\n`);
      res.end();

    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// WEBHOOK ENDPOINTS (for async action confirmation)
// ═══════════════════════════════════════════════════════════════════

// Nylas webhook for email delivery confirmation
app.post('/api/webhooks/nylas', async (req, res) => {
  const { type, data } = req.body;
  
  if (type === 'message.created' || type === 'message.sent') {
    const messageId = data.id;
    
    await supabaseAdmin
      .from('action_log')
      .update({ 
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
      .eq('confirmation_id', messageId);
    
    console.log(`[Webhook] Nylas confirmed message: ${messageId}`);
  }
  
  res.status(200).json({ received: true });
});

// Twilio webhook for call status
app.post('/api/webhooks/twilio', async (req, res) => {
  const { CallSid, CallStatus } = req.body;
  
  const statusMap = {
    'completed': 'confirmed',
    'busy': 'failed',
    'no-answer': 'failed',
    'failed': 'failed',
    'canceled': 'failed'
  };
  
  const newStatus = statusMap[CallStatus] || 'pending';
  
  await supabaseAdmin
    .from('action_log')
    .update({ 
      status: newStatus,
      confirmed_at: newStatus === 'confirmed' ? new Date().toISOString() : null,
      error_message: newStatus === 'failed' ? `Call ${CallStatus}` : null
    })
    .eq('confirmation_id', CallSid);
  
  console.log(`[Webhook] Twilio call ${CallSid}: ${CallStatus} → ${newStatus}`);
  
  res.status(200).send('OK');
});

// ElevenLabs webhook for conversation events
app.post('/api/webhooks/elevenlabs', async (req, res) => {
  const { conversation_id, event_type, data } = req.body;
  
  if (event_type === 'conversation.ended') {
    await supabaseAdmin
      .from('action_log')
      .update({ 
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        response: data
      })
      .eq('confirmation_id', conversation_id);
    
    console.log(`[Webhook] ElevenLabs conversation ended: ${conversation_id}`);
  }
  
  res.status(200).json({ received: true });
});

// ═══════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[REACH] Server running on port ${PORT}`);
  console.log(`[REACH] Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app };
