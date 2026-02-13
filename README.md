# ABA REACH v1.5.0-CHARLIE

Real-time Engagement and Action Channel Hub

## Hierarchy
L6: AIR (ABA Intelligence Router) > L5: REACH > L4: VOICE, SMS, EMAIL, OMI, BRAIN, API > L3: VARA, CARA, IMAN, TASTE, COLE, LUKE, JUDE, PACK

## ACL Format
⬡[ORIGIN]:[AGENT]:[DOMAIN].[SUBDOMAIN].[PATH]:[TYPE]:[INTENT]:[CONNECTIONS]:[TRUST]:[VERSION]:[TIMESTAMP]:[HASH]⬡

## Routes
- POST /api/router - AIR text chat
- POST /api/models/claude - Claude proxy
- GET /api/voice/deepgram-token - Browser STT
- POST /api/voice/tts - ElevenLabs TTS
- GET /api/omi/manifest - OMI registration
- POST /api/omi/webhook - OMI transcript ingestion
- POST /api/sms/send - Twilio SMS
- POST /api/brain/search - Brain query
- POST /api/brain/store - Brain persist
- POST /webhook/voice - Twilio inbound voice
- POST /webhook/sms - Twilio inbound SMS

## Deployed
https://aba-reach.onrender.com
