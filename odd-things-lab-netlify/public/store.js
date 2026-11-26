'use strict';
const $ = id => document.getElementById(id);
const screen = $('screen');
const modal = $('modal');
const demo = location.protocol === 'file:' || document.documentElement.dataset.demo === 'true';
const wa = 'https://wa.me/60124390204';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = value => 'RM ' + (value / 100).toFixed(2);
const art = name => window.EMBED_ART?.[name] || 'art/' + name;
function read(key, fallback) { try { return JSON.parse(localStorage.getItem('magua4:' + key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem('magua4:' + key, JSON.stringify(value)); } catch { throw Error('本机储存空间不足，图片请压小一点再试。'); } }
let state, isAdmin = false, route = 'home', ownerTab = 'orders', orderFilter = '', orderQuery = '';
let cartCustom = read('cart-custom', {});
let cart = read('cart', {}), requestToken = read('request', '') || crypto.randomUUID();
let quiet = read('quiet', false), musicOn = false, selectedDog = 5, letterDone = false;
let audioContext, beatTimer, toastTimer, busy = false, searchResults = null, lastFocused, notifiedOrders = null, welcomeChecked = false;
let dogLine = '把信给我。店长看不看，我先用鼻子催。';
const lookKeys = [['question'], ['woodfish','sweat','soul'], ['expectant'], ['excited'], ['graduate'], ['outline'], ['queuehappy','vacant','sleepy'], ['inspect']];
let activeCategory = null, productSort = 'price-down', productFilter = '';
const messagePresets = {'催店长':['店长，我只是路过来看看进度 👀','小狗，替我轻轻催一下啦 🐾'], '佛系等单':['慢慢来，做好看一点就行 🍵','我不急，小狗你也坐一下 🐶'], '给店长打气':['店长加油，我等得起 💪','两只手辛苦了，给你递杯水 🧃'], '嘴硬':['我才没有每天来查单呢 🙄','随便看看，真的不是想你了 👀']};
const tickerLines = [
  '🐶 店长努力加工中，小狗负责精神监工。', '🖨️ 打印机在跑，店长没跑。麻瓜请放心。',
  '🫠 做得慢是手工，回得慢是手忙。', '📦 您的快乐正在排队，小狗暂时不接受插队零食。',
  '🪵 店长有两只手。许愿长出第三只，暂未研究成功。'
];
async function api(op, payload = {}) {
  if (demo) {
    const database = read('demo', null) || Lab.initial(true);
    Lab.migrate(database);
    let result = {};
    if (op === 'login') {if(payload.email?.toLowerCase()!=='owner@gmail.com'||payload.password!=='magua-demo')throw Error('Gmail 或研究所密码不正确');isAdmin = true;}
    else if (op === 'logout') isAdmin = false;
    else if (op) result = Lab.apply(database, op, payload, isAdmin, 'local-visitor');
    if (op) save('demo', database);
    state = Lab.project(database, isAdmin, 'local-visitor');
    return result;
  }
  const response = await fetch('/api/shop', op ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, op }) } : { cache: 'no-store' });
  let data;
  try { data = await response.json(); } catch { throw Error('店铺服务暂时没连上，请刷新再试。'); }
  if (!response.ok) throw Error(data.error || '连接失败，请稍候');
  if (data.state) { state = data.state; isAdmin = data.admin; } else await api();
  return data.result || {};
}
function tell(message) {
  $('toast').textContent = message;
  $('toast').classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('on'), 3200);
}
function context() { audioContext ??= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume(); return audioContext; }
function tone(frequency = 500, duration = .065, music = false, volume = .035) {
  if (quiet && !music) return;
  try {
    const c = context(), oscillator = c.createOscillator(), gain = c.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = music ? 'triangle' : 'sine';
    oscillator.connect(gain); gain.connect(c.destination);
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, c.currentTime + duration);
    oscillator.start(); oscillator.stop(c.currentTime + duration);
  } catch {}
}
function sound(name) {
  if (quiet) return;
  const audio = new Audio(window.EMBED_SOUND?.[name] || 'sound/' + name + '.wav');
  audio.volume = .6; audio.play().catch(() => {});
}
function rustle() {
  if (quiet) return;
  try {
    const c = context(), length = Math.floor(c.sampleRate * .38), buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / length) * .08;
    const source = c.createBufferSource(), filter = c.createBiquadFilter(); source.buffer = buffer; filter.type = 'highpass'; filter.frequency.value = 2200;
    source.connect(filter); filter.connect(c.destination); source.start();
    setTimeout(() => tone(160, .09), 300);
  } catch {}
}
function bark(index) {
  if (quiet) return;
  const profiles = [[160, .19, 1], [290, .13, 2], [230, .12, 2], [360, .11, 1], [310, .12, 2], [190, .21, 1], [135, .17, 2], [175, .16, 1]];
  try {
    const c = context(), [pitch, duration, count] = profiles[index];
    for (let n = 0; n < count; n++) {
      const at = c.currentTime + n * .19, source = c.createOscillator(), filter = c.createBiquadFilter(), gain = c.createGain();
      source.type = 'sawtooth'; source.frequency.setValueAtTime(pitch * 1.8, at); source.frequency.exponentialRampToValueAtTime(pitch * .7, at + duration);
      filter.type = 'bandpass'; filter.frequency.value = 1000 + index * 105; filter.Q.value = .7;
      gain.gain.setValueAtTime(.001, at); gain.gain.exponentialRampToValueAtTime(.12, at + .02); gain.gain.exponentialRampToValueAtTime(.001, at + duration);
      source.connect(filter); filter.connect(gain); gain.connect(c.destination); source.start(at); source.stop(at + duration);
    }
  } catch {}
}
function puppyBarks(){if(quiet)return;try{const c=context();for(let n=0;n<2;n++){const at=c.currentTime+n*.21,o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type='triangle';o.frequency.setValueAtTime(640,at);o.frequency.exponentialRampToValueAtTime(350,at+.11);f.type='bandpass';f.frequency.value=1300;f.Q.value=.7;g.gain.setValueAtTime(.001,at);g.gain.exponentialRampToValueAtTime(.12,at+.018);g.gain.exponentialRampToValueAtTime(.001,at+.14);o.connect(f);f.connect(g);g.connect(c.destination);o.start(at);o.stop(at+.15);}}catch{}}
function dogSound(dog){
  if(quiet)return;
  const look=dog?.className||'';
  const index=Lab.dogs.findIndex(name=>dog?.getAttribute('aria-label')?.startsWith(name));
  if(look.includes('woodfish')){sound('woodfish');return;}
  if(/excited|graduate|expectant|queuehappy|normal/.test(look)){bark(index<0?5:index);return;}
  try{
    const c=context(), source=c.createOscillator(),gain=c.createGain(),filter=c.createBiquadFilter();
    const sleep=look.includes('sleepy'),gone=look.includes('evaporating'),sigh=/soul|sweat|vacant/.test(look);
    const duration=sleep?.65:gone?.16:sigh?.48:.2;
    source.type=sleep?'triangle':gone?'sawtooth':'sine';
    source.frequency.setValueAtTime(sleep?90:gone?220:sigh?260:660,c.currentTime);
    source.frequency.exponentialRampToValueAtTime(sleep?60:gone?45:sigh?90:440,c.currentTime+duration);
    filter.type='lowpass';filter.frequency.value=sleep?260:gone?400:1200;
    gain.gain.setValueAtTime(.001,c.currentTime);gain.gain.exponentialRampToValueAtTime(.075,c.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);
    source.connect(filter);filter.connect(gain);gain.connect(c.destination);source.start();source.stop(c.currentTime+duration);
  }catch{}
}
function toggleMusic() {
  musicOn = !musicOn;
  if (beatTimer) clearInterval(beatTimer);
  beatTimer = null;
  if (musicOn) {
    let beat = 0;
    const melody = [392, 0, 440, 523, 0, 440, 392, 330, 349, 0, 392, 440, 0, 330, 294, 0, 330, 392, 0, 523, 587, 0, 523, 440, 392, 0, 349, 330, 294, 0, 330, 392];
    const play = () => {
      const note = melody[beat % melody.length];
      if (note) tone(note, .18, true, .025);
      if (beat % 4 === 0) tone([130.81, 110, 87.31, 98][Math.floor(beat / 8) % 4], .3, true, .035);
      beat++;
    };
    play(); beatTimer = setInterval(play, 245);
  }
  header();
}
function say(message) {
  dogLine = message;
  if ($('dog-says')) $('dog-says').textContent = message;

}
function field(name, label, placeholder = '', attributes = '', value = '') {
  return '<label>' + label + '<input name="' + name + '" placeholder="' + esc(placeholder) + '" value="' + esc(value) + '" ' + attributes + '></label>';
}
const credentials = () => '<div class="pair">' + field('order', '🎫 订单号码 **', '例如 49', 'required inputmode="numeric" maxlength="16"') + field('last', '📞 下单电话后四位 **', '4 位数字', 'required inputmode="numeric" pattern="[0-9]{4}" maxlength="4"') + '</div>';
function options(values, current) { return values.map((value, index) => '<option value="' + index + '" ' + (index === current ? 'selected' : '') + '>' + esc(value) + '</option>').join(''); }
function stageOptions(current){return [0,6,1,7,2,3,4,5].map(i=>'<option value="'+i+'" '+(i===current?'selected':'')+'>'+Lab.stages[i]+'</option>').join('');}
function dialog(title, body, kind = '') {
  lastFocused = document.activeElement;
  modal.className = kind;
  $('dialog-title').textContent = title;
  $('dialog-body').innerHTML = body + '<p id="form-error" class="error" role="alert"></p>';
  if (!modal.open) modal.showModal();
}
function close() { modal.close(); lastFocused?.focus?.(); }
$('close').onclick = () => {if(modal.classList.contains('welcome-popup'))leaveWelcome();else close();};
modal.addEventListener('click', event => {
  if(modal.classList.contains('welcome-popup')){if(event.target.closest('[data-act=welcome-track]'))close();else leaveWelcome();}
  else if(event.target===modal)close();
});
modal.addEventListener('cancel',event=>{if(modal.classList.contains('welcome-popup')){event.preventDefault();leaveWelcome();}});
function ago(time) {
  const hours = Math.max(0, Math.floor((Date.now() - (time || Date.now())) / 3600000));
  return hours < 1 ? '刚刚' : hours < 24 ? hours + ' 小时前' : Math.floor(hours / 24) + ' 天前';
}
function lookFor(order) {return Lab.moodIndex(order);}
function eyeExpression(eye, look, eyeIndex=0) {
  const {x,y,r,fur}=eye;
  if(look==='normal'||look==='hourglass'||(look==='inspect'&&eyeIndex===1))return '';
  const mask='<ellipse cx="'+x+'" cy="'+y+'" rx="'+(r+1)+'" ry="'+(r+1)+'" fill="'+fur+'"/>';
  let line='';
  if(look==='question')return mask+'<text x="'+x+'" y="'+(y+2.1)+'" text-anchor="middle" fill="#30231d" font-size="11" font-weight="900">?</text>';
  if(['excited','graduate','queuehappy','woodfish'].includes(look))line='<path d="M '+(x-2)+' '+(y+1)+' Q '+x+' '+(y-2)+' '+(x+2)+' '+(y+1)+'"/>';
  else if(look==='soul')line='<path d="M '+(x-3.3)+' '+(y-3.3)+' l 6.6 6.6 m 0 -6.6 l -6.6 6.6"/>';
  else if(['sleepy','vacant'].includes(look))line='<path d="M '+(x-2)+' '+y+' h4"/>';
  else if(look==='sweat')line='<circle cx="'+(x+1.7)+'" cy="'+y+'" r=".8" fill="#30231d"/>';
  else if(['expectant','inspect'].includes(look))return mask+'<ellipse cx="'+x+'" cy="'+y+'" rx="3.5" ry="4.1" fill="#2c241f"/><circle cx="'+(x-1)+'" cy="'+(y-1.6)+'" r="1.3" fill="white"/><circle cx="'+(x+1.3)+'" cy="'+(y+1.7)+'" r=".7" fill="white"/>';
  if(look==='queuehappy')line+='<path d="M '+(x-2)+' '+(y+(eyeIndex===0?-4:-2))+' L '+(x+2)+' '+(y+(eyeIndex===0?-2:-4))+'"/>';
  return mask+'<g fill="none" stroke="#30231d" stroke-width="1.2" stroke-linecap="round">'+line+'</g>';
}
function mouthExpression(mouth,look){
  if(!mouth||!['crying','angry','deadpan','excited','graduate','ghost','soul'].includes(look))return '';
  const {x,y,rx,ry,fur}=mouth;
  const mask='<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+fur+'"/>';
  let path;
  if(['excited','graduate'].includes(look))path='<path d="M '+(x-2.4)+' '+(y-1)+' Q '+x+' '+(y+1)+' '+(x+2.4)+' '+(y-1)+' Q '+(x+2)+' '+(y+4)+' '+x+' '+(y+4)+' Q '+(x-2)+' '+(y+4)+' '+(x-2.4)+' '+(y-1)+'Z" fill="#e9a48e"/>';
  else if(look==='ghost')path='<ellipse cx="'+x+'" cy="'+y+'" rx="1.6" ry="2" fill="#4e3c2b"/>';
  else path='<path d="M '+(x-2.2)+' '+y+' Q '+x+' '+(y-(look==='deadpan'?0:2))+' '+(x+2.2)+' '+y+'" fill="none"/>';
  return mask+'<g stroke="#30251e" stroke-width=".9" stroke-linecap="round">'+path+'</g>';
}
function dogVisual(index=5,look='normal',extra='') {
  const rig=DOG_RIGS[index]||DOG_RIGS[5];
  const style='--dog-x:'+(index%4*100/3)+'%;--dog-y:'+(Math.floor(index/4)*100)+'%;--cut:'+rig.cut+'%;--head-pivot:'+((rig.eyes[0].x+rig.eyes[1].x)/2)+'%;--welcome-body-lift:'+(-(90-rig.cut)*.22)+'%';
  if(['outline','ghost'].includes(look))return '<span role="img" aria-label="'+Lab.dogs[index]+' · 离家中" class="dog-art evaporating '+extra+'"><svg viewBox="0 0 100 100" class="departed-dog"><path d="'+rig.outline+'" fill="none" stroke="#a59d8e" stroke-width="1.4" stroke-dasharray="2.5 2.7" stroke-linecap="round"/><text x="50" y="62" text-anchor="middle" fill="#786d60" font-size="13" font-weight="800">离家中</text><g class="departure-smoke" fill="#d8d1c6"><ellipse cx="11" cy="65" rx="10" ry="7"/><circle cx="9" cy="58" r="6"/><ellipse cx="90" cy="65" rx="10" ry="7"/><circle cx="93" cy="57" r="6"/></g><g class="evaporate-dust" fill="#b8afa0"><circle cx="38" cy="16" r="1.3"/><circle cx="54" cy="7" r="1.5"/><circle cx="70" cy="20" r="1"/></g></svg></span>';
  const headProps=['sleepy','angry','deadpan','excited','sparkling','graduate','vacant','sweat','soul','inspect'].includes(look);
  const headDecoration=headProps?'<span class="rig-prop head-prop" '+(look==='inspect'?'style="left:'+(rig.eyes[0].x-11)+'%;top:'+(rig.eyes[0].y-10)+'%;width:27%;height:27%"':'')+' aria-hidden="true">'+prop(look)+'</span>':'';
  const bodyDecoration=!headProps&&look!=='normal'?'<span class="rig-prop body-prop" aria-hidden="true">'+prop(look==='question'?'hourglass':look)+'</span>':'';
  const face=rig.eyes.map((e,n)=>eyeExpression(e,look,n)).join('')+mouthExpression(rig.mouth,look);
  const fur=['#fbeedb','#faecd9','#faead4','#fff7eb','#b97e60','#f9c67e','#4d4646','#d99c63'][index];
  const wave=extra.includes('waving')?'<svg class="wave-paw" viewBox="0 0 50 70" aria-hidden="true"><path d="M12 65C9 53 17 44 17 33C8 28 8 17 14 12C20 5 32 7 35 16C42 13 48 20 44 27C44 41 31 50 29 65Z" fill="'+fur+'" stroke="#201d18" stroke-width="4" stroke-linejoin="round"/><path d="M18 19v7m9-9v8m9-5-2 7" fill="none" stroke="#201d18" stroke-width="2.5" stroke-linecap="round"/></svg>':'';
  return '<span role="img" aria-label="'+Lab.dogs[index]+' · '+esc(look)+'" class="dog-art rigged look-'+look+' '+extra+'" style="'+style+'"><span class="dog-sprite dog-body"></span><span class="dog-head-group"><span class="dog-sprite dog-head-base"></span><svg class="rig-face" viewBox="0 0 100 100">'+face+'</svg>'+headDecoration+'</span>'+bodyDecoration+(look==='woodfish'?'<span class=woodfish-words>咚 咚 咚</span>':'')+wave+'</span>';
}
function prop(look) {
  const props = {
    question: '',
    vacant:'<text x="16" y="18" text-anchor="middle" fill="#736857" stroke="none" font-size="11">无语</text>',
    sweat:'<path d="M21 4C12 14 15 22 21 22S30 14 21 4Z" fill="#a4d4df"/>',
    soul:'<path class="soul-rising" d="M6 27V14C6 0 27 1 27 14V27L21 23 16 28 11 24Z" fill="#eff5ec"/><path d="M12 13h1m8 0h1M14 20h6"/>',
    inspect:'<circle cx="13" cy="12" r="9" fill="#c9e6e280"/><path d="M20 20L30 30" stroke-width="5"/>',
    hourglass: '<path d="M8 4h16v4c0 4-3 6-6 8 3 2 6 4 6 8v4H8v-4c0-4 3-6 6-8-3-2-6-4-6-8Z" fill="#fff6d9"/><path d="m10 9 6 5 6-5m-12 16 6-6 6 6" fill="#dbad5c"/><path d="M6 3h20M6 29h20"/>',
    sleepy: '<path d="M8 8h15L9 22h15M4 27h7m12-24h4"/>',
    angry: '<path d="M10 24V14m6 9V11m6 13V14M8 10C2 8 7 1 12 5c2-6 11-3 9 2 8-1 9 7 3 8"/>',
    deadpan: '<circle cx="7" cy="15" r="2"/><circle cx="16" cy="15" r="2"/><circle cx="25" cy="15" r="2"/>',
    woodfish: '<path d="M4 23c0-7 8-11 16-9 12 2 12 14-1 14H7Z" fill="#db9f58"/><path d="M5 23h10"/><g class="woodfish-mallet"><path d="M5 11l11-6"/><circle cx="18" cy="5" r="4" fill="#f0cb8a"/></g>',
    handover: '<path d="M3 31V10l7-5 6 6 6-6 7 5v21" fill="#91ae80"/><rect x="8" y="16" width="18" height="14" rx="2" fill="#d6a871"/><path d="M15 16h5v7h-5Z" fill="#fff0cd"/>',
    excited: '<path d="m8 21 4-16m7 18 9-12" stroke="#cd6b43" stroke-width="5"/>',
    sparkling: '<path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#efca69"/>',
    parcel: '<rect x="2" y="10" width="28" height="20" rx="3" fill="#dcaf74"/><path d="M2 16h28M13 10h6v14h-6Z" fill="#fff0cd"/>',
    graduate: '<path d="m1 10 15-7 15 7-15 7Zm6 4v9c6 4 13 4 18 0v-9" fill="#5d5349"/><path d="m26 10 3 3v13" stroke="#bf7149"/>',
    ghost: '<path d="M5 24V13C5 0 27 1 27 14v13l-6-4-5 5-5-5Z" fill="#d8edef"/><path d="m10 12 3 3m0-3-3 3m9-3 3 3m0-3-3 3"/>'
  };
  return props[look] ? '<svg viewBox="0 0 32 32" fill="none" stroke="#45372b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + props[look] + '</svg>' : '';
}
function rankTag(member) { return member ? '<button type="button" class="rank-tag" data-act="profile" data-member="'+member.id+'">' + esc(member.rank) + '</button>' : ''; }
function ticker() { return '<div class="ticker"><div>' + [...tickerLines, ...tickerLines].map(line => '<span>' + line + '</span>').join('') + '</div></div>'; }
function footer() { return '<footer><span class="footer-paws">🐾 · 🐾 · 🐾</span><b>麻瓜今日观察完毕</b><p>地球再忙，也记得回来摸摸狗。🐶</p><small>'+(demo?'互动样版 · 资料保存在本机':'麻瓜研究所 · 快乐研究中')+'</small>'+(isAdmin?'<a href="#admin">店长值班室 ↗</a>':'')+'</footer>'; }
function home() {
  const date = new Date(), daySeed = Math.floor((Date.now()+8*3600000)/86400000);
  const good = [['摸摸狗头','快乐发呆'],['收快递','夸夸自己'],['喝水摸鱼','分享快乐'],['慢慢来','给狗加油'],['研究小物','早点休息'],['见好就收','吃点好的'],['大胆提问','快乐拆盒']][daySeed%7];
  const bad = [['假装很忙','独自纠结'],['反复内耗','忘记吃饭'],['偷偷加班','乱催自己'],['皱着眉头','憋着不说'],['无限拖延','熬夜硬撑'],['口是心非','为难小狗'],['盯着进度','忘记快乐']][daySeed%7];
  const month = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: 'long' }).format(date);
  const number = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kuala_Lumpur', day: 'numeric' }).format(date);
  const weekday = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'long' }).format(date);
  return '<section class="welcome"><p class="brand-welcome"><small>欢迎来到</small><span>麻瓜研究所<i>✦</i></span></p><button data-act="logo" aria-label="戳一下麻瓜"><img src="' + art('logo.png') + '" alt="麻瓜研究所"></button><small id="welcome-note">地球麻瓜请进，小狗已经帮你留了位置。🐶</small></section>' +
    '<section class="calendar"><div class="calendar-top"><span>' + month + '</span><span>麻瓜历</span></div><div class="calendar-main"><div class="almanac"><b>宜</b><span>'+good[0]+'</span><span>'+good[1]+'</span></div><div><strong>' + number + '</strong><small>' + weekday + '</small><small class=calendar-note>麻瓜放松日 · 今日也准时快乐</small></div><div class="almanac avoid"><b>忌</b><span>'+bad[0]+'</span><span>'+bad[1]+'</span></div></div><p class=calendar-bottom>🐾 '+['今日研究：少想一点，多摸狗一点。','小狗提醒：快乐不是待办事项。','今日批准：麻瓜可以休息一下。'][daySeed%3]+'</p></section>' +
    '<section class="cup-invite"><span class="cup-icon"><i></i><i></i></span><div><b>又犹犹豫豫？</b><p>丢个圣杯，让小狗听听天意。</p></div><button data-act="cups">丢一下</button></section>' +
    '<div class="home-doors">' + [['shop', '麻瓜补给站', 'door-shop', '给麻瓜加点油。'], ['track', '小狗追踪局', 'door-track', '小狗盯单，比你还勤。'], ['wish', '麻瓜来信', 'door-mail', '有什么鬼点子，寄给店长。']].map(([path, title, image, line]) => '<a href="#' + path + '"><div class=door-illustration><img src="' + art(image + '.webp') + '" alt="">'+(path==='shop'?'':'<small class=door-quip>'+({track:'催店长这事，我熟。',wish:'大胆写，头痛的是店长。'}[path])+'</small>')+'</div><h2>' + title + '</h2><p>' + line + '</p><span>走这边 ↗</span></a>').join('') + '</div>';
}
function cartRows() {
  return Object.entries(cart).map(([key, qty]) => {
    const [id, variantText = '0'] = key.split('|');
    const product = state.products.find(p => p.id === id && p.active && p.mode !== 'custom');
    const variant = Number(variantText), option = product?.variants?.[variant];
    return { key, product, qty, variant, customization:cartCustom[key], price: option?.price ?? product?.price, label: product?.name + (option ? ' · ' + option.label : '') };
  }).filter(row => row.product && row.qty > 0);
}
function productCard(product) {
  const image = product.photo || art(['cat-print.webp', 'cat-clay.webp', 'cat-box.webp'][product.cat]);
  const variants = product.variants || [];
  return '<article class="product" data-product="' + esc(product.id) + '"><img src="' + image + '" alt="' + esc(product.name) + '"><div class="product-info"><h3>' + esc(product.name) + '</h3><p class="description">' + esc(product.description || '') + '</p>' +
    (product.mode === 'custom' ? '<small>定制研究 · 先和店长聊聊</small><a class="button primary" target="_blank" rel="noopener" href="' + wa + '?text=' + encodeURIComponent('店长，我想定制「' + product.name + '」') + '">找店长研究 ↗</a>' : '<strong class="price">' + money(variants[0]?.price ?? product.price) + '</strong><small>' + (product.mode === 'pre' ? '⏳ 预购 · ' + esc(product.lead || '制作时间请问店长') : '📦 现货 ' + product.stock + ' 件') + '</small>' +
    (variants.length ? '<label class="variant-label">选择规格<select data-variant>' + variants.map((v, i) => '<option value="' + i + '">' + esc(v.label) + ' · ' + money(v.price) + '</option>').join('') + '</select></label>' : '') +
    (product.mode === 'pre' ? '<a class="small-link" target="_blank" rel="noopener" href="' + wa + '?text=' + encodeURIComponent('我想问「' + product.name + '」的预购安排') + '">预购有疑问？先问店长 ↗</a>' : '') +
    ((product.allowPhoto||(product.customFields||[]).length)?'<small>🎨 可填写定制资料'+(product.allowPhoto?' · 上传参考照片':'')+'</small>':'')+'<div class="buy-row"><span class="stepper"><button data-act="minus" aria-label="减少数量">−</button><output>1</output><button data-act="plus" aria-label="增加数量">+</button></span><button class="primary" data-act="add" ' + (product.mode === 'stock' && product.stock < 1 ? 'disabled' : '') + '>' + (product.mode === 'stock' && product.stock < 1 ? '小狗卖光了' : '加进购物车') + '</button></div>') + '</div></article>';
}
function productTools(){return '<div class=product-controls><label class=direct-sort>sort by<select id=product-sort aria-label="sort by"><option value=price-down>价钱：最高到最低</option><option value=price-up>价钱：最低到最高</option><option value=name>名字：A–Z</option><option value=name-desc>名字：Z–A</option></select></label><span>·</span><button type=button data-act=filter>filter</button></div>'+(productFilter?'<p class=search-caption>全店搜索：'+esc(productFilter)+' <button data-act=clear-filter>清除 ×</button></p>':'');}

