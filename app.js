import {MAX_BACKUP_BYTES,TYPES,STATUSES,seedEntries,upsertEntry,progressOf,parseBackup,createBackup,previewImport,filterEntries,summaryOf,timelineOf} from './model.js';
import {cover} from './covers.js';
import {editEntry} from './editor.js';
const $=s=>document.querySelector(s), node=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n},option=(value,label)=>new Option(label,value);
let mode='demo',entries=[],tab='library',list=false,incoming=null,output='',filename='',readFailed=false,token=0;
const key=()=> 'shelfmark:v1:'+mode;
function tell(msg){$('#alert').textContent=msg}
function read(){let raw=localStorage.getItem(key());entries=raw===null?(mode==='demo'?seedEntries():[]):parseBackup(raw);readFailed=false}
try{mode=localStorage.getItem('shelfmark:mode')==='blank'?'blank':'demo';read()}catch{readFailed=true;tell('無法讀取收藏。為保護原資料，暫停寫入。')}
function save(next){if(readFailed)throw Error('無法讀取原收藏，已停止寫入。');localStorage.setItem(key(),createBackup(next));entries=next;render()}
function openEntry(e){editEntry(e,next=>{save(upsertEntry(entries,next));tell('作品已儲存。')},item=>{save(upsertEntry(entries,{...item,archived:!item.archived,updatedAt:new Date().toISOString()}));tell(item.archived?'作品已還原。':'作品已封存。')},item=>{save(entries.filter(x=>x.id!==item.id));tell('作品已刪除。')})}
for(const [id,dict] of [['type',TYPES],['status',STATUSES]])for(const [v,l] of Object.entries(dict))$('#'+id).add(option(v,l));
function render(){
const s=summaryOf(entries);$('#stats').replaceChildren(...[['收藏作品',s.total],['進行中',s.active],['已完成',s.done]].map(([k,v])=>{let box=node('div','stat');box.append(node('strong','',v),node('span','',k));return box}));
let tag=$('#tag'),old=tag.value;tag.replaceChildren(option('','所有標籤'),...[...new Set(entries.flatMap(x=>x.tags))].sort((a,b)=>a.localeCompare(b,'zh-Hant')).map(x=>option(x,x)));if([...tag.options].some(o=>o.value===old))tag.value=old;
let scope=$('#scope').value, filtered=filterEntries(entries,{query:$('#query').value,type:$('#type').value,status:$('#status').value,tag:tag.value,favorite:scope==='favorite',archived:scope==='archived'});
let time=tab==='timeline';if(time)filtered=timelineOf(filtered);$('#view-title').textContent=time?'最近更新':'我的作品庫';$('#count').textContent=filtered.length+' 部作品'+(time?' · 依最後編輯時間排列':'');$('#layout').hidden=time;$('#layout').textContent=list?'切換為格狀':'切換為列表';
let cards=$('#cards');cards.className='cards'+(list||time?' list':'');cards.replaceChildren();
for(const [i,e] of filtered.entries()){let a=node('article','card'),b=node('button','open-card'),c=node('div','caption'),p=progressOf(e);b.type='button';b.setAttribute('aria-label','編輯 '+e.title);b.innerHTML=cover(e,i);c.append(node('span','kicker',TYPES[e.type]+'　/　'+STATUSES[e.status]+(e.favorite?'　★':'')),node('h3','',e.title),node('p','meta',e.creator||'未記錄創作者'),node('span','progress',p.label));if(time)c.append(node('time','meta','更新：'+new Date(e.updatedAt).toLocaleString('zh-TW')));b.append(c);b.onclick=()=>openEntry(e);a.append(b);cards.append(a)}
if(!filtered.length){let z=node('div','empty');z.append(node('h3','',entries.length?'沒有符合的作品':'從第一部作品開始'),node('p','meta',entries.length?'試著調整搜尋或篩選條件。':'按「新增作品」，留下你下一段閱讀或觀影紀錄。'));cards.append(z)}
}
$('#add').onclick=()=>openEntry(null);$('#query').oninput=render;for(const id of ['type','tag','status','scope'])$('#'+id).onchange=render;$('#layout').onclick=()=>{list=!list;render()};for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{tab=b.dataset.tab;for(const n of document.querySelectorAll('[data-tab]'))n.setAttribute('aria-pressed',String(n===b));render()};
function resetData(){token++;incoming=null;output='';$('#out').hidden=true;$('#out-preview').textContent='';$('#file').value='';$('#preview').textContent='';$('#apply').disabled=true;$('#mode-text').textContent='目前空間：'+(mode==='demo'?'示範收藏（虛構作品）':'私人收藏')+'。兩個空間分別儲存。';$('#mode').textContent=mode==='demo'?'切換到私人收藏':'切換到示範收藏'}
$('#data').onclick=()=>{resetData();$('#backup').showModal()};
$('#mode').onclick=()=>{let old=mode;try{mode=mode==='demo'?'blank':'demo';read();localStorage.setItem('shelfmark:mode',mode);for(const id of ['query','type','status','tag'])$('#'+id).value='';$('#scope').value='all';render();resetData();$('#backup').close();tell('已切換收藏空間。')}catch{mode=old;try{read()}catch{readFailed=true}$('#preview').textContent='無法切換收藏空間，未覆寫原資料。'}};
function preview(shared){output=shared?JSON.stringify({format:'shelfmark-share',works:entries.filter(e=>!e.archived).map(e=>({title:e.title,type:e.type,creator:e.creator}))},null,2):createBackup(entries);filename=shared?'shelfmark-share.json':'shelfmark-backup.json';$('#out-title').textContent=shared?'分享清單：只有名稱、媒介與創作者':'完整備份：包含筆記與已封存作品';$('#out-preview').textContent=output;$('#out').hidden=false}
$('#export').onclick=()=>preview(false);$('#share').onclick=()=>preview(true);$('#download').onclick=()=>{if(!output)return;let url=URL.createObjectURL(new Blob([output],{type:'application/json'}));let a=node('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)};
$('#file').onchange=async()=>{let seq=++token;incoming=null;$('#apply').disabled=true;$('#preview').textContent='';let file=$('#file').files[0];if(!file)return;try{if(file.size>MAX_BACKUP_BYTES)throw Error('檔案超過匯入容量上限');let parsed=parseBackup(await file.text());if(seq!==token)return;let p=previewImport(entries,parsed);incoming=parsed;$('#preview').textContent='可新增 '+p.added+' 部，略過重複 '+p.skipped+' 部。現有資料優先。';$('#apply').disabled=!p.added}catch(e){if(seq===token)$('#preview').textContent='無法匯入：'+e.message+'。現有資料未變更。'}};
$('#apply').onclick=()=>{if(!incoming)return;try{let p=previewImport(entries,incoming);save(p.entries);resetData();$('#preview').textContent='已匯入 '+p.added+' 部作品。'}catch(e){$('#preview').textContent='未寫入：'+e.message}};
render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>tell('無法快取離線介面；仍可在此頁管理作品。'));
