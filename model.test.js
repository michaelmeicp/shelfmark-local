import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_BACKUP_BYTES,seedEntries,validateEntry,upsertEntry,progressOf,createBackup,parseBackup,previewImport,filterEntries,summaryOf,timelineOf} from './model.js';

test('book pages, current series episode and film watched produce correct labels',()=>{
  const [book,series,film] = seedEntries();
  assert.deepEqual(progressOf(book),{done:100,total:300,percent:33,label:'100 / 300 頁'});
  assert.deepEqual(progressOf(series),{done:11,total:16,percent:68,label:'S2E3 · 11 / 16 集'});
  assert.deepEqual(progressOf(film),{done:1,total:1,percent:100,label:'已看完'});
  assert.equal(progressOf({...film,status:'paused'}).percent,0);
});
test('validates book totals/read pages, including fraction, negative, 0, final page',()=>{
  const [book] = seedEntries();
  for (const pagesRead of [-1,301,100.5,'100']) assert.throws(()=>validateEntry({...book,pagesRead}));
  for (const totalPages of [0,1000001]) assert.throws(()=>validateEntry({...book,totalPages}));
  assert.equal(progressOf(validateEntry({...book,pagesRead:0})).percent,0);
  assert.equal(progressOf(validateEntry({...book,pagesRead:299})).percent,99);
  assert.equal(progressOf(validateEntry({...book,pagesRead:300})).percent,100);
});
test('validates season-specific episode bounds and counts completed seasons',()=>{
  const [,series] = seedEntries();
  const e = {...series,seasonLengths:[2,4,9]};
  assert.equal(progressOf(validateEntry({...e,season:2,episode:4})).done,6);
  assert.equal(progressOf(validateEntry({...e,season:3,episode:9})).percent,100);
  assert.equal(progressOf(validateEntry({...e,season:1,episode:0})).done,0);
  for (const [season,episode] of [[0,1],[4,1],[2,0],[2,5],[3,-1],[1,3]]) assert.throws(()=>validateEntry({...e,season,episode}));
  for (const seasonLengths of [[],[0],[1,10001],new Array(2)]) assert.throws(()=>validateEntry({...e,seasonLengths}));
});
test('versioned JSON roundtrip preserves all records including private notes and archive',()=>{
  const entries = seedEntries();
  entries[0] = {...entries[0],notes:'保留筆記\n\n第二行',archived:true};
  const restored = parseBackup(createBackup(entries));
  assert.deepEqual(restored,entries);
  assert.deepEqual(previewImport([],restored).entries,entries);
});
test('duplicate imports are deterministic, first intake wins, existing record has priority',()=>{
  const [book] = seedEntries();
  const candidates = [
    {...book,notes:'do not overwrite'},
    {...book,id:'new-1',title:'  山的回信 '},
    {...book,id:'new-2',title:'　Ａ　ｂ ｃ　'},
    {...book,id:'new-3',title:'a b c'},
    {...book,id:'new-4',title:'a b c',type:'film'},
  ];
  const {entries,added,skipped,duplicates} = previewImport([book],candidates);
  assert.equal(entries[0],book);
  assert.deepEqual(entries.map(e=>e.id),[book.id,'new-2','new-4']);
  assert.equal(added,2); assert.equal(skipped,3);
  assert.deepEqual(duplicates.map(x=>x.reason),['id','title','title']);
  assert.equal(previewImport(entries,candidates).added,0);
});
test('invalid import fails atomically even if an invalid record would have been skipped',()=>{
  const entries = seedEntries();
  const before = createBackup(entries);
  const [book] = entries;
  assert.throws(()=>previewImport(entries,[{...book,id:'new',title:'新品'},{...book,pagesRead:500}]));
  assert.throws(()=>parseBackup('{'));
  assert.throws(()=>parseBackup('{"format":"shelfmark","version":2,"entries":[]}'));
  assert.throws(()=>parseBackup('{"format":"shelfmark","version":1,"entries":[{"type":"book"}]}'));
  assert.equal(createBackup(entries),before);
});
test('create/edit uniqueness works per media, archived duplicates remain reserved',()=>{
  const [book] = seedEntries();
  const archived = {...book,archived:true};
  const old = [archived];
  assert.throws(()=>upsertEntry(old,{...book,id:'new'}));
  assert.equal(upsertEntry(old,{...book,type:'film',id:'new'}).length,2);
  assert.equal(upsertEntry(old,{...book,pagesRead:300})[0].pagesRead,300);
  assert.equal(old[0].pagesRead,100);
});
test('filters combine query, media, status, tags, favorites and exclude spoilers',()=>{
  const entries = seedEntries();
  assert.deepEqual(filterEntries(entries,{query:'晚禾 自然',type:'book',status:'active',tag:'散文',favorite:true}).map(e=>e.id),['demo-1']);
  assert.deepEqual(filterEntries(entries,{query:'氣味'}),[]);
  const e = {...entries[0],archived:true,tags:['all']};
  assert.deepEqual(filterEntries([e,...entries.slice(1)],{archived:true,tag:'all'}),[e]);
  assert.equal(filterEntries([e],{archived:'all'}).length,1);
});
test('dashboard excludes archived works; update timeline is newest first and nonmutating',()=>{
  const data = seedEntries().reverse();
  data[0] = {...data[0],archived:true};
  assert.deepEqual(summaryOf(data),{total:5,book:2,film:2,series:1,queued:2,active:2,done:1,paused:0,favorites:2,archived:1});
  assert.deepEqual(timelineOf(data).map(e=>e.id),['demo-1','demo-2','demo-3','demo-4','demo-5','demo-6']);
  assert.deepEqual(timelineOf(filterEntries(data,{archived:true})).map(e=>e.id),['demo-6']);
  assert.equal(data[0].id,'demo-6');
});
test('rejects prototype keys, malformed dates and unsafe metadata',()=>{
  const [book] = seedEntries();
  for (const changes of [{type:'__proto__'},{status:'toString'},{id:'a<b'},{rating:6},{archived:1},{updatedAt:'2026-10-30'},{updatedAt:'2026-02-30T00:00:00.000Z'},{updatedAt:'2026-05-07T00:00:00.000Z'}]) assert.throws(()=>validateEntry({...book,...changes}));
});

test('rejects oversized backups in both ASCII and multibyte text before parsing',()=>{
  assert.throws(()=>parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1)), /備份檔案過大/);
  assert.throws(()=>parseBackup('讀'.repeat(Math.floor(MAX_BACKUP_BYTES / 3) + 1)), /備份檔案過大/);
});
