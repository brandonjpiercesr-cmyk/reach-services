// ═══════════════════════════════════════════════════════════════════
// TOOLS v2.0
// Tool definitions and execution for AIR
// Part of ABABASE architecture
// ═══════════════════════════════════════════════════════════════════

const TOOL_DEFINITIONS = [
  {
    name: 'get_contact',
    description: 'Look up a contact by name. Returns phone, email, and relationship info. Use EXACT name matching.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Contact name to look up (exact match)'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'send_email',
    description: 'Send an email via Nylas. Use HTML formatting with <p> and <br> tags. Returns message_id as confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body in HTML format (use <p> and <br> tags)'
        }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'dial_phone',
    description: 'Initiate an outbound phone call via ElevenLabs. Returns conversation_id as confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'Phone number to call (E.164 format: +1XXXXXXXXXX)'
        },
        first_message: {
          type: 'string',
          description: 'Opening message when call connects'
        },
        context: {
          type: 'string',
          description: 'Context for the call (what the call is about)'
        }
      },
      required: ['phone_number', 'first_message']
    }
  },
  {
    name: 'send_sms',
    description: 'Send an SMS message via Twilio. Returns message_sid as confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Phone number to text (E.164 format)'
        },
        body: {
          type: 'string',
          description: 'SMS message body (max 1600 characters)'
        }
      },
      required: ['to', 'body']
    }
  },
  {
    name: 'search_calendar',
    description: 'Search calendar events by date range or keyword.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term (event title, attendee, etc.)'
        },
        start_date: {
          type: 'string',
          description: 'Start date (ISO format)'
        },
        end_date: {
          type: 'string',
          description: 'End date (ISO format)'
        }
      },
      required: []
    }
  },
  {
    name: 'create_event',
    description: 'Create a calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Event title'
        },
        start_time: {
          type: 'string',
          description: 'Start time (ISO format)'
        },
        end_time: {
          type: 'string',
          description: 'End time (ISO format)'
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of attendee email addresses'
        },
        location: {
          type: 'string',
          description: 'Event location or video link'
        },
        description: {
          type: 'string',
          description: 'Event description'
        }
      },
      required: ['title', 'start_time', 'end_time']
    }
  },
  {
    name: 'get_sports_scores',
    description: 'Get live sports scores and standings.',
    input_schema: {
      type: 'object',
      properties: {
        league: {
          type: 'string',
          enum: ['nba', 'nfl', 'mlb', 'nhl', 'mls', 'wnba', 'ncaafb', 'ncaamb'],
          description: 'Sports league'
        },
        team: {
          type: 'string',
          description: 'Team name (optional, for filtering)'
        }
      },
      required: ['league']
    }
  },
  {
    name: 'save_memory',
    description: 'Save information to user context for future reference.',
    input_schema: {
      type: 'object',
      properties: {
        context_type: {
          type: 'string',
          enum: ['preferences', 'notes', 'project', 'personal'],
          description: 'Type of memory'
        },
        label: {
          type: 'string',
          description: 'Short label for this memory'
        },
        content: {
          type: 'string',
          description: 'Content to remember'
        },
        priority: {
          type: 'number',
          description: 'Priority 1-10 (higher = more important)'
        }
      },
      required: ['context_type', 'label', 'content']
    }
  },
  {
    name: 'search_brain',
    description: 'Search the ABA brain (aba_memory) for stored information. Use this to find checkpoints, configs, HAM identities, past decisions, and any stored context. Returns matching records.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query - keywords to find in brain content'
        },
        memory_type: {
          type: 'string',
          description: 'Optional: Filter by memory type (checkpoint, ham_identity, system, milestone, etc.)'
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 10)'
        }
      },
      required: ['query']
    }
  }
];

