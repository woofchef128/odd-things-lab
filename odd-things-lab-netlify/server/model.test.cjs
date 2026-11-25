const { test } = require('node:test');
const assert = require('node:assert/strict');
const Lab = require('./model.cjs');
function payload(overrides = {}) {
  return { token: crypto.randomUUID(), buyer: 'Aina Lee', phone: '0124390204', address: '123, Jalan ABC', city: 'Kuala Lumpur', postcode: '50000', state: 'W.P. Kuala Lumpur', payer: 'Aina Lee', dog: 5, items: [{ id: 'p0', qty: 1, variant: 0 }], total: 3700, ...overrides };
}
test('order retry produces one order and one stock reservation', () => {
  const s = Lab.initial(true), p = payload();
  const a = Lab.apply(s, 'order', p, false, 'one');
  const b = Lab.apply(s, 'order', p, false, 'one');
  assert.deepEqual(a, b); assert.equal(s.products[0].stock, 11); assert.equal(s.orders.filter(o => o.id === a.order).length, 1);
  assert.equal(Lab.project(s, false, 'one').pins[0], a.order);
});
test('variant orders aggregate stock and use server prices', () => {
  const s = Lab.initial(true); s.products[0].stock = 2;
  s.products[0].variants = [{ label: 'A', price: 2900 }, { label: 'B', price: 3000 }];
  assert.throws(() => Lab.apply(s, 'order', payload({ items: [{ id: 'p0', qty: 2, variant: 0 }, { id: 'p0', qty: 1, variant: 1 }], total: 9600 }), false, 'one'), /库存不足/);
  assert.equal(s.products[0].stock, 2);
  assert.throws(() => Lab.apply(s, 'order', payload({ total: 1 }), false, 'one'), /金额已变更/);
});
test('search disambiguates matching order number and phone suffix without exposing addresses', () => {
  const s = Lab.initial(true); s.orders.push({ ...s.orders[0], id: 2049, buyer: 'Other Person', phone: '000009999' });
  assert.deepEqual(Lab.apply(s, 'search', { query: '2049' }, false, 'one').ids, [49, 2049]);
  const publicState = Lab.project(s, false, 'one');
  assert(!JSON.stringify(publicState.orders).includes('0000002049'));
  assert(publicState.orders.every(o => !('tracking' in o) && !('address' in o)));
  assert.throws(() => Lab.apply(s, 'parcel', { order: 49, last: '9999' }, false, 'one'));
  assert.equal(Lab.apply(s, 'parcel', { order: 49, last: '2049' }, false, 'one').tracking, 'DEMO-049');
});
test('employee number remains stable, milestones synchronize and opening a letter is realization', () => {
  const s = Lab.initial(true);
  Lab.apply(s, 'join', { order: 49, last: '2049', name: '小麻瓜' }, false, 'one');
  assert.equal(Lab.member(s, 'one').id, 49);
  for (let i = 0; i < 10; i++) Lab.apply(s, 'comment', { id: 'wish-example', role: 'order', order: 49, last: '2049', text: '留言 ' + i }, false, 'one');
  assert.equal(Lab.member(s, 'one').rank, '实习麻瓜');
  Lab.apply(s, 'done', { id: 'wish-example', done: true }, true, 'owner');
  const m = Lab.member(s, 'one'); assert.equal(m.rank, '麻瓜员工'); assert(m.elder); assert.equal(m.badges.length, 9);
  const p = Lab.project(s, false, 'one');
  assert.equal(p.orders.find(o => o.id === 49).identity.rank, m.rank);
  assert.equal(p.wishes[0].comments[0].identity.rank, m.rank);
  Lab.apply(s, 'join', { order: 49, last: '2049', name: '另一个昵称' }, false, 'another-device');
  assert.equal(Lab.member(s, 'another-device').id, 49); assert.equal(Lab.member(s, 'another-device').name, 'Aina Lee');
});
test('daily merit is limited and stays limited after employee join', () => {
  const s = Lab.initial(true);
  for (let i = 0; i < 3; i++) Lab.apply(s, 'vote', { id: 'wish-example' }, false, 'one');
  assert.throws(() => Lab.apply(s, 'vote', { id: 'wish-example' }, false, 'one'));
  Lab.apply(s, 'join', { order: 49, last: '2049', name: '小麻瓜' }, false, 'one');
  assert.equal(Lab.project(s, false, 'one').remaining, 0);
  Lab.apply(s, 'join', { order: 49, last: '2049', name: '小麻瓜' }, false, 'two');
  assert.equal(Lab.project(s, false, 'two').remaining, 0);
});
test('changing stage resets mood time and rejects stale owner edits', () => {
  const s = Lab.initial(true), before = Date.now();
  Lab.apply(s, 'update', { order: 49, stage: 1, mood: 0, version: 0 }, true, 'owner');
  assert(s.orders[0].statusAt >= before);
  assert.throws(() => Lab.apply(s, 'update', { order: 49, stage: 4, mood: 0, version: 0 }, true, 'owner'), /刚更新过/);
  assert.equal(s.orders[0].stage, 1);
});
test('untrusted visitors cannot update products, stages or impersonate the owner', () => {
  const s = Lab.initial(true);
  assert.throws(() => Lab.apply(s, 'update', { order: 49, stage: 4 }, false, 'one'));
  assert.throws(() => Lab.apply(s, 'product', {}, false, 'one'));
  assert.throws(() => Lab.apply(s, 'comment', { id: 'wish-example', role: 'owner', text: '伪造' }, false, 'one'));
});
test('legacy data migrates without losing orders and staff identity', () => {
  const s = Lab.initial(true); delete s.version; delete s.accounts;
  s.members = { old: { phone: '0000002049', id: 49, dog: 5, name: '老麻瓜' } };
  Lab.migrate(s); Lab.migrate(s);
  assert.equal(s.orders.length, 3); assert.equal(Lab.member(s, 'old').id, 49); assert.equal(s.version, 4);
});

