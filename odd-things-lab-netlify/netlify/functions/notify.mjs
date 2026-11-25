import pg from 'pg';
import { randomUUID } from 'node:crypto';
import Lab from '../../server/model.cjs';
let pool;
export function orderEmail(order, siteUrl = '') {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => 'RM ' + (Number(value || 0) / 100).toFixed(2);
  const ticket = Lab.ticket(order.id);
  const attachments = [], photos = new Map();
  const rows = order.items.map(item => {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(item.photo || '');
    let image = '';
    if (match) {
      let cid = photos.get(item.photo);
      if (!cid) {
        cid = 'product-' + photos.size;
        photos.set(item.photo, cid);
        attachments.push({ filename: cid + '.' + match[1], content: match[2], content_type: 'image/' + match[1], content_id: cid });
      }
      image = `<td width="84" style="padding:14px 12px 14px 0;vertical-align:top"><img src="cid:${cid}" alt="${esc(item.name)}" width="72" style="display:block;width:72px;height:auto;border-radius:10px"></td>`;
    }
    return `<tr>${image}<td colspan="${image ? 1 : 2}" style="padding:14px 0;vertical-align:top"><strong>${esc(item.name)}</strong><br><span style="color:#807263">${money(item.price)} × ${esc(item.qty)}</span></td><td align="right" style="padding:14px 0;vertical-align:top;white-space:nowrap">${money(item.price * item.qty)}</td></tr>`;
  }).join('');
  const time = new Intl.DateTimeFormat('en-MY', { timeZone:'Asia/Kuala_Lumpur', dateStyle:'medium', timeStyle:'short' }).format(new Date(order.created));
  const address = [order.address, order.postcode, order.city, order.state].filter(Boolean).join(', ');
  let adminUrl = 'https://magualab.netlify.app/#admin';
  try { const url = new URL(siteUrl); if (url.protocol === 'https:') adminUrl = url.origin + '/#admin'; } catch {}
  const text = [`🐶 麻瓜研究所 · 新订单 ${ticket}`, '小狗接到新任务啦，店长来看看！', '状态：待核款', '下单时间：' + time + '（马来西亚时间）', '', '🛍️ 订购商品', ...order.items.map(i => `${i.name} × ${i.qty}　${money(i.price * i.qty)}`), '', '商品金额：' + money(order.total - order.fee), '运费：' + money(order.fee), '订单总额：' + money(order.total), '', '📦 收件资料', '姓名：' + order.buyer, '电话：' + order.phone, '地址：' + address, '付款人：' + (order.payer || '未填写'), '', '💬 顾客备注', order.message || '没有备注', '', '🐾 打开店长工作台：' + adminUrl, '请核对实际到账后，再更新订单状态。'].join('\n');
  const html = `<html lang="zh-Hans"><body style="margin:0;background:#faf5e9;color:#554536;font-family:Arial,sans-serif;line-height:1.65"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:600px;background:#fffdf8;border:1px solid #e5d8bc;border-radius:18px"><tr><td style="padding:28px"><p style="margin:0;color:#82705b">麻瓜研究所 · 新订单通知</p><h1 style="font-size:24px;margin:8px 0">🐶 新订单 ${esc(ticket)}</h1><p>小狗接到新任务啦，店长来看看！</p><p><strong style="background:#fff0c7;padding:5px 12px;border-radius:16px">待核款</strong></p><p style="font-size:13px;color:#807263">下单时间：${esc(time)}（马来西亚时间）</p><h2 style="font-size:18px">🛍️ 订购商品</h2><table role="presentation" width="100%" cellspacing="0">${rows}</table><div style="padding:16px;background:#f6eedf;border-radius:12px">商品金额：${money(order.total - order.fee)}<br>运费：${money(order.fee)}<br><strong style="font-size:20px">订单总额：${money(order.total)}</strong></div><h2 style="font-size:18px">📦 收件资料</h2><p>姓名：${esc(order.buyer)}<br>电话：${esc(order.phone)}<br>地址：${esc(address)}<br>付款人：${esc(order.payer || '未填写')}</p><h2 style="font-size:18px">💬 顾客备注</h2><p style="white-space:pre-wrap">${esc(order.message || '没有备注')}</p><p style="margin:28px 0"><a href="${esc(adminUrl)}" style="display:inline-block;padding:12px 20px;background:#4c6853;color:#fff;text-decoration:none;border-radius:10px">🐾 打开店长工作台</a></p><p style="font-size:13px;color:#807263">请核对实际到账后，再更新订单状态。</p></td></tr></table></td></tr></table></body></html>`;
  return { subject: `🐶 新订单 ${ticket}｜${money(order.total)}｜${String(order.buyer).replace(/[\r\n]/g, ' ')}`, text, html, ...(attachments.length ? { attachments } : {}) };
}
function configured(type) {
  if (type === '新订单邮件') return !!(process.env.RESEND_API_KEY && process.env.SHOP_EMAIL && process.env.EMAIL_FROM);
  return !!(process.env.WA_ACCESS_TOKEN && process.env.WA_PHONE_NUMBER_ID && process.env.WA_API_VERSION && process.env.WA_TEMPLATE_NAME && process.env.WA_TEMPLATE_LANGUAGE);
}
async function deliver(event, order) {
  let response;
  if (event.type === '新订单邮件') {
    const email = orderEmail(order, process.env.URL);
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'magua-' + event.id },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [...new Set(process.env.SHOP_EMAIL.split(',').map(email => email.trim()).filter(Boolean))], ...email })
    });
  } else {
    if (!order.consent) return { status: '已跳过', error: '顾客未订阅 WhatsApp 进度' };
    const version = process.env.WA_API_VERSION;
    if (!/^v\d+\.\d+$/.test(version)) return { status: '待配置', error: '请检查 WhatsApp API 版本' };
    let phone = String(order.phone).replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '60' + phone.slice(1);
    response = await fetch('https://graph.facebook.com/' + version + '/' + process.env.WA_PHONE_NUMBER_ID + '/messages', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { Authorization: 'Bearer ' + process.env.WA_ACCESS_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template', template: {
        name: process.env.WA_TEMPLATE_NAME,
        language: { code: process.env.WA_TEMPLATE_LANGUAGE },
        components: [{ type: 'body', parameters: [Lab.ticket(order.id), Lab.stages[event.stage], order.tracking || '物流资料稍后更新'].map(text => ({ type: 'text', text })) }]
      } })
    });
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return { status: '发送失败', error: '服务返回 ' + response.status + '，请检查配置后重试' };
  return { status: '已发送', providerId: result.id || result.messages?.[0]?.id || '' };
}
async function claim(client) {
  await client.query('BEGIN');
  const row = await client.query('SELECT data FROM magua_store WHERE id=1 FOR UPDATE');
  if (!row.rows.length) { await client.query('COMMIT'); return null; }
  const state = Lab.migrate(row.rows[0].data);
  let claimed = null;
  for (const event of state.events) {
    if (event.status === '发送中' && Date.now() - (event.started || 0) > 300000) {
      event.status = '待店长核对'; event.error = '上次发送结果不确定，请核对后再决定是否重发';
    }
    if (!['待发送', '待配置'].includes(event.status)) continue;
    if (!configured(event.type)) { event.status = '待配置'; event.error = event.type === '新订单邮件' ? '邮件服务未配置' : 'WhatsApp 服务未配置'; continue; }
    const current = state.orders.find(o => o.id === event.order);
    const order = event.payload || current;
    if (!order) { event.status = '发送失败'; event.error = '订单已不存在'; continue; }
    event.status = '发送中'; event.started = Date.now(); event.claim = randomUUID(); event.attempts = (event.attempts || 0) + 1;
    claimed = { event: { ...event }, order }; break;
  }
  await client.query('UPDATE magua_store SET data=$1 WHERE id=1', [state]);
  await client.query('COMMIT'); return claimed;
}
async function finish(client, event, result) {
  await client.query('BEGIN');
  const row = await client.query('SELECT data FROM magua_store WHERE id=1 FOR UPDATE');
  const state = row.rows[0].data;
  const target = state.events.find(e => e.id === event.id);
  if (target?.claim === event.claim) Object.assign(target, result, { finished: Date.now() });
  await client.query('UPDATE magua_store SET data=$1 WHERE id=1', [state]);
  await client.query('COMMIT');
}
export default async function notify() {
  if (!process.env.DATABASE_URL) return;
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 4000 });
  const client = await pool.connect();
  try {
    const exists = await client.query("SELECT to_regclass('public.magua_store') AS name");
    if (!exists.rows[0].name) return;
    // Two eight-second requests fit within the scheduled function's time budget.
    for (let n = 0; n < 2; n++) {
      const task = await claim(client);
      if (!task) break;
      let result;
      try { result = await deliver(task.event, task.order); }
      catch { result = { status: '待店长核对', error: '网络中断，发送结果不确定。请先核对，避免重复通知。' }; }
      await finish(client, task.event, result);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Notification queue could not complete', error.code || 'unknown');
  } finally { client.release(); }
}
export const config = { schedule: '* * * * *' };