// Tool execution function
async function executeToolCall(toolName, input, context) {
  const { userId, supabaseClient, channel } = context;
  
  console.log(`[Tools] Executing ${toolName} with input:`, JSON.stringify(input).substring(0, 200));
  
  switch (toolName) {
    case 'get_contact': {
      // Use the new contacts table with exact matching
      const { data, error } = await supabaseClient.rpc('get_contact', {
        p_user_id: userId,
        p_name: input.name
      });
      
      if (error) {
        return { error: error.message, status: 'failed' };
      }
      
      if (!data || data.length === 0) {
        return { 
          error: `No contact found with name "${input.name}"`, 
          status: 'not_found',
          suggestion: 'Check the contacts directory for available names'
        };
      }
      
      const contact = data[0];
      return {
        status: 'success',
        contact: {
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          relationship: contact.relationship,
          trust_level: `T${contact.trust_level}`
        }
      };
    }
    
    case 'send_email': {
      // Nylas email sending
      const nylasApiKey = process.env.NYLAS_API_KEY;
      const nylasGrantId = process.env.NYLAS_GRANT_ID;
      
      if (!nylasApiKey || !nylasGrantId) {
        return { error: 'Nylas integration not configured', status: 'failed' };
      }
      
      try {
        const response = await fetch(`https://api.us.nylas.com/v3/grants/${nylasGrantId}/messages/send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${nylasApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: [{ email: input.to }],
            subject: input.subject,
            body: input.body
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          return { error: result.message || 'Failed to send email', status: 'failed' };
        }
        
        return {
          status: 'success',
          message_id: result.data?.id,
          confirmation: `Email sent to ${input.to}`
        };
      } catch (err) {
        return { error: err.message, status: 'failed' };
      }
    }
    
    case 'dial_phone': {
      // ElevenLabs outbound call via Twilio integration
      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      // These are hardcoded agent configs from REACH
      const AGENT_ID = 'agent_0601khe2q0gben08ws34bzf7a0sa';
      const PHONE_NUMBER_ID = 'phnum_0001khe3q3nyec1bv04mk2m048v8';
      
      if (!elevenLabsApiKey) {
        return { error: 'ElevenLabs integration not configured', status: 'failed' };
      }
      
      try {
        const requestBody = {
          agent_id: AGENT_ID,
          agent_phone_number_id: PHONE_NUMBER_ID,
          to_number: input.phone_number
        };
        
        if (input.first_message) {
          requestBody.first_message = input.first_message;
        }
        
        const response = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          return { error: result.message || result.detail || 'Failed to initiate call', status: 'failed' };
        }
        
        return {
          status: 'success',
          conversation_id: result.conversation_id,
          call_sid: result.callSid,
          confirmation: `Call initiated to ${input.phone_number}`
        };
      } catch (err) {
        return { error: err.message, status: 'failed' };
      }
    }
    
    case 'send_sms': {
      // Twilio SMS
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
      
      if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
        return { error: 'Twilio integration not configured', status: 'failed' };
      }
      
      try {
        const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: input.to,
            From: twilioFromNumber,
            Body: input.body
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          return { error: result.message || 'Failed to send SMS', status: 'failed' };
        }
        
        return {
          status: 'success',
          message_sid: result.sid,
          confirmation: `SMS sent to ${input.to}`
        };
      } catch (err) {
        return { error: err.message, status: 'failed' };
      }
    }
    
    case 'save_memory': {
      // Save to user_contexts table
      const { data, error } = await supabaseClient
        .from('user_contexts')
        .upsert({
          user_id: userId,
          context_type: input.context_type,
          label: input.label,
          content: input.content,
          priority: input.priority || 5,
          is_protected: false
        }, {
          onConflict: 'user_id,context_type,label'
        })
        .select()
        .single();
      
      if (error) {
        return { error: error.message, status: 'failed' };
      }
      
      return {
        status: 'success',
        memory_id: data.id,
        confirmation: `Saved "${input.label}" to ${input.context_type}`
      };
    }
    
    case 'search_calendar':
    case 'create_event':
    case 'get_sports_scores': {
      // Placeholder for future implementation
      return {
        status: 'not_implemented',
        message: `${toolName} is not yet implemented. Coming soon.`
      };
    }
    
    case 'search_brain': {
      // ⬡B:ABABASE:BRAIN_SEARCH:v2.0:INDEXED:20260227⬡
      // Search aba_memory using INDEXED fields only
      // NEVER ilike on content (full table scan on 238K rows = timeout)
      try {
        const query = (input.query || '').replace(/['"]/g, '');
        const memoryType = input.memory_type;
        const limit = input.limit || 10;
        
        let url = `https://htlxjkbrstpwwtzsbyvb.supabase.co/rest/v1/aba_memory?select=source,memory_type,content,importance,created_at`;
        
        // memory_type filter (exact match, uses index)
        if (memoryType) {
          url += `&memory_type=eq.${memoryType}`;
        }
        
        // source ILIKE (uses GIN trigram index after SQL runs)
        if (query) {
          url += `&source=ilike.*${query}*`;
        }
        
        url += `&order=importance.desc,created_at.desc&limit=${limit}`;
        
        console.log('[search_brain v2] Indexed query:', url.substring(0, 150));
        
        const response = await fetch(url, {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MzI4MjEsImV4cCI6MjA4NjEwODgyMX0.MOgNYkezWpgxTO3ZHd0omZ0WLJOOR-tL7hONXWG9eBw',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MzI4MjEsImV4cCI6MjA4NjEwODgyMX0.MOgNYkezWpgxTO3ZHd0omZ0WLJOOR-tL7hONXWG9eBw'
          }
        });
        
        if (!response.ok) {
          const errText = await response.text();
          console.error('[search_brain] Error:', errText);
          return { error: 'Brain search failed', status: 'error' };
        }
        
        const results = await response.json();
        
        if (!results || results.length === 0) {
          return {
            status: 'no_results',
            message: `No brain records found matching "${query}"` + (memoryType ? ` with type ${memoryType}` : ''),
            results: []
          };
        }
        
        const formatted = results.map(r => ({
          source: r.source,
          type: r.memory_type,
          importance: r.importance,
          content: typeof r.content === 'string' ? r.content.substring(0, 500) : JSON.stringify(r.content).substring(0, 500),
          created: r.created_at
        }));
        
        return {
          status: 'success',
          count: formatted.length,
          results: formatted
        };
      } catch (e) {
        console.error('[search_brain] Error:', e.message);
        return { error: e.message, status: 'error' };
      }
    }
    
    default:
      return {
        status: 'unknown_tool',
        error: `Unknown tool: ${toolName}`
      };
  }
}

module.exports = { TOOL_DEFINITIONS, executeToolCall };
