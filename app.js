const STORAGE_KEY = 'chusenManagerDataV1';
const AUTO_SCHEDULE_KEY = 'chusenAutomaticScheduleV1';
const AUTO_SCHEDULE_CHECK_KEY = 'chusenAutomaticScheduleLastCheckV1';
const AUTO_SCHEDULE_INTERVAL = 12 * 60 * 60 * 1000;
const SCAN_HISTORY_KEY = 'chusenScanHistoryV1';
const SCHEDULE_RETENTION_DAYS = 30;

const seedData = {
  accounts: [
    { id:'ACC-001', name:'Tài khoản 1', email:'email1@gmail.com', phone:'090-1234-5678', active:true },
    { id:'ACC-002', name:'Tài khoản 2', email:'email2@gmail.com', phone:'080-2345-6789', active:true },
    { id:'ACC-003', name:'Tài khoản 3', email:'email3@gmail.com', phone:'070-3456-7890', active:true },
    { id:'ACC-004', name:'Tài khoản 4', email:'email4@gmail.com', phone:'090-4567-8901', active:true },
    { id:'ACC-005', name:'Tài khoản 5', email:'email5@gmail.com', phone:'080-5678-9012', active:true }
  ],
  products: [
    {
      id:'OP17', name:'ONE PIECE CARD GAME OP-17', category:'One Piece', image:'assets/onepiece.svg',
      releaseAt:'2026-08-30T10:00', resultAt:'2026-08-12T12:00', note:'Giới hạn tùy cửa hàng. Kiểm tra kết quả trước ngày thanh toán.',
      stores:[
        { id:'geo', name:'GEO', applyStart:'2026-08-04T10:00', applyEnd:'2026-08-07T23:59', resultAt:'2026-08-12T12:00', releaseAt:'2026-08-30T10:00', link:'https://geo-online.co.jp/', fee:1, accountIds:['ACC-001','ACC-002','ACC-004'] },
        { id:'familymart', name:'FamilyMart', applyStart:'2026-08-05T10:00', applyEnd:'2026-08-08T23:59', resultAt:'2026-08-14T10:00', releaseAt:'2026-08-30T10:00', link:'https://www.family.co.jp/', fee:0, accountIds:['ACC-001','ACC-002','ACC-003','ACC-004','ACC-005'] },
        { id:'aeon', name:'AEON Style', applyStart:'2026-08-06T09:00', applyEnd:'2026-08-10T20:00', resultAt:'2026-08-16T12:00', releaseAt:'2026-08-30T09:00', link:'https://www.aeonretail.jp/', fee:0, accountIds:['ACC-003'] }
      ]
    },
    {
      id:'PKM-SHIELD', name:'Pokémon Card Game Sword & Shield BOX', category:'Pokémon', image:'assets/pokemon.svg',
      releaseAt:'2026-08-25T10:00', resultAt:'2026-08-10T10:00', note:'Theo dõi thông báo trên app của cửa hàng.',
      stores:[{ id:'fm2', name:'FamilyMart', applyStart:'2026-08-05T10:00', applyEnd:'2026-08-07T23:59', resultAt:'2026-08-10T10:00', releaseAt:'2026-08-25T10:00', link:'https://www.family.co.jp/', fee:0, accountIds:['ACC-001','ACC-002','ACC-003','ACC-004','ACC-005'] }]
    },
    {
      id:'UX21', name:'Beyblade X UX-21', category:'Beyblade', image:'assets/beyblade.svg',
      releaseAt:'2026-08-28T10:00', resultAt:'2026-08-18T12:00', note:'Có thể giới hạn 1 sản phẩm / người.',
      stores:[{ id:'takara', name:'Takara Tomy Mall', applyStart:'2026-08-08T10:00', applyEnd:'2026-08-12T23:59', resultAt:'2026-08-18T12:00', releaseAt:'2026-08-28T10:00', link:'https://takaratomymall.jp/', fee:0, accountIds:['ACC-001'] }]
    }
  ],
  transactions:[
    { id:'T1', date:'2026-08-03', accountId:'ACC-001', productId:'OP17', store:'GEO', amount:6600, status:'hold' },
    { id:'T2', date:'2026-08-03', accountId:'ACC-002', productId:'OP17', store:'GEO', amount:1, status:'verify' },
    { id:'T3', date:'2026-08-01', accountId:'ACC-003', productId:'PKM-SHIELD', store:'FamilyMart', amount:5500, status:'hold' }
  ],
  settings:{ notifications:true, before:'30', dailySummary:'08:00', resultNotice:true, deadlineNotice:true, releaseNotice:true }
};

let state = loadData();
let route = 'dashboard';
let selectedProductId = null;
let automaticSchedule = loadCachedAutomaticSchedule();
let automaticScheduleLoading = false;
let lastScanResults = [];
const app = document.getElementById('app');
const modal = document.getElementById('modal');

