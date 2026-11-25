const Lab = (() => {
  const dogs = ['鼻事多', '拖油瓶', '眨眼包', '煤球', '瞎打听', '毛毛', '胡须佬', '歪歪'];
  const stages = ['待核款', '制作中', '要面交', '已寄出', '已完成', '不等咯', '排队中', '待寄出'];
  const moods = [['问号眼与沙漏'], ['敲木鱼', '侧目冷汗', '灵魂出窍'], ['水汪汪期待脸'], ['开怀大笑'], ['毕业帽大笑'], ['离家中'], ['八字眉弯眼笑', '无神无语', '打瞌睡'], ['放大镜验货']];
  const cats = ['打印出没区', '手捏观察室', '不准偷看室'];
  const states = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'W.P. Kuala Lumpur', 'W.P. Labuan', 'W.P. Putrajaya'];
  const fail = message => { throw Error(message); };
  const text = (value, max = 100, required = true) => {
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail('请检查填写内容');
    return value.trim();
  };
  const integer = (value, min, max) => {
    if (!Number.isSafeInteger(value) || value < min || value > max) fail('请检查数量或金额');
    return value;
  };
  const photo = value => {
    if (!value) return '';
    if (typeof value !== 'string' || value.length > 1000000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) fail('请使用小于 700KB 的 PNG、JPG 或 WebP');
    return value;
  };
  const normalizePhone = value => String(value).replace(/[^0-9]/g, '').replace(/^60/, '0');
  const day = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const localDay = time => Math.floor((time + 8 * 3600000) / 86400000);
  const daysInStage = (order, now = Date.now()) => Math.max(0, localDay(now) - localDay(order.statusAt || order.created || now));
  const moodIndex = (order, now = Date.now()) => Math.min(daysInStage(order, now), moods[order.stage].length - 1);
  const statusLines = [
    ['钱有没有到，店长比你还紧张 👀','店长查账中，小狗看不懂数字 🧾','正在对账，先别把店长当骗子喂 😂'],
    ['店长在做了，小狗的催单嘴也没停 🛠️','两只手已经全用上了，脚还不会做 🦶','小狗盯到眼睛干，店长还在埋头干 👀'],
    ['东西好了，差一个麻瓜来接头 🤝','店长准备交货，请勿演成谍战片 🕶️','等你来领，小狗已经闻过了，放心 🐾'],
    ['已出发，小狗追了两步就放弃了 🚚','现在归快递哥管，店长终于管不到了 📦','小狗不会开货车，催它也没用啦 🐶'],
    ['签收啦！小狗申请下班，店长不批准 🎓','东西归你，快乐归你，烂摊子归店长 🛠️','研究成果已到家，麻瓜满意请摇尾巴 🐾'],
    ['款没等到，小狗先卷铺盖了 💨','查无此款，查有两团狗烟 💨','钱没来，小狗说它也不来了 🧳'],
    ['排着啦，小狗还没学会插队 🐾','店长做前面的，小狗替你盯着他 👀','你的单没失踪，只是前面有点热闹 🫠'],
    ['做好了，小狗正在查有没有偷工减料 🔍','胶带再绕一圈，安全感不能省 📦','正在打包，小狗也想跟着寄，被拦了 🐶']
  ];
  const statusLine = (order, now = Date.now()) => statusLines[order.stage][(order.id + localDay(order.statusAt || order.created || now) + daysInStage(order, now)) % 3];
  const numId = value => Number(String(value).trim().replace(/^(OTL-|#)/i, ''));
  const ticket = number => '#' + String(number).padStart(3, '0');
  const masked = value => {
    const letters = Array.from(String(value).replace(/\s/g, ''));
    return letters[0] + '***' + (letters.length > 1 ? letters.at(-1) : '');
  };
  const newId = () => crypto.randomUUID();
  function migrate(s) {
    s.members ??= {};
    s.accounts ??= {};
    s.meritTotals ??= {};
    s.merit ??= {};
    s.receipts ??= {};
    s.events ??= [];
    s.pins ??= {};
    if (s.version !== 4) {
      const mapping = [5, 3, 0, 4, 2, 6, 1, 7];
      s.orders.forEach(o => { o.dog = mapping[o.dog] ?? 5; o.statusAt ??= o.created || Date.now(); });
      s.wishes.forEach(w => {
        w.dog = mapping[w.dog] ?? 5;
        w.created ??= Date.now();
        w.comments.forEach(c => { if (c.dog !== undefined) c.dog = mapping[c.dog] ?? 5; });
      });
      Object.entries(s.members).forEach(([key, m]) => {
        m.dog = mapping[m.dog] ?? 5;
        s.accounts[m.phone] ??= { ...m, merit: s.meritTotals[key] || 0 };
      });
      s.version = 4;
    }
    s.owners ??= {};
    for (const o of [...s.orders].sort((a,b)=>a.id-b.id)) {
      const phone=normalizePhone(o.phone);
      s.accounts[phone] ??= {id:o.id,phone,name:o.buyer,dog:o.dog,merit:0,earned:[]};
    }
    return s;
  }
  function initial(demo = false) {
    const s = { version: 4, seq: 0, products: [], orders: [], wishes: [], shipping: [null, null], qr: '', members: {}, accounts: {}, merit: {}, meritTotals: {}, receipts: {}, pins: {}, events: [] };
    if (!demo) return s;
    s.shipping = [800, 1500];
    s.products = [
      { id: 'p0', name: '小狗桌面伙伴', cat: 0, price: 2900, mode: 'stock', stock: 12, active: true, photo: '', description: '研究所的小同事，先帮你把桌面占好。', variants: [] },
      { id: 'p-custom', name: '有个点子想打印？', cat: 0, price: 100, mode: 'custom', stock: 0, active: true, photo: '', description: '尺寸、用途、草图都可以发给店长研究。', variants: [] },
      { id: 'p1', name: '手捏小麻瓜', cat: 1, price: 5900, mode: 'pre', lead: '示例 · 7–10 天', stock: 0, active: true, photo: '', description: '把人类缩小一点，快乐放大一点。', variants: [{ label: '1 位麻瓜', price: 5900 }, { label: '2 位麻瓜', price: 9900 }] },
      { id: 'p2', name: '今天谁值班 · 盲盒系列', cat: 2, price: 6900, mode: 'pre', lead: '示例 · 7–10 天', stock: 0, active: true, photo: '', description: '先别偷看，小同事正在盒子里整理发型。', variants: [] }
    ];
    const now = Date.now();
    s.seq = 49;
    s.orders = [
      { id: 49, buyer: 'Aina Lee', phone: '0000002049', dog: 6, stage: 3, mood: 0, created: now - 4 * 86400000, statusAt: now - 86400000, items: [{ id: 'p0', name: '小狗桌面伙伴', price: 2900, qty: 2, stocked: true }], total: 6600, fee: 800, address: '123, Jalan ABC, Taman Biubiubiu', city: 'Kuala Lumpur', postcode: '50000', state: 'W.P. Kuala Lumpur', tracking: 'DEMO-049', carrier: '示例快递', url: '', sample: true },
      { id: 48, buyer: 'Lim Wei', phone: '0000002048', dog: 4, stage: 1, mood: 0, created: now - 3 * 86400000, statusAt: now - 86400000, items: [{ id: 'p1', name: '手捏小麻瓜 · 1 位麻瓜', price: 5900, qty: 1, stocked: false }], total: 6700, fee: 800, address: '示例地址', sample: true },
      { id: 47, buyer: 'Tan Mei', phone: '0000002047', dog: 5, stage: 0, mood: 0, created: now - 86400000, statusAt: now - 86400000, items: [{ id: 'p0', name: '小狗桌面伙伴', price: 2900, qty: 1, stocked: true }], total: 3700, fee: 800, address: '示例地址', sample: true }
    ];
    s.wishes = [
      { id: 'wish-example', order: 49, dog: 6, text: '想让小狗替我保管耳机。', note: '放在办公桌上，一边收线，一边监督麻瓜上班。', done: false, created: now - 86400000, votes: 3, comments: [] },
      { id: 'wish-48', order: 48, dog: 4, text: '能做一只趴在键盘上拒绝加班的小狗吗？', note: '我的老板看到它，应该会懂吧。', done: false, created: now - 2 * 86400000, votes: 1, comments: [] }
    ];
    return s;
  }
  function account(s, key) {
    const ref = s.members[key];
    return ref ? s.accounts[ref.phone] : null;
  }
  function meritKey(s, key) { return account(s, key)?.phone || key; }
  function member(s, key) {
    migrate(s);
    return profile(s,account(s,key));
  }
  function profile(s,m) {
    if(!m)return null;
    const orders = s.orders.filter(o => normalizePhone(o.phone) === m.phone);
    const active = orders.filter(o => o.stage !== 5);
    const finished = orders.filter(o => o.stage === 4);
    const ids = new Set(orders.map(o => o.id));
    const comments = s.wishes.flatMap(w => w.comments).filter(c => c.role === 'order' && ids.has(c.order)).length + s.wishes.filter(w=>ids.has(w.order)&&!!w.note).length;
    const products = new Set(finished.flatMap(o => o.items.map(i => i.id || i.name))).size;
    const badges = [
      { id: 'join', icon: '🐣', name: '入职麻瓜', earned: orders.length > 0, detail: '第一次下单' },
      { id: 'elder', icon: '🏅', name: '开所元老', earned: m.id >= 1 && m.id <= 200, detail: '工号 #001–#200' },
      { id: 'chat', icon: '💬', name: '话唠麻瓜', earned: comments >= 10, detail: '留言满 10 次', progress: comments + '/10' },
      { id: 'repeat', icon: '🔄', name: '回头麻瓜', earned: active.length >= 3, detail: '下单满 3 次', progress: active.length + '/3' },
      { id: 'meet', icon: '🤝', name: '见过店长', earned: finished.some(o => o.handover), detail: '面交过一次' },
      { id: 'pre', icon: '⏳', name: '耐心麻瓜', earned: finished.some(o => o.items.some(i => i.stocked === false)), detail: '收到过预购商品' },
      { id: 'letter', icon: '✉️', name: '信被拆啦', earned: s.wishes.some(w => ids.has(w.order) && w.done), detail: '一个点子被实现' },
      { id: 'collect', icon: '🧺', name: '收集麻瓜', earned: products >= 3, detail: '买过 3 款不同产品', progress: products + '/3' },
      { id: 'merit', icon: '🪵', name: '功德麻瓜', earned: (m.merit || 0) >= 10, detail: '累积敲木鱼 10 次', progress: (m.merit || 0) + '/10' }
    ];
    // Once recognized, a badge remains part of this employee's history.
    const earned = new Set([...(m.earned || []), ...badges.filter(b => b.earned).map(b => b.id)]);
    badges.forEach(b => { b.earned = earned.has(b.id); });
    const count = badges.filter(b => b.id !== 'elder' && b.earned).length;
    const rank = count >= 7 ? '麻瓜主管' : count >= 5 ? '资深麻瓜' : count >= 3 ? '麻瓜员工' : '实习麻瓜';
    return { id: m.id, name: m.name, dog: m.dog, rank, elder: earned.has('elder'), orders: orders.map(o => o.id), badges, count };
  }
  function project(s, admin, key) {
    migrate(s);
    if(!s.members[key]) {
      const receipt=Object.entries(s.receipts).find(([receiptKey])=>receiptKey.startsWith(key));
      const ownOrder=receipt&&s.orders.find(o=>o.id===receipt[1].order);
      if(ownOrder)s.members[key]={phone:normalizePhone(ownOrder.phone)};
    }
    const byPhone = new Map();
    for (const account of Object.values(s.accounts)) {
      const m=profile(s,account);byPhone.set(account.phone,{id:m.id,rank:m.rank,elder:m.elder,dog:m.dog,badges:m.badges,count:m.count});
    }
    const pinnedOrder=s.orders.find(o=>(s.pins[key]||[]).includes(o.id));
    const pinnedProfile=pinnedOrder?profile(s,s.accounts[normalizePhone(pinnedOrder.phone)]):null;
    const displayMember=member(s,key)||(pinnedProfile?{...pinnedProfile,name:masked(pinnedProfile.name),orders:[pinnedOrder.id]}:null);
    const identities = new Map(s.orders.map(o => [o.id, byPhone.get(normalizePhone(o.phone)) || null]));
    return {
      products: admin ? s.products : s.products.filter(p => p.active), shipping: s.shipping, qr: s.qr,
      ...(admin ? { nextOrder: ticket(s.seq + 1) } : {}),
      member: displayMember, pins: [...new Set([...(s.pins[key] || []), ...(member(s, key)?.orders || [])])],
      orders: admin ? s.orders.map(o => ({...o,identity:identities.get(o.id)})) : s.orders.map(o => ({ id: o.id, customer: masked(o.buyer), stage: o.stage, dog: o.dog, message: o.message || '', mood: o.mood, statusAt: o.statusAt, created: o.created, items: o.items.map(i => ({ name: i.name, qty: i.qty, cat: i.cat ?? s.products.find(p=>p.id===i.id)?.cat ?? 0 })), sample: o.sample, identity: identities.get(o.id) })),
      wishes: s.wishes.map(w => ({ ...w, identity: identities.get(w.order), comments: w.comments.map(c => ({ ...c, identity: c.role === 'order' ? identities.get(c.order) : null })) })),
      remaining: Math.max(0, 3 - (s.merit[day() + ':' + meritKey(s, key)] || 0)),
      events: admin ? s.events.map(e => ({ id: e.id, type: e.type, order: e.order, status: e.status, error: e.error })) : []
    };
  }
  function apply(s, op, p, admin, key) {
    migrate(s);
    const auth = () => {
      const o = s.orders.find(o => o.id === numId(p.order));
      if (!/^\d{4}$/.test(p.last || '') || !o || o.phone.slice(-4) !== p.last) fail('号码牌和电话后四位对不上，再看一眼哦 🐶');
      return o;
    };
    const wish = () => s.wishes.find(w => w.id === p.id) || fail('找不到这封信');
    const event = (type, o) => s.events.push({ id: newId(), type, order: o.id, stage: o.stage, status: '待发送', created: Date.now(), attempts: 0, payload: JSON.parse(JSON.stringify(o)) });
    let result = {};
    if (op === 'certificate') {
      const o = auth(), m = profile(s, s.accounts[normalizePhone(o.phone)]);
      return { member: m };
    }
    if (op === 'message') {
      const o = auth(), message=text(p.message || '', 100, false);for(const other of s.orders)if(normalizePhone(other.phone)===normalizePhone(o.phone))other.message=message;return {};
    }
    if (op === 'search') {
      const q = text(p.query, 20).replace(/^(OTL-|#)/i, '');
      if (!/^\d+$/.test(q)) fail('输入订单号码或电话后四位就好');
      return { ids: s.orders.filter(o => o.id === Number(q) || (q.length === 4 && o.phone.slice(-4) === q)).map(o => o.id) };
    }
    if (op === 'pin') {
      const id = numId(p.order);
      if (!s.orders.some(o => o.id === id)) fail('没有这个号码');
      s.pins[key] = [...new Set([...(s.pins[key] || []), id])];
      return {};
    }
    if (op === 'join') {
      const o = auth(), phone = normalizePhone(o.phone), first = s.orders.filter(a => normalizePhone(a.phone) === phone).sort((a, b) => a.id - b.id)[0];
      if (!s.accounts[phone]) s.accounts[phone] = { id: first.id, phone, name: text(p.name, 20), dog: o.dog, merit: s.meritTotals[key] || 0, earned: [] };
      s.members[key] = { phone };
      const guestKey = day() + ':' + key, accountKey = day() + ':' + phone;
      s.merit[accountKey] = Math.max(s.merit[accountKey] || 0, s.merit[guestKey] || 0);
    } else if (op === 'order') {
      const token = text(p.token, 80);
      if (!/^[a-zA-Z0-9-]{12,80}$/.test(token)) fail('订单请求无效');
      if (s.receipts[key + token]) return s.receipts[key + token];
      const buyer = text(p.buyer, 65), phone = normalizePhone(text(p.phone, 22)), address = text(p.address, 70), city = text(p.city, 65), postcode = text(p.postcode, 5), payer = text(p.payer, 90);
      if (!/^[A-Za-z0-9\s.,'&()/#-]+$/.test(buyer + address + city)) fail('邮寄资料请用英文或 Malay 填写哦');
      if (!/^\d{9,15}$/.test(phone) || !/^\d{5}$/.test(postcode) || !states.includes(p.state)) fail('请检查电话、邮编和州属');
      const fee = s.shipping[[9, 10, 14].includes(states.indexOf(p.state)) ? 1 : 0];
      if (fee === null) fail('运费待店长确认');
      const dog = s.accounts[phone]?.dog ?? integer(p.dog, 0, 7);
      if (!Array.isArray(p.items) || !p.items.length || p.items.length > 100) fail('请先选择商品');
      const seen = new Set(), totals = new Map();
      const items = p.items.map(row => {
        const product = s.products.find(a => a.id === row.id && a.active && a.mode !== 'custom');
        const variant = integer(row.variant ?? 0, 0, 99), entry = product?.variants?.[variant];
        const key = row.id + ':' + variant;
        if (!product || seen.has(key) || (product.variants?.length && !entry) || (!product.variants?.length && variant !== 0)) fail('购物车需更新');
        seen.add(key);
        const qty = integer(row.qty, 1, 99);
        totals.set(product.id, (totals.get(product.id) || 0) + qty);
        return { id: product.id, name: product.name + (entry ? ' · ' + entry.label : ''), photo: product.photo || '', price: entry?.price ?? product.price, qty, variant, cat:product.cat, stocked: product.mode === 'stock' };
      });
      for (const [id, qty] of totals) {
        const product = s.products.find(a => a.id === id);
        if (product.mode === 'stock' && qty > product.stock) fail(product.name + ' 库存不足');
      }
      const total = items.reduce((sum, i) => sum + i.qty * i.price, fee);
      if (total !== p.total) fail('金额已变更，请刷新核对后提交');
      for (const [id, qty] of totals) { const item = s.products.find(a => a.id === id); if (item.mode === 'stock') item.stock -= qty; }
      const o = { id: ++s.seq, buyer, phone, address, city, postcode, state: p.state, payer, dog, mood: 0, items, total, fee, stage: 0, consent: p.consent === true, created: Date.now(), statusAt: Date.now(), carrier: '', tracking: '', url: '', message: text(p.message || '', 100, false) };
      s.orders.unshift(o);
      s.accounts[phone] ??= {id:o.id,phone,name:buyer,dog,merit:s.meritTotals[key]||0,earned:[]};
      s.members[key]={phone};s.owners[key]=phone;
      const guestMerit=day()+':'+key, employeeMerit=day()+':'+phone;
      s.merit[employeeMerit]=Math.max(s.merit[employeeMerit]||0,s.merit[guestMerit]||0);
      s.pins[key] = [...new Set([...(s.pins[key] || []), o.id])];
      event('新订单邮件', o); result = { order: o.id, dog: o.dog }; s.receipts[key + token] = result;
    } else if (op === 'parcel') {
      const o = auth();
      if (![3, 4].includes(o.stage)) fail('包裹还没寄出');
      return { tracking: o.tracking, carrier: o.carrier, url: o.url };
    } else if (op === 'wish') {
      const o = auth();
      const w = { id: newId(), order: o.id, dog: o.dog, text: text(p.text, 80), note: text(p.note || '', 300, false), done: false, created: Date.now(), votes: 0, comments: [] };
      s.wishes.unshift(w); result = { id: w.id };
    } else if (op === 'vote') {
      const w = wish(), k = day() + ':' + meritKey(s, key);
      if ((s.merit[k] || 0) >= 3) fail('今天功德圆满，熬到 12am 再敲啦 🪵');
      s.merit[k] = (s.merit[k] || 0) + 1; w.votes++;
      s.meritTotals[key] = (s.meritTotals[key] || 0) + 1;
      if (account(s, key)) account(s, key).merit = (account(s, key).merit || 0) + 1;
    } else if (op === 'comment') {
      const w = wish(), message = text(p.text, 300), o = p.role === 'order' ? auth() : null;
      if (p.role === 'owner' && !admin) fail('请先登录');
      const original = s.orders.find(a => a.id === w.order);
      w.comments.push({ id: newId(), text: message, time: Date.now(), role: p.role === 'owner' ? 'owner' : o ? 'order' : 'guest', order: o?.id, dog: o?.dog, author: !!(o && original && normalizePhone(o.phone) === normalizePhone(original.phone)) });
    } else {
      if (!admin) fail('请先登录');
      if (op === 'product') {
        const cat = integer(p.cat, 0, 2), name = text(p.name, 60);
        if (!['stock', 'pre', 'custom'].includes(p.mode)) fail('请选择销售方式');
        const variants = (p.variants || []).map(v => ({ label: text(v.label, 30), price: integer(v.price, 1, 99999999) }));
        if (variants.length > 12) fail('最多设置 12 种规格');
        const item = { id: p.id ? text(p.id, 80) : newId(), name, cat, price: integer(p.price, 1, 99999999), stock: integer(p.stock, 0, 99999), mode: cat && p.mode !== 'custom' ? 'pre' : p.mode, lead: text(p.lead || '', 80, false), description: text(p.description || '', 200, false), photo: photo(p.photo), active: !!p.active, variants };
        const index = s.products.findIndex(x => x.id === item.id);
        if (index >= 0) s.products[index] = item; else s.products.push(item);
      } else if (op === 'reset-order-numbering') {
        if (s.orders.length || s.events.some(event => event.status === '发送中')) fail('请先清空测试订单；存在订单时不能重置编号');
        if (p.confirm !== 'RESET 001') fail('请确认从 #001 开始编号');
        s.seq = 0;
        result = { nextOrder: '#001' };
      } else if (op === 'delete-test-order') {
        const id = numId(p.order), o = s.orders.find(o => o.id === id) || fail('找不到订单');
        if (p.confirm !== ticket(id)) fail('请核对要删除的测试订单号码');
        if (s.events.some(e => e.order === id && e.status === '发送中')) fail('通知正在发送，请稍后再清理');
        for (const item of o.items) {
          const product = s.products.find(product => product.id === item.id);
          if (item.stocked && product) product.stock += item.qty;
        }
        s.orders = s.orders.filter(order => order.id !== id);
        s.events = s.events.filter(event => event.order !== id);
        s.wishes = s.wishes.filter(wish => wish.order !== id);
        for (const wish of s.wishes) wish.comments = wish.comments.filter(comment => comment.order !== id);
        for (const [key, receipt] of Object.entries(s.receipts)) if (receipt.order === id) delete s.receipts[key];
        for (const key of Object.keys(s.pins)) s.pins[key] = s.pins[key].filter(order => order !== id);
        const phone = normalizePhone(o.phone), remaining = s.orders.filter(order => normalizePhone(order.phone) === phone).sort((a,b) => a.id-b.id);
        if (!remaining.length) {
          delete s.accounts[phone];
          for (const key of Object.keys(s.members)) if (normalizePhone(s.members[key].phone) === phone) delete s.members[key];
          for (const key of Object.keys(s.owners)) if (normalizePhone(s.owners[key]) === phone) delete s.owners[key];
        } else if (s.accounts[phone]?.id === id) s.accounts[phone].id = remaining[0].id;
        result = { deleted: id };
      } else if (op === 'settings') {
        const shipping = [p.west, p.east].map(v => v === null ? null : integer(v, 0, 999999));
        const qr = photo(p.qr); s.shipping = shipping; s.qr = qr;
      } else if (op === 'update') {
        const o = s.orders.find(o => o.id === numId(p.order)) || fail('找不到订单');
        if (p.version !== undefined && p.version !== (o.version || 0)) fail('这笔订单刚更新过，请重新打开');
        const stage = integer(p.stage, 0, stages.length - 1), url = text(p.url || '', 500, false);
        if (url && !/^https:\/\//i.test(url)) fail('物流链接须以 https:// 开头');
        const edits = { stage, mood: integer(p.mood ?? 0, 0, moods[stage].length - 1), url, handover: o.handover || stage === 2, carrier: text(p.carrier || '', 60, false), tracking: text(p.tracking || '', 100, false), address: text(p.address || o.address, 70), note: text(p.note || '', 200, false) };
        if (p.quantities) {
          if (!Array.isArray(p.quantities) || p.quantities.length !== o.items.length) fail('订单内容已变更');
          const quantities = p.quantities.map(q => integer(q, 0, 99));
          if (!quantities.some(Boolean)) fail('至少保留一件商品');
          const deltas = new Map();
          o.items.forEach((item, i) => { if (item.stocked) deltas.set(item.id, (deltas.get(item.id) || 0) + quantities[i] - item.qty); });
          for (const [id, delta] of deltas) { const item = s.products.find(a => a.id === id); if (delta && (!item || item.stock < delta)) fail('现货库存不足'); }
          edits.items = o.items.map((i, n) => ({ ...i, qty: quantities[n] })).filter(i => i.qty);
          edits.total = edits.items.reduce((sum, i) => sum + i.qty * i.price, o.fee || 0);
          for (const [id, delta] of deltas) { const item = s.products.find(a => a.id === id); if (item) item.stock -= delta; }
        }
        const changed = stage !== o.stage;
        if (changed) edits.statusAt = Date.now();
        Object.assign(o, edits); o.version = (o.version || 0) + 1;
        if (changed && o.consent) event('WhatsApp 状态通知', o);
      } else if (op === 'done') wish().done = !!p.done;
      else if (op === 'retryevent') {
        const e = s.events.find(e => e.id === p.id) || fail('找不到通知');
        if (e.status === '发送中') fail('通知仍在发送，请稍候');
        if (e.status === '已发送') fail('这条通知已经发过了');
        e.status = '待发送'; e.error = '';
      } else fail('无法识别操作');
    }
    for (const a of Object.values(s.accounts)) {
      const m=profile(s,a);a.earned=m.badges.filter(b=>b.earned).map(b=>b.id);
    }
    return result;
  }
  return { dogs, stages, moods, cats, states, initial, migrate, project, apply, ticket, day, numId, member, daysInStage, moodIndex, statusLine };
})();
if (typeof module !== 'undefined') module.exports = Lab;
