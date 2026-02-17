// ABA AGENT EXEC (Execution Controller)
// Dispatches auto-executable tasks to appropriate agents
// v1.0.0 - Feb 17, 2026

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://htlxjkbrstpwwtzsbyvb.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Agent routing map - which agent handles what type of task
const AGENT_ROUTING = {
  email: "IMAN",
  send_email: "IMAN",
  gmail: "IMAN",
  calendar: "TEMPO",
  schedule: "TEMPO",
  meeting: "TEMPO",
  reminder: "DAWN",
  follow_up: "DAWN",
  job_search: "CLAUDETTE",
  job_application: "CLAUDETTE",
  research: "SAGE",
  search: "SAGE",
  voice: "VARA",
  speak: "VARA",
  transcript: "MARS",
  meeting_notes: "MARS",
  document: "SCRIBE",
  write: "SCRIBE",
  budget: "BUDGET",
  money: "BUDGET",
  finances: "BUDGET"
};

// Find the right agent for a task
function routeTask(task) {
  // If target_agent already specified, use it
  if (task.target_agent) {
    return task.target_agent.toUpperCase();
  }

  // Try to match keywords in task description
  const desc = task.task_description.toLowerCase();
  
  for (const [keyword, agent] of Object.entries(AGENT_ROUTING)) {
    if (desc.includes(keyword)) {
      return agent;
    }
  }

  // Default to AIR for routing decision
  return "AIR";
}

// Execute a single task
async function executeTask(task) {
  const targetAgent = routeTask(task);
  
  const execution = {
    task_id: task.id || `task_${Date.now()}`,
    target_agent: targetAgent,
    status: "dispatched",
    dispatched_at: new Date().toISOString()
  };

  // Log the dispatch to brain
  await supabase.from("aba_memory").insert({
    memory_type: "exec_dispatch",
    source: `exec_dispatch_${Date.now()}`,
    content: JSON.stringify({
      task,
      routed_to: targetAgent,
      dispatched_at: execution.dispatched_at
    }),
    air_processed: false
  });

  // TODO: Actually call the agent endpoint when implemented
  // For now, mark as dispatched and return routing info
  
  return execution;
}

// Process all pending auto-executable tasks
async function processPendingTasks() {
  try {
    // Get all pending tasks that are auto-executable
    const { data: pendingTasks, error } = await supabase
      .from("aba_memory")
      .select("*")
      .eq("memory_type", "pending_task")
      .eq("air_processed", false)
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) {
      console.error("EXEC: Error fetching pending tasks:", error);
      return { executed: 0, errors: [error.message] };
    }

    if (!pendingTasks || pendingTasks.length === 0) {
      return { executed: 0, message: "No pending tasks" };
    }

    const results = [];
    
    for (const taskRow of pendingTasks) {
      try {
        const taskData = JSON.parse(taskRow.content);
        
        // Only auto-execute if flagged
        if (taskData.auto_execute) {
          const execution = await executeTask(taskData);
          results.push({ success: true, ...execution });
          
          // Mark as processed
          await supabase
            .from("aba_memory")
            .update({ air_processed: true })
            .eq("id", taskRow.id);
        } else {
          results.push({
            success: false,
            task_id: taskRow.id,
            reason: "Not auto-executable - requires human"
          });
        }
      } catch (taskError) {
        results.push({
          success: false,
          task_id: taskRow.id,
          error: taskError.message
        });
      }
    }

    return {
      executed: results.filter(r => r.success).length,
      total: pendingTasks.length,
      results
    };
  } catch (error) {
    console.error("EXEC processPendingTasks error:", error);
    throw error;
  }
}

module.exports = {
  executeTask,
  processPendingTasks,
  routeTask,
  AGENT_ROUTING
};