function loadData(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(seedData); }
  catch { return structuredClone(seedData); }
}
function saveData(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function money(n){ return new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(n); }
function dt(v){ if(!v) return '—'; return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)); }
function d(v){ return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit'}).format(new Date(v)); }
function esc(v=''){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function accountName(id){ return state.accounts.find(a=>a.id===id)?.id || id; }
function product(id){ return state.products.find(p=>p.id===id); }
function statusText(s){ return ({hold:'Tạm giữ',verify:'Xác minh',refund:'Đã hoàn'})[s] || s; }
function statusClass(s){ return ({hold:'orange',verify:'green',refund:'green'})[s] || 'purple'; }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1800); }
function setSubtitle(text){ document.getElementById('pageSubtitle').textContent=text; }
function scanEndpoint(){ return String(state.settings?.scanEndpoint||window.CHUSEN_FIREBASE_DEFAULTS?.scanEndpoint||'').trim().replace(/\/+$/,''); }
function scanHeaders(){
  const headers={'Content-Type':'application/json'};
  const token=String(state.settings?.scanToken||'').trim();
  if(token) headers['X-Scan-Token']=token;
  return headers;
}
function localDateKey(value=new Date()){
  const date=value instanceof Date?value:new Date(value);
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function dateFromKey(key){ return new Date(`${key}T12:00:00+09:00`); }
function addDaysKey(days){ const date=new Date(); date.setUTCHours(date.getUTCHours()+9); date.setUTCDate(date.getUTCDate()+days); return date.toISOString().slice(0,10); }
function loadCachedAutomaticSchedule(){
  try{
    const cached=JSON.parse(localStorage.getItem(AUTO_SCHEDULE_KEY));
    return Array.isArray(cached)?cached:[];
  }catch{return [];}
}
function firestoreValue(value){
  if(value?.toDate) return value.toDate().toISOString();
  return value ?? '';
}
function normalizeScheduleItem(item,id=''){
  return {
    id:String(item.id||id||`schedule-${Date.now()}`),
    date:String(item.date||localDateKey(firestoreValue(item.resultAt)||new Date())),
    storeName:String(item.storeName||item.store||'Cửa hàng'),
    productName:String(item.productName||item.product||'Sản phẩm Chusen'),
    time:String(item.time||''),
    applyStart:firestoreValue(item.applyStart),
    applyEnd:firestoreValue(item.applyEnd),
    resultAt:firestoreValue(item.resultAt),
    link:String(item.link||''),
    method:String(item.method||item.note||''),
    area:String(item.area||''),
    sourceType:String(item.sourceType||'unknown'),
    sourceUrl:String(item.sourceUrl||item.link||''),
    confidence:Number(item.confidence??(item.verified===true?95:45)),
    active:item.active!==false,
    verified:item.verified!==false,
    demo:item.demo===true
  };
}
function demoAutomaticSchedule(){
  return [
    {id:'demo-history-1',date:addDaysKey(-1),storeName:'GEO',productName:'ONE PIECE CARD GAME',time:'12:00～',link:'https://geo-online.co.jp/',method:'Kiểm tra thông báo trong ứng dụng GEO',sourceType:'official-web',confidence:95,verified:true,demo:true},
    {id:'demo-history-2',date:addDaysKey(-4),storeName:'AEON Style',productName:'Pokémon Card Game BOX',time:'10:00～',link:'https://www.aeonretail.jp/',method:'Kiểm tra kết quả trong ứng dụng AEON',sourceType:'official-web',confidence:95,verified:true,demo:true},
    {id:'demo-1',date:addDaysKey(0),storeName:'Bic Camera',productName:'Pokémon Card Game BOX',time:'10:00～',link:'https://www.biccamera.com/bc/category/001/240/',method:'Kiểm tra trang Chusen / thông báo của cửa hàng',verified:false,demo:true},
    {id:'demo-2',date:addDaysKey(0),storeName:'Joshin',productName:'ONE PIECE CARD GAME',time:'15:00～',link:'https://joshinweb.jp/',method:'Kiểm tra thông báo trong ứng dụng Joshin',verified:false,demo:true},
    {id:'demo-3',date:addDaysKey(0),storeName:'Yodobashi.com',productName:'Dragon Ball Super Card Game',time:'18:00～',link:'https://www.yodobashi.com/',method:'Kiểm tra email hoặc trang lịch sử Chusen',verified:false,demo:true},
    {id:'demo-4',date:addDaysKey(1),storeName:'Pokémon Center Online',productName:'Pokémon Card Game BOX',time:'13:00 / 15:00 / 17:00',link:'https://www.pokemoncenter-online.com/',method:'My Page → Lịch sử Chusen',verified:false,demo:true}
  ].map(x=>normalizeScheduleItem(x,x.id));
}
function scheduleHistoryItems(){
  const today=localDateKey();
  const cutoff=addDaysKey(-SCHEDULE_RETENTION_DAYS);
  return scheduleSource().filter(x=>x.active&&x.date<today&&x.date>=cutoff).sort((a,b)=>`${b.date} ${timeText(b)}`.localeCompare(`${a.date} ${timeText(a)}`));
}
function loadScanHistory(){
  try{ const rows=JSON.parse(localStorage.getItem(SCAN_HISTORY_KEY)); return Array.isArray(rows)?rows:[]; }
  catch{return [];}
}
function saveScanLog(request,count,mode){
  const rows=loadScanHistory();
  rows.unshift({at:new Date().toISOString(),date:request.date,keyword:request.keyword,area:request.area,source:request.source,count,mode});
  localStorage.setItem(SCAN_HISTORY_KEY,JSON.stringify(rows.slice(0,30)));
}
function dedupeScheduleItems(items){
  const map=new Map();
  items.forEach(item=>{
    const row=normalizeScheduleItem(item,item.id);
    const key=[row.date,row.storeName,row.productName,row.time,row.link].map(x=>String(x).trim().toLowerCase()).join('|');
    const old=map.get(key);
    if(!old||trustInfo(row).score>trustInfo(old).score) map.set(key,row);
  });
  return [...map.values()];
}
async function cleanupOldSchedule(){
  const cutoff=addDaysKey(-SCHEDULE_RETENTION_DAYS);
  if(automaticSchedule.length){
    automaticSchedule=automaticSchedule.filter(x=>!x.date||x.date>=cutoff);
    localStorage.setItem(AUTO_SCHEDULE_KEY,JSON.stringify(automaticSchedule));
  }
  const db=window.chusenDb;
  if(!db) return;
  try{
    const snap=await db.collection('chusenSchedule').where('date','<',cutoff).get();
    if(snap.empty) return;
    const batch=db.batch();
    snap.docs.forEach(doc=>batch.delete(doc.ref));
    await batch.commit();
  }catch{}
}
function scheduleSource(){ return automaticSchedule.length?automaticSchedule:demoAutomaticSchedule(); }
function safeLink(value){
  try{ const url=new URL(value); return ['http:','https:'].includes(url.protocol)?url.href:'#'; }
  catch{return '#';}
}
function trustInfo(item){
  const score=Math.max(0,Math.min(100,Number(item.confidence)||0));
  if(item.verified||item.sourceType==='official-web') return {label:'Chính thức',cls:'verified',score:Math.max(score,95)};
  if(item.sourceType==='official-x') return {label:'X chính thức',cls:'high',score:Math.max(score,85)};
  if(item.sourceType==='community') return {label:'Tham khảo',cls:'medium',score:score||65};
  return {label:'Chưa xác minh',cls:'low',score:score||40};
}
function timeText(item){
  if(item.time) return item.time;
  if(item.resultAt) return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'}).format(new Date(item.resultAt));
  if(item.applyStart||item.applyEnd){
    const start=item.applyStart?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'}).format(new Date(item.applyStart)):'';
    const end=item.applyEnd?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'}).format(new Date(item.applyEnd)):'';
    return [start,end].filter(Boolean).join(' → ');
  }
  return 'Chưa xác định';
}
function scheduleDayLabel(key){
  const date=dateFromKey(key);
  return {
    short:new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Tokyo',day:'numeric',month:'numeric'}).format(date),
    weekday:new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Tokyo',weekday:'short'}).format(date).replace('.',''),
    weekend:[0,6].includes(date.getUTCDay())
  };
}
function renderAutomaticSchedule(){
  const today=localDateKey();
  const end=addDaysKey(6);
  const items=scheduleSource().filter(x=>x.active&&x.date>=today&&x.date<=end).sort((a,b)=>`${a.date} ${timeText(a)}`.localeCompare(`${b.date} ${timeText(b)}`));
  const grouped=new Map();
  for(let i=0;i<7;i++) grouped.set(addDaysKey(i),[]);
  items.forEach(item=>{ if(grouped.has(item.date)) grouped.get(item.date).push(item); });
  return `<div class="schedule-board">${[...grouped].map(([key,dayItems])=>{
    const label=scheduleDayLabel(key);
    const tone=key===today?'today':label.weekend?'weekend':'';
    return `<section class="schedule-day ${tone}">
      <button class="schedule-date" onclick="openScheduleDay('${key}')" aria-label="Xem và sửa lịch ngày ${label.short}"><strong>${label.short}</strong><span>${label.weekday}</span>${dayItems.length?`<small>${dayItems.length} cửa hàng</small>`:'<small>Chạm để quét</small>'}</button>
      <div class="schedule-day-content">${dayItems.length?dayItems.map(scheduleStoreRow).join(''):'<div class="schedule-empty">Không có lịch Chusen</div>'}</div>
    </section>`;
  }).join('')}</div>`;
}
function scheduleStoreRow(item){
  const link=safeLink(item.link);
  const initial=esc(item.storeName.slice(0,1).toUpperCase());
  const trust=trustInfo(item);
  return `<article class="schedule-store">
    <div class="store-mark">${initial}</div>
    <div class="schedule-store-main"><strong>${esc(item.storeName)}</strong><b>${esc(item.productName)}</b><span>◷ ${esc(timeText(item))}</span>${item.demo?'<em>Dữ liệu mẫu để kiểm tra giao diện</em>':item.verified?'':'<em>Chưa xác minh nguồn</em>'}</div>
    <div class="schedule-method"><span>${esc(item.method||'Mở trang cửa hàng để kiểm tra')}</span><span class="trust-badge ${trust.cls}">${trust.label} · ${trust.score}%</span>${link!=='#'?`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Mở link Chusen ↗</a>`:'<span class="no-link">Chưa có link</span>'}</div>
  </article>`;
}
function renderScanPanel(){
  return `<form class="scan-panel card" onsubmit="scanSchedule(event)">
    <div class="scan-panel-head"><div><strong>🔎 Quét lịch theo yêu cầu</strong><span>Chọn ngày, từ khóa và khu vực muốn kiểm tra</span></div></div>
    <div class="scan-grid">
      <label><span>Ngày cần quét</span><input type="date" name="date" value="${addDaysKey(1)}" required></label>
      <label><span>Từ khóa</span><input name="keyword" placeholder="OP-18, Pokémon, デッキ100…"></label>
      <label><span>Khu vực</span><input name="area" placeholder="Atsugi, Kanagawa, Hamamatsu…"></label>
      <label><span>Nguồn ưu tiên</span><select name="source"><option value="all">Website chính thức + X</option><option value="official">Chỉ nguồn chính thức</option><option value="x">Ưu tiên X</option></select></label>
    </div>
    <button class="scan-now-btn" type="submit">🔍 Quét ngay</button>
  </form>`;
}
function renderHistoryButton(){
  const count=scheduleHistoryItems().length;
  return `<button class="history-entry" onclick="openScheduleHistory()"><span class="history-icon">↶</span><span><b>Lịch sử 30 ngày</b><small>${count?`${count} lịch đã qua`:'Xem các lịch Chusen đã qua'}</small></span><strong>›</strong></button>`;
}
function openScheduleHistory(){
  const items=scheduleHistoryItems();
  const scans=loadScanHistory();
  openModal(`<div class="modal-inner history-modal"><div class="modal-head"><div><h3>Lịch sử 30 ngày</h3><div class="row-sub">Lịch cũ hơn 30 ngày được tự động xóa</div></div><button type="button" class="icon-btn" onclick="modal.close()">×</button></div>
    <div class="history-list">${items.length?items.map(item=>{const trust=trustInfo(item);return `<button class="history-row" onclick="openScheduleItemForm('${esc(item.date)}','${esc(item.id)}')"><span class="history-date">${esc(scheduleDayLabel(item.date).short)}</span><span><b>${esc(item.storeName)}</b><small>${esc(item.productName)} · ${esc(timeText(item))}</small></span><span class="trust-badge ${trust.cls}">${trust.score}%</span></button>`;}).join(''):'<div class="empty">Chưa có lịch nào trong 30 ngày qua</div>'}</div>
    <div class="history-scan-head"><b>Các lần quét gần đây</b><span>${scans.length}/30</span></div>
    <div class="scan-log">${scans.length?scans.slice(0,8).map(row=>`<div><span>${esc(new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Tokyo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(row.at)))}</span><b>${esc(row.keyword||'Tất cả')} · ${esc(row.date)}</b><small>${row.count} kết quả · ${row.mode==='live'?'Internet':'Dữ liệu đã lưu'}</small></div>`).join(''):'<div class="empty">Chưa có lần quét nào</div>'}</div>
  </div>`);
}
function openScheduleDay(dateKey){
  const label=scheduleDayLabel(dateKey);
  const items=scheduleSource().filter(x=>x.active&&x.date===dateKey);
  openModal(`<div class="modal-inner day-editor"><div class="modal-head"><div><h3>Lịch ngày ${label.short}</h3><div class="row-sub">Chạm vào lịch để sửa hoặc quét lại ngày này</div></div><button type="button" class="icon-btn" onclick="modal.close()">×</button></div>
    <div class="day-editor-actions"><button class="primary-btn" onclick="openScheduleItemForm('${dateKey}')">+ Thêm lịch</button><button class="secondary-btn" onclick="openDayScanner('${dateKey}')">🔍 Quét ngày này</button></div>
    <div class="day-editor-list">${items.length?items.map(item=>{const trust=trustInfo(item);return `<button class="day-edit-row" onclick="openScheduleItemForm('${dateKey}','${esc(item.id)}')"><span><b>${esc(item.storeName)}</b><small>${esc(item.productName)} · ${esc(timeText(item))}</small></span><span class="trust-badge ${trust.cls}">${trust.score}%</span></button>`;}).join(''):'<div class="empty">Ngày này chưa có lịch Chusen</div>'}</div>
  </div>`);
}
function openDayScanner(dateKey){
  openModal(`<form class="modal-inner form-grid" onsubmit="scanSchedule(event)"><div class="modal-head"><h3>Quét ngày ${esc(scheduleDayLabel(dateKey).short)}</h3><button type="button" class="icon-btn" onclick="modal.close()">×</button></div><input type="hidden" name="date" value="${esc(dateKey)}"><div class="field"><label>Từ khóa</label><input name="keyword" placeholder="Tên sản phẩm hoặc cửa hàng"></div><div class="field"><label>Khu vực</label><input name="area" placeholder="Atsugi, Kanagawa, Hamamatsu…"></div><div class="field"><label>Nguồn ưu tiên</label><select name="source"><option value="all">Website chính thức + X</option><option value="official">Chỉ nguồn chính thức</option><option value="x">Ưu tiên X</option></select></div><button class="primary-btn">🔍 Quét ngay</button></form>`);
}
async function scanSchedule(event){
  event.preventDefault();
  const form=event.target;
  const data=new FormData(form);
  const request={date:String(data.get('date')||localDateKey()),keyword:String(data.get('keyword')||'').trim(),area:String(data.get('area')||'').trim(),source:String(data.get('source')||'all')};
  const button=form.querySelector('[type=submit]');
  if(button){button.disabled=true;button.textContent='Đang quét…';}
  let results=[];
  let live=false;
  const endpoint=scanEndpoint();
  try{
    if(endpoint){
      const response=await fetch(`${endpoint}/scan`,{method:'POST',headers:scanHeaders(),body:JSON.stringify(request)});
      if(!response.ok) throw new Error('scan-failed');
      const payload=await response.json();
      results=(Array.isArray(payload)?payload:(payload.results||[])).map(x=>normalizeScheduleItem({...x,date:x.date||request.date},x.id));
      live=true;
    }else{
      const keyword=request.keyword.toLowerCase();
      const area=request.area.toLowerCase();
      results=scheduleSource().filter(item=>item.date===request.date)
        .filter(item=>!keyword||`${item.storeName} ${item.productName} ${item.method}`.toLowerCase().includes(keyword))
        .filter(item=>!area||!item.area||item.area.toLowerCase().includes(area))
        .filter(item=>request.source==='all'||(request.source==='official'&&(item.verified||item.sourceType.startsWith('official')))||(request.source==='x'&&['official-x','community'].includes(item.sourceType)));
    }
    results=dedupeScheduleItems(results);
    lastScanResults=results;
    saveScanLog(request,results.length,live?'live':'local');
    showScanResults(request,results,live);
  }catch{
    saveScanLog(request,0,'error');
    showScanResults(request,[] ,false,true);
  }
}
function showScanResults(request,results,live,error=false){
  openModal(`<div class="modal-inner scan-results"><div class="modal-head"><div><h3>Kết quả quét ${esc(scheduleDayLabel(request.date).short)}</h3><div class="row-sub">${esc(request.keyword||'Tất cả sản phẩm')} · ${esc(request.area||'Mọi khu vực')}</div></div><button type="button" class="icon-btn" onclick="modal.close()">×</button></div>
    <div class="scan-mode ${live?'live':'test'}">${error?'Không kết nối được bộ quét.':live?'Đã quét nguồn trực tuyến.':'Chế độ test: đang tìm trong dữ liệu lịch đã đồng bộ. Bộ quét Internet sẽ hoạt động khi cấu hình địa chỉ máy chủ quét.'}</div>
    <div class="scan-result-list">${results.length?results.map((item,index)=>{const trust=trustInfo(item);return `<article class="scan-result"><div><b>${esc(item.storeName)}</b><strong>${esc(item.productName)}</strong><span>${esc(timeText(item))}${item.area?` · ${esc(item.area)}`:''}</span></div><span class="trust-badge ${trust.cls}">${trust.label} · ${trust.score}%</span><div class="scan-result-actions"><button class="secondary-btn" onclick="editScanResult(${index})">Xem / sửa</button>${safeLink(item.sourceUrl)!=='#'?`<a href="${esc(safeLink(item.sourceUrl))}" target="_blank" rel="noopener noreferrer">Nguồn ↗</a>`:''}</div></article>`;}).join(''):'<div class="empty">Chưa tìm thấy lịch phù hợp</div>'}</div>
    ${results.length?'<button class="primary-btn" style="width:100%;margin-bottom:8px" onclick="saveAllScanResults()">Lưu tất cả kết quả</button>':''}
    <button class="secondary-btn" style="width:100%" onclick="openDayScanner('${esc(request.date)}')">Quét lại</button>
  </div>`);
}
function editScanResult(index){ const item=lastScanResults[index]; if(item) openScheduleItemForm(item.date,item.id,item); }
async function saveAllScanResults(){
  if(!lastScanResults.length) return;
  const base=automaticSchedule.length?automaticSchedule:demoAutomaticSchedule();
  automaticSchedule=dedupeScheduleItems([...base,...lastScanResults]);
  localStorage.setItem(AUTO_SCHEDULE_KEY,JSON.stringify(automaticSchedule));
  let shared=true;
  try{
    const db=window.chusenDb;
    if(db){
      const batch=db.batch();
      lastScanResults.forEach(item=>batch.set(db.collection('chusenSchedule').doc(item.id),{...item,demo:false},{merge:true}));
      await batch.commit();
    }else shared=false;
  }catch{shared=false;}
  modal.close(); renderDashboard(); toast(shared?'Đã lưu tất cả kết quả':'Đã lưu trên thiết bị');
}
function openScheduleItemForm(dateKey,id='',sourceItem=null){
  const item=sourceItem||scheduleSource().find(x=>x.id===id)||null;
  const trust=trustInfo(item||{});
  openModal(`<form class="modal-inner form-grid" onsubmit="saveScheduleItem(event)"><div class="modal-head"><h3>${item?'Sửa':'Thêm'} lịch Chusen</h3><button type="button" class="icon-btn" onclick="modal.close()">×</button></div><input type="hidden" name="id" value="${esc(item?.id||'')}"><div class="field"><label>Ngày</label><input type="date" name="date" required value="${esc(item?.date||dateKey)}"></div><div class="field"><label>Tên cửa hàng</label><input name="storeName" required value="${esc(item?.storeName||'')}"></div><div class="field"><label>Tên sản phẩm</label><input name="productName" required value="${esc(item?.productName||'')}"></div><div class="field"><label>Ngày giờ / khoảng thời gian</label><input name="time" value="${esc(item?.time||'')}"></div><div class="field"><label>Khu vực</label><input name="area" value="${esc(item?.area||'')}"></div><div class="field"><label>Link Chusen</label><input type="url" name="link" placeholder="https://…" value="${esc(item?.link||'')}"></div><div class="field"><label>Link nguồn</label><input type="url" name="sourceUrl" placeholder="https://…" value="${esc(item?.sourceUrl||item?.link||'')}"></div><div class="field"><label>Loại nguồn</label><select name="sourceType"><option value="official-web">Website chính thức</option><option value="official-x">X chính thức</option><option value="community">Trang tổng hợp</option><option value="unknown">Chưa xác minh</option></select></div><div class="field"><label>Độ tin cậy: <b id="confidenceValue">${trust.score}%</b></label><input type="range" name="confidence" min="0" max="100" value="${trust.score}" oninput="document.getElementById('confidenceValue').textContent=this.value+'%'"></div><div class="field"><label>Cách kiểm tra / ghi chú</label><textarea name="method">${esc(item?.method||'')}</textarea></div><button class="primary-btn">Lưu lịch</button>${item?`<button type="button" class="danger-btn" onclick="deleteScheduleItem('${esc(item.id)}','${esc(item.date)}')">Xóa lịch</button>`:''}</form>`);
  modal.querySelector('[name=sourceType]').value=item?.sourceType||'unknown';
}
async function saveScheduleItem(event){
  event.preventDefault();
  const data=new FormData(event.target);
  const id=String(data.get('id')||`schedule-${Date.now()}`);
  const sourceType=String(data.get('sourceType'));
  const item=normalizeScheduleItem({id,date:data.get('date'),storeName:data.get('storeName'),productName:data.get('productName'),time:data.get('time'),area:data.get('area'),link:data.get('link'),sourceUrl:data.get('sourceUrl'),sourceType,confidence:Number(data.get('confidence')),method:data.get('method'),verified:sourceType==='official-web',active:true},id);
  if(!automaticSchedule.length) automaticSchedule=demoAutomaticSchedule();
  const index=automaticSchedule.findIndex(x=>x.id===id);
  if(index>=0) automaticSchedule[index]=item; else automaticSchedule.push(item);
  localStorage.setItem(AUTO_SCHEDULE_KEY,JSON.stringify(automaticSchedule));
  try{ if(window.chusenDb) await window.chusenDb.collection('chusenSchedule').doc(id).set({...item,demo:false},{merge:true}); toast('Đã lưu lịch dùng chung'); }
  catch{ toast('Đã lưu trên thiết bị; chưa ghi được lên dữ liệu chung'); }
  modal.close(); renderDashboard();
}
async function deleteScheduleItem(id,dateKey){
  if(!confirm('Xóa lịch Chusen này?')) return;
  if(!automaticSchedule.length) automaticSchedule=demoAutomaticSchedule();
  automaticSchedule=automaticSchedule.filter(x=>x.id!==id);
  localStorage.setItem(AUTO_SCHEDULE_KEY,JSON.stringify(automaticSchedule));
  try{ if(window.chusenDb&&!id.startsWith('demo-')) await window.chusenDb.collection('chusenSchedule').doc(id).delete(); }
  catch{}
  modal.close(); renderDashboard(); toast('Đã xóa lịch');
}
function automaticScheduleStatus(){
  if(automaticScheduleLoading) return 'Đang kiểm tra lịch mới…';
  const last=Number(localStorage.getItem(AUTO_SCHEDULE_CHECK_KEY)||0);
  if(!last) return 'Tự kiểm tra 2 lần/ngày';
  return `Cập nhật: ${new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Tokyo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(last))} · 2 lần/ngày`;
}
async function refreshAutomaticSchedule(force=false){
  const now=Date.now();
  const last=Number(localStorage.getItem(AUTO_SCHEDULE_CHECK_KEY)||0);
  if(!force&&automaticSchedule.length&&now-last<AUTO_SCHEDULE_INTERVAL) return;
  const db=window.chusenDb;
  const endpoint=scanEndpoint();
  if(!db&&!endpoint) return;
  automaticScheduleLoading=true;
  if(route==='dashboard') renderDashboard();
  try{
    const cutoff=addDaysKey(-SCHEDULE_RETENTION_DAYS);
    let fresh=[];
    let loaded=false;
    if(endpoint){
      try{
        const response=await fetch(`${endpoint}/feed`,{headers:scanHeaders()});
        if(response.ok){
          const payload=await response.json();
          fresh.push(...(payload.results||[]).map((x,index)=>normalizeScheduleItem(x,x.id||`feed-${index}`)));
          loaded=true;
        }
      }catch{}
    }
    if(db){
      try{
        const snap=await db.collection('chusenSchedule').get();
        fresh.push(...snap.docs.map(doc=>normalizeScheduleItem(doc.data(),doc.id)));
        loaded=true;
      }catch{}
    }
    if(!loaded) throw new Error('no-source');
    fresh=dedupeScheduleItems(fresh).filter(x=>x.active&&(!x.date||x.date>=cutoff));
    automaticSchedule=fresh;
    localStorage.setItem(AUTO_SCHEDULE_KEY,JSON.stringify(fresh));
    localStorage.setItem(AUTO_SCHEDULE_CHECK_KEY,String(now));
    if(force) toast(`Đã kiểm tra ${fresh.length} lịch Chusen`);
  }catch(err){
    if(force) toast('Chưa tải được lịch mới, đang dùng bản đã lưu');
  }finally{
    automaticScheduleLoading=false;
    if(route==='dashboard') renderDashboard();
  }
}

