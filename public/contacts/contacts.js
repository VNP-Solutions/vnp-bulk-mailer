(() => {
    // ============== Columns ==============
    // Every contact field is free text → a multi-select + sort filter.
    const COLUMNS = [
        { key: 'first_name', label: 'First Name', cell: 'name', filter: { kind: 'text' } },
        { key: 'last_name', label: 'Last Name', cell: 'name', filter: { kind: 'text' } },
        { key: 'email', label: 'Email', cell: 'email', filter: { kind: 'text' } },
        { key: 'hotel_name', label: 'Hotel', filter: { kind: 'text' } },
        { key: 'portfolio', label: 'Portfolio', filter: { kind: 'text' } },
    ];

    function filterField(col) {
        return (col.filter && col.filter.field) || col.key;
    }

    // ============== Icons ==============
    const ICONS = {
        check: '<svg viewBox="0 0 16 16"><path d="M3 8L7 12L13 5"/></svg>',
        cross: '<svg viewBox="0 0 16 16"><path d="M4 4L12 12M12 4L4 12"/></svg>',
        funnel: '<svg viewBox="0 0 16 16" fill="none"><path d="M2 3.5h12L9.5 9v4l-3-1.5V9L2 3.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
        funnelFilled: '<svg viewBox="0 0 16 16"><path d="M2 3.5h12L9.5 9v4l-3-1.5V9L2 3.5z" fill="currentColor"/></svg>',
        sortAsc: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 13V3M8 3L4.5 6.5M8 3l3.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        sortDesc: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M8 13l3.5-3.5M8 13l-3.5-3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        search: '<svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.4"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
        emptyContacts: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    };

    // ============== DOM ==============
    const theadRow = document.getElementById('data-thead-row');
    const tbody = document.getElementById('data-tbody');
    const tableWrap = document.getElementById('data-table-wrap');
    const paginationEl = document.getElementById('data-pagination');
    const dataCount = document.getElementById('data-count');
    const searchEl = document.getElementById('search');
    const searchInput = document.getElementById('search-input');
    const toastEl = document.getElementById('toast');
    const popoverEl = document.getElementById('filter-popover');

    // ============== Auth ==============
    function getToken() {
        return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    }
    function authHeaders() {
        return { Authorization: `Bearer ${getToken()}` };
    }

    // ============== State ==============
    const PAGE_SIZE = 25;
    let currentContacts = [];
    let totalContacts = 0;
    let currentPage = 1;
    let searchQuery = '';
    let filterState = {}; // keyed by field → { op:'in', value:[...] }
    let sortState = null; // { key, dir }
    let loadSeq = 0;
    const selectedIds = new Set();

    // ============== Helpers ==============
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (ch) => ({
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

    // ============== Toast ==============
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

    // ============== Render head ==============
    function renderHead() {
        const checkCell = `
            <th class="col-check">
                <label class="head-check-label" id="head-check-label">
                    <input type="checkbox" id="select-all-check" aria-label="Select all visible rows">
                    <span class="head-check-box"></span>
                </label>
            </th>`;
        const cols = COLUMNS.map((col) => {
            const field = filterField(col);
            const filterActive = !!filterState[field];
            const sortActive = sortState && sortState.key === field;
            const activeCls = filterActive || sortActive ? ' active' : '';
            return `
                <th>
                    <span class="th-label">${escapeHtml(col.label)}</span>
                    <button class="filter-btn${activeCls}" data-filter-col="${col.key}" aria-label="Filter ${escapeHtml(col.label)}">${
                        filterActive ? ICONS.funnelFilled : ICONS.funnel
                    }</button>
                </th>`;
        }).join('');
        const actionsCell = '<th class="col-actions">Actions</th>';
        theadRow.innerHTML = checkCell + cols + actionsCell;
        updateSelectAllUi();
    }

    // ============== Render rows ==============
    function cellHtml(col, contact) {
        const raw = contact[col.key];
        if (raw == null || raw === '') return '<span class="cell-muted">—</span>';
        const safe = escapeHtml(String(raw));
        if (col.cell === 'name') return `<span class="cell-name">${safe}</span>`;
        if (col.cell === 'email') return `<span class="cell-email">${safe}</span>`;
        return safe;
    }

    function renderRows(contacts) {
        const totalCols = COLUMNS.length + 2; // check + actions
        if (!contacts.length) {
            const filtersActive = searchQuery || Object.keys(filterState).length;
            const msg = filtersActive
                ? 'No contacts match these filters.'
                : 'No contacts yet. Add one or bulk upload a list to get started.';
            tbody.innerHTML = `
                <tr><td colspan="${totalCols}">
                    <div class="data-empty">
                        <div class="empty-icon">${ICONS.emptyContacts}</div>
                        <div>${msg}</div>
                    </div>
                </td></tr>`;
            return;
        }
        tbody.innerHTML = '';
        const frag = document.createDocumentFragment();
        contacts.forEach((contact, i) => {
            const id = String(contact._id);
            const isSelected = selectedIds.has(id);
            const tr = document.createElement('tr');
            tr.style.animationDelay = `${Math.min(i * 24, 320)}ms`;
            if (isSelected) tr.classList.add('row-selected');
            const cells = COLUMNS.map((col) => `<td>${cellHtml(col, contact)}</td>`).join('');
            tr.innerHTML = `
                <td class="col-check">
                    <label class="row-check-label">
                        <input type="checkbox" class="row-check" data-row-id="${id}" ${isSelected ? 'checked' : ''}>
                        <span class="row-check-box"></span>
                    </label>
                </td>
                ${cells}
                <td class="col-actions">
                    <div class="actions">
                        <button class="action-link" data-action="delete" data-id="${id}">Delete</button>
                    </div>
                </td>`;
            frag.appendChild(tr);
        });
        tbody.appendChild(frag);
    }

    function renderSkeleton(rows = 8) {
        const widths = [16, 70, 70, 80, 60, 50, 30];
        let html = '';
        for (let i = 0; i < rows; i++) {
            html += `<tr class="skeleton-row" style="animation-delay:${i * 40}ms">${
                widths.map((w) => `<td><div class="skel-pill" style="width:${w}%"></div></td>`).join('')
            }</tr>`;
        }
        tbody.innerHTML = html;
    }

    // ============== Pagination ==============
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

    function renderPagination() {
        const totalPages = Math.max(1, Math.ceil(totalContacts / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        if (totalContacts === 0) {
            paginationEl.hidden = true;
            paginationEl.innerHTML = '';
            return;
        }
        paginationEl.hidden = false;
        const startNum = (currentPage - 1) * PAGE_SIZE + 1;
        const endNum = Math.min(currentPage * PAGE_SIZE, totalContacts);
        const pages = buildPageList(currentPage, totalPages);
        const pageBtns = pages.map((p) => {
            if (p === '...') return '<span class="page-dots">…</span>';
            const cls = p === currentPage ? ' active' : '';
            return `<button class="page-btn${cls}" data-page="${p}">${p}</button>`;
        }).join('');
        paginationEl.innerHTML = `
            <div class="pagination-info">Showing ${startNum}–${endNum} of ${totalContacts}</div>
            <div class="pagination-controls">
                <button class="page-btn" data-action="prev" ${currentPage <= 1 ? 'disabled' : ''} aria-label="Previous">‹</button>
                ${pageBtns}
                <button class="page-btn" data-action="next" ${currentPage >= totalPages ? 'disabled' : ''} aria-label="Next">›</button>
            </div>`;
    }

    paginationEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.page-btn');
        if (!btn || btn.disabled) return;
        const totalPages = Math.max(1, Math.ceil(totalContacts / PAGE_SIZE));
        const action = btn.dataset.action;
        if (action === 'prev') { if (currentPage <= 1) return; currentPage--; }
        else if (action === 'next') { if (currentPage >= totalPages) return; currentPage++; }
        else if (btn.dataset.page) {
            const n = Number(btn.dataset.page);
            if (n === currentPage) return;
            currentPage = n;
        } else return;
        loadContacts();
    });

    // ============== Load ==============
    async function loadContacts() {
        const seq = ++loadSeq;
        tbody.style.opacity = currentContacts.length ? '0.55' : '1';
        try {
            const res = await fetch('/api/contacts/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({
                    limit: PAGE_SIZE,
                    skip: (currentPage - 1) * PAGE_SIZE,
                    search: searchQuery || undefined,
                    filters: filterState,
                    sort: sortState ? [sortState] : [],
                }),
            });
            if (res.status === 401) { window.location.replace('/login'); return; }
            const data = await res.json();
            if (seq !== loadSeq) return;

            if (data.total > 0 && (data.items || []).length === 0 && currentPage > 1) {
                currentPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
                return loadContacts();
            }

            currentContacts = data.items || [];
            totalContacts = data.total || 0;
            dataCount.textContent = `${totalContacts} total`;
            renderRows(currentContacts);
            renderPagination();
            updateSelectAllUi();
            if (window.updateSidebarBadge) window.updateSidebarBadge('contacts', totalContacts);
        } catch (e) {
            console.error(e);
            showToast('error', 'Could not load contacts.');
        } finally {
            if (seq === loadSeq) tbody.style.opacity = '1';
        }
    }

    // ============== Top search ==============
    let searchDebounce;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchEl.classList.add('loading');
        searchDebounce = setTimeout(async () => {
            const next = searchInput.value.trim();
            if (next === searchQuery) { searchEl.classList.remove('loading'); return; }
            searchQuery = next;
            currentPage = 1;
            try { await loadContacts(); }
            finally { searchEl.classList.remove('loading'); }
        }, 250);
    });

    // ============== Selection ==============
    tbody.addEventListener('change', (e) => {
        const checkbox = e.target.closest('.row-check');
        if (!checkbox) return;
        const id = checkbox.dataset.rowId;
        if (!id) return;
        if (checkbox.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        const tr = checkbox.closest('tr');
        if (tr) tr.classList.toggle('row-selected', checkbox.checked);
        updateSelectAllUi();
    });

    theadRow.addEventListener('change', (e) => {
        if (e.target.id !== 'select-all-check') return;
        const checked = e.target.checked;
        currentContacts.forEach((row) => {
            const id = String(row._id);
            if (checked) selectedIds.add(id);
            else selectedIds.delete(id);
        });
        document.querySelectorAll('.row-check').forEach((cb) => {
            const id = cb.dataset.rowId;
            cb.checked = selectedIds.has(id);
            const tr = cb.closest('tr');
            if (tr) tr.classList.toggle('row-selected', cb.checked);
        });
        updateSelectAllUi();
    });

    function updateSelectAllUi() {
        const headCheck = document.getElementById('select-all-check');
        const headLabel = document.getElementById('head-check-label');
        if (!headCheck || !headLabel) return;
        const visibleIds = currentContacts.map((r) => String(r._id));
        const visibleSelected = visibleIds.filter((id) => selectedIds.has(id));
        if (visibleIds.length === 0 || visibleSelected.length === 0) {
            headCheck.checked = false;
            headLabel.classList.remove('indeterminate');
        } else if (visibleSelected.length === visibleIds.length) {
            headCheck.checked = true;
            headLabel.classList.remove('indeterminate');
        } else {
            headCheck.checked = false;
            headLabel.classList.add('indeterminate');
        }
        updateExportSelectedState();
    }

    // ============== Filter popover ==============
    let popoverCtx = null;
    let distinctReqSeq = 0;

    theadRow.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        e.stopPropagation();
        const colKey = btn.dataset.filterCol;
        const col = COLUMNS.find((c) => c.key === colKey);
        if (!col || !col.filter) return;
        if (popoverCtx && popoverCtx.col === col) { closePopover(); return; }
        openPopover(col, btn);
    });

    function openPopover(col, anchorEl) {
        const field = filterField(col);
        const existingFilter = filterState[field] ? { ...filterState[field] } : null;
        const existingSort = sortState && sortState.key === field ? { ...sortState } : null;
        popoverCtx = {
            col, field, anchorEl,
            draftFilter: existingFilter,
            draftSort: existingSort,
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
        if (left + popoverWidth > window.innerWidth - margin) {
            left = window.innerWidth - popoverWidth - margin;
        }
        if (left < margin) left = margin;
        const spaceBelow = window.innerHeight - rect.bottom - margin - 6;
        const spaceAbove = rect.top - margin - 6;
        let top;
        let availableHeight;
        if (spaceBelow >= spaceAbove || spaceBelow >= 280) {
            top = rect.bottom + 6;
            availableHeight = spaceBelow;
        } else {
            availableHeight = spaceAbove;
            top = rect.top - 6;
        }
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
        const { col } = popoverCtx;
        popoverEl.innerHTML = `
            <div class="filter-popover-header">${escapeHtml(col.label)}</div>
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
                <button class="filter-sort-btn${dir === 'asc' ? ' active' : ''}" data-action="sort" data-dir="asc">
                    ${ICONS.sortAsc}<span>Sort A to Z</span>
                </button>
                <button class="filter-sort-btn${dir === 'desc' ? ' active' : ''}" data-action="sort" data-dir="desc">
                    ${ICONS.sortDesc}<span>Sort Z to A</span>
                </button>
            </div>`;
    }

    function renderListFilter() {
        const draft = popoverCtx.draftFilter;
        const isUnfilteredDefault = !draft;
        const selected = Array.isArray(draft && draft.value) ? draft.value : [];
        const selectedSet = new Set(selected.map(String));

        let optionsHtml;
        if (popoverCtx.distinctLoading) {
            optionsHtml = '<div class="filter-loading">Loading values…</div>';
        } else if (!popoverCtx.distinctValues.length) {
            optionsHtml = '<div class="filter-empty">No values found</div>';
        } else {
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
                    <span class="filter-search-icon">${ICONS.search}</span>
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
                        if (popoverCtx.draftSort && popoverCtx.draftSort.dir === dir) {
                            popoverCtx.draftSort = null;
                        } else {
                            popoverCtx.draftSort = { key: popoverCtx.field, dir };
                        }
                        renderPopover();
                    });
                    break;
                case 'search':
                    el.addEventListener('input', debounce(() => {
                        popoverCtx.searchTerm = el.value;
                        loadDistinct();
                    }, 200));
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
                default:
                    break;
            }
        });
        popoverEl.addEventListener('click', stopProp, { once: true });
    }

    function stopProp(e) {
        e.stopPropagation();
        popoverEl.addEventListener('click', stopProp, { once: true });
    }

    function applyAndClose() {
        if (!popoverCtx) return;
        const { field, draftFilter, draftSort } = popoverCtx;
        if (draftFilter && hasFilterValue(draftFilter)) filterState[field] = draftFilter;
        else delete filterState[field];
        if (draftSort) sortState = draftSort;
        else if (sortState && sortState.key === field) sortState = null;
        currentPage = 1;
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
    window.addEventListener('resize', () => {
        if (!popoverEl.hidden && popoverCtx) positionPopover(popoverCtx.anchorEl);
    });
    tableWrap.addEventListener('scroll', () => {
        if (!popoverEl.hidden && popoverCtx) positionPopover(popoverCtx.anchorEl);
    });

    // ============== Export ==============
    const exportBtn = document.getElementById('export-btn');
    const exportMenu = document.getElementById('export-menu');
    const exportSelectedBtn = document.getElementById('export-selected-btn');
    const exportCountEl = document.getElementById('export-count');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    const bulkDeleteCount = document.getElementById('bulk-delete-count');

    function updateExportSelectedState() {
        const n = selectedIds.size;
        exportSelectedBtn.disabled = n === 0;
        if (n > 0) { exportCountEl.hidden = false; exportCountEl.textContent = `(${n})`; }
        else exportCountEl.hidden = true;
        // Bulk delete button mirrors the selection.
        if (bulkDeleteBtn) {
            bulkDeleteBtn.hidden = n === 0;
            bulkDeleteCount.textContent = n > 0 ? `(${n})` : '';
        }
    }

    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = exportMenu.hidden;
        exportMenu.hidden = !open;
        exportBtn.classList.toggle('open', open);
    });

    document.addEventListener('click', (e) => {
        if (exportMenu.hidden) return;
        if (exportBtn.contains(e.target) || exportMenu.contains(e.target)) return;
        exportMenu.hidden = true;
        exportBtn.classList.remove('open');
    });

    exportMenu.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn || btn.disabled) return;
        exportMenu.hidden = true;
        exportBtn.classList.remove('open');
        const action = btn.dataset.action;
        if (action === 'export-all') {
            await downloadExport({
                filters: filterState,
                sort: sortState ? [sortState] : [],
                search: searchQuery || undefined,
            }, 'Exporting all contacts…');
        } else if (action === 'export-selected') {
            const ids = Array.from(selectedIds);
            if (ids.length === 0) return;
            await downloadExport({ ids }, `Exporting ${ids.length} contact${ids.length === 1 ? '' : 's'}…`);
        }
    });

    async function downloadExport(body, loadingLabel) {
        const originalHtml = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = `<span class="btn-mini-spinner"></span>${escapeHtml(loadingLabel || 'Exporting…')}`;
        try {
            const res = await fetch('/api/contacts/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Export failed');
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const filename = `contacts-${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('success', `Exported ${filename}`);
        } catch (err) {
            console.error(err);
            showToast('error', err.message || 'Could not export contacts.');
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalHtml;
        }
    }

    // ============== Modal helpers ==============
    function openModal(el) {
        el.hidden = false;
        // eslint-disable-next-line no-unused-expressions
        el.offsetHeight;
        el.classList.add('visible');
        document.body.style.overflow = 'hidden';
        const firstField = el.querySelector('input:not([type=file])');
        if (firstField) setTimeout(() => firstField.focus(), 80);
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

    // ============== Add contact ==============
    const addBtn = document.getElementById('add-contact-btn');
    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-form');
    const addSubmit = document.getElementById('add-submit');
    const addError = document.getElementById('add-error');

    addBtn.addEventListener('click', () => openModal(addModal));
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
        if (!body.email) {
            addError.textContent = 'Email is required.';
            addError.hidden = false;
            return;
        }
        setButtonLoading(addSubmit, true, 'Creating…');
        try {
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                addError.textContent = data.error || 'Could not add contact.';
                addError.hidden = false;
                return;
            }
            closeModal(addModal);
            const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || data.email;
            showToast('success', `${name} added.`);
            currentPage = 1;
            await loadContacts();
        } catch (err) {
            console.error(err);
            addError.textContent = 'Network error. Please try again.';
            addError.hidden = false;
        } finally {
            setButtonLoading(addSubmit, false);
        }
    });

    // ============== Delete ==============
    const deleteModal = document.getElementById('delete-modal');
    const deleteSubmit = document.getElementById('delete-submit');
    const deleteName = document.getElementById('delete-name');
    const deleteError = document.getElementById('delete-error');
    let deleteTargetId = null;

    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="delete"]');
        if (!btn) return;
        const id = btn.dataset.id;
        const contact = currentContacts.find((c) => String(c._id) === String(id));
        if (!contact) return;
        deleteTargetId = id;
        const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || contact.email || 'this contact';
        deleteName.textContent = name;
        deleteError.hidden = true;
        openModal(deleteModal);
    });

    deleteModal.querySelectorAll('[data-close="delete"]').forEach((el) => el.addEventListener('click', () => closeModal(deleteModal)));
    deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) closeModal(deleteModal); });

    deleteSubmit.addEventListener('click', async () => {
        if (!deleteTargetId) return;
        deleteError.hidden = true;
        setButtonLoading(deleteSubmit, true, 'Deleting…');
        try {
            const res = await fetch(`/api/contacts/${deleteTargetId}`, { method: 'DELETE', headers: authHeaders() });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                deleteError.textContent = data.error || 'Could not delete contact.';
                deleteError.hidden = false;
                return;
            }
            selectedIds.delete(String(deleteTargetId));
            closeModal(deleteModal);
            showToast('success', 'Contact deleted.');
            await loadContacts();
        } catch (err) {
            console.error(err);
            deleteError.textContent = 'Network error. Please try again.';
            deleteError.hidden = false;
        } finally {
            setButtonLoading(deleteSubmit, false);
            deleteTargetId = null;
        }
    });

    // ============== Bulk delete (selected) ==============
    const bulkDeleteModal = document.getElementById('bulk-delete-modal');
    const bulkDeleteSubmit = document.getElementById('bulk-delete-submit');
    const bulkDeleteName = document.getElementById('bulk-delete-name');
    const bulkDeleteError = document.getElementById('bulk-delete-error');

    bulkDeleteBtn.addEventListener('click', () => {
        const n = selectedIds.size;
        if (n === 0) return;
        bulkDeleteName.textContent = `${n} contact${n === 1 ? '' : 's'}`;
        bulkDeleteError.hidden = true;
        openModal(bulkDeleteModal);
    });

    bulkDeleteModal.querySelectorAll('[data-close="bulk-delete"]').forEach((el) => el.addEventListener('click', () => closeModal(bulkDeleteModal)));
    bulkDeleteModal.addEventListener('click', (e) => { if (e.target === bulkDeleteModal) closeModal(bulkDeleteModal); });

    bulkDeleteSubmit.addEventListener('click', async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        bulkDeleteError.hidden = true;
        setButtonLoading(bulkDeleteSubmit, true, 'Deleting…');
        try {
            const res = await fetch('/api/contacts/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ ids }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                bulkDeleteError.textContent = data.error || 'Could not delete contacts.';
                bulkDeleteError.hidden = false;
                return;
            }
            selectedIds.clear();
            closeModal(bulkDeleteModal);
            const d = data.deleted || ids.length;
            showToast('success', `${d} contact${d === 1 ? '' : 's'} deleted.`);
            currentPage = 1;
            await loadContacts();
        } catch (err) {
            console.error(err);
            bulkDeleteError.textContent = 'Network error. Please try again.';
            bulkDeleteError.hidden = false;
        } finally {
            setButtonLoading(bulkDeleteSubmit, false);
        }
    });

    // ============== Bulk upload ==============
    const bulkBtn = document.getElementById('bulk-upload-btn');
    const bulkModal = document.getElementById('bulk-modal');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');

    const modalBackdrop = document.getElementById('upload-modal');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalSubtitle = document.getElementById('modal-subtitle');
    const modalProgressBar = document.getElementById('modal-progress-bar');
    const modalProgressText = document.getElementById('modal-progress-text');
    const modalErrors = document.getElementById('modal-errors');
    const modalErrorsTitle = document.getElementById('modal-errors-title');
    const modalErrorsList = document.getElementById('modal-errors-list');
    const modalActions = document.getElementById('modal-actions');
    const modalClose = document.getElementById('modal-close');

    const templateBtn = document.getElementById('download-template-btn');
    const templateSpinner = document.getElementById('template-spinner');

    bulkBtn.addEventListener('click', () => openModal(bulkModal));
    bulkModal.querySelectorAll('[data-close="bulk"]').forEach((el) => el.addEventListener('click', () => closeModal(bulkModal)));
    bulkModal.addEventListener('click', (e) => { if (e.target === bulkModal) closeModal(bulkModal); });

    // Download a starter .xlsx with the expected columns + an example row.
    templateBtn.addEventListener('click', async () => {
        templateBtn.disabled = true;
        templateSpinner.hidden = false;
        try {
            const res = await fetch('/api/contacts/template', { headers: authHeaders() });
            if (!res.ok) throw new Error('Could not download template');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'contacts-template.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('success', 'Template downloaded.');
        } catch (err) {
            console.error(err);
            showToast('error', err.message || 'Could not download template.');
        } finally {
            templateBtn.disabled = false;
            templateSpinner.hidden = true;
        }
    });

    dropzone.addEventListener('click', () => fileInput.click());
    ['dragenter', 'dragover'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault(); e.stopPropagation();
            if (evt === 'dragleave' && dropzone.contains(e.relatedTarget)) return;
            dropzone.classList.remove('drag-over');
        });
    });
    dropzone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length) startBulkFlow(files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) startBulkFlow(files[0]);
        fileInput.value = '';
    });

    // Light client-side validation: the sheet must have a recognizable email column.
    async function validateHeaders(file) {
        if (typeof XLSX === 'undefined') return { ok: true }; // skip if parser unavailable
        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            const headers = (aoa[0] || []).map((h) => String(h || '').trim().toLowerCase());
            const hasEmail = headers.some((h) => h === 'email' || h === 'email address');
            return { ok: hasEmail, hasEmail };
        } catch (e) {
            return { ok: false, error: 'Could not read this file as a spreadsheet.' };
        }
    }

    async function startBulkFlow(file) {
        const check = await validateHeaders(file);
        if (!check.ok) {
            showToast('error', check.error || 'Your file needs an "Email" column.');
            return;
        }
        closeModal(bulkModal);
        setTimeout(() => {
            openUploadModal();
            modalTitle.textContent = 'Uploading file';
            modalSubtitle.textContent = file.name;
            setModalState('uploading');
            uploadWithProgress(file, (pct) => setProgress(pct))
                .then((result) => onBulkDone(result))
                .catch((e) => {
                    console.error(e);
                    setModalState('error');
                    modalTitle.textContent = 'Something went wrong';
                    modalSubtitle.textContent = e.message || 'Upload failed.';
                    modalActions.hidden = false;
                });
        }, 300);
    }

    function uploadWithProgress(file, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const form = new FormData();
            form.append('file', file);
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
            });
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { resolve(JSON.parse(xhr.responseText)); }
                    catch (e) { reject(new Error('Invalid server response')); }
                } else {
                    let msg = 'Upload failed.';
                    try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
                    reject(new Error(msg));
                }
            });
            xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
            xhr.open('POST', '/api/contacts/bulk');
            xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
            xhr.send(form);
        });
    }

    async function onBulkDone(result) {
        setProgress(100);
        const inserted = result.rows_inserted || 0;
        const failed = result.rows_failed || 0;
        const total = result.rows_total || 0;
        setModalState('success');
        if (failed === 0) {
            modalTitle.textContent = 'All done!';
            modalSubtitle.textContent = `${inserted} contact${inserted === 1 ? '' : 's'} imported successfully.`;
            modalActions.hidden = true;
            setTimeout(() => { closeUploadModal(); }, 1600);
        } else {
            modalTitle.textContent = 'Done with errors';
            modalSubtitle.textContent = `${inserted} of ${total} contacts imported. ${failed} row${failed === 1 ? '' : 's'} skipped.`;
            modalErrorsTitle.textContent = `Skipped rows (${failed})`;
            modalErrorsList.innerHTML = (result.errors || [])
                .map((e) => `<li><strong>Row ${e.row}:</strong>${escapeHtml(e.message || '')}</li>`)
                .join('');
            modalErrors.hidden = (result.errors || []).length === 0;
            modalActions.hidden = false;
        }
        currentPage = 1;
        await loadContacts();
    }

    // Upload modal state machine
    function openUploadModal() {
        resetUploadModal();
        modalBackdrop.hidden = false;
        // eslint-disable-next-line no-unused-expressions
        modalBackdrop.offsetHeight;
        modalBackdrop.classList.add('visible');
    }
    function closeUploadModal() {
        modalBackdrop.classList.remove('visible');
        setTimeout(() => { modalBackdrop.hidden = true; resetUploadModal(); }, 300);
    }
    function resetUploadModal() {
        modal.className = 'modal state-uploading';
        modalTitle.textContent = 'Uploading file';
        modalSubtitle.textContent = 'Preparing…';
        modalProgressBar.style.width = '0%';
        modalProgressText.textContent = '0%';
        modalErrors.hidden = true;
        modalErrorsList.innerHTML = '';
        modalActions.hidden = true;
    }
    function setModalState(state) { modal.className = `modal state-${state}`; }
    function setProgress(percent, label) {
        modalProgressBar.style.width = `${percent}%`;
        modalProgressText.textContent = label != null ? label : `${Math.round(percent)}%`;
    }
    modalClose.addEventListener('click', closeUploadModal);
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop && !modalActions.hidden) closeUploadModal();
    });

    // ============== Esc closes modals ==============
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        [addModal, bulkModal, deleteModal, bulkDeleteModal].forEach((m) => { if (!m.hidden) closeModal(m); });
    });

    // ============== Init ==============
    renderHead();
    renderSkeleton(8);
    loadContacts();
})();
