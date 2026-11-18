export const TYPES = Object.freeze({book:'書籍', film:'電影', series:'影集'});
export const STATUSES = Object.freeze({queued:'想看', active:'進行中', done:'已完成', paused:'暫停'});

const MAX_ITEMS = 5000;
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;
const own = (o,k) => Object.hasOwn(o,k);
const invalid = (label) => { throw new Error(label); };
function string(value, max, label, required = false) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) invalid(label);
  return value.trim();
}
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(label);
  return value;
}
function flag(value, label) {
  if (typeof value !== 'boolean') invalid(label);
  return value;
}
function iso(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) invalid('日期格式不正確');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) invalid('日期不正確');
  return value;
}
const normalized = (str) => str.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const titleKey = (e) => e.type + ':' + normalized(e.title);

export function validateEntry(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) invalid('紀錄格式不正確');
  if (typeof e.type !== 'string' || !own(TYPES,e.type)) invalid('找不到這種媒介');
  if (typeof e.status !== 'string' || !own(STATUSES,e.status)) invalid('找不到這個狀態');
  const id = string(e.id, 96, '紀錄 ID 不正確', true);
  if (!/^[a-z\d_-]+$/i.test(id)) invalid('紀錄 ID 不正確');
  const title = string(e.title,160,'請輸入作品名稱（最多 160 字）',true);
  const tagsIn = e.tags ?? [];
  if (!Array.isArray(tagsIn) || tagsIn.length > 12) invalid('最多可加入 12 個標籤');
  const seen = new Set();
  const tags = Array.from(tagsIn,tag=>string(tag,30,'標籤不可留空，最多 30 字',true)).filter(tag=>{
    const key = normalized(tag);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const createdAt = iso(e.createdAt);
  const updatedAt = iso(e.updatedAt);
  if (updatedAt < createdAt) invalid('修改時間不可早於建立時間');
  let pagesRead = 0, totalPages = 0, season = 0, episode = 0, seasonLengths = [];
  if (e.type === 'book') {
    totalPages = integer(e.totalPages,1,1000000,'總頁數需介於 1–1,000,000');
    pagesRead = integer(e.pagesRead ?? 0,0,totalPages,'已讀頁數不能小於 0 或超過總頁數');
  }
  if (e.type === 'series') {
    if (!Array.isArray(e.seasonLengths) || !e.seasonLengths.length || e.seasonLengths.length > 100) invalid('請輸入各季集數（最多 100 季）');
    seasonLengths = Array.from(e.seasonLengths,n=>integer(n,1,10000,'每季集數需介於 1–10,000'));
    season = integer(e.season ?? 1,1,seasonLengths.length,'季數超出設定範圍');
    episode = integer(e.episode ?? 0,season === 1 ? 0 : 1,seasonLengths[season-1],'集數超出該季的範圍');
  }
  return {id,title,type:e.type,status:e.status,creator:string(e.creator ?? '',120,'作者／製作資訊最多 120 字'),tags,notes:string(e.notes ?? '',10000,'筆記最多 10,000 字'),rating:integer(e.rating ?? 0,0,5,'評分須介於 0–5'),favorite:flag(e.favorite ?? false,'收藏狀態不正確'),archived:flag(e.archived ?? false,'封存狀態不正確'),pagesRead,totalPages,season,episode,seasonLengths,createdAt,updatedAt};
}

export function upsertEntry(entries, input) {
  const e = validateEntry(input);
  if (entries.some(item=>item.id !== e.id && titleKey(item) === titleKey(e))) invalid('同類型已有相同名稱的紀錄');
  if (entries.some(item=>item.id === e.id)) return entries.map(item=>item.id === e.id ? e : item);
  if (entries.length >= MAX_ITEMS) invalid('清單已達 5,000 筆上限');
  return [e,...entries];
}
export function progressOf(e) {
  let done, total, label;
  if (e.type === 'book') {
    done = e.pagesRead; total = e.totalPages; label = `${done} / ${total} 頁`;
  } else if (e.type === 'series') {
    done = e.seasonLengths.slice(0,e.season-1).reduce((a,b)=>a+b,0)+e.episode;
    total = e.seasonLengths.reduce((a,b)=>a+b,0);
    label = done ? `S${e.season}E${e.episode} · ${done} / ${total} 集` : `0 / ${total} 集`;
  } else {
    done = Number(e.status === 'done'); total = 1; label = done ? '已看完' : '尚未看完';
  }
  const percent = done === total ? 100 : Math.floor((done / total) * 100);
  return {done,total,percent,label};
}
const format = 'shelfmark';
function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length > MAX_ITEMS) invalid('備份紀錄格式不合或超過 5,000 筆');
  return Array.from(entries,(entry,i)=>{
    try { return validateEntry(entry); }
    catch (err) { throw new Error(`第 ${i+1} 筆：${err.message}`); }
  });
}
export function createBackup(entries) {
  return JSON.stringify({format,version:1,entries:validateEntries(entries)},null,2);
}
export function parseBackup(json) {
  if (typeof json !== 'string' || json.length > MAX_BACKUP_BYTES || new TextEncoder().encode(json).length > MAX_BACKUP_BYTES) invalid('備份檔案過大');
  let value;
  try { value = JSON.parse(json); }
  catch { invalid('無法讀取 JSON，請選擇 Shelfmark 備份檔'); }
  if (!value || value.format !== format || value.version !== 1) invalid('不支援這個備份格式或版本');
  return validateEntries(value.entries);
}
export function previewImport(entries, incoming) {
  const valid = validateEntries(incoming);
  const next = [...entries], ids = new Set(entries.map(e=>e.id)), titles = new Set(entries.map(titleKey)), duplicates = [];
  for (const e of valid) {
    const key = titleKey(e);
    if (ids.has(e.id) || titles.has(key)) { duplicates.push({title:e.title,reason:ids.has(e.id) ? 'id' : 'title'}); continue; }
    ids.add(e.id);
    titles.add(key);
    next.push(e);
    if (next.length > MAX_ITEMS) invalid('匯入後超過 5,000 筆上限');
  }
  return {entries:next,added:next.length-entries.length,skipped:duplicates.length,duplicates};
}
export function filterEntries(entries, {query='',type='',status='',tag='',favorite=false,archived=false} = {}) {
  const terms = normalized(query).split(' ').filter(Boolean);
  const tagKey = normalized(tag);
  return entries.filter(e=>{
    if (archived !== 'all' && e.archived !== archived) return false;
    if (type && type !== 'all' && e.type !== type) return false;
    if (status && status !== 'all' && e.status !== status) return false;
    if (favorite && !e.favorite) return false;
    if (tagKey && !e.tags.some(t=>normalized(t)===tagKey)) return false;
    const haystack = normalized([e.title,e.creator,...e.tags].join(' '));
    return terms.every(t=>haystack.includes(t));
  });
}
export function summaryOf(entries) {
  const counts = {total:0,book:0,film:0,series:0,queued:0,active:0,done:0,paused:0,favorites:0,archived:0};
  for (const e of entries) {
    if (e.archived) { counts.archived++; continue; }
    counts.total++; counts[e.type]++; counts[e.status]++;
    if (e.favorite) counts.favorites++;
  }
  return counts;
}
export function timelineOf(entries) {
  return [...entries].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}