function render(){
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.route===route));
  const map={ dashboard:renderDashboard, chusen:renderChusen, accounts:renderAccounts, transactions:renderTransactions, settings:renderSettings, detail:renderDetail, productForm:renderProductForm };
  (map[route]||renderDashboard)();
}

function renderDashboard(){
  setSubtitle('Tổng quan hôm nay');
  const totalHold=state.transactions.filter(t=>t.status==='hold').reduce((s,t)=>s+t.amount,0);
  const applied=state.products.reduce((s,p)=>s+p.stores.reduce((x,st)=>x+st.accountIds.length,0),0);
  app.innerHTML=`<section class="page">
    <div class="card date-strip"><strong>📅 Tổng quan hôm nay</strong><span>${new Date().toLocaleDateString('vi-VN')}</span></div>
    <div class="stats-grid">
      <div class="card stat"><div class="value">${state.accounts.length}</div><div class="label">Tài khoản</div></div>
      <div class="card stat"><div class="value">${state.products.length}</div><div class="label">Sản phẩm</div></div>
      <div class="card stat"><div class="value">${applied}</div><div class="label">Lượt đăng ký</div></div>
      <div class="card stat"><div class="value" style="font-size:18px">${money(totalHold)}</div><div class="label">Đang bị giữ</div></div>
      <div class="card stat"><div class="value">${state.products.filter(p=>new Date(p.resultAt)>new Date()).length}</div><div class="label">Sắp công bố</div></div>
      <div class="card stat"><div class="value">${state.transactions.filter(t=>t.status==='verify').length}</div><div class="label">Cần xác minh</div></div>
    </div>
    <div class="section-head schedule-heading"><div><h2>Lịch Chusen tự động</h2><span>${automaticScheduleStatus()}</span></div><button class="schedule-refresh" onclick="refreshAutomaticSchedule(true)" ${automaticScheduleLoading?'disabled':''}>↻ Làm mới</button></div>
    ${renderScanPanel()}
    ${renderHistoryButton()}
    ${renderAutomaticSchedule()}
    <div class="section-head"><h2>Giao dịch gần đây</h2><button class="link-btn" onclick="go('transactions')">Xem tất cả</button></div>
    <div class="card list">${state.transactions.slice(0,4).map(transactionRow).join('') || '<div class="empty">Chưa có giao dịch</div>'}</div>
  </section><button class="fab" onclick="go('productForm')">+</button>`;
}

