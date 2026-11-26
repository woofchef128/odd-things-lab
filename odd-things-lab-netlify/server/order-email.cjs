const Lab = require('./model.cjs');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => 'RM ' + (Number(value || 0) / 100).toFixed(2);
module.exports = function orderEmail(order, siteUrl = '') {
  const ticket = Lab.ticket(order.id), attachments = [], photos = new Map();
  const embed = (photo, label, width) => {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(photo || '');
    if (!match) return '';
    let cid = photos.get(photo);
    if (!cid) {
      cid = 'order-photo-' + photos.size;
      photos.set(photo, cid);
      attachments.push({ filename: cid + '.' + match[1], content: match[2], content_type: 'image/' + match[1], content_id: cid });
    }
    return `<img src="cid:${cid}" alt="${esc(label)}" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border-radius:10px">`;
  };
  const itemText = item => [`${item.name} × ${item.qty}　${money(item.price * item.qty)}`, ...(item.customization?.fields || []).filter(f=>f.value).map(f=>`  ${f.label}：${f.value}`), ...(item.customization?.remark?['  定制备注：'+item.customization.remark]:[]), ...(item.customization?.photo?['  已附定制参考照片']:[])].join('\n');
  const rows = order.items.map(item => {
    const image = embed(item.photo, item.name, 72), custom = item.customization;
    const customPhoto = custom ? embed(custom.photo, '定制参考照片 · '+item.name, 160) : '';
    const details = custom ? `<div style="padding:10px 0"><b>🎨 定制资料</b>${(custom.fields || []).filter(f=>f.value).map(f=>`<div>${esc(f.label)}：${esc(f.value)}</div>`).join('')}${custom.remark?`<div>备注：${esc(custom.remark)}</div>`:''}${customPhoto?`<p style="margin:8px 0">参考照片</p>${customPhoto}`:''}</div>` : '';
    return `<tr>${image?`<td width="84" style="padding:14px 12px 14px 0;vertical-align:top">${image}</td>`:''}<td colspan="${image?1:2}" style="padding:14px 0;vertical-align:top"><strong>${esc(item.name)}</strong><br><span style="color:#807263">${money(item.price)} × ${esc(item.qty)}</span>${details}</td><td align="right" style="padding:14px 0;vertical-align:top;white-space:nowrap">${money(item.price*item.qty)}</td></tr>`;
  }).join('');
  const time = new Intl.DateTimeFormat('en-MY', {timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'}).format(new Date(order.created));
  const pickup = order.fulfillment==='pickup', region = {west:'West Malaysia',east:'East Malaysia',singapore:'Singapore'}[order.region] || '';
  const address = pickup ? (order.pickupInfo?.address || '自取地点待店长确认') : [order.address,order.postcode,order.city,order.state].filter(Boolean).join(', ');
  const recipientName = order.recipientName || order.buyer, recipientPhone = order.recipientPhone || order.phone;
  let adminUrl='https://magualab.netlify.app/#admin';
  try {const url=new URL(siteUrl);if(url.protocol==='https:')adminUrl=url.origin+'/#admin';}catch{}
  const text = [`🐶 麻瓜研究所 · 新订单 ${ticket}`,'小狗接到新任务啦，店长来看看！','状态：待核款','下单时间：'+time+'（马来西亚时间）','','🛍️ 订购商品',...order.items.map(itemText),'','商品金额：'+money(order.total-order.fee),'运费：'+money(order.fee),'订单总额：'+money(order.total),'','👤 顾客资料','姓名：'+order.buyer,'电话：'+order.phone,'邮箱：'+(order.email||'旧订单未填写'),'','📦 '+(pickup?'自取':'配送 '+region),'收件人：'+recipientName,'收件电话：'+recipientPhone,(pickup?'自取地点：':'地址：')+address,...(pickup&&order.pickupInfo?.instructions?['自取说明：'+order.pickupInfo.instructions]:[]),'付款人：'+(order.payer||'未填写'),'','💬 Note to seller · 捎句话',order.message||'没有备注','','🐾 打开店长工作台：'+adminUrl,'请核对实际到账后，再更新订单状态。'].join('\n');
  const html=`<html lang="zh-Hans"><body style="margin:0;background:#faf5e9;color:#554536;font-family:Arial,sans-serif;line-height:1.65"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:600px;background:#fffdf8;border:1px solid #e5d8bc;border-radius:18px"><tr><td style="padding:24px"><p style="margin:0;color:#82705b">麻瓜研究所 · 新订单通知</p><h1 style="font-size:24px;margin:8px 0">🐶 新订单 ${esc(ticket)}</h1><p>小狗接到新任务啦，店长来看看！</p><p><strong style="background:#fff0c7;padding:5px 12px;border-radius:16px">待核款</strong></p><p style="font-size:13px;color:#807263">下单时间：${esc(time)}（马来西亚时间）</p><h2 style="font-size:18px">🛍️ 订购商品</h2><table role="presentation" width="100%" cellspacing="0">${rows}</table><div style="padding:16px;background:#f6eedf;border-radius:12px">商品金额：${money(order.total-order.fee)}<br>运费：${money(order.fee)}<br><strong style="font-size:20px">订单总额：${money(order.total)}</strong></div><h2 style="font-size:18px">👤 顾客资料</h2><p>姓名：${esc(order.buyer)}<br>电话：${esc(order.phone)}<br>邮箱：${esc(order.email||'旧订单未填写')}</p><h2 style="font-size:18px">📦 ${pickup?'自取':'配送 '+esc(region)}</h2><p>收件人：${esc(recipientName)}<br>收件电话：${esc(recipientPhone)}<br>${pickup?'自取地点':'地址'}：${esc(address)}${pickup&&order.pickupInfo?.instructions?'<br>自取说明：'+esc(order.pickupInfo.instructions):''}<br>付款人：${esc(order.payer||'未填写')}</p><h2 style="font-size:18px">💬 Note to seller · 捎句话</h2><p style="white-space:pre-wrap">${esc(order.message||'没有备注')}</p><p style="margin:28px 0"><a href="${esc(adminUrl)}" style="display:inline-block;padding:12px 20px;background:#4c6853;color:#fff;text-decoration:none;border-radius:10px">🐾 打开店长工作台</a></p><p style="font-size:13px;color:#807263">请核对实际到账后，再更新订单状态。</p></td></tr></table></td></tr></table></body></html>`;
  return {subject:`🐶 新订单 ${ticket}｜${money(order.total)}｜${String(order.buyer).replace(/[\r\n]/g,' ')}`,text,html,...(attachments.length?{attachments}:{})};
};
