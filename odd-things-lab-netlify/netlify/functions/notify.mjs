import pg from 'pg';
import { randomUUID } from 'node:crypto';
import Lab from '../../server/model.cjs';
let pool;
function configured(type) {
  if (type === '新订单邮件') return !!(process.env.RESEND_API_KEY && process.env.SHOP_EMAIL && process.env.EMAIL_FROM);
  return !!(process.env.WA_ACCESS_TOKEN && process.env.WA_PHONE_NUMBER_ID && process.env.WA_API_VERSION && process.env.WA_TEMPLATE_NAME && process.env.WA_TEMPLATE_LANGUAGE);
}
async function deliver(event, order) {
  let response;
  if (event.type === '新订单邮件') {
    const text = [
      '收到新订单 ' + Lab.ticket(order.id),
      '顾客 ' + order.buyer,
      '电话 ' + order.phone,
      ...order.items.map(i => i.name + ' × ' + i.qty),
      '应付 RM ' + (order.total / 100).toFixed(2),
      '邮寄 ' + [order.address, order.postcode, order.city, order.state].filter(Boolean).join(', '),
      '打开店长工作台处理 ' + (process.env.URL || '') + '/#admin'
    ].join('\n');
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'magua-' + event.id },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [process.env.SHOP_EMAIL], subject: '🐶 新麻瓜来了 · ' + Lab.ticket(order.id), text })
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