function productRow(p){
  const count=p.stores.reduce((s,st)=>s+st.accountIds.length,0);
  const max=Math.max(1,state.accounts.length*p.stores.length);
  return `<div class="list-row clickable" onclick="openProduct('${p.id}')">
    <img class="product-thumb" src="${p.image}" alt="" />
    <div><div class="row-title">${esc(p.name)}</div><div class="row-sub">Công bố: ${dt(p.resultAt)}<br>${p.stores.map(s=>esc(s.name)).join(' · ')}</div></div>
    <div class="row-right"><span class="status red">${new Date(p.resultAt)>new Date()?'Sắp tới':'Đã công bố'}</span><div class="row-sub"><b>${count} / ${max}</b><br>lượt đăng ký</div></div>
  </div>`;
}
function transactionRow(t){
  return `<div class="list-row clickable transaction-row" onclick="openTransactionForm('${t.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openTransactionForm('${t.id}')}">
    <div class="row-sub">${d(t.date)}</div>
    <div><div class="row-title">${accountName(t.accountId)}</div><div class="row-sub">${esc(product(t.productId)?.name||'Sản phẩm')} · ${esc(t.store)}<br><span class="edit-hint">Chạm để sửa</span></div></div>
    <div class="row-right"><b>${money(t.amount)}</b><br><span class="status ${statusClass(t.status)}">${statusText(t.status)}</span></div>
  </div>`;
}

