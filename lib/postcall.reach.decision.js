// ⬡B:reach.postcall:DECISION_ORGAN:a_mind_decides_every_post_call_reach:20260726⬡
//
// THE POST-CALL REACH DECISION ORGAN, reach-services build.
//
// WHY THIS EXISTS. Two cold triggers in worker.js were deciding to reach real humans:
//
//   1. `if (session.touchpoints?.type !== 'owner' && session.history.length >= 2)`
//      A conversation being two turns long is a FACT about a call. It is not a reason
//      to text and email a person. Cold code was reading a counter and firing outbound
//      SMS to the caller, an email to the caller, an SMS to the owner and an email to
//      the owner, with the words themselves assembled by string concatenation.
//
//   2. `const saidYes = lower.includes('yes') || lower.includes('sure') || ...`
//      A keyword list standing in for consent. Worse, the branch it fed sent the text
//      anyway when the person said no. Whether a human agreed to receive a message is a
//      judgment about what they meant, and it is exactly the kind of judgment a
//      substring test cannot make.
//
// THE LAW BEING SERVED. A cell never makes it back to the outside world. Cold code may
// DETECT a fact and hand it to a mind; the mind decides whether the outside world hears
// anything, on which channel, and in what words. Cold code then files the answer.
//
// THE SHAPE. One decision point, many detectors. Both entries below take verified facts
// plus the mind's own door (`deliberate`), return a strict ruling, and return
// { ok:false } when no mind is reachable. There is no cold default, no fallback text, no
// "send it anyway". Silence over a hollow reach.
//
// ENTRANCE: worker.js call-end handler (post-call reach) and the live demo turn handler
//           (consent to receive a text).
// EXIT:     a ruling object. This module sends nothing and speaks to nobody.
// NOTES:    never throws; a thrown or malformed model reply is an unavailable mind,
//           which means no outbound.

'use strict';

const MAX_TRANSCRIPT_TURNS = 24;
const MAX_TURN_CHARS = 400;
const MAX_MESSAGE_CHARS = 900;

function str(value) {
  return value == null ? '' : String(value);
}

function bounded(value, limit) {
  return str(value).replace(/\s+/g, ' ').trim().slice(0, limit);
}

