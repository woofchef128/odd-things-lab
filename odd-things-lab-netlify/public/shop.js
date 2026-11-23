const $ = id => document.getElementById(id);
const endpoint = '/.netlify/functions/orders';
const baseDog = {color:'cream',ears:'floppy',extra:'none'};
const fur = {cream:'#ffe1ac',brown:'#d2986b',gray:'#d5d3e4'};
const expressions = ['•  •','^  ^','•  ◕','◕  ◕','◉  ◉','♡  ♡'];
const stageIcons = ['⌛','✓','⚙','📦','🚚','✦'];
const shippingFields = ['name','phone','address','postcode','city','state'];
const paymentNames = {qr:'QR 扫码',bank:'银行转账'};
const rm = cents => 'RM' + (cents / 100).toFixed(2);
let config;
function dogSettings() {
  return $('custom').checked ? {color:$('color').value,ears:$('ears').value,extra:$('extra').value} : baseDog;
}
function renderDog(target,dog,stage = 0,caption = '') {
  const head = document.createElement('div');
  head.className = 'dog ' + dog.ears;
  head.style.setProperty('--fur',fur[dog.color]);
  head.setAttribute('role','img');
  head.setAttribute('aria-label',caption || '跟单小狗');
  const face = document.createElement('span');
  face.className = 'face';
  face.textContent = expressions[stage] + '\nᴥ';
  const accessory = document.createElement('small');
  accessory.textContent = [({bow:'🎀',star:'⭐'})[dog.extra],stageIcons[stage]].filter(Boolean).join(' ');
  head.append(face,accessory);
  target.replaceChildren(head);
}
function items() {
  return config.products.map(product => ({id:product.id,qty:Number($('qty-' + product.id).value)})).filter(item => item.qty > 0);
}
function updateTotal() {
  const cents = items().reduce((total,item) => total + item.qty * config.products.find(product => product.id === item.id).cents,0);
  $('total').textContent = rm(cents);
}
async function api(url,options) {
  const response = await fetch(url,options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '暂时无法连接，请稍后重试。');
  return data;
}
function renderReceipt(order) {
  const receipt = $('receipt');
  const number = document.createElement('p');
  number.textContent = '订单号 ' + order.code + ' · 查询码 ' + order.key;
  const link = document.createElement('a');
  link.href = location.pathname + '#' + new URLSearchParams({order:order.code,key:order.key});
  link.textContent = '保存这个查询链接';
  const heading = document.createElement('h2');
  heading.textContent = '订单付款';
  receipt.replaceChildren(heading,number,link);
  renderPayment(receipt,order);
  receipt.hidden = false;
  $('order').value = order.code;
  $('key').value = order.key;
}
function renderPayment(receipt,order) {
  if (!order.paymentMethod || !order.shipping) return;
  const subtotal = order.lines.reduce((total,line) => total + line.qty * line.cents,0);
  const intro = document.createElement('p');
  const payment = config.payment;
  const configured = order.paymentMethod === 'qr' ? Boolean(payment.qrImage) :
    Boolean(payment.bankName && payment.accountName && payment.accountNumber);
  intro.textContent = paymentNames[order.paymentMethod] + ' · 商品小计 ' + rm(subtotal);
  receipt.append(intro);
  if (order.stage > 0) return;
  if (order.demo || !configured) {
    const notice = document.createElement('p');
    notice.textContent = order.demo ? '测试订单无需付款，可预览 WhatsApp 讯息。' : '收款资料尚未设置，请先联系商家。';
    receipt.append(notice);
  } else if (order.paymentMethod === 'qr') {
    const qr = document.createElement('img');
    Object.assign(qr,{src:payment.qrImage,alt:'商家收款二维码',className:'pay-qr'});
    receipt.append(qr);
  } else {
    const bank = document.createElement('p');
    bank.textContent = [payment.bankName,payment.accountName,payment.accountNumber].join(' · ');
    receipt.append(bank);
  }
  const form = document.createElement('form');
  const label = document.createElement('label');
  label.textContent = '付款账户姓名（银行账户或电子钱包显示的姓名）';
  const payer = document.createElement('input');
  Object.assign(payer,{required:true,maxLength:100,placeholder:'例如：Tan Mei Ling'});
  label.append(payer);
  const button = document.createElement('button');
  button.textContent = order.demo ? '预览 WhatsApp 讯息' : '打开 WhatsApp 发付款凭证 ↗';
  const output = document.createElement('output');
  output.style.whiteSpace = 'pre-wrap';
  output.setAttribute('aria-live','polite');
  form.append(label,button,output);
  form.onsubmit = event => {
    event.preventDefault();
    const name = payer.value.trim();
    if (!name) {
      output.textContent = '请填写付款账户姓名。';
      payer.focus();
      return;
    }
    const shipping = order.shipping;
    const message = [
      '你好，我想提交 ' + config.brand + ' 的付款凭证。',
      '订单号：' + order.code,
      '商品：', ...order.lines.map(item => '• ' + item.name + ' × ' + item.qty + ' — ' + rm(item.cents * item.qty)),
      '商品小计：' + rm(subtotal),
      '付款方式：' + paymentNames[order.paymentMethod],
      '付款账户姓名：' + name,
      '收件人：' + shipping.name,
      '电话：' + shipping.phone,
      '邮寄地址：' + [shipping.address,shipping.postcode,shipping.city,shipping.state].join(', '),
      ...(order.note ? ['备注：' + order.note] : [])
    ].join('\n');
    if (order.demo) {
      output.textContent = message;
      return;
    }
    window.open('https://wa.me/' + config.whatsapp + '?text=' + encodeURIComponent(message),'_blank','noopener,noreferrer');
    output.textContent = '请在 WhatsApp 里发送讯息，并附上付款截图。';
  };
  receipt.append(form);
}
$('checkout').onsubmit = async event => {
  event.preventDefault();
  $('submit').disabled = true;
  $('checkout-status').textContent = '正在生成订单…';
  try {
    const order = await api(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items(),dog:dogSettings(),note:$('note').value,shipping:Object.fromEntries(shippingFields.map(field => [field,$('shipping-' + field).value])),paymentMethod:$('payment-method').value})});
    renderReceipt(order);
    config.products.forEach(product => {$('qty-' + product.id).value = 0;});
    $('note').value = '';
    updateTotal();
    $('checkout-status').textContent = '订单已生成。';
    $('receipt').scrollIntoView({block:'start'});
  } catch (error) {
    $('checkout-status').textContent = error.message;
  } finally {
    $('submit').disabled = false;
  }
};
async function track() {
  $('tracking').textContent = '正在找你的小狗…';
  $('progress-dog').replaceChildren();
  $('timeline').replaceChildren();
  $('receipt').hidden = true;
  try {
    const query = new URLSearchParams({order:$('order').value.trim().toUpperCase(),key:$('key').value.trim().toUpperCase()});
    const order = await api(endpoint + '?' + query);
    const stage = config.stages[order.stage];
    $('tracking').textContent = order.code + ' · ' + stage;
    renderDog($('progress-dog'),order.dog,order.stage,stage);
    config.stages.forEach((label,index) => {
      const row = document.createElement('li');
      row.textContent = label;
      if (index === order.stage) {
        row.className = 'progress-current';
        row.setAttribute('aria-current','step');
        row.textContent += '（目前）';
      }
      $('timeline').append(row);
    });
    renderReceipt({...order,key:query.get('key')});
    if (order.stage === 0 && order.paymentMethod) {
      const paymentLink = document.createElement('a');
      paymentLink.href = '#receipt';
      paymentLink.textContent = '查看付款资料／发送凭证';
      $('tracking').append(document.createElement('br'),paymentLink);
    }
  } catch (error) {
    $('tracking').textContent = error.message;
  }
}
$('track-form').onsubmit = event => {event.preventDefault(); if (config) track();};
function loadLink() {
  const query = new URLSearchParams(location.hash.slice(1));
  if (!config || !query.has('order') || !query.has('key')) return;
  $('order').value = query.get('order');
  $('key').value = query.get('key');
  $('track').scrollIntoView();
  track();
}
addEventListener('hashchange',loadLink);
$('custom').onchange = () => {
  $('options').hidden = !$('custom').checked;
  renderDog($('dog'),dogSettings());
};
$('options').onchange = () => renderDog($('dog'),dogSettings());
(async () => {
  try {
    config = await api('./catalog.json');
    $('brand').textContent = config.brand;
    $('english').textContent = config.english;
    $('demo').hidden = config.live;
    for (const product of config.products) {
      const card = document.createElement('article');
      const symbol = document.createElement('div');
      symbol.className = 'symbol';
      symbol.textContent = product.symbol;
      symbol.setAttribute('aria-hidden','true');
      const name = document.createElement('h3');
      name.textContent = product.name;
      const details = document.createElement('p');
      details.textContent = product.type + ' · ' + rm(product.cents);
      const label = document.createElement('label');
      label.textContent = '数量';
      const qty = document.createElement('input');
      Object.assign(qty,{type:'number',min:'0',max:'20',step:'1',value:'0',id:'qty-' + product.id,required:true});
      qty.oninput = updateTotal;
      label.append(qty);
      card.append(symbol,name,details,label);
      $('products').append(card);
    }
    renderDog($('hero-dog'),baseDog,4);
    renderDog($('dog'),baseDog);
    $('submit').disabled = false;
    loadLink();
  } catch {
    $('startup').textContent = '暂时无法读取商品，请刷新重试。';
  }
})();