function renderChusen(){
  setSubtitle('Sản phẩm và cửa hàng chūsen');
  app.innerHTML=`<section class="page">
    <div class="search-box"><input id="productSearch" placeholder="Tìm sản phẩm, cửa hàng..." oninput="filterProducts(this.value)"><button class="primary-btn" onclick="go('productForm')">+ Tạo</button></div>
    <div id="productList" class="card list">${state.products.map(productRow).join('') || '<div class="empty">Chưa có sản phẩm</div>'}</div>
  </section><button class="fab" onclick="go('productForm')">+</button>`;
}
function filterProducts(q){
  const s=q.trim().toLowerCase();
  const items=state.products.filter(p=>p.name.toLowerCase().includes(s)||p.stores.some(st=>st.name.toLowerCase().includes(s)));
  document.getElementById('productList').innerHTML=items.map(productRow).join('')||'<div class="empty">Không tìm thấy sản phẩm</div>';
}

function renderDetail(){
  const p=product(selectedProductId); if(!p){ route='chusen'; return render(); }
  setSubtitle('Chi tiết sản phẩm');
  const allApplied=[...new Set(p.stores.flatMap(s=>s.accountIds))];
  app.innerHTML=`<section class="page">
    <button class="link-btn" style="justify-self:start" onclick="go('chusen')">← Quay lại</button>
    <div class="card card-pad detail-hero"><img src="${p.image}" alt=""><div><h2 style="margin:0 0 7px">${esc(p.name)}</h2><span class="status red">${new Date(p.resultAt)>new Date()?'Chưa kết thúc':'Đã kết thúc'}</span><div class="row-sub">${esc(p.category)}</div></div></div>
    <div class="card card-pad"><div class="info-grid"><div class="label">Công bố kết quả</div><b>${dt(p.resultAt)}</b><div class="label">Ngày phát hành</div><b>${dt(p.releaseAt)}</b><div class="label">Ghi chú</div><span>${esc(p.note)}</span></div></div>
    <div class="card card-pad"><div class="section-head"><h2>Tiến độ tổng</h2><b>${allApplied.length}/${state.accounts.length}</b></div><div class="progress" style="margin-top:12px"><span style="width:${Math.round(allApplied.length/state.accounts.length*100)}%"></span></div></div>
    <div class="section-head"><h2>Cửa hàng đã lưu</h2><button class="link-btn" onclick="openStoreForm('${p.id}')">+ Thêm cửa hàng</button></div>
    <div class="card card-pad">${p.stores.map(st=>storeRow(p,st)).join('')||'<div class="empty">Chưa có cửa hàng</div>'}</div>
    <div class="card card-pad"><div class="section-head"><h2>Tài khoản</h2><span class="row-sub">Nhấn để đổi trạng thái</span></div>${state.accounts.map(a=>{
      const stores=p.stores.filter(s=>s.accountIds.includes(a.id));
      return `<div class="store-row"><div><b>${a.id}</b><div class="row-sub">${stores.length?stores.map(s=>s.name).join(', '):'Chưa đăng ký cửa hàng nào'}</div></div><span class="status ${stores.length?'green':'red'}">${stores.length?'Đã đăng ký':'Chưa đăng ký'}</span></div>`;
    }).join('')}</div>
    <div class="form-actions"><button class="secondary-btn" onclick="editProduct('${p.id}')">Sửa sản phẩm</button><button class="danger-btn" onclick="deleteProduct('${p.id}')">Xóa sản phẩm</button></div>
  </section>`;
}
function storeRow(p,st){
  return `<div class="store-row"><div><b>${esc(st.name)}</b><div class="row-sub">Đăng ký: ${dt(st.applyStart)} → ${dt(st.applyEnd)}<br>Kết quả: ${dt(st.resultAt)} · Phát hành: ${dt(st.releaseAt)}<br>${st.accountIds.length}/${state.accounts.length} tài khoản · <a href="${esc(st.link)}" target="_blank" rel="noopener">Mở link</a></div><div class="progress" style="margin-top:9px"><span style="width:${Math.round(st.accountIds.length/state.accounts.length*100)}%"></span></div></div><div class="store-actions"><button class="mini-btn" onclick="openAccountPicker('${p.id}','${st.id}')">Tài khoản</button><button class="mini-btn" onclick="openStoreForm('${p.id}','${st.id}')">Sửa</button></div></div>`;
}

