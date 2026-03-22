// api/send-sms.js
// Vercel serverless function — sends Twilio SMS alert to Jeremy on new claim

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    clientName,
    phone,
    idea,
    consultType,
    ambassadorName,
    refCode,
  } = req.body;

  // Pull credentials from Vercel environment variables (never hardcoded)
  const accountSid  = process.env.TWILIO_ACCOUNT_SID;
  const authToken   = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber  = process.env.TWILIO_FROM_NUMBER;
  const toNumber    = process.env.TWILIO_TO_NUMBER; // Jeremy's cell

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    console.error('[SMS] Missing Twilio env vars');
    return res.status(500).json({ error: 'SMS not configured' });
  }

  const consult = consultType === 'zoom' ? 'Zoom Call' : 'In Person';
  const body = [
    `🔥 NEW CLAIM — WOTS`,
    ``,
    `Client: ${clientName}`,
    `Phone:  ${phone}`,
    `Type:   ${consult}`,
    `Idea:   ${idea}`,
    ``,
    `Via: ${ambassadorName} (ref: ${refCode})`,
    ``,
    `→ Send deposit link to hold their spot`,
  ].join('\n');

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromNumber,
          To:   toNumber,
          Body: body,
        }),
      }
    );

    const result = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error('[SMS] Twilio error:', result);
      return res.status(500).json({ error: result.message || 'Twilio send failed' });
    }

    console.log('[SMS] Sent ✓', result.sid);
    return res.status(200).json({ success: true, sid: result.sid });

  } catch (err) {
    console.error('[SMS] Fetch error:', err);
    return res.status(500).json({ error: 'Network error sending SMS' });
  }
}