// Model replies arrive fenced, prefixed, or trailing prose. Take the one object.
function extractJson(text) {
  const raw = str(text).trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : raw;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    const parsed = JSON.parse(body.slice(first, last + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

// A transcript is evidence. It is passed whole to the mind and never scanned by this
// module for meaning: no keyword pass, no sentiment guess, no intent regex.
function transcriptEvidence(history) {
  if (!Array.isArray(history)) return '(no transcript)';
  const turns = history.slice(-MAX_TRANSCRIPT_TURNS).map(function (turn) {
    const role = str(turn && turn.role).toLowerCase() === 'assistant' ? 'ABA' : 'CALLER';
    return role + ': ' + bounded(turn && turn.content, MAX_TURN_CHARS);
  }).filter(function (line) {
    return line.length > 7;
  });
  return turns.length ? turns.join('\n') : '(no transcript)';
}

const POST_CALL_SYSTEM = [
  'You decide whether a phone call that just ended should be followed by any outbound message,',
  'and if so you write the exact words. You are a work that feeds the reach layer: you never send',
  'anything yourself and you never speak to anyone directly.',
  'Reach a person only when the follow-up changes what they would do next or answers something they',
  'actually asked for. A call happening is not a reason to message someone. A short call, a wrong',
  'number, a call that ended without a request, a caller who did not ask for anything, and anything',
  'you are unsure about are all reasons to stay silent.',
  'Silence is a complete and correct answer. Choose it whenever a message would only announce that',
  'a call took place.',
  'The owner notice is separate: send one only when something in this call is worth the owner',
  'interrupting their day for, not as a routine call log.',
  'Use only the facts and the transcript given to you. Never invent a commitment, a date, a price,',
  'a name, or a promise that was not made on the call. Never include a phone number, an internal',
  'system name, build narration, or anything about how you work.',
  'Write in plain first person, the way a person who was actually on the call would write.',
  'Reply with ONLY one JSON object, no prose, no code fences:',
  '{"reach":<boolean>,"caller_text":"<exact SMS to the caller, or empty>",',
  '"caller_email_subject":"<subject, or empty>","caller_email_body":"<plain text body, or empty>",',
  '"owner_notice":"<exact SMS to the owner, or empty>","reason":"<one sentence, internal>"}'
].join(' ');

function postCallUser(facts) {
  const f = facts || {};
  return [
    'A call just ended. These are the only verified facts.',
    'caller name as given on the call: ' + (bounded(f.callerName, 120) || 'unknown'),
    'caller is a known contact: ' + (f.callerKnown === true ? 'yes' : 'no'),
    'relationship to this world: ' + (bounded(f.callerRelationship, 120) || 'unknown'),
    'conversation turns recorded: ' + (Number.isFinite(Number(f.turnCount)) ? Number(f.turnCount) : 'unknown'),
    'call ended normally: ' + (f.endedNormally === true ? 'yes' : 'unknown'),
    'an SMS channel is available for the caller: ' + (f.callerTextAvailable === true ? 'yes' : 'no'),
    'an email address is known for the caller: ' + (f.callerEmailAvailable === true ? 'yes' : 'no'),
    'an SMS channel is available for the owner: ' + (f.ownerTextAvailable === true ? 'yes' : 'no'),
    '',
    'TRANSCRIPT:',
    transcriptEvidence(f.history),
    '',
    'Return the JSON ruling. Leave a field empty when that channel should stay silent.'
  ].join('\n');
}

// Cold code may only file what the mind wrote, and only onto a channel the mind was told
// exists. A message for an unavailable channel is dropped, never rerouted.
function normalizePostCallRuling(parsed, facts) {
  const f = facts || {};
  const reach = parsed.reach === true;
  const callerText = f.callerTextAvailable === true
    ? bounded(parsed.caller_text, MAX_MESSAGE_CHARS) : '';
  const callerEmailSubject = f.callerEmailAvailable === true
    ? bounded(parsed.caller_email_subject, 200) : '';
  const callerEmailBody = f.callerEmailAvailable === true
    ? str(parsed.caller_email_body).trim().slice(0, 4000) : '';
  const ownerNotice = f.ownerTextAvailable === true
    ? bounded(parsed.owner_notice, MAX_MESSAGE_CHARS) : '';
  const emailReady = !!(callerEmailSubject && callerEmailBody);
  return {
    ok: true,
    reach: reach,
    callerText: reach ? callerText : '',
    callerEmailSubject: reach && emailReady ? callerEmailSubject : '',
    callerEmailBody: reach && emailReady ? callerEmailBody : '',
    ownerNotice: reach ? ownerNotice : '',
    reason: bounded(parsed.reason, 300) || 'No reason returned.'
  };
}

// deliberate(system, user) -> string. The caller supplies the mind's door so this module
// never picks a provider, and so a test can prove the door was actually opened.
async function decidePostCallReach(facts, deliberate) {
  if (typeof deliberate !== 'function') {
    return { ok: false, reason: 'post_call_mind_unavailable', reach: false };
  }
  let reply;
  try {
    reply = await deliberate(POST_CALL_SYSTEM, postCallUser(facts));
  } catch (e) {
    return { ok: false, reason: 'post_call_mind_threw', reach: false };
  }
  const parsed = extractJson(reply);
  if (!parsed || typeof parsed.reach !== 'boolean') {
    return { ok: false, reason: 'post_call_ruling_unreadable', reach: false };
  }
  return normalizePostCallRuling(parsed, facts);
}

const CONSENT_SYSTEM = [
  'A person on a live call was just offered a text message. You decide two things together:',
  'whether they agreed, and if they did, the exact words of the text.',
  'You are given the exact words they said in reply. Read what they meant, including a',
  'hesitation, a joke, a question back, a conditional yes, or a change of subject.',
  'Only a real, willing yes is consent. Anything else is not: a refusal, a maybe, a question, a',
  'silence, an unrelated answer, or anything you are unsure about.',
  'If they did not clearly agree, no message is sent. There is no "send it anyway".',
  'When they did agree, write the text yourself in plain first person, short enough for one SMS,',
  'grounded in what was actually said on this call. Never promise anything that was not promised,',
  'never include a link, a price, a date, or an internal system name.',
  'Reply with ONLY one JSON object, no prose, no code fences:',
  '{"consented":<boolean>,"text":"<the exact SMS to send, or empty>","reason":"<one sentence, internal>"}'
].join(' ');

function consentUser(exactReply, history) {
  return [
    'They were just offered a text message.',
    '',
    'THEIR EXACT REPLY:',
    bounded(exactReply, MAX_TURN_CHARS) || '(they said nothing)',
    '',
    'CONVERSATION SO FAR:',
    transcriptEvidence(history),
    '',
    'Return the JSON ruling.'
  ].join('\n');
}

async function decideTextConsent(exactReply, history, deliberate) {
  if (typeof deliberate !== 'function') {
    return { ok: false, consented: false, text: '', reason: 'consent_mind_unavailable' };
  }
  let reply;
  try {
    reply = await deliberate(CONSENT_SYSTEM, consentUser(exactReply, history));
  } catch (e) {
    return { ok: false, consented: false, text: '', reason: 'consent_mind_threw' };
  }
  const parsed = extractJson(reply);
  if (!parsed || typeof parsed.consented !== 'boolean') {
    return { ok: false, consented: false, text: '', reason: 'consent_ruling_unreadable' };
  }
  const text = parsed.consented === true ? bounded(parsed.text, 320) : '';
  // Consent without words is not a send. Cold code has no sentence of its own to fall
  // back on, so an empty text is the same as no consent.
  if (parsed.consented === true && !text) {
    return { ok: false, consented: false, text: '', reason: 'consent_text_missing' };
  }
  return {
    ok: true,
    consented: parsed.consented === true,
    text: text,
    reason: bounded(parsed.reason, 300) || 'No reason returned.'
  };
}

module.exports = {
  decidePostCallReach: decidePostCallReach,
  decideTextConsent: decideTextConsent,
  POST_CALL_SYSTEM: POST_CALL_SYSTEM,
  CONSENT_SYSTEM: CONSENT_SYSTEM,
  _test: {
    extractJson: extractJson,
    transcriptEvidence: transcriptEvidence,
    postCallUser: postCallUser,
    consentUser: consentUser,
    normalizePostCallRuling: normalizePostCallRuling
  }
};
