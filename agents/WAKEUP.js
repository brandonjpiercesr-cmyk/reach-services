// AGENT WAKEUP - Wake Up Protocol
// Like a hotel wake up call - ABA wakes you up
// Uses law of escalation: call → text → email → repeat
// v1.0.0 - Feb 17, 2026

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://htlxjkbrstpwwtzsbyvb.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const AGENT_WAKEUP = {
  id: 'wakeup',
  full_name: 'Wake Up Protocol',
  version: '1.0.0',
  department: 'PROACTIVE',
  
  // Escalation levels
  levels: {
    gentle: {
      methods: ['text'],
      max_attempts: 2,
      interval_seconds: 300 // 5 min between
    },
    normal: {
      methods: ['call', 'text'],
      max_attempts: 3,
      interval_seconds: 180 // 3 min between
    },
    aggressive: {
      methods: ['call', 'text', 'call', 'call'],
      max_attempts: 5,
      interval_seconds: 60 // 1 min between
    },
    extreme: {
      methods: ['call', 'call', 'text', 'call', 'email', 'call'],
      max_attempts: 10,
      interval_seconds: 30 // 30 sec between
    }
  },
  
  async execute(context) {
    const { input } = context;
    
    switch(input.action) {
      case 'schedule':
        return await this.scheduleWakeup(input);
      case 'trigger':
        return await this.triggerWakeup(input);
      case 'acknowledge':
        return await this.acknowledgeWakeup(input);
      case 'cancel':
        return await this.cancelWakeup(input);
      default:
        return { error: 'Unknown action' };
    }
  },
  
  async scheduleWakeup(input) {
    const { ham_id, wake_time, level, briefing } = input;
    
    const wakeup = {
      id: `wakeup_${Date.now()}`,
      ham_id,
      wake_time, // ISO string
      level: level || 'normal',
      briefing: briefing || null,
      status: 'scheduled',
      attempts: 0,
      acknowledged: false,
      created_at: new Date().toISOString()
    };
    
    // Store in brain
    await supabase.from("aba_memory").insert({
      memory_type: "wakeup_scheduled",
      source: wakeup.id,
      content: JSON.stringify(wakeup)
    });
    
    // Schedule with pg_cron or external scheduler
    await this.scheduleCron(wakeup);
    
    return { 
      status: 'scheduled',
      wakeup_id: wakeup.id,
      wake_time: wakeup.wake_time,
      level: wakeup.level
    };
  },
  
  async triggerWakeup(input) {
    const { wakeup_id } = input;
    
    // Load wakeup config
    const { data } = await supabase
      .from("aba_memory")
      .select("content")
      .eq("source", wakeup_id)
      .single();
    
    if (!data) return { error: 'Wakeup not found' };
    
    const wakeup = JSON.parse(data.content);
    
    if (wakeup.acknowledged) {
      return { status: 'already_acknowledged' };
    }
    
    const levelConfig = this.levels[wakeup.level];
    
    if (wakeup.attempts >= levelConfig.max_attempts) {
      return { status: 'max_attempts_reached', attempts: wakeup.attempts };
    }
    
    // Get current method in rotation
    const methodIndex = wakeup.attempts % levelConfig.methods.length;
    const method = levelConfig.methods[methodIndex];
    
    // Execute wake up attempt
    const result = await this.executeWakeMethod(method, wakeup);
    
    // Update attempts
    wakeup.attempts++;
    wakeup.last_attempt = new Date().toISOString();
    wakeup.last_method = method;
    
    await supabase
      .from("aba_memory")
      .update({ content: JSON.stringify(wakeup) })
      .eq("source", wakeup_id);
    
    // Schedule next attempt if not acknowledged
    if (!wakeup.acknowledged) {
      setTimeout(() => {
        this.triggerWakeup({ wakeup_id });
      }, levelConfig.interval_seconds * 1000);
    }
    
    return {
      status: 'attempt_made',
      method,
      attempt: wakeup.attempts,
      next_in_seconds: levelConfig.interval_seconds
    };
  },
  
  async executeWakeMethod(method, wakeup) {
    const ham = await this.loadHAM(wakeup.ham_id);
    
    // Build briefing message
    let message = `Good morning! This is your ABA wake up call.`;
    if (wakeup.briefing) {
      message += ` ${wakeup.briefing}`;
    }
    message += ` Reply or answer to acknowledge.`;
    
    switch(method) {
      case 'call':
        return await this.makeCall(ham.phone, message);
      case 'text':
        return await this.sendText(ham.phone, message);
      case 'email':
        // Only send ONE email ever (as Brandon said)
        if (!wakeup.email_sent) {
          wakeup.email_sent = true;
          return await this.sendEmail(ham.email, 'ABA Wake Up Call', message);
        }
        return { skipped: 'email_already_sent' };
      default:
        return { error: 'Unknown method' };
    }
  },
  
  async makeCall(phone, message) {
    // Use Twilio or ElevenLabs for voice call
    const twilio = require('twilio')(TWILIO_SID, TWILIO_TOKEN);
    
    const call = await twilio.calls.create({
      twiml: `<Response><Say voice="alice">${message}</Say><Gather input="speech dtmf" timeout="10"><Say>Press any key or say anything to acknowledge.</Say></Gather></Response>`,
      to: phone,
      from: TWILIO_PHONE
    });
    
    return { call_sid: call.sid, status: 'calling' };
  },
  
  async sendText(phone, message) {
    const twilio = require('twilio')(TWILIO_SID, TWILIO_TOKEN);
    
    const sms = await twilio.messages.create({
      body: message,
      to: phone,
      from: TWILIO_PHONE
    });
    
    return { message_sid: sms.sid, status: 'sent' };
  },
  
  async sendEmail(email, subject, body) {
    // Route through IMAN
    const AIR = require('./AIR');
    return await AIR.deployAgent('IMAN', {
      action: 'send_email',
      to: email,
      subject,
      body
    });
  },
  
  async acknowledgeWakeup(input) {
    const { wakeup_id, method } = input;
    
    const { data } = await supabase
      .from("aba_memory")
      .select("content")
      .eq("source", wakeup_id)
      .single();
    
    if (!data) return { error: 'Wakeup not found' };
    
    const wakeup = JSON.parse(data.content);
    wakeup.acknowledged = true;
    wakeup.acknowledged_at = new Date().toISOString();
    wakeup.acknowledged_via = method;
    
    await supabase
      .from("aba_memory")
      .update({ content: JSON.stringify(wakeup) })
      .eq("source", wakeup_id);
    
    return { 
      status: 'acknowledged',
      attempts_before_ack: wakeup.attempts
    };
  },
  
  async cancelWakeup(input) {
    const { wakeup_id } = input;
    
    await supabase
      .from("aba_memory")
      .update({ 
        content: JSON.stringify({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      })
      .eq("source", wakeup_id);
    
    return { status: 'cancelled' };
  },
  
  async loadHAM(hamId) {
    const { data } = await supabase
      .from("aba_memory")
      .select("content")
      .eq("source", `dna_${hamId}`)
      .single();
    
    return data ? JSON.parse(data.content) : { phone: null, email: null };
  },
  
  async scheduleCron(wakeup) {
    // This would integrate with pg_cron or external scheduler
    // For now, store for manual pickup
    console.log(`Scheduled wakeup ${wakeup.id} for ${wakeup.wake_time}`);
  }
};

module.exports = { AGENT_WAKEUP };
