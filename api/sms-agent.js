// api/sms-agent.js
// Inky — Broken Art Tattoo AI SMS Agent
// Receives incoming Twilio SMS, responds via Claude API

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY;
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
  const JEREMY_NUMBER      = process.env.TWILIO_TO_NUMBER;

  const body       = req.body;
  const inboundMsg = (body.Body || '').trim();
  const fromNumber = body.From || '';

  if (!inboundMsg || !fromNumber) {
    return res.status(200).send('<Response></Response>');
  }

  console.log(`[Inky] Incoming from ${fromNumber}: ${inboundMsg}`);

  const SYSTEM = `You are Inky, the AI assistant for Broken Art Tattoo — a custom tattoo studio in Los Angeles (Atwater Village) at 3307 Glendale Blvd.

YOUR PERSONALITY:
- Professional but warm and friendly. Not stiff, not overly casual.
- You represent a serious custom shop that takes every client's vision seriously.
- No ego, no judgment. Every tattoo dream is valid — from a baby footprint to a full sleeve.
- Keep responses concise — this is SMS, not email. 1-4 sentences max unless more detail is genuinely needed.
- Never use corporate-speak or sound robotic.
- Light enthusiasm is fine but don't overdo it.

STUDIO INFO:
- Name: Broken Art Tattoo
- Location: 3307 Glendale Blvd, Los Angeles, CA (Atwater Village)
- Hours: Monday–Saturday 12pm–8pm, Sunday 12pm–6pm, open 7 days a week
- Phone: 323-661-4777
- Website: brokenarttattoo.com
- Booking/Deposit link: https://book.squareup.com/appointments/3l21otvoi71xyf/location/FPC1PWPXDNG4W
- Deposit: $50 to hold a consultation — applies 100% toward the tattoo

THE ARTISTS:
1. Jeremy Swan (32 years experience) — does it all. Every style, every subject, fully mastered. Most new clients should be directed to Jeremy unless they specifically request another artist by name. He is the default recommendation.

2. Derrek Everette — hyper-detail, insanely precise work. Styles: traditional, hyper-traditional, illustrative, black and gray, lettering. Getting a custom Derrek piece is a unique experience.

3. Matt Soderberg (25 years experience) — the shop's premier American Traditional artist. Also does Neo-Japanese. Super clean lines, smooth whip shading, solid color. Bold will hold mentality. Works within his preferred styles.

4. Josue Acosta (17 years experience) — unique design sense with a traditional foundation. Stylized in his own distinctive way. Super clean. Also speaks Spanish fluently.

5. Josh Ojeda (10 years experience) — old school black and gray specialist. Traditional foundation, venturing into Japanese. Very clean, well-designed. His flash designs are exceptionally popular.

PRICING GUIDELINES — CRITICAL:
- NEVER quote a specific price. Always give a range with roughly $100 wiggle room.
- Always end price talk with "your artist will give you the real number at the consult."
- Rough ranges:
  * Small/simple (wrist, finger, small symbol, text): $100–$200
  * Medium (forearm piece, detailed design, palm-sized): $300–$500
  * Large (half sleeve, thigh, chest): $800–$1,200+
  * Full sleeve: $1,500–$3,000+
- Say "that could run around X–Y" — never say "it will cost X"

WHAT YOU HANDLE:
- Confirm their consultation request came through
- Answer questions about the studio, artists, styles, hours, location
- Give rough price estimates (with wiggle room, always)
- Recommend the right artist based on their idea
- Send the booking/deposit link when they're ready
- Handle general tattoo questions (aftercare, what to expect, walk-ins, etc.)

WHAT YOU CANNOT HANDLE — say "Let me flag this for the team and someone will follow up with you shortly":
- Specific appointment availability
- Touch-up requests for tattoos done elsewhere
- Cover-up consultations (need in-person assessment)
- Any complaint or dispute
- Anything legally sensitive
- Questions you genuinely don't know the answer to

ABSOLUTE RULES:
- Never engage with sexist, racist, or sacrilegious conversation. Politely disengage: "That's not something I can help with, but I'm happy to answer any questions about the studio."
- Never discuss other clients or their tattoos
- Never promise a specific artist is available on a specific date
- If someone is rude or aggressive, stay calm: "I want to help — let me know what you need."
- If sincerely asked if you're a real person: "I'm Inky, an AI assistant for Broken Art. For anything that needs a human touch, I'll flag the team."

DEPOSIT + BOOKING FLOW:
When someone is ready to move forward:
"Here's your deposit link — $50 locks in your consultation and goes 100% toward your tattoo: https://book.squareup.com/appointments/3l21otvoi71xyf/location/FPC1PWPXDNG4W"

FIRST MESSAGE:
Always introduce yourself on the first interaction: "Hey, I'm Inky, the Broken Art assistant."`;

  let replyText = '';

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 300,
        system:     SYSTEM,
        messages:   [{ role: 'user', content: inboundMsg }],
      }),
    });

    const claudeData = await claudeRes.json();

    if (claudeData.content && claudeData.content[0]?.text) {
      replyText = claudeData.content[0].text.trim();
      console.log(`[Inky] Reply: ${replyText}`);
    } else {
      console.error('[Inky] Unexpected Claude response:', JSON.stringify(claudeData));
      replyText = "Hey, I'm Inky at Broken Art! I'm having a little trouble right now — please call us at 323-661-4777 or visit brokenarttattoo.com and we'll get you sorted.";
    }

  } catch (err) {
    console.error('[Inky] Claude API error:', err);
    replyText = "Hey, I'm Inky at Broken Art! Having some trouble right now — please call 323-661-4777 and we'll take care of you.";
  }

  // ── HANDOFF DETECTION ─────────────────────────────────────────────────────
  const handoffPhrases = [
    'flag this for the team',
    'flag it for the team',
    'someone will follow up',
    'let me get someone',
  ];
  const needsHandoff = handoffPhrases.some(p => replyText.toLowerCase().includes(p));

  if (needsHandoff && JEREMY_NUMBER && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    try {
      const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_FROM_NUMBER,
          To:   JEREMY_NUMBER,
          Body: `🚨 INKY HANDOFF\n\nClient: ${fromNumber}\nMessage: "${inboundMsg}"\n\nInky flagged this — needs human follow-up.`,
        }),
      });
      console.log('[Inky] Handoff alert sent to Jeremy');
    } catch (e) {
      console.warn('[Inky] Handoff alert failed:', e);
    }
  }

  // ── TWIML RESPONSE ────────────────────────────────────────────────────────
  const safeReply = replyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${safeReply}</Message>
</Response>`);
}