function renderAccounts(){
  setSubtitle('Quản lý 5–10 tài khoản');
  app.innerHTML=`<section class="page"><div class="search-box"><input placeholder="Tìm kiếm tài khoản..." oninput="filterAccounts(this.value)"><button class="primary-btn" onclick="openAccountForm()">+ Thêm</button></div><div id="accountList" class="card list">${state.accounts.map(accountRow).join('')}</div><div class="small-note">Dữ liệu được lưu trực tiếp trên trình duyệt bằng LocalStorage. Không đưa mật khẩu vào ứng dụng.</div></section><button class="fab" onclick="openAccountForm()">+</button>`;
}
function accountRow(a){ return `<div class="list-row"><div class="avatar">♙</div><div><div class="row-title">${a.id}</div><div class="row-sub">${esc(a.email)}<br>${esc(a.phone)}</div></div><div class="row-right"><span class="status ${a.active?'green':'red'}">${a.active?'Đang hoạt động':'Tạm khóa'}</span><br><button class="link-btn" onclick="openAccountForm('${a.id}')">Sửa</button></div></div>`; }
function filterAccounts(q){ const s=q.toLowerCase(); const a=state.accounts.filter(x=>`${x.id} ${x.email} ${x.phone}`.toLowerCase().includes(s)); document.getElementById('accountList').innerHTML=a.map(accountRow).join('')||'<div class="empty">Không tìm thấy tài khoản</div>'; }

function renderTransactions(){
  setSubtitle('Theo dõi tiền tạm giữ và hoàn');
  const hold=state.transactions.filter(t=>t.status==='hold').reduce((s,t)=>s+t.amount,0);
  const refund=state.transactions.filter(t=>t.status==='refund').reduce((s,t)=>s+t.amount,0);
  app.innerHTML=`<section class="page"><div class="card amount-card"><small>Tổng tiền đang bị giữ</small><strong>${money(hold)}</strong></div><div class="stats-grid"><div class="card stat"><div class="value" style="font-size:18px">${money(hold)}</div><div class="label">Tạm giữ</div></div><div class="card stat"><div class="value" style="font-size:18px;color:var(--green)">${money(refund)}</div><div class="label">Đã hoàn</div></div><div class="card stat"><div class="value">${state.transactions.length}</div><div class="label">Giao dịch</div></div></div><div class="card list">${state.transactions.map(transactionRow).join('')||'<div class="empty">Chưa có giao dịch</div>'}</div></section><button class="fab" onclick="openTransactionForm()">+</button>`;
}

