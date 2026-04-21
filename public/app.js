/* global state */
let allComics = [];
let editingId = null;

/* ── DOM refs ──────────────────────────────────────────────────────────────── */
const grid           = document.getElementById('comics-grid');
const emptyState     = document.getElementById('empty-state');
const searchInput    = document.getElementById('search');
const filterStatus   = document.getElementById('filter-status');
const filterPub      = document.getElementById('filter-publisher');
const filterSeries   = document.getElementById('filter-series');
const modalBackdrop  = document.getElementById('modal-backdrop');
const modal          = document.getElementById('modal');
const modalTitle     = document.getElementById('modal-title');
const comicForm      = document.getElementById('comic-form');
const btnAdd         = document.getElementById('btn-add');
const modalClose     = document.getElementById('modal-close');
const modalCancel    = document.getElementById('modal-cancel');
const btnDelete      = document.getElementById('btn-delete-comic');
const statTotal      = document.getElementById('stat-total');
const statRead       = document.getElementById('stat-read');
const statReading    = document.getElementById('stat-reading');
const statUnread     = document.getElementById('stat-unread');
const totalBadge     = document.getElementById('total-badge');

/* ── API helpers ────────────────────────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

/* ── Data loading ───────────────────────────────────────────────────────────── */
async function loadStats() {
  try {
    const s = await apiFetch('/api/comics/stats');
    statTotal.textContent   = s.total;
    statRead.textContent    = s.read;
    statReading.textContent = s.reading;
    statUnread.textContent  = s.unread;
    totalBadge.textContent  = s.total + ' comics';

    // Rebuild publisher filter
    const prevPub = filterPub.value;
    filterPub.innerHTML = '<option value="">All Publishers</option>';
    s.publishers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      if (p === prevPub) opt.selected = true;
      filterPub.appendChild(opt);
    });

    // Rebuild series filter
    const prevSeries = filterSeries.value;
    filterSeries.innerHTML = '<option value="">All Series</option>';
    s.series.forEach(sr => {
      const opt = document.createElement('option');
      opt.value = sr; opt.textContent = sr;
      if (sr === prevSeries) opt.selected = true;
      filterSeries.appendChild(opt);
    });
  } catch (e) {
    console.error('Failed to load stats', e);
  }
}

async function loadComics() {
  const params = new URLSearchParams();
  const q = searchInput.value.trim();
  if (q)                    params.set('search', q);
  if (filterStatus.value)   params.set('status', filterStatus.value);
  if (filterPub.value)      params.set('publisher', filterPub.value);
  if (filterSeries.value)   params.set('series', filterSeries.value);

  try {
    allComics = await apiFetch('/api/comics?' + params.toString());
    renderGrid();
  } catch (e) {
    console.error('Failed to load comics', e);
  }
}

/* ── Rendering ──────────────────────────────────────────────────────────────── */
function statusBadge(status) {
  const labels = { read: 'Read', reading: 'Reading', unread: 'Unread' };
  return `<span class="badge-${status} text-xs font-semibold px-2 py-0.5 rounded-full">${labels[status] || status}</span>`;
}

function renderGrid() {
  grid.innerHTML = '';
  if (!allComics.length) {
    emptyState.classList.remove('hidden');
    emptyState.classList.add('flex');
    return;
  }
  emptyState.classList.add('hidden');
  emptyState.classList.remove('flex');

  allComics.forEach(comic => {
    const card = document.createElement('article');
    card.className = 'comic-card bg-gray-800 rounded-xl overflow-hidden cursor-pointer border border-gray-700 hover:border-yellow-400/50';
    card.dataset.id = comic.id;

    const coverHtml = comic.cover_url
      ? `<img src="${escHtml(comic.cover_url)}" alt="Cover of ${escHtml(comic.title)}"
              class="w-full h-52 object-cover"
              onerror="this.parentElement.innerHTML=coverPlaceholder()" />`
      : `<div class="cover-placeholder w-full h-52 flex items-center justify-center text-5xl select-none">📖</div>`;

    card.innerHTML = `
      <div class="relative">${coverHtml}</div>
      <div class="p-3 space-y-1">
        <div class="flex items-start justify-between gap-1">
          <h3 class="font-semibold text-sm leading-tight text-white line-clamp-2 flex-1">${escHtml(comic.title)}</h3>
          ${statusBadge(comic.status)}
        </div>
        ${comic.series ? `<p class="text-xs text-gray-400 truncate">${escHtml(comic.series)}${comic.issue_number ? ' #' + escHtml(comic.issue_number) : ''}</p>` : ''}
        ${comic.publisher ? `<p class="text-xs text-gray-500 truncate">${escHtml(comic.publisher)}${comic.year ? ' · ' + comic.year : ''}</p>` : (comic.year ? `<p class="text-xs text-gray-500">${comic.year}</p>` : '')}
      </div>`;

    card.addEventListener('click', () => openEditModal(comic));
    grid.appendChild(card);
  });
}