const demo = [
  {id:'demo-1',title:'山的回信',type:'book',status:'active',creator:'林晚禾',tags:['散文','自然'],pagesRead:100,totalPages:300,favorite:true,notes:'示範筆記：留意不同章節描寫氣味的方式。'},
  {id:'demo-2',title:'藍色月台',type:'series',status:'active',creator:'餘光製作',tags:['城市','劇情'],season:2,episode:3,seasonLengths:[8,8],favorite:true},
  {id:'demo-3',title:'七號燈塔',type:'film',status:'done',creator:'周遙',tags:['海岸','劇情'],rating:4},
  {id:'demo-4',title:'雨天的索引',type:'book',status:'queued',creator:'黎一川',tags:['小說','城市'],totalPages:228},
  {id:'demo-5',title:'透明的晝',type:'film',status:'queued',creator:'陳徹',tags:['科幻'],favorite:false},
  {id:'demo-6',title:'走失的地圖',type:'series',status:'paused',creator:'空港影像',tags:['旅行'],season:1,episode:4,seasonLengths:[10]}
];
export function seedEntries() {
  return demo.map((e,i)=>validateEntry({...e,createdAt:'2026-10-05T09:00:00.000Z',updatedAt:`2026-10-${21-i}T12:00:00.000Z`}));
}