function renderSettings(){
  setSubtitle('Thông báo và sao lưu');
  const s=state.settings;
  app.innerHTML=`<section class="page">
    <div class="card card-pad"><div class="toggle-row"><div><b>Bật thông báo</b><div class="row-sub">Nhắc hạn chūsen, kết quả và ngày phát hành</div></div>${toggle('notifications',s.notifications)}</div></div>
    <div class="card form-card"><div class="field"><label>Nhắc trước thời gian chūsen</label><select onchange="updateSetting('before',this.value)"><option value="15" ${s.before==='15'?'selected':''}>15 phút trước</option><option value="30" ${s.before==='30'?'selected':''}>30 phút trước</option><option value="60" ${s.before==='60'?'selected':''}>1 giờ trước</option><option value="1440" ${s.before==='1440'?'selected':''}>1 ngày trước</option></select></div><div class="field" style="margin-top:14px"><label>Tóm tắt lịch mỗi ngày</label><input type="time" value="${s.dailySummary}" onchange="updateSetting('dailySummary',this.value)"></div></div>
    <div class="card card-pad">${settingToggle('deadlineNotice','Khi gần đến hạn đăng ký',s.deadlineNotice)}${settingToggle('resultNotice','Khi công bố kết quả',s.resultNotice)}${settingToggle('releaseNotice','Khi đến ngày phát hành',s.releaseNotice)}</div>
    <div class="card form-card form-grid"><div><h2 style="margin:0">Máy chủ quét Internet/X</h2><div class="row-sub">Dán địa chỉ Worker sau khi triển khai. Khóa OpenAI chỉ lưu trong Worker, không nhập vào đây.</div></div><div class="field"><label>Địa chỉ máy chủ quét</label><input type="url" id="scanEndpointSetting" placeholder="https://chusen-scanner...workers.dev" value="${esc(s.scanEndpoint||'')}"></div><div class="field"><label>Mã bảo vệ máy chủ</label><input type="password" id="scanTokenSetting" placeholder="Mã SCAN_TOKEN" value="${esc(s.scanToken||'')}"></div><div class="form-actions"><button class="primary-btn" onclick="saveScannerSettings()">Lưu kết nối</button><button class="secondary-btn" onclick="testScannerConnection()">Kiểm tra</button></div><div id="scannerConnectionStatus" class="small-note">${scanEndpoint()?'Đã nhập địa chỉ máy chủ.':'Chưa kết nối máy chủ quét.'}</div></div>
    <div class="card card-pad"><h2 style="margin-top:0">Dữ liệu</h2><div class="form-actions"><button class="secondary-btn" onclick="exportData()">Xuất JSON</button><button class="secondary-btn" onclick="document.getElementById('importFile').click()">Nhập JSON</button></div><input id="importFile" type="file" accept="application/json" hidden onchange="importData(this.files[0])"><button class="danger-btn" style="width:100%;margin-top:10px" onclick="resetData()">Khôi phục dữ liệu mẫu</button></div>
    <div class="small-note">Trình duyệt web không thể gửi thông báo khi đã đóng hoàn toàn nếu chưa có máy chủ push. Bản này vẫn lưu lịch và hiển thị việc sắp tới khi mở app.</div>
  </section>`;
}
function toggle(key,val){ return `<label class="switch"><input type="checkbox" ${val?'checked':''} onchange="updateSetting('${key}',this.checked)"><span class="slider"></span></label>`; }
function settingToggle(key,label,val){ return `<div class="toggle-row"><span>${label}</span>${toggle(key,val)}</div>`; }
function updateSetting(k,v){ state.settings[k]=v; saveData(); toast('Đã lưu cài đặt'); }
function saveScannerSettings(){
  state.settings.scanEndpoint=document.getElementById('scanEndpointSetting')?.value.trim()||'';
  state.settings.scanToken=document.getElementById('scanTokenSetting')?.value.trim()||'';
  saveData(); toast('Đã lưu kết nối máy chủ quét'); renderSettings();
}
async function testScannerConnection(){
  saveScannerSettings();
  const status=document.getElementById('scannerConnectionStatus');
  const endpoint=scanEndpoint();
  if(!endpoint){ if(status) status.textContent='Hãy nhập địa chỉ máy chủ quét.'; return; }
  if(status) status.textContent='Đang kiểm tra kết nối…';
  try{
    const response=await fetch(`${endpoint}/health`,{headers:scanHeaders()});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'connection-failed');
    if(status) status.textContent=data.openaiConfigured?'✅ Máy chủ sẵn sàng quét Internet/X.':'⚠️ Worker hoạt động nhưng chưa có OPENAI_API_KEY.';
  }catch{ if(status) status.textContent='❌ Không kết nối được. Kiểm tra URL, SCAN_TOKEN và CORS.'; }
}

function renderProductForm(){
  setSubtitle('Tạo chūsen mới');
  const p=selectedProductId?product(selectedProductId):null;
  app.innerHTML=`<section class="page"><button class="link-btn" style="justify-self:start" onclick="go('${p?'detail':'chusen'}')">← Quay lại</button><form class="card form-card form-grid" onsubmit="saveProductForm(event)">
    <input type="hidden" name="id" value="${p?.id||''}">
    <div class="field"><label>Tên sản phẩm</label><input name="name" required value="${esc(p?.name||'')}" placeholder="Ví dụ: ONE PIECE OP-17"></div>
    <div class="field"><label>Nhóm sản phẩm</label><select name="category"><option>One Piece</option><option>Pokémon</option><option>Beyblade</option><option>Yu-Gi-Oh!</option><option>Khác</option></select></div>
    <div class="field"><label>Ngày giờ công bố kết quả chính</label><input type="datetime-local" name="resultAt" value="${toInput(p?.resultAt)}" required></div>
    <div class="field"><label>Ngày giờ phát hành</label><input type="datetime-local" name="releaseAt" value="${toInput(p?.releaseAt)}" required></div>
    <div class="field"><label>Ghi chú</label><textarea name="note" placeholder="Giới hạn mua, lưu ý thanh toán...">${esc(p?.note||'')}</textarea></div>
    <button class="primary-btn" type="submit">${p?'Lưu thay đổi':'Tạo sản phẩm'}</button>
  </form></section>`;
  if(p) app.querySelector('[name=category]').value=p.category;
}
function toInput(v){ return v?new Date(v).toISOString().slice(0,16):''; }
function saveProductForm(e){
  e.preventDefault(); const f=new FormData(e.target); const id=f.get('id')||`P${Date.now()}`;
  const old=product(id); const item={ id, name:f.get('name').trim(), category:f.get('category'), image:old?.image||'assets/default.svg', resultAt:f.get('resultAt'), releaseAt:f.get('releaseAt'), note:f.get('note').trim(), stores:old?.stores||[] };
  if(old) state.products[state.products.findIndex(x=>x.id===id)]=item; else state.products.unshift(item);
  saveData(); selectedProductId=id; route='detail'; render(); toast('Đã lưu sản phẩm');
}

function openAccountForm(id){
  const a=state.accounts.find(x=>x.id===id);
  openModal(`<form class="modal-inner form-grid" onsubmit="saveAccount(event)"><div class="modal-head"><h3>${a?'Sửa':'Thêm'} tài khoản</h3><button type="button" class="icon-btn" onclick="modal.close()">×</button></div><input type="hidden" name="oldId" value="${a?.id||''}"><div class="field"><label>Mã tài khoản</label><input name="id" required value="${a?.id||`ACC-${String(state.accounts.length+1).padStart(3,'0')}`}"></div><div class="field"><label>Email</label><input type="email" name="email" required value="${esc(a?.email||'')}"></div><div class="field"><label>Số điện thoại</label><input name="phone" value="${esc(a?.phone||'')}"></div><div class="field"><label>Trạng thái</label><select name="active"><option value="true">Đang hoạt động</option><option value="false">Tạm khóa</option></select></div><button class="primary-btn">Lưu tài khoản</button></form>`);
  if(a) modal.querySelector('[name=active]').value=String(a.active);
}
function saveAccount(e){ e.preventDefault(); const f=new FormData(e.target); const oldId=f.get('oldId'); const a={id:f.get('id').trim(),name:f.get('id').trim(),email:f.get('email').trim(),phone:f.get('phone').trim(),active:f.get('active')==='true'}; if(oldId){ state.accounts[state.accounts.findIndex(x=>x.id===oldId)]=a; state.products.forEach(p=>p.stores.forEach(s=>s.accountIds=s.accountIds.map(x=>x===oldId?a.id:x))); } else state.accounts.push(a); saveData(); modal.close(); render(); toast('Đã lưu tài khoản'); }

function openStoreForm(pid,sid){
  const p=product(pid); const st=p.stores.find(x=>x.id===sid);
  openModal(`<form class="modal-inner form-grid" onsubmit="saveStore(event)"><div class="modal-head"><h3>${st?'Sửa':'Thêm'} cửa hàng</h3><button type="button" class="icon-btn" onclick="modal.close()">×</button></div><input type="hidden" name="pid" value="${pid}"><input type="hidden" name="sid" value="${sid||''}"><div class="field"><label>Tên cửa hàng</label><input name="name" required value="${esc(st?.name||'')}"></div><div class="field"><label>Link chūsen</label><input type="url" name="link" value="${esc(st?.link||'https://')}"></div><div class="field"><label>Bắt đầu</label><input type="datetime-local" name="applyStart" value="${toInput(st?.applyStart)}"></div><div class="field"><label>Hạn chót</label><input type="datetime-local" name="applyEnd" value="${toInput(st?.applyEnd)}"></div><div class="field"><label>Công bố kết quả</label><input type="datetime-local" name="resultAt" value="${toInput(st?.resultAt||p.resultAt)}"></div><div class="field"><label>Ngày phát hành</label><input type="datetime-local" name="releaseAt" value="${toInput(st?.releaseAt||p.releaseAt)}"></div><button class="primary-btn">Lưu cửa hàng</button></form>`);
}
function saveStore(e){ e.preventDefault(); const f=new FormData(e.target); const p=product(f.get('pid')); const sid=f.get('sid')||`S${Date.now()}`; const old=p.stores.find(x=>x.id===sid); const st={id:sid,name:f.get('name').trim(),link:f.get('link').trim(),applyStart:f.get('applyStart'),applyEnd:f.get('applyEnd'),resultAt:f.get('resultAt'),releaseAt:f.get('releaseAt'),fee:old?.fee||0,accountIds:old?.accountIds||[]}; if(old)p.stores[p.stores.findIndex(x=>x.id===sid)]=st; else p.stores.push(st); saveData(); modal.close(); render(); toast('Đã lưu cửa hàng'); }

