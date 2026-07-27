// ⬡B:tests.reach.sms_send:TEST:an_anonymous_twilio_door_is_closed:20260727⬡
// FAILS on the old worker.js: POST /api/sms/send took { to, message } from any request body
// and sent a real text from the estate's Twilio number, to any number on earth, for anyone
// who knew the URL. No token, no session, no council, no cycle, no kill switch. That is cold
// code deciding to reach a human, the exact GRANDDADDY 911 violation this repo's PR #6 exists
// to close, and it sat one file over from where PR #6 closed the last one.
//
// This test reads the real worker source with comments stripped (the same method as
// tests/postcall.cold.trigger.test.js), so an assertion about what the code DOES is never
// fooled by a comment that quotes the old shape.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

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

// Isolate the /api/sms/send handler body so a guard elsewhere in the file cannot make this
// test pass for the wrong door.
function smsSendHandler(src) {
  const start = src.indexOf("path === '/api/sms/send'");
  assert.ok(start !== -1, "the /api/sms/send handler must exist to be tested");
  // up to the next endpoint dispatch
  const rest = src.slice(start);
  const next = rest.indexOf("if (path ===", 10);
  return next === -1 ? rest : rest.slice(0, next);
}

test('the SMS send door refuses before it reads a body, and refuses when no key is configured', function () {
  const h = smsSendHandler(worker());

  // The authorization decision must happen BEFORE the Twilio send is assembled. If the
  // refusal appears after the fetch to Twilio, the text already went out.
  const authIdx = h.indexOf('sms_send_authorization_required');
  const sendIdx = h.indexOf('api.twilio.com');
  assert.ok(authIdx !== -1, 'the door must be able to refuse with sms_send_authorization_required');
  assert.ok(sendIdx !== -1, 'precondition: this is still the Twilio send handler');
  assert.ok(authIdx < sendIdx, 'the refusal must be decided before the Twilio send is built');

  // Default-shut: an unset key must refuse, so the hole is closed on a world that sets nothing.
  assert.match(h, /!\s*REACH_INTERNAL_KEY\s*\|\|/,
    'an unset REACH_INTERNAL_KEY must refuse, never default open');
  assert.match(h, /x-reach-internal-key/,
    'the caller must present a header credential, not a value from the body it also controls');
});

test('the SMS send door does not authorize off anything the caller supplies in the body', function () {
  const h = smsSendHandler(worker());
  // The credential is compared to an env value. It must not be read from parseBody/body.
  const guard = h.slice(0, h.indexOf('sms_send_authorization_required') + 40);
  assert.doesNotMatch(guard, /parseBody|body\./,
    'the authorization must be settled from the header and env before the body is ever parsed');
});