function shop() {
  const rows = cartRows(), subtotal = rows.reduce((sum, row) => sum + row.price * row.qty, 0);
  return ticker() + '' + '<div class="category-drawers">' + Lab.cats.map((name, i) => '<details class="category" data-category="'+i+'" '+(activeCategory===i?'open':'')+' '+(activeCategory!==null&&activeCategory!==i?'hidden':'')+'><summary><img src="' + art(['cat-print.webp', 'cat-clay.webp', 'cat-box.webp'][i]) + '" alt=""><span><b>' + name + '</b><small>' + ['研究出来的小东西，也接你的鬼点子。', '一个人、两个人，都给你捏成小麻瓜。', '店长出题，小狗封盒，你来拆答案。'][i] + '</small></span><i>'+ (activeCategory===i?'×':'＋')+'</i></summary>'+ (activeCategory===i?productTools():'')+'<div class="category-products">' + state.products.filter(p => p.active && (productFilter ? (p.name+' '+(p.description||'')).toLowerCase().includes(productFilter.toLowerCase()) : p.cat===i)).sort((a,b)=>productSort==='price-up'?a.price-b.price:productSort==='price-down'?b.price-a.price:productSort==='name'?a.name.localeCompare(b.name):productSort==='name-desc'?b.name.localeCompare(a.name):0).map(productCard).join('') + '</div></details>').join('') + '</div>' +
    '<section class="cart"><div class=cart-heading><h2>🛒 麻瓜的收获</h2><button data-act=empty-cart>🧹 清空</button></div>' + (rows.length ? rows.map(row => '<div class="cart-row"><div><b>' + esc(row.label) + '</b>' + (row.customization ? '<small>🎨 定制资料'+(row.customization.photo?' · 已附照片':'')+'</small><button type="button" data-act="edit-customization" data-key="'+esc(row.key)+'">查看 / 修改定制</button>' : '') + '<small>' + money(row.price) + ' × ' + row.qty + '</small></div><button data-act="cart-minus" data-key="' + esc(row.key) + '" aria-label="减少购物车数量">−</button><b>' + row.qty + '</b><button data-act="cart-plus" data-key="' + esc(row.key) + '" aria-label="增加购物车数量">+</button></div>').join('') + '<div class="cart-total"><span>商品小计</span><strong>' + money(subtotal) + '</strong></div><button class="primary wide" data-act="checkout">填写地址与资料 →</button>' : '<p class="empty">空空的。小狗已经把购物车擦三遍了。🐶</p>') + '</section>';
}
function choices() {
  if (!$('choices')) return;
  if(state.member){selectedDog=state.member.dog;$('choices').innerHTML='<div class=returning-colleague>'+dogVisual(selectedDog)+'<b>'+esc(Lab.dogs[selectedDog])+'</b><small>第一位跟单小狗，继续陪这个麻瓜排队 🐾</small></div>';return;}
  $('choices').innerHTML = '<div class="dog-picker">' + Lab.dogs.map((name, i) => '<button type="button" data-act="dog" data-i="' + i + '" aria-pressed="' + (i === selectedDog) + '">' + dogVisual(i) + '<span>' + (i === selectedDog ? '✓ ' : '') + name + '</span></button>').join('') + '</div><p class="field-help">' + Lab.dogs[selectedDog] + '已到岗。点它会叫，摸它会变扁。🐶</p>';
}
function checkout() {
  if (!cartRows().length) return;
  selectedDog = state.member?.dog ?? 5;
  const regions = [['west','West Malaysia',0],['east','East Malaysia',1],['singapore','Singapore',2]];
  dialog('🛒 麻瓜结账处', `<form data-form="checkout" data-step="0">
    ${demo ? '<p class="demo-hint">互动样版 · 请勿实际付款。</p>' : ''}
    <ol class="checkout-progress"><li aria-current="step">1 配送／自取</li><li>2 顾客资料</li><li>3 付款</li></ol>
    <section data-checkout-step="0" class="checkout-step"><h2>🚚 服务选项</h2>
      <div class="fulfillment-tabs"><label><input type="radio" name="fulfillment" value="delivery" checked>🚚 配送</label><label><input type="radio" name="fulfillment" value="pickup">🏡 自取</label></div>
      <fieldset id="delivery-fields"><legend>📍 配送地址</legend>
        ${field('address', '地址 **', '123, Jalan ABC, Taman Biubiubiu', 'required maxlength="160" autocomplete="shipping street-address"')}
        <p class="field-help">请用英文 / Malay 填写地址。选择配送地区后确认邮编与城市。</p>
        <div class="shipping-options">${regions.map(([value,label,index]) => `<label class="shipping-choice"><input type="radio" name="region" value="${value}" ${index === 0 ? 'checked' : ''}><span><b>${label}</b><small>${state.shipping[index] == null ? '运费待店长设置，请先联系店长' : money(state.shipping[index])}</small></span></label>`).join('')}</div>
        <div class="pair">${field('postcode', '邮编 **', '50000', 'required inputmode="numeric" pattern="[0-9]{5}" maxlength="5"')}<label>城市 **<select name="city" required><option value="">先填邮编或选择城市</option></select></label></div>
        <label>州属 **<select name="state" required><option value="">选择州属</option>${Lab.states.map(s=>'<option>'+s+'</option>').join('')}<option>Singapore</option></select></label>
        <label id="manual-city-label" hidden>城市名称 **<input name="cityManual" maxlength="65" disabled></label><small class="field-help" id="postcode-hint">填好邮编，小狗会帮你找城市和州属。</small>
      </fieldset>
      <div id="pickup-details" hidden><h3>🏡 自取 · 不收运费</h3><p>${esc(state.pickup?.address || '自取地点请先联系店长确认。')}</p><p class="field-help">${esc(state.pickup?.instructions || '商品做好后，店长会与你确认自取时间。')}</p></div>
      <p id="shipping-error" role="status" class="field-help"></p><button type="button" class="primary wide" data-act="checkout-next">下一步：顾客资料 →</button>
    </section>
    <section data-checkout-step="1" class="checkout-step" hidden><h2>👤 顾客资料</h2>
      ${field('buyer','顾客名字 **','Your name','required maxlength="65" autocomplete="name"')}
      ${field('phone','顾客电话号码 **','012-3456789 / +65 8123 4567','required type="tel" autocomplete="tel" pattern="[0-9+ ()-]{8,22}"')}
      ${field('email','顾客邮箱 / Gmail **','name@gmail.com','required type="email" maxlength="254" autocomplete="email"')}
      <h3>📦 收件人资料</h3><label class="checkbox"><input type="checkbox" name="sameRecipient" checked>收件人名字、电话同顾客</label>
      <fieldset id="recipient-fields" disabled hidden>${field('recipientName','收件人名字 **','','required maxlength="65" autocomplete="shipping name"')}${field('recipientPhone','收件人电话号码 **','','required type="tel" pattern="[0-9+ ()-]{8,22}" autocomplete="shipping tel"')}</fieldset>
      <h3>💬 Note to seller · 捎句话</h3>${messageFields()}
      <div class="checkout-actions"><button type="button" data-act="checkout-back">← 返回</button><button type="button" class="primary" data-act="checkout-next">下一步：付款 →</button></div>
    </section>
    <section data-checkout-step="2" class="checkout-step payment" hidden><h2>💰 核对与付款</h2><div id="checkout-summary" class="checkout-summary"></div><div id="bill" class="bill"></div>
      ${state.qr ? '<img class="payment-qr" src="'+state.qr+'" alt="店长提供的 DuitNow 收款二维码"><p class="field-help">用 TNG 或银行 App 扫码付款。</p>' : ''}
      <div class="tng-row"><div><small>TNG 转账</small><b>012-4390204</b></div><button type="button" data-act="copy">复制</button></div><p class="recipient">收款人 · ZENTIO ENTERPRISE</p>
      ${field('payer','付款人 TNG 全名 **','用于核对付款','required maxlength="90"')}<p class="field-help">转账备注请填 TNG 全名，付款截图在提交后到 WhatsApp 附上。</p>
      <details class="choose-dog"><summary>🐶 要选一只跟单小狗吗？<small>不选就由毛毛接待。</small></summary><div id="choices"></div></details>
      <label class="checkbox"><input name="consent" type="checkbox">通过 WhatsApp 接收订单进度</label><div class="checkout-actions"><button type="button" data-act="checkout-back">← 返回资料</button><button class="primary" type="submit">提交订单，拿号码牌 🎫</button></div>
    </section></form>`, 'checkout-modal');
  choices(); cityOptions(); deliveryFields(); bill();
}
function cityOptions(preferred='',matches=[]){
  const form=document.querySelector('form[data-form="checkout"]');if(!form)return;
  if(form.elements.region.value==='singapore'){
    form.elements.city.innerHTML='<option value="Singapore">Singapore</option>';
    form.elements.state.value='Singapore';
  } else {
    const index=Lab.states.indexOf(form.elements.state.value);
    const candidates=matches.filter(row=>row[0]===index).map(row=>row[1]);
    const values=[...new Set([...candidates,...(STATE_CITIES[index]||Object.values(STATE_CITIES).flat())])];
    form.elements.city.innerHTML='<option value="">选择城市</option>'+values.map(city=>'<option value="'+esc(city)+'">'+esc(city)+'</option>').join('')+'<option value="__other__">其他城市（手动填写）</option>';
    if(preferred&&values.includes(preferred))form.elements.city.value=preferred;
    else if(candidates.length)form.elements.city.value=candidates[0];
  }
  $('manual-city-label').hidden=true;form.elements.cityManual.disabled=true;form.elements.cityManual.required=false;
}
function deliveryFields(){
  const form=document.querySelector('form[data-form="checkout"]');if(!form)return;
  const pickup=form.elements.fulfillment.value==='pickup',sg=form.elements.region.value==='singapore';
  $('delivery-fields').hidden=pickup;$('delivery-fields').disabled=pickup;$('pickup-details').hidden=!pickup;
  form.elements.postcode.pattern=sg?'[0-9]{6}':'[0-9]{5}';form.elements.postcode.maxLength=sg?6:5;form.elements.postcode.placeholder=sg?'018956':'50000';
  if(sg){form.elements.state.value='Singapore';cityOptions();}else if(form.elements.state.value==='Singapore'){form.elements.state.value='';cityOptions();}
  $('postcode-hint').textContent=sg?'新加坡使用六位邮编。':'填好邮编，小狗会帮你找城市和州属。';
  bill();
}
function bill() {
  const form = document.querySelector('form[data-form="checkout"]');if(!form)return;
  const subtotal = cartRows().reduce((sum,row)=>sum+row.price*row.qty,0);
  const pickup=form.elements.fulfillment.value==='pickup',region=form.elements.region.value;
  const shipping=pickup?0:state.shipping[['west','east','singapore'].indexOf(region)];
  form.dataset.total=shipping==null?'':String(subtotal+shipping);
  $('bill').innerHTML='<span>商品 '+money(subtotal)+' · '+(pickup?'自取：不收运费':'运费 '+(shipping==null?'待店长设置':money(shipping)))+'</span><b>应付 '+(shipping==null?'待确认':money(subtotal+shipping))+'</b>';
  $('shipping-error').textContent=shipping==null?'该地区暂未设置运费，请联系店长，或选择其他服务方式。':'';
}
function checkoutStep(delta){
  const form=document.querySelector('form[data-form="checkout"]');if(!form)return;
  const step=Number(form.dataset.step),section=form.querySelector('[data-checkout-step="'+step+'"]');
  if(delta>0){
    const fields=[...section.querySelectorAll('input,select,textarea')].filter(el=>!el.disabled&&!el.closest('fieldset[disabled]'));
    for(const input of fields)if(!input.reportValidity())return;
    if(step===0&&form.elements.fulfillment.value==='delivery'){
      const region=form.elements.region.value,index=Lab.states.indexOf(form.elements.state.value);
      const expected=index<0?'singapore':[9,10,14].includes(index)?'east':'west';
      if(region!==expected){tell('配送地区与州属不一致，请重新选择');return;}
    }
    if(!form.dataset.total){tell('请先确认运费');return;}
  }
  const next=Math.max(0,Math.min(2,step+delta));form.dataset.step=next;
  form.querySelectorAll('[data-checkout-step]').forEach(el=>el.hidden=Number(el.dataset.checkoutStep)!==next);
  form.querySelectorAll('.checkout-progress li').forEach((el,i)=>i===next?el.setAttribute('aria-current','step'):el.removeAttribute('aria-current'));
  if(next===2){
    const same=form.elements.sameRecipient.checked,pickup=form.elements.fulfillment.value==='pickup';
    $('checkout-summary').innerHTML='<h3>🛍️ 订单商品</h3>'+cartRows().map(row=>'<p>'+esc(row.label)+' × '+row.qty+(row.customization?'<small>含定制资料'+(row.customization.photo?'与照片':'')+'</small>':'')+'</p>').join('')+'<h3>'+(pickup?'🏡 自取':'🚚 配送')+'</h3><p>'+esc(pickup?(state.pickup?.address||'地点待店长确认'):[form.elements.address.value,form.elements.postcode.value,form.elements.city.value==='__other__'?form.elements.cityManual.value:form.elements.city.value,form.elements.state.value].join(', '))+'</p><p>顾客：'+esc(form.elements.buyer.value)+' · '+esc(form.elements.phone.value)+'<br>'+esc(form.elements.email.value)+'<br>收件人：'+esc(same?form.elements.buyer.value:form.elements.recipientName.value)+' · '+esc(same?form.elements.phone.value:form.elements.recipientPhone.value)+'</p>';bill();
  }
  modal.scrollTop=0;section.blur?.();
}
function customizationForm(product,variant,qty,key=''){
  const saved=key?cartCustom[key]||{}:{};
  dialog('🎨 '+product.name+' · 定制资料', '<form data-form="customize" data-id="'+esc(product.id)+'" data-variant="'+variant+'" data-qty="'+qty+'" data-key="'+esc(key)+'"><p>'+esc(product.variants?.[variant]?.label||product.name)+' · '+money(product.variants?.[variant]?.price??product.price)+' × '+qty+'</p>'+(product.allowPhoto?'<label>📷 上传照片来定制'+(product.requirePhoto?' **':'（选填）')+'<input name="customPhoto" type="file" accept="image/png,image/jpeg,image/webp" '+(product.requirePhoto&&!saved.photo?'required':'')+'></label><p class="field-help">支持 JPG、PNG、WebP；仅供店长处理这项定制，不会公开显示。</p>'+ (saved.photo?'<img class="upload-preview" src="'+saved.photo+'" alt="已选定制照片">':''):'')+(product.customFields||[]).map((field,i)=>'<label>'+esc(field.label)+(field.required?' **':'（选填）')+'<textarea name="customField'+i+'" maxlength="200" '+(field.required?'required':'')+'>'+esc(saved.fields?.find(value=>value.label===field.label)?.value||'')+'</textarea></label>').join('')+'<label>定制备注（选填）<textarea name="customRemark" maxlength="300">'+esc(saved.remark||'')+'</textarea></label><button class="primary wide" type="submit">'+(key?'保存定制资料':'确认，加入购物车')+'</button></form>');
}
function ticket(order,own=false){
  const mood=lookFor(order),look=lookKeys[order.stage][mood];
  if(own)return '<article class="my-order-card">'+(order.message?'<p class="speech-bubble">'+esc(order.message)+'</p>':'')+'<div class="my-order-main"><button class=pet-dog data-act=pet aria-label="摸摸跟单小狗">'+dogVisual(order.dog,look)+'</button><div><h3>🎫 你的号码：'+Lab.ticket(order.id)+'</h3><p class=my-order-status>'+Lab.stages[order.stage]+'</p><p class=owner-status-line>'+esc(Lab.statusLine(order))+'</p><p class=ordered-items>🛍️ '+order.items.map(i=>esc(i.name)+' × '+i.qty).join('、')+'</p></div></div>'+([3,4].includes(order.stage)?'<button class="parcel-button wide" data-act=parcel data-i="'+order.id+'">🚚 查看包裹</button>':'')+'</article>';
  return '<article class="ticket'+(own?' own-ticket':'')+'">'+(order.message?'<p class="speech-bubble">'+esc(order.message)+'</p>':'')+'<div class="ticket-row"><b class="ticket-id">'+Lab.ticket(order.id)+'</b><button class="pet-dog" data-act="pet" aria-label="摸摸'+Lab.dogs[order.dog]+'">'+dogVisual(order.dog,look)+'</button><div class="ticket-copy"><div class="ticket-name"><b>'+esc(order.customer||(order.buyer?order.buyer[0]+'***'+order.buyer.at(-1):'麻瓜'))+'</b>'+rankTag(order.identity)+'</div><p class="owner-status-line">'+esc(Lab.statusLine(order))+'</p><p class="ordered-items">'+order.items.map(i=>esc(i.name)+' × '+i.qty).join('、')+'</p>'+([3,4].includes(order.stage)?'<button class="parcel-button" data-act="parcel" data-i="'+order.id+'">🚚 查看包裹</button>':'')+'</div><span class="status status-'+order.stage+'">'+Lab.stages[order.stage]+'</span></div></article>';
}
function employeeCard() {
  const m = state.member;
  if (!m) return '';
  return '<button class="employee-card" data-act="certificate"><span class="staff-avatar">' + dogVisual(m.dog) + (m.elder ? '<span class="elder-chop">开所<br>元老</span>' : '') + '</span><span class="employee-name"><strong>' + esc(m.name) + '</strong>' + rankTag(m) + '<small>工号 #' + String(m.id).padStart(3, '0') + '</small></span><small class="flip-hint">翻面看徽章 ↗</small></button>';
}
function certificate(member=state.member,full=false) {
  if(!member)return;
  const name=full?member.name:'麻瓜档案';
  dialog(full?'🪪 我的麻瓜员工证':'🪪 麻瓜公开履历','<div class="official-certificate dossier-card"><div class=certificate-eyebrow>麻瓜研究所 · 人类观察档案</div><header>麻瓜员工证<small>快乐研究部 · 长期有效</small></header><div class=staff-photo><span class="id-dog-portrait" role=img aria-label="'+esc(Lab.dogs[member.dog])+'正面半身证件照" style="--portrait-x:'+(member.dog%4*100/3)+'%;--portrait-y:'+(Math.floor(member.dog/4)*100)+'%"></span>'+(member.elder?'<span class=elder-seal>元老</span>':'')+'</div><div class=staff-details><h2>'+esc(name)+'</h2>'+rankTag(member)+'<p>工号 '+Lab.ticket(member.id)+'</p><small>跟单小狗 · '+esc(Lab.dogs[member.dog])+'</small></div><div class=staff-card-footer><span class=barcode aria-label="装饰条码"></span><small>MG-'+String(member.id).padStart(3,'0')+'</small><b>店长认证 🐾</b></div></div><p class=field-help>'+(full?'你的麻瓜履历，小狗都有记着。':'公开档案只展示职位、工号和勋章。')+'</p><div class=badge-grid>'+member.badges.map(b=>'<div class="achievement '+(b.earned?'earned':'')+'"><span>'+b.icon+'</span><b>'+b.name+'</b><small>'+b.detail+'</small></div>').join('')+'</div>');
}
function verification(order,type){const message=type==='message'?messageFields(state.orders.find(o=>o.id===order)?.message||'').replace('<details class="message-options choose-dog"','<details open class="message-options choose-dog"'):'';dialog(type==='message'?'💬 '+Lab.ticket(order)+' 的小狗想说什么？':'是你吗？麻瓜 🧐','<form data-form="'+type+'"><input name=order type=hidden value="'+order+'">'+message+field('last','下单电话后四位 **','确认一下是麻瓜本人','required inputmode="numeric" pattern="[0-9]{4}" maxlength="4"')+'<button class="primary wide">'+(type==='message'?'交给小狗捎话 💬':'打开我的员工证 🪪')+'</button></form>');}
function messageFields(value=''){return '<details class="message-options choose-dog" '+(value?'open':'')+'><summary>💬 让跟单小狗捎句话（选填）</summary><div class=message-tone-tabs>'+Object.keys(messagePresets).map((n,i)=>'<button type=button data-act=message-tone data-tone="'+n+'" aria-pressed="'+(i===0)+'">'+['🙏','🍵','💪','😼'][i]+' '+n+'</button>').join('')+'<button type=button data-act=message-tone data-tone=custom>✍️ 自己写</button></div><div class=message-presets>'+presetButtons(Object.keys(messagePresets)[0])+'</div><label class=message-custom>自己写 / 不捎话<input name=message maxlength=100 value="'+esc(value)+'" placeholder="不写也可以，小狗安静陪你。"></label><p class=message-preview>预览：<span>'+esc(value||'还没选，小狗先安静陪你 🐶')+'</span></p><button type=button class=text-button data-act=clear-message>这次不捎话</button></details>';}
function presetButtons(tone){return (messagePresets[tone]||[]).map(line=>'<button type=button data-act=message-preset>'+esc(line)+'</button>').join('');}

