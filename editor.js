import { TYPES, STATUSES, validateEntry } from './model.js';

function node(tag, options = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === 'text') el.textContent = value;
    else if (key === 'className') el.className = value;
    else if (key in el && !key.startsWith('aria')) el[key] = value;
    else el.setAttribute(key, value);
  }
  el.append(...children);
  return el;
}

function field(label, input) {
  return node('label', { className: 'field' }, node('span', { text: label }), input);
}

function numberInput(name, value, min) {
  return node('input', { name, type: 'number', min, step: 1, value, required: true, inputMode: 'numeric' });
}

function select(name, options, value) {
  const el = node('select', { name });
  for (const [optionValue, label] of options) {
    el.append(node('option', { value: optionValue, text: label }));
  }
  el.value = String(value);
  return el;
}

function button(text, fn, className = '') {
  const el = node('button', { type: 'button', text, className });
  el.addEventListener('click', fn);
  return el;
}

function makeId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
}

/** Open the private record editor. Mutation callbacks may throw; failed changes leave the dialog open. */
export function editEntry(entry, onSave, onArchive, onDelete) {
  const previousFocus = document.activeElement;
  const dialog = node('dialog', { 'aria-labelledby': 'editor-title', className: 'editor' });
  const form = node('form');
  const heading = node('h2', { id: 'editor-title', text: entry ? '編輯紀錄' : '新增紀錄' });
  const intro = node('p', { className: 'meta', text: '把想讀、想看的作品和進度留在這台裝置。' });
  const title = node('input', { name: 'title', value: entry?.title ?? '', required: true, maxLength: 160, autofocus: true });
  const type = select('type', Object.entries(TYPES), entry?.type ?? 'book');
  const status = select('status', Object.entries(STATUSES), entry?.status ?? 'queued');
  const maker = node('input', { name: 'creator', value: entry?.creator ?? '', maxLength: 120, placeholder: '選填' });
  const originalTags = entry?.tags?.join('、') ?? '';
  const tags = node('input', { name: 'tags', value: originalTags, placeholder: '例：科幻、睡前閱讀' });
  const notes = node('textarea', { name: 'notes', value: entry?.notes ?? '', rows: 3, maxLength: 10000, placeholder: '筆記只在編輯和完整備份中顯示。' });
  const rating = select('rating', [['0', '未評分'], ...[1, 2, 3, 4, 5].map(n => [String(n), n + '／5'])], entry?.rating ?? 0);
  const favorite = node('input', { name: 'favorite', type: 'checkbox', checked: entry?.favorite ?? false });
  const favoriteLabel = node('label', { className: 'check' }, favorite, ' 加入收藏');

  const pagesRead = numberInput('pagesRead', entry?.type === 'book' ? entry.pagesRead : 0, 0);
  const totalPages = numberInput('totalPages', entry?.type === 'book' ? entry.totalPages : '', 1);
  const bookFields = node('div', { className: 'row' }, field('已讀頁數', pagesRead), field('總頁數', totalPages));

  const seasonLengths = node('input', {
    name: 'seasonLengths', value: entry?.seasonLengths?.join('、') ?? '',
    required: true, placeholder: '例：8、10、6', 'aria-describedby': 'editor-season-hint',
  });
  const season = numberInput('season', entry?.type === 'series' ? entry.season : 1, 1);
  const episode = numberInput('episode', entry?.type === 'series' ? entry.episode : 0, 0);
  const seriesFields = node('div', { className: 'fields' },
    field('各季集數', seasonLengths),
    node('p', { id: 'editor-season-hint', className: 'meta', text: '依序填入每季總集數，例如 8、10。尚未開始請填第 1 季、第 0 集。' }),
    node('div', { className: 'row' }, field('目前季數', season), field('該季已看集數', episode)),
  );
  const filmFields = node('p', { className: 'meta', text: '電影的觀看進度由狀態決定。看完時請選「已完成」。' });

  function syncType() {
    bookFields.hidden = type.value !== 'book';
    for (const el of [pagesRead, totalPages]) el.disabled = bookFields.hidden;
    seriesFields.hidden = type.value !== 'series';
    for (const el of [seasonLengths, season, episode]) el.disabled = seriesFields.hidden;
    filmFields.hidden = type.value !== 'film';
  }
  type.addEventListener('change', syncType);
  syncType();

  const error = node('p', { className: 'error', role: 'alert', tabIndex: -1, hidden: true });
  const confirmation = node('div', { className: 'fields', hidden: true });
  const fields = node('div', { className: 'fields' },
    field('作品名稱', title),
    node('div', { className: 'row' }, field('媒介', type), field('狀態', status)),
    field('作者／創作者', maker),
    bookFields, seriesFields, filmFields,
    field('標籤（用頓號或逗號分隔）', tags),
    node('div', { className: 'row' }, field('我的評分', rating), favoriteLabel),
    field('私人筆記', notes),
  );
  const actions = node('div', { className: 'actions' });
  function displayError(err) {
    error.textContent = err instanceof Error ? err.message : '操作未完成，請再試一次。';
    error.hidden = false;
    error.focus();
  }
  function clearError() {
    error.textContent = '';
    error.hidden = true;
  }
  function confirmAction(kind, trigger) {
    clearError();
    const remove = kind === 'delete';
    const action = remove ? '刪除' : entry.archived ? '還原' : '封存';
    const message = remove ? '此操作無法復原。已匯出的備份不受影響。'
      : entry.archived ? '這筆紀錄會重新出現在館藏。' : '紀錄會移到封存區，可隨時還原。';
    fields.hidden = true;
    actions.hidden = true;
    const back = button('返回編輯', () => {
      confirmation.hidden = true;
      confirmation.replaceChildren();
      fields.hidden = false;
      actions.hidden = false;
      clearError();
      trigger.focus();
    });
    const proceed = button('確認' + action, () => {
      clearError();
      try {
        (remove ? onDelete : onArchive)(entry);
        dialog.close();
      } catch (err) { displayError(err); }
    }, remove ? 'danger' : 'primary');
    confirmation.replaceChildren(node('h3', { text: '要' + action + '這筆紀錄嗎？' }),
      node('p', { text: message }), node('div', { className: 'actions' }, back, proceed));
    confirmation.hidden = false;
    back.focus();
  }

  if (entry && onArchive) {
    const archive = button(entry.archived ? '還原' : '封存', () => confirmAction('archive', archive));
    actions.append(archive);
  }
  if (entry && onDelete) {
    const remove = button('刪除', () => confirmAction('delete', remove), 'danger');
    actions.append(remove);
  }
  actions.append(button('取消', () => dialog.close()), node('button', { text: '儲存紀錄', type: 'submit', className: 'primary' }));
  form.append(heading, intro, error, fields, actions, confirmation);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!confirmation.hidden) return;
    clearError();
    try {
      const book = type.value === 'book', series = type.value === 'series';
      let lengths = [];
      if (series) {
        const rawLengths = seasonLengths.value.trim().split(/[、,，\s]+/);
        if (rawLengths.some(part => !/^\d+$/.test(part) || Number(part) < 1)) {
          throw new Error('請依序輸入每季的正整數總集數，例如 8、10。');
        }
        lengths = rawLengths.map(Number);
      }
      const stamp = new Date().toISOString();
      const now = entry?.createdAt > stamp ? entry.createdAt : stamp;
      const draft = {
        id: entry?.id ?? makeId(), title: title.value.trim(), type: type.value,
        status: status.value, creator: maker.value, tags: tags.value === originalTags ? (entry?.tags ?? []) : tags.value.split(/[、,，]/).map(tag => tag.trim()).filter(Boolean),
        notes: notes.value, rating: Number(rating.value), favorite: favorite.checked, archived: entry?.archived ?? false,
        pagesRead: book ? pagesRead.valueAsNumber : 0, totalPages: book ? totalPages.valueAsNumber : 0,
        season: series ? season.valueAsNumber : 0, episode: series ? episode.valueAsNumber : 0, seasonLengths: lengths,
        createdAt: entry?.createdAt ?? now, updatedAt: now,
      };
      onSave(validateEntry(draft));
      dialog.close();
    } catch (err) { displayError(err); }
  });

  dialog.append(form);
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    else document.querySelector('.toolbar .primary')?.focus();
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  title.focus();
}