function coverPlaceholder() {
  return '<div class="cover-placeholder w-full h-52 flex items-center justify-center text-5xl select-none">📖</div>';
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Modal helpers ──────────────────────────────────────────────────────────── */
function openAddModal() {
  editingId = null;
  modalTitle.textContent = 'Add Comic';
  comicForm.reset();
  document.getElementById('form-id').value = '';
  btnDelete.classList.add('hidden');
  showModal();
}

function openEditModal(comic) {
  editingId = comic.id;
  modalTitle.textContent = 'Edit Comic';
  document.getElementById('form-id').value      = comic.id;
  document.getElementById('form-title').value   = comic.title || '';
  document.getElementById('form-series').value  = comic.series || '';
  document.getElementById('form-issue').value   = comic.issue_number || '';
  document.getElementById('form-publisher').value = comic.publisher || '';
  document.getElementById('form-year').value    = comic.year || '';
  document.getElementById('form-status').value  = comic.status || 'unread';
  document.getElementById('form-cover').value   = comic.cover_url || '';
  document.getElementById('form-notes').value   = comic.notes || '';
  btnDelete.classList.remove('hidden');
  showModal();
}

function showModal() {
  modalBackdrop.classList.remove('hidden');
  document.body.classList.add('modal-open');
  document.getElementById('form-title').focus();
}

function hideModal() {
  modalBackdrop.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

/* ── Form submission ────────────────────────────────────────────────────────── */
comicForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title:        document.getElementById('form-title').value.trim(),
    series:       document.getElementById('form-series').value.trim() || null,
    issue_number: document.getElementById('form-issue').value.trim() || null,
    publisher:    document.getElementById('form-publisher').value.trim() || null,
    year:         parseInt(document.getElementById('form-year').value) || null,
    status:       document.getElementById('form-status').value,
    cover_url:    document.getElementById('form-cover').value.trim() || null,
    notes:        document.getElementById('form-notes').value.trim() || null,
  };

  try {
    if (editingId) {
      await apiFetch(`/api/comics/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await apiFetch('/api/comics', { method: 'POST', body: JSON.stringify(payload) });
    }
    hideModal();
    await loadStats();
    await loadComics();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

/* ── Delete ─────────────────────────────────────────────────────────────────── */
btnDelete.addEventListener('click', async () => {
  if (!editingId) return;
  if (!confirm('Delete this comic from your collection?')) return;
  try {
    await apiFetch(`/api/comics/${editingId}`, { method: 'DELETE' });
    hideModal();
    await loadStats();
    await loadComics();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

/* ── Event wiring ───────────────────────────────────────────────────────────── */
btnAdd.addEventListener('click', openAddModal);
modalClose.addEventListener('click', hideModal);
modalCancel.addEventListener('click', hideModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) hideModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideModal(); });

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadComics, 300);
});
filterStatus.addEventListener('change', loadComics);
filterPub.addEventListener('change', loadComics);
filterSeries.addEventListener('change', loadComics);

document.getElementById('btn-clear-filters').addEventListener('click', () => {
  searchInput.value = '';
  filterStatus.value = '';
  filterPub.value = '';
  filterSeries.value = '';
  loadComics();
});

/* ── Init ───────────────────────────────────────────────────────────────────── */
(async () => {
  await loadStats();
  await loadComics();
})();
