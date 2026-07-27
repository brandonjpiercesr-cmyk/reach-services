// ⬡B:tests.reach.postcall:TEST:no_cold_trigger_reaches_a_human:20260726⬡
// FAILS on the old worker.js (the cold triggers are present in the source and the module
// under test does not exist). PASSES only when every post-call outbound is ruled on by a
// mind and every byte sent is a byte the mind wrote.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const organ = require('../lib/postcall.reach.decision.js');

// The retired defects are documented in comments on purpose, so every assertion about
// what the code DOES is made against code with the comments stripped out.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map(function (line) { return line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'); })
    .join('\n');
}

function worker() {
  return stripComments(fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8'));
}

test('the cold post-call trigger and the cold consent keyword list are gone from the live worker',
  function () {
    const source = worker();

    assert.doesNotMatch(source, /session\.history\.length\s*>=\s*2/,
      'a turn counter is still deciding to reach a human');
    assert.doesNotMatch(source, /const\s+saidYes\s*=/,
      'a keyword list is still standing in for consent');
    assert.doesNotMatch(source, /lower\.includes\('yes'\)/,
      'a substring test is still standing in for consent');
    assert.doesNotMatch(source, /They said no - send it anyway/,
      'the live service still sends after a refusal');

    // Both replaced paths must reach the one decision organ.
    assert.match(source, /require\('\.\/lib\/postcall\.reach\.decision\.js'\)/,
      'the worker must require the decision organ');
    assert.match(source, /postCallReach\.decidePostCallReach\(facts,\s*deliberatePostCall\)/,
      'post-call outbound must be ruled on by the mind');
    assert.match(source, /postCallReach\.decideTextConsent\(\s*[\s\S]{0,80}?deliberatePostCall\)/,
      'text consent must be ruled on by the mind');

    // Structural, not mocked: every outbound in postCallAutomation carries mind bytes.
    const start = source.indexOf('async function postCallAutomation(session) {');
    const end = source.indexOf('async function deliberatePostCall(', start);
    assert.ok(start >= 0 && end > start);
    const body = source.slice(start, end);
    const sends = body.match(/await send(?:SMS|Email)FromCall\([^;]*?\);/gs) || [];
    assert.ok(sends.length >= 3, 'expected the post-call sends to still exist, found ' + sends.length);
    for (const send of sends) {
      assert.match(send, /ruling\./,
        'an outbound in postCallAutomation does not carry ruling bytes: ' + send);
    }
    const demoStart = source.indexOf('async function trySendDemoSMS(');
    const demoEnd = source.indexOf('async function advanceDemoTouchpoints(', demoStart);
    const demo = source.slice(demoStart, demoEnd);
    assert.match(demo, /trySendDemoSMS\(session, exactMessage\)/,
      'the demo text must be handed exact authored bytes');
    assert.doesNotMatch(demo, /\+1\d{10}/,
      'a real phone number is hardcoded in the demo send path');
  });

test('with no mind reachable, a finished call produces no outbound at all',
  async function () {
    const facts = { callerName:'Sam', turnCount:9, callerTextAvailable:true,
      callerEmailAvailable:true, ownerTextAvailable:true,
      history:[{ role:'user', content:'Yes, text me everything.' }] };

    // No deliberate function at all: the exact shape of an unconfigured provider.
    const noMind = await organ.decidePostCallReach(facts, null);
    assert.equal(noMind.ok, false);
    assert.equal(noMind.reach, false);
    assert.equal(noMind.reason, 'post_call_mind_unavailable');

    // A mind that throws is also an unavailable mind, never a fallback send.
    const threw = await organ.decidePostCallReach(facts, async function () {
      throw new Error('provider down');
    });
    assert.equal(threw.ok, false);
    assert.equal(threw.reach, false);

    // A mind that answers with prose instead of a ruling sends nothing either.
    const garbled = await organ.decidePostCallReach(facts, async function () {
      return 'Sure, I would text them.';
    });
    assert.equal(garbled.ok, false);
    assert.equal(garbled.reach, false);
  });

test('a two-turn call is a fact handed to the mind, not a reason to message anyone',
  async function () {
    let seenSystem = null;
    let seenUser = null;
    const facts = { callerName:'Sam', turnCount:2, callerTextAvailable:true,
      callerEmailAvailable:false, ownerTextAvailable:true,
      history:[{ role:'assistant', content:'Hello?' }, { role:'user', content:'Wrong number.' }] };

    const quiet = await organ.decidePostCallReach(facts, async function (system, user) {
      seenSystem = system; seenUser = user;
      return JSON.stringify({ reach:false, caller_text:'', caller_email_subject:'',
        caller_email_body:'', owner_notice:'', reason:'Wrong number, nothing to follow up.' });
    });
    assert.equal(quiet.ok, true);
    assert.equal(quiet.reach, false);
    assert.equal(quiet.callerText, '');
    assert.equal(quiet.ownerNotice, '');
    assert.match(seenUser, /conversation turns recorded: 2/,
      'the turn count must reach the mind as evidence');
    assert.match(seenUser, /Wrong number\./, 'the transcript must reach the mind as evidence');
    assert.match(seenSystem, /Silence is a complete and correct answer/);

    // The identical two-turn fact can also warrant a reach. The number decides nothing.
    const loud = await organ.decidePostCallReach(facts, async function () {
      return JSON.stringify({ reach:true, caller_text:'I have the quote you asked for, want it now?',
        caller_email_subject:'', caller_email_body:'', owner_notice:'', reason:'They asked for a quote.' });
    });
    assert.equal(loud.reach, true);
    assert.equal(loud.callerText, 'I have the quote you asked for, want it now?');
  });

test('the mind cannot send down a channel it was told does not exist', async function () {
  const ruling = await organ.decidePostCallReach({
    callerName:'Sam', turnCount:6, callerTextAvailable:false,
    callerEmailAvailable:false, ownerTextAvailable:false, history:[]
  }, async function () {
    return JSON.stringify({ reach:true, caller_text:'text anyway',
      caller_email_subject:'subject anyway', caller_email_body:'body anyway',
      owner_notice:'owner anyway', reason:'wants every channel' });
  });
  assert.equal(ruling.ok, true);
  assert.equal(ruling.callerText, '');
  assert.equal(ruling.callerEmailSubject, '');
  assert.equal(ruling.callerEmailBody, '');
  assert.equal(ruling.ownerNotice, '');
});

test('consent is a ruling with words, and a no is a no', async function () {
  // The exact replies the old substring test got wrong, in both directions.
  const cases = [
    { reply:'Yes',                          consented:true  },
    { reply:'No, please do not text me.',   consented:false },
    { reply:'Yeah right, no thanks.',       consented:false },
    { reply:'Is that going to cost me?',    consented:false },
    { reply:'Not yes, no.',                 consented:false }
  ];
  for (const item of cases) {
    let seenUser = null;
    const ruling = await organ.decideTextConsent(item.reply, [], async function (system, user) {
      seenUser = user;
      return JSON.stringify({ consented:item.consented,
        text:item.consented ? 'Sending it over now, good talking with you.' : '',
        reason:'judged from the exact reply' });
    });
    assert.equal(ruling.ok, true, item.reply);
    assert.equal(ruling.consented, item.consented, item.reply);
    assert.equal(!!ruling.text, item.consented, item.reply);
    assert.ok(seenUser.includes(item.reply),
      'the exact reply must reach the mind verbatim: ' + item.reply);
  }

  // No mind, no consent, no words, no send.
  const noMind = await organ.decideTextConsent('Yes please!', [], null);
  assert.equal(noMind.ok, false);
  assert.equal(noMind.consented, false);
  assert.equal(noMind.text, '');

  // Consent without authored bytes is not a send: cold code has no sentence to fall back on.
  const wordless = await organ.decideTextConsent('Yes please!', [], async function () {
    return JSON.stringify({ consented:true, text:'', reason:'agreed' });
  });
  assert.equal(wordless.ok, false);
  assert.equal(wordless.consented, false);
  assert.equal(wordless.reason, 'consent_text_missing');
});

test('the organ itself never scans a transcript for meaning and never authors a message',
  function () {
    const source = stripComments(fs.readFileSync(
      path.join(ROOT, 'lib', 'postcall.reach.decision.js'), 'utf8'));
    assert.doesNotMatch(source, /\.includes\('(?:yes|no|sure|yeah|ok)'\)/i,
      'the organ is keyword matching intent');
    assert.doesNotMatch(source, /saidYes|saidNo/,
      'the organ carries a cold consent verdict');
    // Every string it returns to a human must come from the parsed ruling.
    assert.doesNotMatch(source, /callerText:\s*['"`]/);
    assert.doesNotMatch(source, /ownerNotice:\s*['"`]/);
    assert.doesNotMatch(source, /text:\s*['"](?!\s*['"])\S/);
  });
