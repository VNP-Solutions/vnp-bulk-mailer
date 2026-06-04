(() => {
    const ICONS = {
        check: '<svg viewBox="0 0 16 16"><path d="M3 8L7 12L13 5"/></svg>',
        cross: '<svg viewBox="0 0 16 16"><path d="M4 4L12 12M12 4L4 12"/></svg>',
        emptyJobs: '<svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
        emptyHistory: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
        emptyContacts: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
        funnel: '<svg viewBox="0 0 16 16" fill="none"><path d="M2 3.5h12L9.5 9v4l-3-1.5V9L2 3.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
        funnelFilled: '<svg viewBox="0 0 16 16"><path d="M2 3.5h12L9.5 9v4l-3-1.5V9L2 3.5z" fill="currentColor"/></svg>',
        sortAsc: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 13V3M8 3L4.5 6.5M8 3l3.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        sortDesc: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M8 13l3.5-3.5M8 13l-3.5-3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        fsearch: '<svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.4"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    };

    // ============== Auth + helpers ==============
    function getToken() {
        return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    }
    function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }
    function jsonHeaders() { return { 'Content-Type': 'application/json', ...authHeaders() }; }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[ch]));
    }

    function debounce(fn, ms) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${y}/${m}/${day} ${hh}:${mm}`;
    }

    const toastEl = document.getElementById('toast');
    let toastTimer;
    function showToast(kind, message) {
        clearTimeout(toastTimer);
        toastEl.className = `toast ${kind}`;
        toastEl.querySelector('.toast-icon').innerHTML = kind === 'success' ? ICONS.check : ICONS.cross;
        toastEl.querySelector('.toast-text').textContent = message;
        toastEl.hidden = false;
        // eslint-disable-next-line no-unused-expressions
        toastEl.offsetHeight;
        toastEl.classList.add('visible');
        toastTimer = setTimeout(() => {
            toastEl.classList.remove('visible');
            setTimeout(() => { toastEl.hidden = true; }, 300);
        }, 4500);
    }

    function buildPageList(current, total) {
        const set = new Set([1, total, current - 1, current, current + 1]);
        const valid = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
        const out = [];
        for (let i = 0; i < valid.length; i++) {
            if (i > 0 && valid[i] - valid[i - 1] > 1) out.push('...');
            out.push(valid[i]);
        }
        return out;
    }

    function renderPagination(el, total, page, pageSize, onGo) {
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (total === 0) { el.hidden = true; el.innerHTML = ''; return; }
        el.hidden = false;
        const startNum = (page - 1) * pageSize + 1;
        const endNum = Math.min(page * pageSize, total);
        const pages = buildPageList(page, totalPages);
        const pageBtns = pages.map((p) => {
            if (p === '...') return '<span class="page-dots">…</span>';
            return `<button class="page-btn${p === page ? ' active' : ''}" data-page="${p}">${p}</button>`;
        }).join('');
        el.innerHTML = `
            <div class="pagination-info">Showing ${startNum}–${endNum} of ${total}</div>
            <div class="pagination-controls">
                <button class="page-btn" data-action="prev" ${page <= 1 ? 'disabled' : ''}>‹</button>
                ${pageBtns}
                <button class="page-btn" data-action="next" ${page >= totalPages ? 'disabled' : ''}>›</button>
            </div>`;
        el.onclick = (e) => {
            const btn = e.target.closest('.page-btn');
            if (!btn || btn.disabled) return;
            const action = btn.dataset.action;
            let next = page;
            if (action === 'prev') next = page - 1;
            else if (action === 'next') next = page + 1;
            else if (btn.dataset.page) next = Number(btn.dataset.page);
            if (next !== page && next >= 1 && next <= totalPages) onGo(next);
        };
    }

    function skeleton(tbody, cols, rows = 6) {
        let html = '';
        for (let i = 0; i < rows; i++) {
            html += `<tr class="skeleton-row" style="animation-delay:${i * 40}ms">${
                Array.from({ length: cols }).map(() => '<td><div class="skel-pill" style="width:60%"></div></td>').join('')
            }</tr>`;
        }
        tbody.innerHTML = html;
    }

    function statusBadge(status) {
        return `<span class="status-badge ${status}">${escapeHtml(status)}</span>`;
    }

    // ============== Modal helpers ==============
    function openModal(el) {
        el.hidden = false;
        // eslint-disable-next-line no-unused-expressions
        el.offsetHeight;
        el.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }
    function closeModal(el) {
        el.classList.remove('visible');
        document.body.style.overflow = '';
        setTimeout(() => {
            el.hidden = true;
            const form = el.querySelector('form');
            if (form) form.reset();
            el.querySelectorAll('.form-error').forEach((er) => { er.hidden = true; er.textContent = ''; });
        }, 280);
    }
    function setButtonLoading(btn, loading, label) {
        const labelEl = btn.querySelector('.btn-label');
        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
            if (labelEl) { btn.dataset.originalLabel = labelEl.textContent; if (label) labelEl.textContent = label; }
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
            if (labelEl && btn.dataset.originalLabel) { labelEl.textContent = btn.dataset.originalLabel; delete btn.dataset.originalLabel; }
        }
    }

    // ============== Tabs ==============
    const tabsEl = document.getElementById('tabs');
    let activeTab = 'compose';
    tabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab');
        if (!btn) return;
        const tab = btn.dataset.tab;
        if (tab === activeTab) return;
        activeTab = tab;
        tabsEl.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('active', p.id === `pane-${tab}`));
        if (tab === 'jobs') { jobsPage = 1; loadJobs(); startJobsPoll(); }
        else stopJobsPoll();
        if (tab === 'history') { loadHistoryTemplates(); loadHistory(); }
    });

    // ============================================================
    // COMPOSE
    // ============================================================
    const PAGE_SIZE = 10;
    const templateSelect = document.getElementById('template-select');
    const subjectInput = document.getElementById('subject-input');
    const templateFieldsWrap = document.getElementById('template-fields');
    const templateFieldsChips = document.getElementById('template-fields-chips');
    const contactsTbody = document.getElementById('contacts-tbody');
    const contactsPagination = document.getElementById('contacts-pagination');
    const recipientsCount = document.getElementById('recipients-count');
    const selectBanner = document.getElementById('select-banner');
    const searchEl = document.getElementById('search');
    const searchInput = document.getElementById('search-input');
    const sendBtn = document.getElementById('send-btn');
    const sendSummary = document.getElementById('send-summary');
    const theadRow = document.getElementById('contacts-thead-row');
    const tableWrap = document.getElementById('contacts-table-wrap');
    const popoverEl = document.getElementById('filter-popover');

    // Recipient table columns — every contact field is a text filter.
    const COLUMNS = [
        { key: 'first_name', label: 'First Name' },
        { key: 'last_name', label: 'Last Name' },
        { key: 'email', label: 'Email' },
        { key: 'hotel_name', label: 'Hotel' },
        { key: 'portfolio', label: 'Portfolio' },
    ];

    let templates = [];
    let contactsPage = 1;
    let contactsTotal = 0;
    let contactsSearch = '';
    let currentContacts = [];
    let loadSeq = 0;
    const selectedIds = new Set();
    let allMatching = false;
    let filterState = {}; // keyed by field → { op:'in', value:[...] }
    let sortState = null; // { key, dir }

    // ============== Recipient table head (with per-column filters) ==============
    function renderHead() {
        const checkCell = `
            <th class="col-check">
                <label class="head-check-label" id="head-check-label">
                    <input type="checkbox" id="select-all-check" aria-label="Select all">
                    <span class="head-check-box"></span>
                </label>
            </th>`;
        const cols = COLUMNS.map((col) => {
            const filterActive = !!filterState[col.key];
            const sortActive = sortState && sortState.key === col.key;
            const activeCls = filterActive || sortActive ? ' active' : '';
            return `
                <th>
                    <span class="th-label">${escapeHtml(col.label)}</span>
                    <button class="filter-btn${activeCls}" data-filter-col="${col.key}" aria-label="Filter ${escapeHtml(col.label)}">${
                        filterActive ? ICONS.funnelFilled : ICONS.funnel
                    }</button>
                </th>`;
        }).join('');
        theadRow.innerHTML = checkCell + cols;
        updateSelectAllUi();
    }

    async function loadTemplates() {
        try {
            const res = await fetch('/api/templates/query', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ limit: 500 }) });
            if (res.status === 401) { window.location.replace('/login'); return; }
            const data = await res.json();
            templates = data.items || [];
            if (!templates.length) {
                templateSelect.innerHTML = '<option value="">No templates — upload one first</option>';
            } else {
                templateSelect.innerHTML = '<option value="">Choose a template…</option>' +
                    templates.map((t) => `<option value="${t._id}">${escapeHtml(t.name)}</option>`).join('');
            }
        } catch (e) {
            console.error(e);
            templateSelect.innerHTML = '<option value="">Could not load templates</option>';
        }
    }

    function selectedTemplate() {
        return templates.find((t) => String(t._id) === templateSelect.value) || null;
    }

    templateSelect.addEventListener('change', () => {
        const t = selectedTemplate();
        if (t && (t.fields || []).length) {
            templateFieldsChips.innerHTML = t.fields.map((f) => `<span class="field-chip">[[${escapeHtml(f)}]]</span>`).join('');
            templateFieldsWrap.hidden = false;
        } else if (t) {
            templateFieldsChips.innerHTML = '<span class="field-chips-empty">No [[fields]] in this template</span>';
            templateFieldsWrap.hidden = false;
        } else {
            templateFieldsWrap.hidden = true;
        }
        updateSendState();
    });

    subjectInput.addEventListener('input', updateSendState);

    function recipientTotal() {
        return allMatching ? contactsTotal : selectedIds.size;
    }

    function updateSendState() {
        const n = recipientTotal();
        recipientsCount.textContent = `${n} selected`;
        const t = selectedTemplate();
        const subject = subjectInput.value.trim();
        const ready = !!t && !!subject && n > 0;
        sendBtn.disabled = !ready;
        if (!t) sendSummary.textContent = 'Select a template to begin.';
        else if (!subject) sendSummary.textContent = 'Write a subject line.';
        else if (n === 0) sendSummary.textContent = 'Select at least one recipient.';
        else sendSummary.innerHTML = `Ready to send <strong>${t.name}</strong> to <strong>${n}</strong> recipient${n === 1 ? '' : 's'}.`;
        const label = sendBtn.querySelector('.btn-label');
        if (label) label.textContent = n > 0 ? `Send to ${n} recipient${n === 1 ? '' : 's'}` : 'Send campaign';
    }

    function renderContacts(contacts) {
        if (!contacts.length) {
            const filtersActive = contactsSearch || Object.keys(filterState).length;
            const msg = filtersActive ? 'No contacts match these filters.' : 'No contacts yet. Add one to get started.';
            contactsTbody.innerHTML = `<tr><td colspan="6"><div class="data-empty"><div class="empty-icon">${ICONS.emptyContacts}</div><div>${msg}</div></div></td></tr>`;
            return;
        }
        contactsTbody.innerHTML = '';
        const frag = document.createDocumentFragment();
        contacts.forEach((c) => {
            const id = String(c._id);
            const checked = allMatching || selectedIds.has(id);
            const tr = document.createElement('tr');
            if (checked) tr.classList.add('row-selected');
            tr.innerHTML = `
                <td class="col-check">
                    <label class="row-check-label">
                        <input type="checkbox" class="row-check" data-row-id="${id}" ${checked ? 'checked' : ''}>
                        <span class="row-check-box"></span>
                    </label>
                </td>
                <td>${c.first_name ? `<span class="cell-name">${escapeHtml(c.first_name)}</span>` : '<span class="cell-muted">—</span>'}</td>
                <td>${c.last_name ? escapeHtml(c.last_name) : '<span class="cell-muted">—</span>'}</td>
                <td>${c.email ? `<span class="cell-email">${escapeHtml(c.email)}</span>` : '<span class="cell-muted">—</span>'}</td>
                <td>${c.hotel_name ? escapeHtml(c.hotel_name) : '<span class="cell-muted">—</span>'}</td>
                <td>${c.portfolio ? escapeHtml(c.portfolio) : '<span class="cell-muted">—</span>'}</td>`;
            frag.appendChild(tr);
        });
        contactsTbody.appendChild(frag);
    }

    async function loadContacts() {
        const seq = ++loadSeq;
        contactsTbody.style.opacity = currentContacts.length ? '0.55' : '1';
        try {
            const res = await fetch('/api/contacts/query', {
                method: 'POST', headers: jsonHeaders(),
                body: JSON.stringify({
                    limit: PAGE_SIZE,
                    skip: (contactsPage - 1) * PAGE_SIZE,
                    search: contactsSearch || undefined,
                    filters: filterState,
                    sort: sortState ? [sortState] : [],
                }),
            });
            if (res.status === 401) { window.location.replace('/login'); return; }
            const data = await res.json();
            if (seq !== loadSeq) return;
            currentContacts = data.items || [];
            contactsTotal = data.total || 0;
            renderContacts(currentContacts);
            renderPagination(contactsPagination, contactsTotal, contactsPage, PAGE_SIZE, (p) => { contactsPage = p; loadContacts(); });
            updateSelectAllUi();
            updateBanner();
            updateSendState();
        } catch (e) {
            console.error(e);
            showToast('error', 'Could not load contacts.');
        } finally {
            if (seq === loadSeq) contactsTbody.style.opacity = '1';
        }
    }

    // Selection
    contactsTbody.addEventListener('change', (e) => {
        const cb = e.target.closest('.row-check');
        if (!cb) return;
        const id = cb.dataset.rowId;
        if (allMatching) {
            // Materialise the matching-all selection into explicit ids for the
            // visible page, then apply this toggle.
            allMatching = false;
            selectedIds.clear();
            currentContacts.forEach((c) => selectedIds.add(String(c._id)));
        }
        if (cb.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        const tr = cb.closest('tr');
        if (tr) tr.classList.toggle('row-selected', cb.checked);
        updateSelectAllUi();
        updateBanner();
        updateSendState();
    });

    theadRow.addEventListener('change', (e) => {
        if (e.target.id !== 'select-all-check') return;
        const checked = e.target.checked;
        if (!checked) {
            allMatching = false;
            currentContacts.forEach((c) => selectedIds.delete(String(c._id)));
        } else {
            currentContacts.forEach((c) => selectedIds.add(String(c._id)));
        }
        document.querySelectorAll('.row-check').forEach((cb) => {
            cb.checked = checked;
            const tr = cb.closest('tr');
            if (tr) tr.classList.toggle('row-selected', checked);
        });
        updateSelectAllUi();
        updateBanner();
        updateSendState();
    });

    function updateSelectAllUi() {
        const selectAllCheck = document.getElementById('select-all-check');
        const headLabel = document.getElementById('head-check-label');
        if (!selectAllCheck || !headLabel) return;
        if (allMatching) {
            selectAllCheck.checked = true;
            headLabel.classList.remove('indeterminate');
            return;
        }
        const visible = currentContacts.map((c) => String(c._id));
        const sel = visible.filter((id) => selectedIds.has(id));
        if (visible.length === 0 || sel.length === 0) {
            selectAllCheck.checked = false;
            headLabel.classList.remove('indeterminate');
        } else if (sel.length === visible.length) {
            selectAllCheck.checked = true;
            headLabel.classList.remove('indeterminate');
        } else {
            selectAllCheck.checked = false;
            headLabel.classList.add('indeterminate');
        }
    }

    // ============== Per-column filter popover ==============
    let popoverCtx = null;
    let distinctReqSeq = 0;

    theadRow.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        e.stopPropagation();
        const col = COLUMNS.find((c) => c.key === btn.dataset.filterCol);
        if (!col) return;
        if (popoverCtx && popoverCtx.col === col) { closePopover(); return; }
        openPopover(col, btn);
    });

    function openPopover(col, anchorEl) {
        const field = col.key;
        popoverCtx = {
            col, field, anchorEl,
            draftFilter: filterState[field] ? { ...filterState[field] } : null,
            draftSort: sortState && sortState.key === field ? { ...sortState } : null,
            searchTerm: '',
            distinctValues: [],
            distinctTotal: 0,
            distinctLoading: true,
        };
        popoverEl.hidden = false;
        renderPopover();
        positionPopover(anchorEl);
        // eslint-disable-next-line no-unused-expressions
        popoverEl.offsetHeight;
        popoverEl.classList.add('visible');
        loadDistinct();
    }

    function closePopover() {
        popoverEl.classList.remove('visible');
        setTimeout(() => {
            if (!popoverEl.classList.contains('visible')) {
                popoverEl.hidden = true;
                popoverEl.innerHTML = '';
                popoverCtx = null;
            }
        }, 180);
    }

    function positionPopover(anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        const popoverWidth = 320;
        const margin = 12;
        let left = rect.left - 8;
        if (left + popoverWidth > window.innerWidth - margin) left = window.innerWidth - popoverWidth - margin;
        if (left < margin) left = margin;
        const spaceBelow = window.innerHeight - rect.bottom - margin - 6;
        const spaceAbove = rect.top - margin - 6;
        let top;
        let availableHeight;
        if (spaceBelow >= spaceAbove || spaceBelow >= 280) { top = rect.bottom + 6; availableHeight = spaceBelow; }
        else { availableHeight = spaceAbove; top = rect.top - 6; }
        const header = popoverEl.querySelector('.filter-popover-header');
        const body = popoverEl.querySelector('.filter-popover-body');
        const footer = popoverEl.querySelector('.filter-popover-footer');
        const headerH = header ? header.offsetHeight : 0;
        const footerH = footer ? footer.offsetHeight : 0;
        const maxBodyH = Math.max(120, availableHeight - headerH - footerH);
        if (body) body.style.maxHeight = `${maxBodyH}px`;
        if (top !== rect.bottom + 6) {
            const finalHeight = popoverEl.offsetHeight;
            top = rect.top - finalHeight - 6;
            if (top < margin) top = margin;
        }
        popoverEl.style.left = `${left}px`;
        popoverEl.style.top = `${top}px`;
    }

    function renderPopover() {
        if (!popoverCtx) return;
        popoverEl.innerHTML = `
            <div class="filter-popover-header">${escapeHtml(popoverCtx.col.label)}</div>
            <div class="filter-popover-body">
                ${renderSortSection()}
                ${renderListFilter()}
            </div>
            <div class="filter-popover-footer">
                ${isFilterDirty() ? '<button class="filter-link" data-action="clear-filter">Clear filter</button>' : ''}
                <button class="filter-apply-btn" data-action="apply">Apply Filter</button>
            </div>`;
        attachPopoverHandlers();
    }

    function renderSortSection() {
        const dir = popoverCtx.draftSort ? popoverCtx.draftSort.dir : null;
        return `
            <div class="filter-sort-section">
                <button class="filter-sort-btn${dir === 'asc' ? ' active' : ''}" data-action="sort" data-dir="asc">${ICONS.sortAsc}<span>Sort A to Z</span></button>
                <button class="filter-sort-btn${dir === 'desc' ? ' active' : ''}" data-action="sort" data-dir="desc">${ICONS.sortDesc}<span>Sort Z to A</span></button>
            </div>`;
    }

    function renderListFilter() {
        const draft = popoverCtx.draftFilter;
        const isUnfilteredDefault = !draft;
        const selectedSet = new Set((Array.isArray(draft && draft.value) ? draft.value : []).map(String));
        let optionsHtml;
        if (popoverCtx.distinctLoading) optionsHtml = '<div class="filter-loading">Loading values…</div>';
        else if (!popoverCtx.distinctValues.length) optionsHtml = '<div class="filter-empty">No values found</div>';
        else {
            optionsHtml = popoverCtx.distinctValues.map((v) => {
                const safe = escapeHtml(String(v));
                const isChecked = isUnfilteredDefault || selectedSet.has(String(v));
                return `
                    <label class="filter-check">
                        <input type="checkbox" data-action="toggle-value" data-value="${safe}" ${isChecked ? 'checked' : ''}>
                        <span class="filter-check-box"></span>
                        <span class="filter-check-label">${safe}</span>
                    </label>`;
            }).join('');
        }
        const selectedCount = isUnfilteredDefault ? popoverCtx.distinctTotal : selectedSet.size;
        const totalLabel = popoverCtx.distinctTotal ? `${selectedCount} / ${popoverCtx.distinctTotal}` : '—';
        return `
            <div class="filter-section">
                <div class="filter-section-label">Filter by Value</div>
                <div class="filter-search-wrap">
                    <span class="filter-search-icon">${ICONS.fsearch}</span>
                    <input type="text" class="filter-search-input" placeholder="Search..." data-action="search" data-autofocus value="${escapeHtml(popoverCtx.searchTerm)}">
                </div>
                <div class="filter-actions-row">
                    <div class="filter-actions-left">
                        <button class="filter-link primary" data-action="select-all">Select All</button>
                        <button class="filter-link" data-action="clear-values">Clear</button>
                    </div>
                    <span class="filter-count">${totalLabel}</span>
                </div>
                <div class="filter-checkboxes">${optionsHtml}</div>
            </div>`;
    }

    function attachPopoverHandlers() {
        popoverEl.querySelectorAll('[data-action]').forEach((el) => {
            const action = el.dataset.action;
            switch (action) {
                case 'sort':
                    el.addEventListener('click', () => {
                        const dir = el.dataset.dir;
                        if (popoverCtx.draftSort && popoverCtx.draftSort.dir === dir) popoverCtx.draftSort = null;
                        else popoverCtx.draftSort = { key: popoverCtx.field, dir };
                        renderPopover();
                    });
                    break;
                case 'search':
                    el.addEventListener('input', debounce(() => { popoverCtx.searchTerm = el.value; loadDistinct(); }, 200));
                    break;
                case 'toggle-value':
                    el.addEventListener('change', () => {
                        const v = el.dataset.value;
                        let arr;
                        if (!popoverCtx.draftFilter) arr = popoverCtx.distinctValues.map(String);
                        else if (Array.isArray(popoverCtx.draftFilter.value)) arr = popoverCtx.draftFilter.value.slice();
                        else arr = [];
                        const idx = arr.findIndex((x) => String(x) === String(v));
                        if (el.checked && idx === -1) arr.push(v);
                        else if (!el.checked && idx !== -1) arr.splice(idx, 1);
                        if (arr.length === popoverCtx.distinctValues.length) popoverCtx.draftFilter = null;
                        else popoverCtx.draftFilter = { op: 'in', value: arr };
                        renderPopover();
                    });
                    break;
                case 'select-all':
                    el.addEventListener('click', () => { popoverCtx.draftFilter = null; renderPopover(); });
                    break;
                case 'clear-values':
                    el.addEventListener('click', () => { popoverCtx.draftFilter = { op: 'in', value: [] }; renderPopover(); });
                    break;
                case 'clear-filter':
                    el.addEventListener('click', () => { popoverCtx.draftFilter = null; applyAndClose(); });
                    break;
                case 'apply':
                    el.addEventListener('click', applyAndClose);
                    break;
                default: break;
            }
        });
        popoverEl.addEventListener('click', stopProp, { once: true });
    }

    function stopProp(e) { e.stopPropagation(); popoverEl.addEventListener('click', stopProp, { once: true }); }

    function applyAndClose() {
        if (!popoverCtx) return;
        const { field, draftFilter, draftSort } = popoverCtx;
        if (draftFilter && hasFilterValue(draftFilter)) filterState[field] = draftFilter;
        else delete filterState[field];
        if (draftSort) sortState = draftSort;
        else if (sortState && sortState.key === field) sortState = null;
        // Changing the query invalidates a "select all matching" choice.
        allMatching = false;
        contactsPage = 1;
        closePopover();
        renderHead();
        loadContacts();
    }

    function hasFilterValue(f) {
        if (!f) return false;
        if (f.op === 'in') return Array.isArray(f.value) && f.value.length > 0;
        return f.value != null && f.value !== '';
    }

    function isFilterDirty() {
        if (!popoverCtx) return false;
        const { field } = popoverCtx;
        return !!filterState[field] || (sortState && sortState.key === field);
    }

    async function loadDistinct() {
        if (!popoverCtx) return;
        const seq = ++distinctReqSeq;
        popoverCtx.distinctLoading = true;
        renderPopover();
        try {
            const params = new URLSearchParams({ limit: '200' });
            if (popoverCtx.searchTerm) params.set('search', popoverCtx.searchTerm);
            const res = await fetch(`/api/contacts/distinct/${popoverCtx.field}?${params}`, { headers: authHeaders() });
            if (!res.ok) throw new Error('distinct fetch failed');
            const data = await res.json();
            if (seq !== distinctReqSeq || !popoverCtx) return;
            popoverCtx.distinctValues = data.values || [];
            popoverCtx.distinctTotal = data.total || 0;
            popoverCtx.distinctLoading = false;
            renderPopover();
        } catch (e) {
            console.error(e);
            if (seq !== distinctReqSeq || !popoverCtx) return;
            popoverCtx.distinctLoading = false;
            popoverCtx.distinctValues = [];
            renderPopover();
        }
    }

    document.addEventListener('click', (e) => {
        if (popoverEl.hidden) return;
        if (popoverEl.contains(e.target)) return;
        if (e.target.closest('.filter-btn')) return;
        closePopover();
    });
    document.addEventListener('keydown', (e) => {
        if (!popoverEl.hidden && e.key === 'Escape') { e.stopPropagation(); closePopover(); }
    });
    window.addEventListener('resize', () => { if (!popoverEl.hidden && popoverCtx) positionPopover(popoverCtx.anchorEl); });
    if (tableWrap) tableWrap.addEventListener('scroll', () => { if (!popoverEl.hidden && popoverCtx) positionPopover(popoverCtx.anchorEl); });

    function updateBanner() {
        if (allMatching) {
            selectBanner.hidden = false;
            selectBanner.innerHTML = `All <strong>${contactsTotal}</strong> matching contacts are selected. <button class="link" id="clear-all">Clear selection</button>`;
            selectBanner.querySelector('#clear-all').onclick = () => {
                allMatching = false; selectedIds.clear();
                document.querySelectorAll('.row-check').forEach((cb) => { cb.checked = false; cb.closest('tr')?.classList.remove('row-selected'); });
                updateSelectAllUi(); updateBanner(); updateSendState();
            };
            return;
        }
        const visible = currentContacts.map((c) => String(c._id));
        const allVisibleSelected = visible.length > 0 && visible.every((id) => selectedIds.has(id));
        if (allVisibleSelected && contactsTotal > visible.length) {
            selectBanner.hidden = false;
            selectBanner.innerHTML = `All ${visible.length} on this page selected. <button class="link" id="select-all-matching">Select all ${contactsTotal} matching</button>`;
            selectBanner.querySelector('#select-all-matching').onclick = () => {
                allMatching = true;
                document.querySelectorAll('.row-check').forEach((cb) => { cb.checked = true; cb.closest('tr')?.classList.add('row-selected'); });
                updateSelectAllUi(); updateBanner(); updateSendState();
            };
        } else {
            selectBanner.hidden = true;
        }
    }

    // Contacts search
    let searchDebounce;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchEl.classList.add('loading');
        searchDebounce = setTimeout(async () => {
            const next = searchInput.value.trim();
            if (next === contactsSearch) { searchEl.classList.remove('loading'); return; }
            contactsSearch = next;
            contactsPage = 1;
            // Changing the search invalidates a matching-all selection scope.
            if (allMatching) allMatching = false;
            try { await loadContacts(); } finally { searchEl.classList.remove('loading'); }
        }, 250);
    });

    // ============== Add contact modal ==============
    const addBtn = document.getElementById('add-contact-btn');
    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-form');
    const addSubmit = document.getElementById('add-submit');
    const addError = document.getElementById('add-error');

    addBtn.addEventListener('click', () => { openModal(addModal); setTimeout(() => addModal.querySelector('input').focus(), 80); });
    addModal.querySelectorAll('[data-close="add"]').forEach((el) => el.addEventListener('click', () => closeModal(addModal)));
    addModal.addEventListener('click', (e) => { if (e.target === addModal) closeModal(addModal); });

    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        addError.hidden = true;
        const fd = new FormData(addForm);
        const body = {
            first_name: String(fd.get('first_name') || '').trim(),
            last_name: String(fd.get('last_name') || '').trim(),
            email: String(fd.get('email') || '').trim(),
            hotel_name: String(fd.get('hotel_name') || '').trim(),
            portfolio: String(fd.get('portfolio') || '').trim(),
        };
        if (!body.email) { addError.textContent = 'Email is required.'; addError.hidden = false; return; }
        setButtonLoading(addSubmit, true, 'Creating…');
        try {
            const res = await fetch('/api/contacts', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(body) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { addError.textContent = data.error || 'Could not add contact.'; addError.hidden = false; return; }
            closeModal(addModal);
            const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || data.email;
            showToast('success', `${name} added.`);
            contactsPage = 1;
            await loadContacts();
        } catch (err) {
            console.error(err);
            addError.textContent = 'Network error. Please try again.';
            addError.hidden = false;
        } finally {
            setButtonLoading(addSubmit, false);
        }
    });

    // ============== Send confirm ==============
    const sendModal = document.getElementById('send-modal');
    const sendSummaryBox = document.getElementById('send-summary-box');
    const sendConfirm = document.getElementById('send-confirm');
    const sendError = document.getElementById('send-error');

    sendBtn.addEventListener('click', () => {
        const t = selectedTemplate();
        if (!t) return;
        const n = recipientTotal();
        sendSummaryBox.innerHTML = `
            <div class="send-summary-row"><span class="label">Template</span><span class="value">${escapeHtml(t.name)}</span></div>
            <div class="send-summary-row"><span class="label">Subject</span><span class="value">${escapeHtml(subjectInput.value.trim())}</span></div>
            <div class="send-summary-row"><span class="label">Recipients</span><span class="value count">${n}</span></div>`;
        sendError.hidden = true;
        openModal(sendModal);
    });
    sendModal.querySelectorAll('[data-close="send"]').forEach((el) => el.addEventListener('click', () => closeModal(sendModal)));
    sendModal.addEventListener('click', (e) => { if (e.target === sendModal) closeModal(sendModal); });

    sendConfirm.addEventListener('click', async () => {
        const t = selectedTemplate();
        if (!t) return;
        sendError.hidden = true;
        const payload = {
            template_id: t._id,
            subject: subjectInput.value.trim(),
        };
        if (allMatching) {
            payload.mode = 'all';
            payload.search = contactsSearch || undefined;
            payload.filters = filterState;
        } else {
            payload.mode = 'selected';
            payload.contact_ids = Array.from(selectedIds);
        }

        setButtonLoading(sendConfirm, true, 'Sending…');
        try {
            const res = await fetch('/api/send/jobs', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { sendError.textContent = data.error || 'Could not start the send.'; sendError.hidden = false; return; }
            closeModal(sendModal);
            showToast('success', `Sending to ${data.total} recipient${data.total === 1 ? '' : 's'} started.`);
            // Reset selection
            selectedIds.clear(); allMatching = false;
            // Switch to Jobs tab
            tabsEl.querySelector('[data-tab="jobs"]').click();
        } catch (err) {
            console.error(err);
            sendError.textContent = 'Network error. Please try again.';
            sendError.hidden = false;
        } finally {
            setButtonLoading(sendConfirm, false);
        }
    });

    // ============================================================
    // JOBS
    // ============================================================
    const jobsTbody = document.getElementById('jobs-tbody');
    const jobsPagination = document.getElementById('jobs-pagination');
    const jobsCount = document.getElementById('jobs-count');
    const jobsRunningBadge = document.getElementById('jobs-running-badge');
    let jobsPage = 1;
    let jobsTotal = 0;
    let jobsPoll = null;

    function progressCell(job) {
        const done = (job.sent || 0) + (job.failed || 0);
        const pct = job.total ? Math.round((done / job.total) * 100) : 0;
        let cls = '';
        if (job.status === 'completed') cls = 'done';
        else if (job.status === 'failed') cls = 'failed';
        const failHtml = job.failed ? `<span class="fail">${job.failed} failed</span>` : '';
        return `
            <div class="progress-cell">
                <div class="progress-bar-track"><div class="progress-bar-fill ${cls}" style="width:${pct}%"></div></div>
                <div class="progress-meta"><span>${job.sent || 0} / ${job.total || 0} sent</span>${failHtml}</div>
            </div>`;
    }

    function renderJobs(jobs) {
        if (!jobs.length) {
            jobsTbody.innerHTML = `<tr><td colspan="5"><div class="data-empty"><div class="empty-icon">${ICONS.emptyJobs}</div><div>No send jobs yet. Compose a campaign to get started.</div></div></td></tr>`;
            return;
        }
        jobsTbody.innerHTML = jobs.map((j) => `
            <tr>
                <td><span class="cell-name">${escapeHtml(j.template_name || '—')}</span></td>
                <td>${escapeHtml(j.subject || '—')}</td>
                <td class="col-progress">${progressCell(j)}</td>
                <td>${statusBadge(j.status)}</td>
                <td><span class="cell-date">${escapeHtml(formatDateTime(j.created_at))}</span></td>
            </tr>`).join('');
    }

    async function loadJobs() {
        try {
            const res = await fetch('/api/send/jobs/query', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ limit: 25, skip: (jobsPage - 1) * 25 }) });
            if (res.status === 401) { window.location.replace('/login'); return; }
            const data = await res.json();
            jobsTotal = data.total || 0;
            jobsCount.textContent = `${jobsTotal} total`;
            renderJobs(data.items || []);
            renderPagination(jobsPagination, jobsTotal, jobsPage, 25, (p) => { jobsPage = p; loadJobs(); });
            const running = (data.items || []).filter((j) => j.status === 'running' || j.status === 'queued').length;
            if (running > 0) { jobsRunningBadge.hidden = false; jobsRunningBadge.textContent = String(running); }
            else jobsRunningBadge.hidden = true;
            return running;
        } catch (e) {
            console.error(e);
            return 0;
        }
    }

    function startJobsPoll() {
        stopJobsPoll();
        jobsPoll = setInterval(async () => {
            const running = await loadJobs();
            if (!running) stopJobsPoll();
        }, 2000);
    }
    function stopJobsPoll() {
        if (jobsPoll) { clearInterval(jobsPoll); jobsPoll = null; }
    }

    // Keep the Jobs tab badge fresh on load even if not viewing it.
    async function refreshJobsBadge() {
        const running = await loadJobsBadgeOnly();
        if (running > 0 && activeTab !== 'jobs') {
            // Light poll to keep badge moving while user is elsewhere.
            setTimeout(refreshJobsBadge, 4000);
        }
    }
    async function loadJobsBadgeOnly() {
        try {
            const res = await fetch('/api/send/jobs/query', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ limit: 25 }) });
            if (!res.ok) return 0;
            const data = await res.json();
            const running = (data.items || []).filter((j) => j.status === 'running' || j.status === 'queued').length;
            if (running > 0) { jobsRunningBadge.hidden = false; jobsRunningBadge.textContent = String(running); }
            else jobsRunningBadge.hidden = true;
            return running;
        } catch (e) { return 0; }
    }

    // ============================================================
    // HISTORY
    // ============================================================
    const historyTbody = document.getElementById('history-tbody');
    const historyPagination = document.getElementById('history-pagination');
    const historyCount = document.getElementById('history-count');
    const historySearchEl = document.getElementById('history-search');
    const historySearchInput = document.getElementById('history-search-input');
    const historyStatusTabs = document.getElementById('history-status-tabs');
    const historyTemplateFilter = document.getElementById('history-template-filter');
    let historyPage = 1;
    let historyTotal = 0;
    let historyStatus = '';
    let historyTemplate = '';
    let historySearch = '';
    let historyLoaded = false;

    function buildHistoryFilters() {
        const filters = {};
        if (historyStatus) filters.status = { op: 'in', value: [historyStatus] };
        if (historyTemplate) filters.template_name = { op: 'eq', value: historyTemplate };
        return filters;
    }

    function renderHistory(rows) {
        if (!rows.length) {
            historyTbody.innerHTML = `<tr><td colspan="5"><div class="data-empty"><div class="empty-icon">${ICONS.emptyHistory}</div><div>No emails sent yet.</div></div></td></tr>`;
            return;
        }
        historyTbody.innerHTML = rows.map((r) => {
            const name = r.contact_name ? `<span class="cell-name">${escapeHtml(r.contact_name)}</span><div class="cell-sub">${escapeHtml(r.email || '')}</div>`
                : `<span class="cell-email">${escapeHtml(r.email || '—')}</span>`;
            const err = r.status === 'failed' && r.error ? `<div class="cell-sub">${escapeHtml(r.error)}</div>` : '';
            return `
                <tr>
                    <td>${name}</td>
                    <td>${escapeHtml(r.template_name || '—')}</td>
                    <td>${escapeHtml(r.subject || '—')}</td>
                    <td>${statusBadge(r.status)}${err}</td>
                    <td><span class="cell-date">${escapeHtml(formatDateTime(r.sent_at))}</span></td>
                </tr>`;
        }).join('');
    }

    async function loadHistory() {
        if (!historyLoaded) skeleton(historyTbody, 5, 6);
        try {
            const res = await fetch('/api/send/history/query', {
                method: 'POST', headers: jsonHeaders(),
                body: JSON.stringify({ limit: 25, skip: (historyPage - 1) * 25, search: historySearch || undefined, filters: buildHistoryFilters() }),
            });
            if (res.status === 401) { window.location.replace('/login'); return; }
            const data = await res.json();
            historyLoaded = true;
            historyTotal = data.total || 0;
            historyCount.textContent = `${historyTotal} total`;
            renderHistory(data.items || []);
            renderPagination(historyPagination, historyTotal, historyPage, 25, (p) => { historyPage = p; loadHistory(); });
        } catch (e) {
            console.error(e);
            showToast('error', 'Could not load history.');
        }
    }

    async function loadHistoryTemplates() {
        try {
            const res = await fetch('/api/send/history/templates', { headers: authHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            const current = historyTemplateFilter.value;
            historyTemplateFilter.innerHTML = '<option value="">All templates</option>' +
                (data.templates || []).map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
            historyTemplateFilter.value = current;
        } catch (e) { /* ignore */ }
    }

    historyStatusTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-status]');
        if (!btn) return;
        const next = btn.dataset.status || '';
        if (next === historyStatus) return;
        historyStatus = next;
        historyStatusTabs.querySelectorAll('.status-tab').forEach((t) => t.classList.toggle('active', t === btn));
        historyPage = 1;
        loadHistory();
    });

    historyTemplateFilter.addEventListener('change', () => {
        historyTemplate = historyTemplateFilter.value;
        historyPage = 1;
        loadHistory();
    });

    let historyDebounce;
    historySearchInput.addEventListener('input', () => {
        clearTimeout(historyDebounce);
        historySearchEl.classList.add('loading');
        historyDebounce = setTimeout(async () => {
            const next = historySearchInput.value.trim();
            if (next === historySearch) { historySearchEl.classList.remove('loading'); return; }
            historySearch = next;
            historyPage = 1;
            try { await loadHistory(); } finally { historySearchEl.classList.remove('loading'); }
        }, 250);
    });

    // ============== Esc closes modals ==============
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        [addModal, sendModal].forEach((m) => { if (!m.hidden) closeModal(m); });
    });

    // ============== Init ==============
    renderHead();
    skeleton(contactsTbody, 6, 6);
    loadTemplates();
    loadContacts();
    refreshJobsBadge();
})();