function groupedStaffActions(orders){const groups=new Map();for(const o of orders)if(!groups.has(o.identity?.id||o.id))groups.set(o.identity?.id||o.id,o);return [...groups.values()].map(o=>'<div class=grouped-staff-actions><button class="my-certificate-button wide" data-act=verify-certificate data-i="'+o.id+'">🪪 我的员工证 · '+esc(o.identity?.rank||'实习麻瓜')+'</button><button class="my-certificate-button message-button wide" data-act=message data-i="'+o.id+'">💬 让跟单小狗捎句话</button></div>').join('');}
function groupedMyDogs(orders){const groups=new Map();for(const o of orders){const id=o.identity?.id||o.id;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(o);}return [...groups.values()].map(group=>{group.sort((a,b)=>a.id-b.id);const first=group[0],identity=first.identity,dog=identity?.dog??first.dog;const current=[...group].reverse().find(o=>![4,5].includes(o.stage))||group.at(-1);const items=new Map();for(const o of group)for(const item of o.items)items.set(item.name,(items.get(item.name)||0)+item.qty);return '<article class="my-order-card combined-order-card">'+(current.message?'<p class=speech-bubble>'+esc(current.message)+'</p>':'')+'<div class=my-order-main><button class=pet-dog data-act=pet aria-label="摸摸'+esc(Lab.dogs[dog])+'">'+dogVisual(dog,lookKeys[current.stage][lookFor(current)])+'</button><div><h3>🎫 你的号码：</h3><div class=my-order-numbers>'+group.map(o=>'<button type=button data-act=order-details data-i="'+o.id+'">'+Lab.ticket(o.id)+'<small>'+Lab.stages[o.stage]+'</small></button>').join('')+'</div><p class=owner-status-line>'+esc(Lab.statusLine(current))+'</p></div></div><div class=combined-items><small>🛍️ 麻瓜一共带走</small>'+[...items].map(([name,qty])=>'<p>'+esc(name)+' <b>× '+qty+'</b></p>').join('')+'</div>'+group.filter(o=>[3,4].includes(o.stage)).map(o=>'<button class="parcel-button wide" data-act=parcel data-i="'+o.id+'">🚚 查看 '+Lab.ticket(o.id)+' 包裹</button>').join('')+groupedStaffActions(group)+'</article>';}).join('');}
function orderDetails(id){const o=state.orders.find(o=>o.id===id);if(!o)return;dialog('🎫 '+Lab.ticket(o.id)+' 订单详情','<div class=order-detail><p class=my-order-status>'+Lab.stages[o.stage]+'</p><p>'+esc(Lab.statusLine(o))+'</p><div class=combined-items>'+o.items.map(i=>'<p>'+esc(i.name)+' <b>× '+i.qty+'</b></p>').join('')+'</div>'+([3,4].includes(o.stage)?'<button class="primary wide" data-act=parcel data-i="'+o.id+'">🚚 查看包裹</button>':'')+'<small>查看物流时需核对下单电话后四位。</small></div>');}