function openAccountPicker(pid,sid){
  const st=product(pid).stores.find(x=>x.id===sid);
  openModal(`<form class="modal-inner" onsubmit="saveAccountPicker(event)"><div class="modal-head"><h3>${esc(st.name)} · Tài khoản</h3><button type="button" class="icon-btn" onclick="modal.close()">×</button></div><input type="hidden" name="pid" value="${pid}"><input type="hidden" name="sid" value="${sid}">${state.accounts.map(a=>`<label class="toggle-row"><span><b>${a.id}</b><div class="row-sub">${esc(a.email)}</div></span><input type="checkbox" name="accounts" value="${a.id}" ${st.accountIds.includes(a.id)?'checked':''}></label>`).join('')}<button class="primary-btn" style="width:100%;margin-top:14px">Cập nhật</button></form>`);
}
function saveAccountPicker(e){ e.preventDefault(); const f=new FormData(e.target); const st=product(f.get('pid')).stores.find(x=>x.id===f.get('sid')); st.accountIds=f.getAll('accounts'); saveData(); modal.close(); render(); toast('Đã cập nhật tiến độ'); }

function openTransactionForm(id){
  const t=state.transactions.find(x=>x.id===id);
  openModal(`<form class="modal-inner form-grid" onsubmit="saveTransaction(event)">
    <div class="modal-head"><h3>${t?'Sửa':'Thêm'} giao dịch</h3><button type="button" class="icon-btn" onclick="modal.close()">×</button></div>
    <input type="hidden" name="id" value="${t?.id||''}">
    <div class="field"><label>Ngày giao dịch</label><input type="date" name="date" required value="${t?.date||new Date().toISOString().slice(0,10)}"></div>
    <div class="field"><label>Tài khoản</label><select name="accountId">${state.accounts.map(a=>`<option value="${a.id}">${a.id}</option>`).join('')}</select></div>
    <div class="field"><label>Sản phẩm</label><select name="productId">${state.products.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Cửa hàng</label><input name="store" required value="${esc(t?.store||'')}"></div>
    <div class="field"><label>Số tiền</label><input type="number" name="amount" min="0" step="1" required value="${t?.amount??''}"></div>
    <div class="field"><label>Trạng thái</label><select name="status"><option value="hold">Tạm giữ</option><option value="verify">Xác minh</option><option value="refund">Đã hoàn</option></select></div>
    <button class="primary-btn">Lưu giao dịch</button>
    ${t?`<button class="danger-btn" type="button" onclick="deleteTransaction('${t.id}')">Xóa giao dịch</button>`:''}
  </form>`);
  if(t){
    modal.querySelector('[name=accountId]').value=t.accountId;
    modal.querySelector('[name=productId]').value=t.productId;
    modal.querySelector('[name=status]').value=t.status;
  }
}
function saveTransaction(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const id=f.get('id');
  const item={
    id:id||`T${Date.now()}`,
    date:f.get('date'),
    accountId:f.get('accountId'),
    productId:f.get('productId'),
    store:f.get('store').trim(),
    amount:Number(f.get('amount')),
    status:f.get('status')
  };
  if(id){
    const index=state.transactions.findIndex(x=>x.id===id);
    if(index!==-1) state.transactions[index]=item;
  } else {
    state.transactions.unshift(item);
  }
  saveData(); modal.close(); render(); toast(id?'Đã cập nhật giao dịch':'Đã thêm giao dịch');
}
function deleteTransaction(id){
  if(!confirm('Xóa giao dịch này?')) return;
  state.transactions=state.transactions.filter(t=>t.id!==id);
  saveData(); modal.close(); render(); toast('Đã xóa giao dịch');
}

function openModal(html){ document.getElementById('modalContent').innerHTML=html; modal.showModal(); }
function go(r){ route=r; if(r!=='detail'&&r!=='productForm') selectedProductId=null; render(); window.scrollTo({top:0,behavior:'smooth'}); }
function openProduct(id){ selectedProductId=id; route='detail'; render(); }
function editProduct(id){ selectedProductId=id; route='productForm'; render(); }
function deleteProduct(id){ if(!confirm('Xóa sản phẩm này?'))return; state.products=state.products.filter(p=>p.id!==id); state.transactions=state.transactions.filter(t=>t.productId!==id); saveData(); go('chusen'); }
function exportData(){ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`chusen-manager-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
function importData(file){ if(!file)return; const r=new FileReader(); r.onload=()=>{ try{ state=JSON.parse(r.result); saveData(); render(); toast('Đã nhập dữ liệu'); }catch{ alert('File JSON không hợp lệ'); } }; r.readAsText(file); }
function resetData(){ if(confirm('Khôi phục dữ liệu mẫu và xóa dữ liệu hiện tại?')){ state=structuredClone(seedData); saveData(); render(); toast('Đã khôi phục dữ liệu mẫu'); } }

document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.route)));
document.getElementById('menuBtn').addEventListener('click',()=>toast('Dùng thanh menu phía dưới để điều hướng'));
modal.addEventListener('click',e=>{ if(e.target===modal) modal.close(); });
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
function startChusenApp(){ cleanupOldSchedule(); render(); refreshAutomaticSchedule(false); }
window.startChusenApp=startChusenApp;

window.go=go; window.openProduct=openProduct; window.filterProducts=filterProducts; window.filterAccounts=filterAccounts; window.openAccountForm=openAccountForm; window.saveAccount=saveAccount; window.openStoreForm=openStoreForm; window.saveStore=saveStore; window.openAccountPicker=openAccountPicker; window.saveAccountPicker=saveAccountPicker; window.openTransactionForm=openTransactionForm; window.saveTransaction=saveTransaction; window.deleteTransaction=deleteTransaction; window.saveProductForm=saveProductForm; window.editProduct=editProduct; window.deleteProduct=deleteProduct; window.updateSetting=updateSetting; window.exportData=exportData; window.importData=importData; window.resetData=resetData;
window.refreshAutomaticSchedule=refreshAutomaticSchedule;
window.openScheduleDay=openScheduleDay; window.openDayScanner=openDayScanner; window.scanSchedule=scanSchedule; window.editScanResult=editScanResult; window.openScheduleItemForm=openScheduleItemForm; window.saveScheduleItem=saveScheduleItem; window.deleteScheduleItem=deleteScheduleItem;
window.openScheduleHistory=openScheduleHistory; window.saveAllScanResults=saveAllScanResults;
window.saveScannerSettings=saveScannerSettings; window.testScannerConnection=testScannerConnection;