test('status text changes only at Malaysian midnight and moods advance then stay at final frame', () => {
  const start=Date.parse('2026-11-25T15:59:00Z'), o={id:49,stage:6,statusAt:start};
  assert.equal(Lab.statusLine(o,start),Lab.statusLine(o,start+30000));
  assert.notEqual(Lab.statusLine(o,start),Lab.statusLine(o,start+60000));
  assert.equal(Lab.moodIndex(o,start),0);
  assert.equal(Lab.moodIndex(o,start+60000),1);
  assert.equal(Lab.moodIndex(o,start+86460000),2);
  assert.equal(Lab.moodIndex(o,start+8*86400000),2);
});

test('message and private certificate require exact order phone suffix; public profiles are masked', () => {
  const s=Lab.initial(true);Lab.migrate(s);
  assert.throws(()=>Lab.apply(s,'message',{order:49,last:'9999',message:'hello'},false,'guest'));
  assert.throws(()=>Lab.apply(s,'certificate',{order:49,last:'9999'},false,'guest'));
  Lab.apply(s,'message',{order:49,last:'2049',message:'小狗催一下'},false,'guest');
  assert.equal(Lab.project(s,false,'guest').orders.find(o=>o.id===49).message,'小狗催一下');
  const cert=Lab.apply(s,'certificate',{order:49,last:'2049'},false,'guest');assert.equal(cert.member.name,'Aina Lee');
  const publicOrder=Lab.project(s,false,'guest').orders.find(o=>o.id===49);
  assert.notEqual(publicOrder.customer,'Aina Lee');assert.ok(publicOrder.identity.badges.length);assert.equal(publicOrder.phone,undefined);
});

test('one verified message update applies to the same customer orders only', () => {
  const s=Lab.initial(true);s.orders.push({...s.orders[0],id:50});
  Lab.apply(s,'message',{order:49,last:'2049',message:'慢慢来 🐾'},false,'guest');
  assert.equal(s.orders.find(o=>o.id===49).message,'慢慢来 🐾');
  assert.equal(s.orders.find(o=>o.id===50).message,'慢慢来 🐾');
  assert.equal(s.orders.find(o=>o.id===48).message,undefined);
});

test('returning customer keeps the first tracking dog on later orders', () => {
  const s=Lab.initial(true),p=payload({dog:2});
  const first=Lab.apply(s,'order',p,false,'visitor').order;
  const next=Lab.apply(s,'order',payload({dog:7}),false,'visitor').order;
  assert.equal(s.orders.find(o=>o.id===first).dog,2);
  assert.equal(s.orders.find(o=>o.id===next).dog,2);
  assert.equal(Lab.project(s,false,'visitor').member.dog,2);
});
test('test-order cleanup requires admin, restores stock, and keeps other orders and sequence', () => {
  const s=Lab.initial(true), p=payload();
  s.products[0].photo='data:image/png;base64,aGVsbG8=';
  const result=Lab.apply(s,'order',p,false,'test-visitor');
  const order=s.orders.find(o=>o.id===result.order);
  assert.equal(order.items[0].photo,s.products[0].photo);
  const cleanup={order:order.id,confirm:Lab.ticket(order.id)};
  assert.throws(()=>Lab.apply(s,'delete-test-order',cleanup,false,'test-visitor'));
  assert.throws(()=>Lab.apply(s,'delete-test-order',{...cleanup,confirm:'wrong'},true,'owner'));
  const seq=s.seq;
  Lab.apply(s,'delete-test-order',cleanup,true,'owner');
  assert.equal(s.seq,seq);
  assert.equal(s.products[0].stock,12);
  assert.equal(s.orders.length,3);
  assert.ok(!s.events.some(e=>e.order===order.id));
  assert.ok(!Object.values(s.receipts).some(r=>r.order===order.id));
  assert.ok(!(s.pins['test-visitor']||[]).includes(order.id));
});
test('numbering reset requires admin and an empty store; next real order starts at 001', () => {
  const s=Lab.initial(true);
  assert.throws(()=>Lab.apply(s,'reset-order-numbering',{confirm:'RESET 001'},true,'owner'));
  for(const o of [...s.orders]) Lab.apply(s,'delete-test-order',{order:o.id,confirm:Lab.ticket(o.id)},true,'owner');
  assert.throws(()=>Lab.apply(s,'reset-order-numbering',{confirm:'RESET 001'},false,'visitor'));
  assert.throws(()=>Lab.apply(s,'reset-order-numbering',{confirm:'wrong'},true,'owner'));
  Lab.apply(s,'reset-order-numbering',{confirm:'RESET 001'},true,'owner');
  assert.equal(Lab.project(s,true,'owner').nextOrder,'#001');
  const r=Lab.apply(s,'order',payload(),false,'visitor');
  assert.equal(r.order,1);
  assert.throws(()=>Lab.apply(s,'reset-order-numbering',{confirm:'RESET 001'},true,'owner'));
});
