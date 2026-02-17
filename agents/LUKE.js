// ABA AGENT LUKE (Listening Utility Knowledge Extractor)
// Extracts tasks, action items, and key info from transcripts
// v1.0.0 - Feb 17, 2026

const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://htlxjkbrstpwwtzsbyvb.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const LUKE_SYSTEM = `You are ABA AGENT LUKE (Listening Utility Knowledge Extractor).
Your job is to extract actionable items from transcripts.

For each transcript, identify:
1. TASKS - Things that need to be done
2. DECISIONS - Choices that were made
3. FOLLOW-UPS - Items needing future attention
4. KEY FACTS - Important information to remember

For each TASK, extract:
- task_description: What needs to be done (be specific)
- owner: Who should do it (person name or agent name like "ABA", "AGENT IMAN", etc)
- priority: "low", "medium", "high", or "asap"
- auto_execute: true if ABA/agents should do it automatically, false if human needed
- target_agent: Which ABA agent handles this (or null if human task)
- deadline: If mentioned, ISO date string

Return JSON format:
{
  "tasks": [...],
  "decisions": [...],
  "follow_ups": [...],
  "key_facts": [...],
  "summary": "Brief 1-2 sentence summary"
}`;

async function extractFromTranscript(transcript, source = "unknown") {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4000,
      system: LUKE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Extract all actionable items from this transcript:\n\n${transcript}\n\nSource: ${source}`
        }
      ]
    });

    const content = response.content[0].text;
    
    // Parse JSON from response
    let extraction;
    try {
      // Find JSON in response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extraction = JSON.parse(jsonMatch[0]);
      } else {
        extraction = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("LUKE: Failed to parse extraction:", parseError);
      extraction = {
        tasks: [],
        decisions: [],
        follow_ups: [],
        key_facts: [],
        summary: "Extraction parsing failed",
        raw: content
      };
    }

    // Store extraction in brain
    await supabase.from("aba_memory").insert({
      memory_type: "luke_extraction",
      source: `luke_extract_${Date.now()}`,
      content: JSON.stringify({
        source_transcript: source,
        extraction,
        extracted_at: new Date().toISOString()
      }),
      air_processed: false
    });

    // Insert tasks into pending_tasks if table exists
    if (extraction.tasks && extraction.tasks.length > 0) {
      for (const task of extraction.tasks) {
        await supabase.from("aba_memory").insert({
          memory_type: "pending_task",
          source: `luke_task_${Date.now()}`,
          content: JSON.stringify({
            ...task,
            source_transcript: source,
            status: "pending",
            created_by: "AGENT_LUKE"
          }),
          air_processed: false
        });
      }
    }

    return extraction;
  } catch (error) {
    console.error("LUKE extraction error:", error);
    throw error;
  }
}

module.exports = {
  extractFromTranscript,
  LUKE_SYSTEM
};
