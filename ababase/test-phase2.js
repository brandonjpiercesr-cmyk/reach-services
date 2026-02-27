// ═══════════════════════════════════════════════════════════════════
// PHASE 2 TEST: Context Assembly + Claude API
// ═══════════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');
const { ContextAssembler, estimateTokens } = require('./context-assembler');
const Anthropic = require('@anthropic-ai/sdk');

const SUPABASE_URL = 'https://htlxjkbrstpwwtzsbyvb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDUzMjgyMSwiZXhwIjoyMDg2MTA4ODIxfQ.G55zXnfanoUxRAoaYz-tD9FDJ53xHH-pRgDrKss_Iqo';
const BRANDON_USER_ID = '7fc4aa7a-a8e6-4b75-b066-5cc5d4ff43cc';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-api03-YOUR_KEY_HERE';

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('PHASE 2 TESTS: Context Assembly + Claude API');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const assembler = new ContextAssembler(supabase, BRANDON_USER_ID);

  // ═══════════════════════════════════════════════════════════════════
  // TEST 1: Context Assembly
  // ═══════════════════════════════════════════════════════════════════
  console.log('TEST 1: Context Assembly');
  console.log('─────────────────────────────────────────────────────────────────────');
  
  const context = await assembler.assemble({
    agentNames: ['AIR', 'IMAN', 'VARA'],
    currentMessage: 'What is Brandon\'s phone number?',
    channel: 'portal'
  });

  console.log('✅ Context assembled successfully');
  console.log(`   - Estimated tokens: ${context.metadata.estimatedTokens}`);
  console.log(`   - Token budget: ${context.metadata.tokenBudget}`);
  console.log(`   - Utilization: ${context.metadata.utilizationPercent}%`);
  console.log(`   - Agents loaded: ${context.metadata.agentsLoaded.join(', ')}`);
  console.log(`   - Contacts loaded: ${context.metadata.contactCount}`);
  console.log(`   - Contexts loaded: ${context.metadata.contextCount}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════
  // TEST 2: Verify Contacts in System Prompt
  // ═══════════════════════════════════════════════════════════════════
  console.log('TEST 2: Contacts in System Prompt');
  console.log('─────────────────────────────────────────────────────────────────────');
  
  const hasContacts = context.systemPrompt.includes('CONTACTS DIRECTORY');
  const hasBrandon = context.systemPrompt.includes('Brandon') && context.systemPrompt.includes('+13363898116');
  const hasBJ = context.systemPrompt.includes('BJ') && context.systemPrompt.includes('+19803958662');
  const hasEric = context.systemPrompt.includes('Eric') && context.systemPrompt.includes('+13236007676');
  
  console.log(`✅ Contacts directory present: ${hasContacts}`);
  console.log(`✅ Brandon with correct phone: ${hasBrandon}`);
  console.log(`✅ BJ with correct phone: ${hasBJ}`);
  console.log(`✅ Eric with correct phone: ${hasEric}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════
  // TEST 3: Token Counting
  // ═══════════════════════════════════════════════════════════════════
  console.log('TEST 3: Token Counting');
  console.log('─────────────────────────────────────────────────────────────────────');
  
  const systemTokens = estimateTokens(context.systemPrompt);
  const messageTokens = context.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  
  console.log(`   - System prompt tokens: ${systemTokens}`);
  console.log(`   - Message tokens: ${messageTokens}`);
  console.log(`   - Total: ${systemTokens + messageTokens}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════
  // TEST 4: Claude API Call (Contact Lookup Test)
  // ═══════════════════════════════════════════════════════════════════
  console.log('TEST 4: Claude API Call - Contact Lookup');
  console.log('─────────────────────────────────────────────────────────────────────');

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      system: context.systemPrompt,
      messages: context.messages
    });

    console.log('✅ Claude API call successful');
    console.log(`   - Model: claude-sonnet-4-5-20250929`);
    console.log(`   - Input tokens: ${response.usage.input_tokens}`);
    console.log(`   - Output tokens: ${response.usage.output_tokens}`);
    console.log(`   - Stop reason: ${response.stop_reason}`);
    console.log('');
    console.log('📝 Response:');
    console.log('─────────────────────────────────────────────────────────────────────');
    console.log(response.content[0].text);
    console.log('─────────────────────────────────────────────────────────────────────');

    // Verify correct phone number in response
    const correctPhone = response.content[0].text.includes('+13363898116') || response.content[0].text.includes('336-389-8116') || response.content[0].text.includes('3363898116');
    const wrongPhone = response.content[0].text.includes('+19803958662') || response.content[0].text.includes('980-395-8662');
    
    console.log('');
    if (correctPhone && !wrongPhone) {
      console.log('✅ BJ/BRANDON BUG FIXED - Returned correct phone!');
    } else if (wrongPhone) {
      console.log('❌ BJ/BRANDON BUG STILL EXISTS - Returned BJ\'s phone!');
    } else {
      console.log('⚠️ Phone not found in response - manual verification needed');
    }

  } catch (error) {
    console.log('❌ Claude API call failed:', error.message);
    if (error.message.includes('authentication') || error.message.includes('401')) {
      console.log('   (API key may be expired or invalid)');
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('PHASE 2 TESTS COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════');
}

runTests().catch(console.error);