function myDogs() {
  const ids = new Set(state.pins || []), orders = state.orders.filter(o => ids.has(o.id));
  return '<section class="my-dogs"><h2>🎫 我的小狗</h2>' + (orders.length ? groupedMyDogs(orders) : '<p class="field-help">下单后，小狗会自动在这里等你。🐶</p>') +
    '<details class="recover" ' + (!orders.length ? 'open' : '') + '><summary>换了手机 / 看不到小狗？</summary><form data-form="search" class="search-form"><input name="query" required inputmode="numeric" maxlength="20" placeholder="订单号码 / 电话后四位" aria-label="订单号码或电话后四位"><button class="primary">查询</button></form>' + (searchResults ? '<div class="search-results">' + (searchResults.length ? searchResults.map(id => { const o = state.orders.find(o => o.id === id); return '<button data-act="pin" data-i="' + id + '">' + Lab.ticket(id) + ' · ' + esc(o.customer || '麻瓜') + ' · ' + Lab.dogs[o.dog] + '<span>是我的小狗 ＋</span></button>'; }).join('') : '<p class="field-help">小狗还没找到这个号码，再检查一下哦。</p>') + '</div>' : '') + '</details></section>';
}
function track() {
  const working = state.orders.filter(o => o.stage === 1).sort((a, b) => a.id - b.id)[0];
  const queue = state.orders.filter(o => o.stage !== 4), graduated = state.orders.filter(o => o.stage === 4);
  return ticker() + '<section class="processing"><button class="processing-dog pet-dog" data-act="pet" aria-label="摸摸监工小狗">' + dogVisual(5, 'woodfish') + '</button><p>🖨️ 目前正在制作</p><strong>' + (working ? Lab.ticket(working.id) : '店长整理工作台中') + '</strong><small>还有 ' + state.orders.filter(o => [0,1,6,7].includes(o.stage)).length + ' 笔订单等小狗接力</small></section>' +
    '<aside class="refund-note"><p>🫠 等得开始怀疑狗生？店长在认真做，小狗在认真陪。</p><a target="_blank" rel="noopener" href="' + wa + '?text=' + encodeURIComponent('店长，我想询问订单退款。我的订单号码是：') + '">不想等了？退款找店长算账 ↗</a></aside>' + myDogs() +
    '<section class="public-queue"><div class="queue-tabs"><button data-act="queue" aria-pressed="' + (read('queue', 'waiting') === 'waiting') + '">🐶 排队中の小狗 <b>' + queue.length + '</b></button><button data-act="graduates" aria-pressed="' + (read('queue', 'waiting') === 'graduates') + '">🎓 毕业小狗 <b>' + graduated.length + '</b></button></div>' + (read('queue', 'waiting') === 'graduates' ? graduated : queue).map(o => ticket(o)).join('') + (!(read('queue', 'waiting') === 'graduates' ? graduated : queue).length ? '<p class="empty">这里暂时没有小狗。</p>' : '') + '</section>';
}
function comments(letter) {
  const supplement=letter.note?'<div class="comment author-supplement"><span class="comment-avatar">'+dogVisual(letter.dog)+'</span><div><div class="comment-meta"><b>'+Lab.ticket(letter.order)+' 的'+Lab.dogs[letter.dog]+'</b>'+rankTag(letter.identity)+'<span class="author-tag">信件人 · 补充</span><small>'+ago(letter.created)+'</small></div><p>'+esc(letter.note)+'</p></div></div>':'';
  return supplement+letter.comments.map(comment=>'<div class="comment '+(comment.role==='owner'?'owner-comment':'')+'"><span class="comment-avatar">'+(comment.role==='owner'?'<small>店主</small>'+dogVisual(5):comment.role==='order'?dogVisual(comment.dog):'<span class="muggle-avatar">🧍</span>')+'</span><div><div class="comment-meta"><b>'+(comment.role==='owner'?'店主':comment.role==='order'?Lab.ticket(comment.order)+' 的'+Lab.dogs[comment.dog]:'平平无奇的麻瓜')+'</b>'+rankTag(comment.identity)+(comment.author?'<span class="author-tag">信件人</span>':'')+'<small>'+ago(comment.time)+'</small></div><p>'+esc(comment.text)+'</p></div></div>').join('');
}
function wishCard(letter) {
  return '<article class="letter-card"><div class="letter-card-head"><button class="letter-avatar pet-dog" data-act="pet">' + dogVisual(letter.dog) + '</button><div><h3>' + esc(letter.text) + '</h3><small>' + Lab.ticket(letter.order) + ' 的' + Lab.dogs[letter.dog] + rankTag(letter.identity) + ' · ' + ago(letter.created) + '</small></div></div>' +
    '<div class="merit-area"><button class="woodfish-button" data-act="vote" data-id="' + letter.id + '" ' + (state.remaining <= 0 ? 'disabled' : '') + '><span class="wooden-fish"></span><span>敲木鱼 · 功德 +1</span></button><small>这封信累积功德 ' + letter.votes + '</small></div>' +
    '<div class="comment-tools"><button class="text-button" data-act="toggle-comments" data-id="' + letter.id + '">💬 ' + (letter.comments.length+(letter.note?1:0)) + ' 则留言 · 展开</button><button class="text-button write-comment" data-act="comment" data-id="' + letter.id + '">✍️ 我要留言</button></div><div class="letter-comments" id="comments-' + letter.id + '" hidden>' + comments(letter) + '</div></article>';
}
function wishPage() {
  const letters = state.wishes.filter(w => w.done === letterDone).sort((a, b) => b.votes - a.votes);
  return '<section class="mail-station"><div class="mail-dog"><button class="pet-dog" data-act="speak" aria-label="听毛毛店员说话">' + dogVisual(5) + '</button><p class="dog-dialogue" id="dog-says">' + esc(dogLine) + '</p></div><button class="mailbox" data-act="newwish" aria-label="打开信纸，给店长投信"><span class="mailbox-label">麻瓜来信</span><span class="mail-slot"></span><span class="mail-envelope">✉</span><span class="mailbox-bottom">奇思怪想请投这里 ↓</span></button></section>' +
    '<div class="letter-tabs"><button data-act="pending" aria-pressed="' + !letterDone + '">✉️ 待考虑研究</button><button data-act="done" aria-pressed="' + letterDone + '">📬 已研究完毕</button></div><p class="daily-merit">🪵 ' + (state.remaining ? '今天还能积 ' + state.remaining + ' 次功德。' : '今天功德圆满，熬到 12am 再敲啦。') + '</p>' + letters.map(wishCard).join('') + (!letters.length ? '<p class="empty">小狗把这格信箱擦干净了，等下一封信。✉️</p>' : '');
}
function openLetterForm() {
  dialog('💌 寄给店长', '<form data-form="wish"><p class="field-help">写一个想让店长研究的点子，小狗帮你送到。</p>' + credentials() + '<label>想让店长做什么？ **<textarea name="text" required maxlength="80" rows="2" placeholder="80 字以内的小点子"></textarea></label><label>补充说明<textarea name="note" maxlength="300" rows="3" placeholder="尺寸、用途、你的奇妙想法……"></textarea></label><button class="primary wide">把信投进去 ✉️</button></form>');
  const id = state.member?.orders?.[0] || state.pins?.[0];
  if (id) modal.querySelector('[name="order"]').value = id;
  if (demo) modal.querySelector('form').insertAdjacentHTML('afterbegin', '<small class="demo-hint">示例可用 49，电话后四位 2049。</small>');
}
function openComment(id, owner = false) {
  dialog(owner ? '店长回复' : '✍️ 我要留言', '<form data-form="comment" data-id="' + id + '">' + (owner ? '<input type="hidden" name="role" value="owner">' : '<div class="identity-cards"><label><input type="radio" name="role" value="guest" checked><span>🧍 平平无奇的麻瓜</span></label><label><input type="radio" name="role" value="order"><span>🎫 有身份的麻瓜</span></label></div><fieldset id="comment-credentials" hidden disabled>' + credentials() + '</fieldset>') + '<label>留点什么吧 **<textarea name="text" required maxlength="300" rows="4" placeholder="小狗已经坐好，听你说。"></textarea></label><button class="primary wide">送出留言 ✍️</button></form>');
}
function orderList() {
  return state.orders.filter(o => (!orderFilter || o.stage === Number(orderFilter)) && (!orderQuery || [Lab.ticket(o.id), o.buyer, o.phone].some(x => String(x).toLowerCase().includes(orderQuery.toLowerCase())))).map(o => '<article class="admin-order"><div><b>' + Lab.ticket(o.id) + ' · ' + esc(o.buyer) + '</b><small>' + Lab.stages[o.stage] + ' · ' + money(o.total) + '</small><p>' + o.items.map(i => esc(i.name) + ' × ' + i.qty).join('、') + '</p></div><button data-act="manage" data-i="' + o.id + '">处理 →</button></article>').join('') || '<p class="empty">没有匹配订单。</p>';
}
function adminPage() {
  if (!isAdmin) return '<section class="admin-login"><h1>店长工作台</h1><form data-form="login">' + field('email','授权 Gmail 地址','name@gmail.com','required type="email" autocomplete="username"') + field('password','研究所登录密码','','required type="password" autocomplete="current-password"') + '<p class=field-help>使用研究所专用密码，不是你的 Google 密码。'+(demo?'演示账号：owner@gmail.com / magua-demo':'仅店长及获授权的 Gmail 可进入。')+'</p>' + '<button class="primary wide">进入工作台</button></form></section>';
  const tabs = { orders: '📦 订单', products: '🛍️ 商品', comments: '✉️ 信封', settings: '⚙️ 设置' };
  let body = '';
  if (ownerTab === 'orders') body = '<div class="owner-stats"><span>待核款 <b>' + state.orders.filter(o => o.stage === 0).length + '</b></span><span>制作中 <b>' + state.orders.filter(o => o.stage === 1).length + '</b></span><span>已寄出 <b>' + state.orders.filter(o => o.stage === 3).length + '</b></span></div><label>搜订单<input id="owner-query" placeholder="订单号、姓名或电话" value="' + esc(orderQuery) + '"></label><select id="owner-filter"><option value="">所有订单状态</option>' + stageOptions(orderFilter === '' ? -1 : Number(orderFilter)) + '</select><div id="owner-orders">' + orderList() + '</div>' + (!state.orders.length ? '<p>下一笔订单号码：<b>' + esc(state.nextOrder || '待确认') + '</b></p><button type="button" data-act="reset-order-numbering">从 #001 开始正式接单</button>' : '');
  if (ownerTab === 'products') body = '<button class="primary" data-act="product">＋ 上新商品</button>' + state.products.map(p => '<article class="admin-order"><div><b>' + esc(p.name) + '</b><small>' + Lab.cats[p.cat] + ' · ' + (p.active ? '上架' : '已下架') + ' · ' + (p.mode === 'stock' ? '现货 ' + p.stock : p.mode === 'pre' ? '预购' : '联系定制') + '</small></div><button data-act="product" data-id="' + p.id + '">编辑</button></article>').join('');
  if (ownerTab === 'comments') body = state.wishes.map(w => '<section class="admin-letter"><small>' + Lab.ticket(w.order) + ' · ' + (w.done ? '已研究完毕' : '待考虑研究') + '</small><h3>' + esc(w.text) + '</h3>' + comments(w) + '<div class="row"><button data-act="owner-reply" data-id="' + w.id + '">回复留言</button><button data-act="mark" data-id="' + w.id + '">' + (w.done ? '移回待考虑' : '实现点子，拆信盖章 ✓') + '</button></div></section>').join('') || '<p class="empty">信箱暂时空着。</p>';
  if (ownerTab === 'settings') body = '<form data-form="settings" class="settings-form"><h2>运费与付款</h2>' + field('west', '西马运费 · RM', '未填写时先向店长确认', 'type="number" min="0" step=".01"', state.shipping[0] === null ? '' : state.shipping[0] / 100) + field('east', '东马及纳闽运费 · RM', '', 'type="number" min="0" step=".01"', state.shipping[1] === null ? '' : state.shipping[1] / 100) + field('singapore', 'Singapore 运费 · RM', '留空时暂不接受新加坡配送', 'type="number" min="0" step=".01"', state.shipping[2] == null ? '' : state.shipping[2] / 100) + '<h3>🏡 自取安排</h3>' + field('pickupAddress','自取地点','留空则提示顾客联系店长','maxlength="200"',state.pickup?.address||'') + field('pickupInstructions','自取时间 / 说明','商品做好后预约自取','maxlength="300"',state.pickup?.instructions||'') + '<label>DuitNow QR 图片<input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>' + (state.qr ? '<img class="payment-qr" src="' + state.qr + '" alt="当前 QR">' : '<p class="field-help">尚未放 QR，顾客可使用 TNG 号码转账。</p>') + '<label class="checkbox"><input type="checkbox" name="clear">移除现有 QR</label><button class="primary">保存设置</button></form><section class="notification-list"><h2>通知记录</h2><button type="button" data-act="browser-notify">🔔 开启新订单桌面提醒</button><p class="field-help">' + (demo ? '样版不发送真实邮件或 WhatsApp。正式版配置好通知服务后会自动处理。' : '订单和状态更改会在这里留下通知处理记录。') + '</p>' + ((state.events || []).slice(-20).reverse().map(e => '<div class="notification"><b>' + e.type + ' · ' + Lab.ticket(e.order) + '</b><small>' + esc(e.status) + (e.error ? ' · ' + esc(e.error) : '') + '</small>' + (!['已发送', '发送中'].includes(e.status) ? '<button data-act="retry-event" data-id="' + e.id + '">重新排入发送</button>' : '') + '</div>').join('') || '<p>暂无通知</p>') + '</section>';
  return '<div class="owner-heading"><h1>店长工作台</h1><button data-act="logout">退出</button></div><div class="owner-tabs">' + Object.entries(tabs).map(([key, value]) => '<button data-act="owner-tab" data-key="' + key + '" aria-pressed="' + (key === ownerTab) + '">' + value + '</button>').join('') + '</div>' + body;
}
function productForm(id) {
  const p = state.products.find(p => p.id === id) || { cat: 0, stock: 0, price: 2900, mode: 'stock', active: true, variants: [] };
  dialog(id ? '编辑商品' : '上新商品', '<form data-form="product" data-id="' + esc(id || '') + '">' + field('name', '商品名字 **', '', 'required maxlength="60"', p.name) + '<label>分区<select name="cat">' + options(Lab.cats, p.cat) + '</select></label>' + field('description', '小介绍 / 吐槽', '', 'maxlength="200"', p.description) + field('price', '价格 RM **', '', 'required type="number" min=".01" step=".01"', p.price / 100) + '<label>销售方式<select name="mode"><option value="stock" ' + (p.mode === 'stock' ? 'selected' : '') + '>现货</option><option value="pre" ' + (p.mode === 'pre' ? 'selected' : '') + '>预购</option><option value="custom" ' + (p.mode === 'custom' ? 'selected' : '') + '>联系店长定制</option></select></label><p class="field-help">粘土与盲盒按预购制作。定制商品会显示联系店长。</p>' + field('stock', '现货库存', '', 'required type="number" min="0" max="99999"', p.stock) + field('lead', '预购制作时间', '例如 7–10 天', 'maxlength="80"', p.lead) + '<label>规格与价格（每行一项，选填）<textarea name="variants" rows="3" placeholder="1 位麻瓜 | 59\n2 位麻瓜 | 99">' + esc((p.variants || []).map(v => v.label + ' | ' + v.price / 100).join('\n')) + '</textarea></label><h3>🎨 顾客定制资料</h3><label class="checkbox"><input type="checkbox" name="allowPhoto" ' + (p.allowPhoto?'checked':'') + '>允许顾客上传定制照片</label><label class="checkbox"><input type="checkbox" name="requirePhoto" ' + (p.requirePhoto?'checked':'') + '>开启上传时，照片必须填写</label><label>定制文字栏（每行一项；必填项末尾加 *）<textarea name="customFields" rows="3" placeholder="定制名字 *&#10;纪念日期">' + esc((p.customFields||[]).map(field=>field.label+(field.required?' *':'')).join('\n')) + '</textarea></label><p class="field-help">开启后，顾客填写照片 / 定制资料再加入购物车。定价定制请选择「现货」或「预购」，「联系店长定制」仍为询价入口。</p><label>上传真实商品图片<input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>' + (p.photo ? '<img class="upload-preview" src="' + p.photo + '" alt="当前商品图片">' : '') + '<label class="checkbox"><input type="checkbox" name="clear">移除当前图片</label><label class="checkbox"><input type="checkbox" name="active" ' + (p.active ? 'checked' : '') + '>上架销售</label><button class="primary wide">保存商品</button></form>');
}
function manageOrder(id) {
  const o = state.orders.find(o => o.id === Number(id));
  dialog('处理 ' + Lab.ticket(o.id), '<div class="admin-customer-details"><h3>👤 顾客</h3><p>' + esc(o.buyer) + ' · ' + esc(o.phone) + '<br>' + esc(o.email||'旧订单未留邮箱') + '</p><h3>' + (o.fulfillment==='pickup'?'🏡 自取':'🚚 配送 · '+esc({west:'West Malaysia',east:'East Malaysia',singapore:'Singapore'}[o.region]||o.state||'')) + '</h3><p>收件人：' + esc(o.recipientName||o.buyer) + ' · ' + esc(o.recipientPhone||o.phone) + '</p>' + (o.fulfillment==='pickup'?'<p>'+esc(o.pickupInfo?.address||'自取地点待确认')+'<br>'+esc(o.pickupInfo?.instructions||'')+'</p>':'') + o.items.filter(item=>item.customization).map(item=>'<section class="admin-customization"><h3>🎨 '+esc(item.name)+'</h3>'+(item.customization.photo?'<a download="custom-reference-'+o.id+'.webp" href="'+item.customization.photo+'"><img class="upload-preview" src="'+item.customization.photo+'" alt="顾客定制参考照片"><small>点击保存参考照片</small></a>':'')+(item.customization.fields||[]).map(field=>'<p>'+esc(field.label)+'：'+esc(field.value||'未填写')+'</p>').join('')+'<p>'+esc(item.customization.remark||'无定制备注')+'</p></section>').join('') + '</div><form data-form="update" data-id="' + o.id + '"><input type="hidden" name="version" value="' + (o.version || 0) + '"><p><b>' + esc(o.buyer) + '</b> · ' + esc(o.phone) + '</p><small>' + esc([o.postcode, o.city, o.state].filter(Boolean).join(' · ')) + '</small><p>应付 ' + money(o.total) + '</p>' + o.items.map((i, n) => field('qty' + n, i.name + ' · 数量', '', 'required type="number" min="0" max="99"', i.qty)).join('') + field('address', o.fulfillment==='pickup'?'地址（自取不必填）':'邮寄地址', '', (o.fulfillment==='pickup'?'':'required ')+'maxlength="160"', o.address) + '<label>订单状态<select name="stage">' + stageOptions(o.stage) + '</select></label><p class="field-help">换状态后，表情从该状态的第一天开始。之后每天自动换一个表情。</p>' + field('carrier', '快递公司', '', 'maxlength="60"', o.carrier) + field('tracking', '运单号码', '', 'maxlength="100"', o.tracking) + field('url', '物流链接', 'https://', 'type="url" maxlength="500"', o.url) + field('note', '改订 / 退款备注', '', 'maxlength="200"', o.note) + '<a class="button" target="_blank" rel="noopener" href="https://wa.me/' + (o.phone.startsWith('0') ? '60' + o.phone.slice(1) : o.phone) + '?text=' + encodeURIComponent('你好，关于 ' + Lab.ticket(o.id) + ' 的订单：') + '">联系这位麻瓜 ↗</a><button class="primary wide">保存订单</button></form><button type="button" data-act="delete-test-order" data-i="' + o.id + '">🧹 删除这笔测试订单</button>');
}
async function upload(input, previous, maxLength=950000) {
  const file = input.files[0];
  if (!file) return previous || '';
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('请选 PNG、JPG 或 WebP 图片');
  // Resize large phone images for the shop without changing their content.
  const image = await createImageBitmap(file);
  const canvas = document.createElement('canvas'), ratio = Math.min(1, (maxLength<950000?800:1200) / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
  let data = canvas.toDataURL('image/webp', .86);
  for(let quality=.7;data.length>maxLength&&quality>=.3;quality-=.15)data=canvas.toDataURL('image/webp',quality);
  if (data.length > maxLength) throw Error(maxLength<950000?'定制照片太大，请选一张较小的图片':'图片内容较大，请压缩到 700KB 再上传');
  return data;
}
function header() {
  const names = { home: '', shop: '麻瓜补给站', track: '小狗追踪局', wish: '麻瓜来信', admin: '店长工作台' };
  document.querySelector('body>header').hidden=route==='home';
  $('page-name').textContent = names[route];
  $('back').hidden = route === 'home';
  $('cross').hidden = !['shop', 'track'].includes(route);
  $('cross').href = route === 'shop' ? '#track' : '#shop';
  $('cross').textContent = route === 'shop' ? '去追踪局' : '去下单';
  $('mute').textContent = quiet ? '🔇' : '🔊'; $('mute').setAttribute('aria-pressed', String(!quiet));
  $('music').setAttribute('aria-pressed', String(musicOn)); $('music').title = musicOn ? '暂停狗哥打歌' : '狗哥打歌';
  $('music').classList.toggle('playing', musicOn);
  document.querySelectorAll('.dock a').forEach(a => a.hash === '#' + route ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
}
function draw() {
  if (!state) return;
  if (isAdmin) {
    const ids=new Set(state.orders.map(o=>o.id));
    const added=notifiedOrders ? state.orders.filter(o=>!notifiedOrders.has(o.id)) : [];
    if(added.length){tell('新麻瓜来了，收到 '+added.length+' 笔订单 🐶');tone(740,.15);if('Notification' in window&&Notification.permission==='granted')new Notification('研究所收到新订单',{body:added.map(o=>Lab.ticket(o.id)).join(' · ')});}
    notifiedOrders=ids;
  } else notifiedOrders=null;
  document.body.dataset.route = route;
  header();
  screen.innerHTML = ({ home, shop, track, wish: wishPage, admin: adminPage })[route]() + footer();
  if($('product-sort'))$('product-sort').value=productSort;
}
function leaveWelcome(){
  close();
  if(location.hash!=='#home')location.hash='#home';
  else {route='home';draw();window.scrollTo(0,0);}
}
function welcomeBack(){
  if(welcomeChecked)return;
  welcomeChecked=true;
  const mine=new Set([...(state.pins||[]),...(state.member?.orders||[])]);
  const order=state.orders.filter(o=>mine.has(o.id)).sort((a,b)=>b.id-a.id)[0];
  if(!order)return;
  const dog=order.identity?.dog??state.member?.dog??order.dog;
  dialog('你的小狗来迎接你啦', '<section class="returning-welcome"><div class="welcoming-dog">'+dogVisual(dog,'normal','waving')+'</div><p class="welcome-speech">'+esc(Lab.dogs[dog])+'：麻瓜，你回来啦！</p><p class="welcome-question">是回来看看 '+Lab.ticket(order.id)+' 的进度吗？</p><a class="welcome-track" data-act="welcome-track" href="#track?order='+order.id+'">看看我的订单进度 →</a><small class="tap-home">点小狗或其他地方，回首页</small></section>', 'welcome-popup');
}
async function navigate() {
  const [path, params] = location.hash.slice(1).split('?');
  route = ['shop', 'track', 'wish', 'admin'].includes(path) ? path : 'home';
  if (modal.open) close();
  try {
    await api();
    const id = new URLSearchParams(params).get('order');
    if (route === 'track' && id && state.orders.some(o => o.id === Lab.numId(id))) await api('pin', { order: id });
    draw();welcomeBack();
  } catch (error) { screen.innerHTML = '<section class="empty"><h2>小狗暂时没连上工作台</h2><p>' + esc(error.message) + '</p><button data-act="refresh">再试一次</button></section>'; }
  window.scrollTo(0, 0);
}
function cups() {
  sound('cups');
  const result = Math.floor(Math.random() * 3);
  const titles = ['圣杯 · 去试试看！', '笑杯 · 小狗先笑一下。', '阴杯 · 再想一想嘛。'];
  const lines = ['麻瓜可以犹豫，小狗先替你迈一步。', '你问得太好笑，连杯都笑翻了。', '先喝口水。店长也不是每次都想得明白。'];
  dialog('🪵 麻瓜犹豫研究', '<div class="cup-result cups-' + result + '"><i></i><i></i></div><h3 class="center">' + titles[result] + '</h3><p class="center field-help">' + lines[result] + '</p><button class="primary wide" data-act="cups">还是犹豫？再丢一次</button><small class="cup-footnote">今日小小娱乐，决定还是麻瓜自己做。</small>');
}
function sendAnimation() {
  rustle();
  dialog('信封正在传送', '<div class="first-person-mail"><div class="near-mailbox"><span>麻瓜来信</span><div class="near-slot"></div></div><div class="flying-letter"><i>✉</i></div><p>轻轻推一下，交给狗同事。</p></div>', 'mail-animation');
  setTimeout(() => {
    if (!modal.classList.contains('mail-animation')) return;
    close();
    letterDone = false; draw();
    dogLine='咔哒！收到了，小狗帮你守着。';if($('dog-says'))$('dog-says').textContent=dogLine;puppyBarks();
    tell('信收到啦，小狗帮你保管。✉️');
  }, 1800);
}
function invalidHint(field) {
  const messages = { buyer: '名字还空着，快递哥找不到麻瓜咯', phone: '留个正确电话，小狗才找得到麻瓜 📞', address: '地址还没填，包裹不知道飞去哪 📦', postcode: '邮编要填 5 位数字哦 📮', city: '城市还没填，小狗导航迷路了 🧭', state: '请选择州属，让包裹走对路 🗺️', payer: '请填写付款人 TNG 全名，店长才能核款 💰', last: '电话后四位，要刚刚好 4 位哦', order: '号码牌还没填，小狗要认一下人 🎫', text: '信纸还空着，写点什么吧 ✍️' };
  return field.validity.valueMissing ? messages[field.name] || '这里还没填好哦 ✍️' : '这项格式需要再检查一下哦 🐶';
}
document.addEventListener('focusout',event=>{const field=event.target;if(!field.matches('form[data-form=checkout] input,form[data-form=checkout] select')||field.disabled||field.validity.valid)return;field.setAttribute('aria-invalid','true');let hint=field.parentElement.querySelector('.field-error');if(!hint){hint=document.createElement('small');hint.className='field-error';field.after(hint);}hint.textContent=invalidHint(field);},true);
document.addEventListener('invalid', event => {
  event.preventDefault();
  const field = event.target, form = field.form;
  if (!form) return;
  field.setAttribute('aria-invalid', 'true');
  let hint = field.parentElement.querySelector('.field-error');
  if (!hint) { hint = document.createElement('small'); hint.className = 'field-error'; field.after(hint); }
  hint.textContent = invalidHint(field);
  if (form.querySelector(':invalid') === field) { field.focus(); tell('资料还没齐，小狗帮你标出来了 🐶'); }
}, true);
document.addEventListener('keydown', event => {
  const form=event.target.closest?.('form[data-form="checkout"]');
  if(form&&event.key==='Enter'&&event.target.tagName==='INPUT'&&Number(form.dataset.step)<2){event.preventDefault();checkoutStep(1);}
});
document.addEventListener('input', event => {
  const target = event.target;
  if(target.name==='message'){const preview=target.closest('.message-options')?.querySelector('.message-preview span');if(preview)preview.textContent=target.value||'这次不捎话 🐾';}
  target.removeAttribute('aria-invalid'); target.parentElement?.querySelector('.field-error')?.remove();
  if (target.name === 'postcode' && target.form?.elements.region.value!=='singapore') {
    const matches=POSTAL_LOOKUP[target.value]||[];
    const index=matches[0]?.[0]??POSTCODE_TABLE[target.value];
    if(index!==undefined){
      target.form.elements.state.value=Lab.states[index];target.form.elements.region.value=[9,10,14].includes(index)?'east':'west';cityOptions('',matches);
      $('postcode-hint').textContent=matches.length?'📮 已带出城市与州属，两个都可以手动更改。':'📮 已找到州属，请从下拉列表确认城市。';
    }else if(target.value.length===5){cityOptions();$('postcode-hint').textContent='这组邮编小狗不确定，请从下拉列表选城市和州属。';}
    bill();
  }
  if (target.id === 'owner-query') { orderQuery = target.value; $('owner-orders').innerHTML = orderList(); }
});
document.addEventListener('change', event => {
  const target = event.target;
  if (target.name === 'state' && target.form?.dataset.form==='checkout') {const form=target.form,index=Lab.states.indexOf(target.value);form.elements.region.value=target.value==='Singapore'?'singapore':[9,10,14].includes(index)?'east':'west';const previous=form.elements.city.value;cityOptions(previous,POSTAL_LOOKUP[form.elements.postcode.value]||[]);deliveryFields();}
  if(['region','fulfillment'].includes(target.name)&&target.form?.dataset.form==='checkout')deliveryFields();
  if(target.name==='sameRecipient'){const fields=$('recipient-fields');fields.hidden=target.checked;fields.disabled=target.checked;}
  if (target.name === 'city') {const manual=target.value==='__other__';$('manual-city-label').hidden=!manual;target.form.elements.cityManual.disabled=!manual;target.form.elements.cityManual.required=manual;}
  if (target.name === 'role' && $('comment-credentials')) { $('comment-credentials').hidden = target.value !== 'order'; $('comment-credentials').disabled = target.value !== 'order'; }
  if (target.matches('[data-variant]')) {
    const article = target.closest('[data-product]'), p = state.products.find(p => p.id === article.dataset.product);
    article.querySelector('.price').textContent = money(p.variants[Number(target.value)].price);
  }
  if(target.name==='messageCategory'){const area=target.closest('.message-options').querySelector('.message-presets');area.innerHTML=(messagePresets[target.value]||[]).map(line=>'<button type=button data-act=message-preset>'+esc(line)+'</button>').join('');}
  if(['product-sort','product-filter'].includes(target.id)){if(target.id==='product-sort')productSort=target.value;else productFilter=target.value;draw();if($('product-sort'))$('product-sort').value=productSort;}
  if (target.id === 'owner-filter') { orderFilter = target.value; $('owner-orders').innerHTML = orderList(); }
});
document.addEventListener('click',event=>{const summary=event.target.closest('.category>summary');if(summary){event.preventDefault();activeCategory=activeCategory===Number(summary.parentElement.dataset.category)?null:Number(summary.parentElement.dataset.category);productFilter='';draw();if($('product-sort'))$('product-sort').value=productSort;}else if(route==='shop'&&activeCategory!==null&&!event.target.closest('.category>summary,.product-controls,.cart,header,nav,dialog,.search-caption,button,a,input,select,textarea,label')){activeCategory=null;draw();}});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault(); if (busy) return;
  busy = true;
  const buttons = [...form.querySelectorAll('button[type="submit"],button:not([type])')];
  buttons.forEach(button => { button.disabled = true; });
  const payload = Object.fromEntries(new FormData(form)), type = form.dataset.form, id = form.dataset.id;
  try {
    if(type==='filter'){productFilter=payload.keyword.trim();close();draw();}
    else if(type==='certificate'){const result=await api('certificate',payload);certificate(result.member,true);}
    else if(type==='message'){await api('message',payload);close();draw();tell('小狗记好啦，话已经捎上了 💬');}
    else if (type === 'customize') {
      const product=state.products.find(product=>product.id===id);
      if(!product)throw Error('商品已更新，请重新选择');
      const photo=product.allowPhoto?await upload(form.elements.customPhoto,cartCustom[form.dataset.key]?.photo,260000):'';
      const customization={photo,fields:(product.customFields||[]).map((field,i)=>({label:field.label,value:String(payload['customField'+i]||'').trim()})),remark:String(payload.customRemark||'').trim()};
      const key=form.dataset.key||product.id+'|'+form.dataset.variant+'|'+crypto.randomUUID();
      const previous=cartCustom[key];cartCustom[key]=customization;
      try{save('cart-custom',cartCustom);if(!form.dataset.key)await changeCart(key,Number(form.dataset.qty));}catch(error){if(previous)cartCustom[key]=previous;else delete cartCustom[key];save('cart-custom',cartCustom);throw error;}
      close();draw();tell('定制资料已放进购物车 🎨');
    }
    else if (type === 'checkout') {
      if (!form.dataset.total) throw Error('请选择配送地区并确认运费');
      save('request', requestToken);
      const result = await api('order', { ...payload, checkoutVersion:2, sameRecipient:form.elements.sameRecipient.checked, city:payload.city==='__other__'?payload.cityManual:payload.city, dog: selectedDog, consent: payload.consent === 'on', total: Number(form.dataset.total), token: requestToken, items: cartRows().map(row => ({ id: row.product.id, qty: row.qty, variant: row.variant, line:row.key.split('|')[2]||'', customization:row.customization })) });
      selectedDog=result.dog??selectedDog;
      cart = {}; cartCustom={};save('cart-custom',cartCustom);save('cart', cart); requestToken = crypto.randomUUID(); save('request', requestToken);
      draw();
      dialog('🎫 号码牌已到', '<div class="order-success">' + dogVisual(selectedDog, 'excited') + '<h2>' + Lab.ticket(result.order) + '</h2><p>' + Lab.dogs[selectedDog] + '接单了，正在等店长核款。</p><a class="button primary wide" target="_blank" rel="noopener" href="' + wa + '?text=' + encodeURIComponent('店长，这是 ' + Lab.ticket(result.order) + ' 的付款截图。') + '">到 WhatsApp 附上付款截图 ↗</a><a class="button wide" href="#track?order=' + result.order + '">去看我的小狗 →</a></div>');
      bark(selectedDog);
    } else if (type === 'search') {
      const result = await api('search', { query: payload.query }); searchResults = result.ids;
      if (result.ids.length === 1) { await api('pin', { order: result.ids[0] }); searchResults = null; tell('小狗已在这里等你，下次回来还能看到。🐶'); }
      draw(); tone(620);
    } else if (type === 'join') { await api('join', payload); draw(); certificate(); }
    else if (type === 'wish') { await api('wish', payload); sendAnimation(); }
    else if (type === 'comment') {
      await api('comment', { ...payload, id }); close(); draw();
      const block = $('comments-' + id); if (block) { block.hidden = false; block.scrollIntoView({ block: 'center' }); }
      tone(680); tell('留言收到啦 ✍️');
    } else if (type === 'parcel') {
      const result = await api('parcel', payload);
      dialog('🚚 麻瓜的包裹', '<h3>' + esc(result.carrier || '物流公司待补充') + '</h3><p class="tracking-number">' + esc(result.tracking || '店长还没填运单号') + '</p>' + (result.url ? '<a class="button primary wide" rel="noopener" target="_blank" href="' + esc(result.url) + '">查看物流进度 ↗</a>' : ''));
    } else if (type === 'login') { await api('login', payload); draw(); }
    else if (type === 'product') {
      const variants = String(payload.variants).split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const parts = line.split('|');
        if (parts.length !== 2 || !parts[0].trim() || !Number.isFinite(Number(parts[1]))) throw Error('规格请按「1 位麻瓜 | 59」填写，每行一项');
        return { label: parts[0].trim(), price: Math.round(Number(parts[1]) * 100) };
      });
      await api('product', { ...payload, id, cat: Number(payload.cat), price: Math.round(Number(payload.price) * 100), stock: Number(payload.stock), active: payload.active === 'on', allowPhoto:payload.allowPhoto==='on', requirePhoto:payload.requirePhoto==='on', customFields:String(payload.customFields||'').split('\n').map(value=>value.trim()).filter(Boolean).map(value=>({label:value.replace(/\s*\*$/,'').trim(),required:value.endsWith('*')})), variants, photo: payload.clear ? '' : await upload(form.elements.photo, state.products.find(p => p.id === id)?.photo) });
      close(); draw(); tell('商品已保存，小狗开始理货。📦');
    } else if (type === 'update') {
      await api('update', { ...payload, order: id, version: Number(payload.version), stage: Number(payload.stage), mood: 0, quantities: [...form.querySelectorAll('[name^="qty"]')].map(input => Number(input.value)) });
      close(); draw(); tell('订单已更新，狗同事都知道了。🐶');
    } else if (type === 'settings') {
      await api('settings', { west: payload.west === '' ? null : Math.round(Number(payload.west) * 100), east: payload.east === '' ? null : Math.round(Number(payload.east) * 100), singapore:payload.singapore===''?null:Math.round(Number(payload.singapore)*100), pickupAddress:payload.pickupAddress, pickupInstructions:payload.pickupInstructions, qr: payload.clear ? '' : await upload(form.elements.photo, state.qr) });
      draw(); tell('设置已保存');
    }
  } catch (error) { if (modal.open && $('form-error')) $('form-error').textContent = error.message; else tell(error.message); }
  finally { busy = false; buttons.forEach(button => { button.disabled = false; }); }
});
async function changeCart(key, change) {
  const product = state.products.find(p => p.id === key.split('|')[0]);
  const next = (cart[key] || 0) + change;
  const total = Object.entries(cart).filter(([k]) => k.split('|')[0] === product.id).reduce((sum, [, qty]) => sum + qty, 0) + change;
  if (next > 99 || (product.mode === 'stock' && total > product.stock)) throw Error('已达可购买数量，给别的麻瓜留一点 🐶');
  if (next <= 0) {delete cart[key];delete cartCustom[key];save('cart-custom',cartCustom);} else cart[key] = next;
  save('cart', cart);
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-act]');
  if (!button) return;
  const action = button.dataset.act, id = button.dataset.id, number = Number(button.dataset.i);
  if (['newwish','comment','owner-reply','parcel','join','certificate','product','manage','pin','flip-card'].includes(action)) tone(430,.045);
  try {
    if(action==='welcome-track'){}
    else if(action==='welcome-close')leaveWelcome();
    else if(action==='greet-pet'){const dog=modal.querySelector('.dog-art');dog?.classList.remove('squash');if(dog){void dog.offsetWidth;dog.classList.add('squash')}bark(number);tell(Lab.dogs[number]+'：熟悉的麻瓜，熟悉的手！🐶');}
    else if (action === 'refresh') await navigate();
    else if (action === 'logo') { button.classList.remove('squash'); void button.offsetWidth; button.classList.add('squash'); $('welcome-note').textContent = ['研究记录：这名麻瓜一进来就戳人。', '研究记录：戳完人，记得摸摸狗。', '研究记录：快乐的麻瓜，今天也来了。'][Math.floor(Math.random() * 3)]; tone(310); }
    else if (action === 'pet') { dogSound(button.querySelector('.dog-art'));  button.classList.remove('squash'); void button.offsetWidth; button.classList.add('squash'); }
    else if (action === 'cups') cups();
    else if (action === 'dog') { selectedDog = number; choices(); bark(number); const selected = $('choices').querySelector('[data-i="' + number + '"]'); selected.classList.add('squash'); }
    else if (['minus', 'plus', 'add'].includes(action)) {
      const article = button.closest('[data-product]'), product = state.products.find(p => p.id === article.dataset.product), output = article.querySelector('output');
      const variant = Number(article.querySelector('[data-variant]')?.value || 0), key = product.id + '|' + variant;
      const quantity = Number(output.value || output.textContent || 1);
      if (action === 'add') {
        if(product.allowPhoto||(product.customFields||[]).length){customizationForm(product,variant,quantity);return;}
        await changeCart(key, quantity);
        const open = [...document.querySelectorAll('.category')].map(node => node.open); draw();
        document.querySelectorAll('.category').forEach((node, i) => { node.open = open[i]; });
        tell('已加入 ' + product.name + ' × ' + quantity); tone(660);
      } else { output.value = Math.max(1, Math.min(99, quantity + (action === 'plus' ? 1 : -1))); tone(460); }
    } else if (['cart-minus', 'cart-plus'].includes(action)) { await changeCart(button.dataset.key, action === 'cart-plus' ? 1 : -1); draw(); tone(); }
    else if(action==='empty-cart'){cart={};cartCustom={};save('cart',cart);save('cart-custom',cartCustom);draw();tell('清空啦，小狗又擦了一遍车 🧹');}
    else if(action==='category-back'){activeCategory=null;draw();}
    else if (action === 'checkout') checkout();
    else if(action==='checkout-next')checkoutStep(1);
    else if(action==='checkout-back')checkoutStep(-1);
    else if(action==='edit-customization'){const row=cartRows().find(row=>row.key===button.dataset.key);if(row)customizationForm(row.product,row.variant,row.qty,row.key);}
    else if (action === 'copy') {
      try { await navigator.clipboard.writeText('0124390204'); tell('复制成功啦 ✓ TNG 号码已复制'); }
      catch { dialog('TNG 转账号码', '<input readonly value="0124390204" aria-label="复制 TNG 号码"><small>长按号码即可复制。</small>'); }
    } else if (action === 'pin') { await api('pin', { order: number }); searchResults = null; draw(); tell('小狗记住这个位置了。🐶'); }
    else if (action === 'queue' || action === 'graduates') { save('queue', action === 'graduates' ? 'graduates' : 'waiting'); draw(); tone(); }
    else if (action === 'parcel') dialog('是你吗？麻瓜 🧐', '<form data-form="parcel"><input name="order" type="hidden" value="' + number + '">' + field('last', '下单电话后四位 **', '小狗要认一下人', 'required inputmode="numeric" pattern="[0-9]{4}" maxlength="4"') + '<button class="primary wide">是我，查看包裹 🚚</button></form>');
    else if (action === 'join') {
      dialog('🪪 找回麻瓜员工证', '<form data-form="join">' + (demo ? '<small class="demo-hint">示例用 49 / 2049 即可体验。</small>' : '') + credentials() + field('name', '员工昵称 **', '在这个小世界叫什么？', 'required maxlength="20"') + '<p class="field-help">工号使用你的第一笔订单号码，以后一直保留。</p><button class="primary wide">找回我的员工证 🪪</button></form>');
      if (state.pins?.[0]) modal.querySelector('[name="order"]').value = state.pins[0];
    } else if (action === 'certificate') verification(state.member?.orders?.[0]||state.pins?.[0],'certificate');
    else if(action==='verify-certificate')verification(number,'certificate');
    else if(action==='public-certificate'){const o=state.orders.find(o=>o.id===number);certificate(o.identity,false);}
    else if(action==='message')verification(number,'message');
    else if(action==='message-preset'){const area=button.closest('.message-options');area.querySelector('[name=message]').value=button.textContent;area.querySelector('.message-preview span').textContent=button.textContent;area.querySelectorAll('[data-act=message-preset]').forEach(b=>b.setAttribute('aria-pressed',b===button));}
    else if(action==='message-tone'){const area=button.closest('.message-options');area.querySelector('.message-presets').innerHTML=presetButtons(button.dataset.tone);area.querySelectorAll('[data-act=message-tone]').forEach(b=>b.setAttribute('aria-pressed',b===button));if(button.dataset.tone==='custom')area.querySelector('[name=message]').focus();}
    else if(action==='clear-message'){const area=button.closest('.message-options');area.querySelector('[name=message]').value='';area.querySelector('.message-preview span').textContent='这次不捎话 🐾';}
    else if(action==='filter')dialog('🔎 搜全店商品','<form data-form=filter><label>商品关键字<input name=keyword maxlength=80 value="'+esc(productFilter)+'" placeholder="输入名字或关键字"></label><button class="primary wide">搜整个店铺</button></form>');
    else if(action==='clear-filter'){productFilter='';draw();}
    else if(action==='order-details')orderDetails(number);
    else if(action==='profile'){const identity=state.orders.map(o=>o.identity).find(m=>m?.id===Number(button.dataset.member));certificate(identity,false);}
    else if (action === 'flip-card') { $('badge-back').hidden = !$('badge-back').hidden; document.querySelector('.certificate-front').hidden = !$('badge-back').hidden; tone(); }
    else if (action === 'newwish') openLetterForm();
    else if (action === 'speak') {dogSound(button.querySelector('.dog-art')); button.classList.remove('squash'); void button.offsetWidth; button.classList.add('squash'); say(['快寄一封，店长等着拆灵感。', '信封别粘我鼻子，上次差点把我寄走。', '这个点子几大胆一下，我先替店长看一眼。'][Math.floor(Math.random() * 3)]); }
    else if (action === 'pending' || action === 'done') { letterDone = action === 'done'; draw(); tone(); }
    else if (action === 'toggle-comments') { const block = $('comments-' + id); block.hidden = !block.hidden; button.textContent = '💬 ' + (state.wishes.find(w=>w.id===id).comments.length+(state.wishes.find(w=>w.id===id).note?1:0)) + ' 则留言 · ' + (block.hidden ? '展开' : '收起'); tone(); }
    else if (action === 'comment' || action === 'owner-reply') openComment(id, action === 'owner-reply');
    else if (action === 'vote') { if (busy) return; busy = true; button.disabled = true; try { await api('vote', { id }); sound('woodfish'); draw(); tell('功德 +1，小狗替你记上了。🪵'); } finally { busy = false; } }
    else if (action === 'owner-tab') { ownerTab = button.dataset.key; draw(); tone(); }
    else if (action === 'logout') { await api('logout'); draw(); }
    else if (action === 'product') productForm(id);
    else if (action === 'manage') manageOrder(number);
    else if (action === 'reset-order-numbering') { if (!confirm('仅在清空测试订单后使用。确认下一笔订单从 #001 开始？')) return; await api('reset-order-numbering', { confirm: 'RESET 001' }); draw(); tell('下一笔订单会从 #001 开始'); }
    else if (action === 'delete-test-order') { const confirmation = prompt('仅用于测试订单。删除后无法恢复，库存会还原。请输入 ' + Lab.ticket(number) + ' 确认：'); if (confirmation !== Lab.ticket(number)) return; await api('delete-test-order', { order: number, confirm: confirmation }); modal.close(); searchResults = null; draw(); tell('测试订单及关联通知已清理'); }
    else if (action === 'mark') { const w = state.wishes.find(w => w.id === id); await api('done', { id, done: !w.done }); draw(); tell(w.done ? '信移回待考虑' : '点子实现，麻瓜的徽章也同步了。✉️'); }
    else if (action === 'browser-notify') { if(!('Notification' in window))throw Error('这个浏览器暂不支持桌面提醒');const permission=await Notification.requestPermission();tell(permission==='granted'?'已开启。工作台开着时，新订单会提醒店长。':'可在浏览器设置中允许通知'); }
    else if (action === 'retry-event') { await api('retryevent', { id }); draw(); tell('已重新排入发送'); }
  } catch (error) { tell(error.message); if (action === 'vote') draw(); }
});
$('mute').onclick = () => { quiet = !quiet; save('quiet', quiet); if (quiet) window.speechSynthesis?.cancel(); else tone(); header(); };
$('music').onclick = toggleMusic;
window.addEventListener('hashchange', () => { tone(410); navigate(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !modal.open) api().then(draw).catch(() => {}); });
setInterval(() => { if (!document.hidden && !modal.open && ['track', 'wish', 'admin'].includes(route) && !document.activeElement?.matches('input,textarea,select')) api().then(draw).catch(() => {}); }, 30000);
navigate();

let displayedDay=Lab.day();setInterval(()=>{const current=Lab.day();if(current!==displayedDay&&!modal.open){displayedDay=current;if(['home','track','wish'].includes(route))draw();}},30000);
// Decorative dogs in comments and certificates also react to a direct tap.
document.addEventListener('click',event=>{const dog=event.target.closest('.dog-art');if(!dog||event.target.closest('[data-act]'))return;dog.classList.remove('squash');void dog.offsetWidth;dog.classList.add('squash');dogSound(dog);});
