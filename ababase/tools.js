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
    
    case 'search_calendar': {
      // ⬡B:ABABASE:CALI:CALENDAR_SEARCH:v1.0:20260227⬡
      try {
        const NYLAS_API_KEY = process.env.NYLAS_API_KEY || 'nyk_v0_cqGwgMrNAnF8Lj1vQegdFjLNPIXqHqdcWlpE2FMaRivhmEqfHKYH7EBRPqM7Njad';
        const NYLAS_GRANT_ID = '41a3ace1-1c1e-47f3-b017-e5fd71ea1f3a';
        
        // Build date range
        const now = new Date();
        let startTime = input.start_date ? new Date(input.start_date) : now;
        let endTime = input.end_date ? new Date(input.end_date) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const url = `https://api.us.nylas.com/v3/grants/${NYLAS_GRANT_ID}/events?calendar_id=primary&start=${Math.floor(startTime.getTime()/1000)}&end=${Math.floor(endTime.getTime()/1000)}&limit=20`;
        
        console.log('[search_calendar] Fetching:', url.substring(0, 80));
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${NYLAS_API_KEY}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errText = await response.text();
          console.error('[search_calendar] Nylas error:', errText);
          return { status: 'error', message: 'Calendar API error: ' + errText.substring(0, 100) };
        }
        
        const data = await response.json();
        const events = data.data || [];
        
        // Filter by query if provided
        let filtered = events;
        if (input.query) {
          const q = input.query.toLowerCase();
          filtered = events.filter(e => 
            (e.title || '').toLowerCase().includes(q) ||
            (e.description || '').toLowerCase().includes(q)
          );
        }
        
        // Format events
        const formatted = filtered.map(e => ({
          id: e.id,
          title: e.title || 'No title',
          start: e.when?.start_time ? new Date(e.when.start_time * 1000).toISOString() : 'Unknown',
          end: e.when?.end_time ? new Date(e.when.end_time * 1000).toISOString() : 'Unknown',
          location: e.location || null,
          attendees: (e.participants || []).map(p => p.email).join(', '),
          status: e.status
        }));
        
        return {
          status: 'success',
          count: formatted.length,
          date_range: {
            start: startTime.toISOString(),
            end: endTime.toISOString()
          },
          events: formatted
        };
      } catch (e) {
        console.error('[search_calendar] Error:', e.message);
        return { status: 'error', message: e.message };
      }
    }
    
    case 'create_event': {
      // ⬡B:ABABASE:CALI:CREATE_EVENT:v1.0:20260227⬡
      try {
        const NYLAS_API_KEY = process.env.NYLAS_API_KEY || 'nyk_v0_cqGwgMrNAnF8Lj1vQegdFjLNPIXqHqdcWlpE2FMaRivhmEqfHKYH7EBRPqM7Njad';
        const NYLAS_GRANT_ID = '41a3ace1-1c1e-47f3-b017-e5fd71ea1f3a';
        
        const eventData = {
          title: input.title,
          when: {
            start_time: Math.floor(new Date(input.start_time).getTime() / 1000),
            end_time: Math.floor(new Date(input.end_time).getTime() / 1000)
          },
          location: input.location || undefined,
          description: input.description || undefined,
          participants: (input.attendees || []).map(email => ({ email }))
        };
        
        const response = await fetch(`https://api.us.nylas.com/v3/grants/${NYLAS_GRANT_ID}/events?calendar_id=primary`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NYLAS_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventData)
        });
        
        if (!response.ok) {
          const errText = await response.text();
          return { status: 'error', message: 'Failed to create event: ' + errText.substring(0, 100) };
        }
        
        const created = await response.json();
        return {
          status: 'success',
          event_id: created.data?.id,
          title: input.title,
          start: input.start_time,
          end: input.end_time,
          confirmation: `Created event "${input.title}"`
        };
      } catch (e) {
        console.error('[create_event] Error:', e.message);
        return { status: 'error', message: e.message };
      }
    }
    
    case 'get_sports_scores': {
      // ⬡B:ABABASE:PLAY:SPORTS_SCORES:v1.0:20260227⬡
      // Uses ESPN API (free, no auth required)
      try {
        const league = input.league?.toLowerCase() || 'nba';
        const team = input.team?.toLowerCase();
        
        // ESPN API endpoints
        const espnMap = {
          'nba': 'basketball/nba',
          'nfl': 'football/nfl',
          'mlb': 'baseball/mlb',
          'nhl': 'hockey/nhl',
          'mls': 'soccer/usa.1',
          'wnba': 'basketball/wnba',
          'ncaafb': 'football/college-football',
          'ncaamb': 'basketball/mens-college-basketball'
        };
        
        const espnPath = espnMap[league] || 'basketball/nba';
        const url = `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/scoreboard`;
        
        console.log('[get_sports_scores] Fetching:', url);
        
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
          return { status: 'error', message: 'ESPN API error' };
        }
        
        const data = await response.json();
        const events = data.events || [];
        
        // Filter by team if provided
        let filtered = events;
        if (team) {
          filtered = events.filter(e => {
            const teams = e.competitions?.[0]?.competitors || [];
            return teams.some(t => 
              (t.team?.name || '').toLowerCase().includes(team) ||
              (t.team?.displayName || '').toLowerCase().includes(team)
            );
          });
        }
        
        // Format scores
        const scores = filtered.slice(0, 10).map(e => {
          const comp = e.competitions?.[0];
          const teams = comp?.competitors || [];
          const home = teams.find(t => t.homeAway === 'home');
          const away = teams.find(t => t.homeAway === 'away');
          
          return {
            id: e.id,
            name: e.name || 'Unknown',
            status: comp?.status?.type?.description || 'Unknown',
            home_team: home?.team?.displayName || 'Home',
            home_score: home?.score || '0',
            away_team: away?.team?.displayName || 'Away',
            away_score: away?.score || '0',
            venue: comp?.venue?.fullName || null,
            date: e.date
          };
        });
        
        return {
          status: 'success',
          league: league.toUpperCase(),
          count: scores.length,
          games: scores
        };
      } catch (e) {
        console.error('[get_sports_scores] Error:', e.message);
        return { status: 'error', message: e.message };
      }
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
