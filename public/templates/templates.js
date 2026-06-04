(() => {
    // ============== Icons ==============
    const ICONS = {
        check: '<svg viewBox="0 0 16 16"><path d="M3 8L7 12L13 5"/></svg>',
        cross: '<svg viewBox="0 0 16 16"><path d="M4 4L12 12M12 4L4 12"/></svg>',
        empty: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 4v5"/></svg>',
    };
    const MAX_CHIPS = 4;

    // ============== DOM ==============
    const tbody = document.getElementById('data-tbody');
    const paginationEl = document.getElementById('data-pagination');
    const dataCount = document.getElementById('data-count');
    const searchEl = document.getElementById('search');
    const searchInput = document.getElementById('search-input');
    const toastEl = document.getElementById('toast');

    // ============== Auth ==============
    function getToken() {
        return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    }
    function authHeaders() {
        return { Authorization: `Bearer ${getToken()}` };
    }

    // ============== State ==============
    const PAGE_SIZE = 25;
    let currentTemplates = [];
    let totalTemplates = 0;
    let currentPage = 1;
    let searchQuery = '';
    let loadSeq = 0;

    // ============== Helpers ==============
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[ch]));
    }

    function formatDate(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}/${m}/${day}`;
    }

    function formatBytes(bytes) {
        if (!bytes && bytes !== 0) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

    // ============== Render ==============
    function fieldChipsHtml(fields) {
        if (!fields || !fields.length) return '<span class="field-chips-empty">No fields</span>';
        const shown = fields.slice(0, MAX_CHIPS)
            .map((f) => `<span class="field-chip">[[${escapeHtml(f)}]]</span>`)
            .join('');
        const extra = fields.length - MAX_CHIPS;
        const more = extra > 0 ? `<span class="field-chip more">+${extra} more</span>` : '';
        return `<div class="field-chips">${shown}${more}</div>`;
    }

    function renderRows(templates) {
        if (!templates.length) {
            const msg = searchQuery
                ? 'No templates match your search.'
                : 'No templates yet. Upload an HTML email template to get started.';
            tbody.innerHTML = `
                <tr><td colspan="4">
                    <div class="data-empty">
                        <div class="empty-icon">${ICONS.empty}</div>
                        <div>${msg}</div>
                    </div>
                </td></tr>`;
            return;
        }
        tbody.innerHTML = '';
        const frag = document.createDocumentFragment();
        templates.forEach((t, i) => {
            const tr = document.createElement('tr');
            tr.style.animationDelay = `${Math.min(i * 28, 320)}ms`;
            const sub = t.source_name ? `<div class="cell-name-sub">${escapeHtml(t.source_name)}</div>` : '';
            tr.innerHTML = `
                <td>
                    <div class="cell-name">${escapeHtml(t.name)}</div>
                    ${sub}
                </td>
                <td>${fieldChipsHtml(t.fields)}</td>
                <td><span class="cell-date">${escapeHtml(formatDate(t.created_at))}</span></td>
                <td class="col-actions">
                    <div class="actions">
                        <button class="action-link view" data-action="view" data-id="${t._id}">View</button>
                        <button class="action-link danger" data-action="delete" data-id="${t._id}">Delete</button>
                    </div>
                </td>`;
            frag.appendChild(tr);
        });
        tbody.appendChild(frag);
    }

    function renderSkeleton(rows = 6) {
        const widths = [60, 80, 40, 40];
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
        const totalPages = Math.max(1, Math.ceil(totalTemplates / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        if (totalTemplates === 0) {
            paginationEl.hidden = true;
            paginationEl.innerHTML = '';
            return;
        }
        paginationEl.hidden = false;
        const startNum = (currentPage - 1) * PAGE_SIZE + 1;
        const endNum = Math.min(currentPage * PAGE_SIZE, totalTemplates);
        const pages = buildPageList(currentPage, totalPages);
        const pageBtns = pages.map((p) => {
            if (p === '...') return '<span class="page-dots">…</span>';
            const cls = p === currentPage ? ' active' : '';
            return `<button class="page-btn${cls}" data-page="${p}">${p}</button>`;
        }).join('');
        paginationEl.innerHTML = `
            <div class="pagination-info">Showing ${startNum}–${endNum} of ${totalTemplates}</div>
            <div class="pagination-controls">
                <button class="page-btn" data-action="prev" ${currentPage <= 1 ? 'disabled' : ''} aria-label="Previous">‹</button>
                ${pageBtns}
                <button class="page-btn" data-action="next" ${currentPage >= totalPages ? 'disabled' : ''} aria-label="Next">›</button>
            </div>`;
    }

    paginationEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.page-btn');
        if (!btn || btn.disabled) return;
        const totalPages = Math.max(1, Math.ceil(totalTemplates / PAGE_SIZE));
        const action = btn.dataset.action;
        if (action === 'prev') { if (currentPage <= 1) return; currentPage--; }
        else if (action === 'next') { if (currentPage >= totalPages) return; currentPage++; }
        else if (btn.dataset.page) {
            const n = Number(btn.dataset.page);
            if (n === currentPage) return;
            currentPage = n;
        } else return;
        loadTemplates();
    });

    // ============== Load ==============
    async function loadTemplates() {
        const seq = ++loadSeq;
        tbody.style.opacity = currentTemplates.length ? '0.55' : '1';
        try {
            const res = await fetch('/api/templates/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({
                    limit: PAGE_SIZE,
                    skip: (currentPage - 1) * PAGE_SIZE,
                    search: searchQuery || undefined,
                }),
            });
            if (res.status === 401) { window.location.replace('/login'); return; }
            const data = await res.json();
            if (seq !== loadSeq) return;

            if (data.total > 0 && (data.items || []).length === 0 && currentPage > 1) {
                currentPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
                return loadTemplates();
            }

            currentTemplates = data.items || [];
            totalTemplates = data.total || 0;
            dataCount.textContent = `${totalTemplates} total`;
            renderRows(currentTemplates);
            renderPagination();
            if (window.updateSidebarBadge) window.updateSidebarBadge('templates', totalTemplates);
        } catch (e) {
            console.error(e);
            showToast('error', 'Could not load templates.');
        } finally {
            if (seq === loadSeq) tbody.style.opacity = '1';
        }
    }

    // ============== Search ==============
    let searchDebounce;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchEl.classList.add('loading');
        searchDebounce = setTimeout(async () => {
            const next = searchInput.value.trim();
            if (next === searchQuery) { searchEl.classList.remove('loading'); return; }
            searchQuery = next;
            currentPage = 1;
            try { await loadTemplates(); }
            finally { searchEl.classList.remove('loading'); }
        }, 250);
    });

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
        setTimeout(() => { el.hidden = true; }, 280);
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

    // ============== Upload ==============
    const uploadBtn = document.getElementById('upload-template-btn');
    const uploadModal = document.getElementById('upload-modal');
    const uploadForm = document.getElementById('upload-form');
    const uploadSubmit = document.getElementById('upload-submit');
    const uploadError = document.getElementById('upload-error');
    const nameInput = document.getElementById('template-name');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const selectedFile = document.getElementById('selected-file');
    const selectedFileName = document.getElementById('selected-file-name');
    const selectedFileSize = document.getElementById('selected-file-size');
    const selectedFileRemove = document.getElementById('selected-file-remove');

    let pendingFile = null;

    function resetUpload() {
        pendingFile = null;
        uploadForm.reset();
        fileInput.value = '';
        selectedFile.hidden = true;
        dropzone.hidden = false;
        uploadError.hidden = true;
    }

    function setPendingFile(file) {
        pendingFile = file;
        selectedFileName.textContent = file.name;
        selectedFileSize.textContent = formatBytes(file.size);
        selectedFile.hidden = false;
        dropzone.hidden = true;
        if (!nameInput.value.trim()) {
            nameInput.value = file.name.replace(/\.[^.]+$/, '');
        }
        uploadError.hidden = true;
    }

    uploadBtn.addEventListener('click', () => { resetUpload(); openModal(uploadModal); setTimeout(() => nameInput.focus(), 80); });
    uploadModal.querySelectorAll('[data-close="upload"]').forEach((el) => el.addEventListener('click', () => closeModal(uploadModal)));
    uploadModal.addEventListener('click', (e) => { if (e.target === uploadModal) closeModal(uploadModal); });

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
        if (files.length) setPendingFile(files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) setPendingFile(files[0]);
    });
    selectedFileRemove.addEventListener('click', () => {
        pendingFile = null;
        fileInput.value = '';
        selectedFile.hidden = true;
        dropzone.hidden = false;
    });

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        uploadError.hidden = true;
        if (!pendingFile) {
            uploadError.textContent = 'Please choose an HTML file to upload.';
            uploadError.hidden = false;
            return;
        }
        const form = new FormData();
        form.append('file', pendingFile);
        const name = nameInput.value.trim();
        if (name) form.append('name', name);

        setButtonLoading(uploadSubmit, true, 'Uploading…');
        try {
            const res = await fetch('/api/templates/upload', {
                method: 'POST',
                headers: authHeaders(),
                body: form,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                uploadError.textContent = data.error || 'Could not upload template.';
                uploadError.hidden = false;
                return;
            }
            closeModal(uploadModal);
            const n = (data.fields || []).length;
            showToast('success', `"${data.name}" uploaded — ${n} field${n === 1 ? '' : 's'} detected.`);
            currentPage = 1;
            await loadTemplates();
        } catch (err) {
            console.error(err);
            uploadError.textContent = 'Network error. Please try again.';
            uploadError.hidden = false;
        } finally {
            setButtonLoading(uploadSubmit, false);
        }
    });

    // ============== Code editor utilities ==============
    const CONTACT_FIELDS = [
        { label: 'First name', token: '[[first_name]]' },
        { label: 'Last name', token: '[[last_name]]' },
        { label: 'Email', token: '[[email]]' },
        { label: 'Hotel name', token: '[[hotel_name]]' },
        { label: 'Portfolio', token: '[[portfolio]]' },
    ];

    function hlEscape(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Highlight [[token]] placeholders inside already-escaped text.
    function hlFields(escaped) {
        return escaped.replace(/\[\[[^\][]+?\]\]/g, (m) => `<span class="tok-field">${m}</span>`);
    }

    function hlTag(tag) {
        const m = tag.match(/^(<\/?)([a-zA-Z][\w-]*)?([\s\S]*?)(\/?>)$/);
        if (!m) return hlFields(hlEscape(tag));
        const open = m[1];
        const name = m[2] || '';
        const attrs = m[3] || '';
        const close = m[4];
        let inner = name ? `<span class="tok-tag">${hlEscape(name)}</span>` : '';
        inner += attrs.replace(
            /([a-zA-Z_:][\w:.-]*)(\s*=\s*)("(?:[^"]*)"|'(?:[^']*)')|([a-zA-Z_:][\w:.-]*)/g,
            (full, an, eq, val, lone) => {
                if (an) return `<span class="tok-attr">${hlEscape(an)}</span>${hlEscape(eq)}<span class="tok-string">${hlFields(hlEscape(val))}</span>`;
                if (lone) return `<span class="tok-attr">${hlEscape(lone)}</span>`;
                return hlEscape(full);
            }
        );
        return `<span class="tok-punct">${hlEscape(open)}</span>${inner}<span class="tok-punct">${hlEscape(close)}</span>`;
    }

    // Lightweight HTML highlighter — comments, tags (name/attrs/strings), [[fields]].
    function highlightHtml(code) {
        let out = '';
        let i = 0;
        const n = code.length;
        while (i < n) {
            if (code.startsWith('<!--', i)) {
                const end = code.indexOf('-->', i + 4);
                const stop = end === -1 ? n : end + 3;
                out += `<span class="tok-comment">${hlEscape(code.slice(i, stop))}</span>`;
                i = stop;
                continue;
            }
            if (code[i] === '<') {
                const end = code.indexOf('>', i);
                const stop = end === -1 ? n : end + 1;
                out += hlTag(code.slice(i, stop));
                i = stop;
                continue;
            }
            let next = code.indexOf('<', i);
            if (next === -1) next = n;
            out += hlFields(hlEscape(code.slice(i, next)));
            i = next;
        }
        return out;
    }

    function insertAtCursor(ta, text) {
        const start = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
        const end = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
        ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
        const pos = start + text.length;
        ta.selectionStart = ta.selectionEnd = pos;
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Wire a textarea + highlight <pre> overlay so the editor is syntax-coloured.
    function setupCodeEditor(shell) {
        const ta = shell.querySelector('textarea');
        const pre = shell.querySelector('.code-highlight');
        const codeEl = pre.querySelector('code');
        function render() {
            codeEl.innerHTML = highlightHtml(ta.value) + '\n';
            pre.scrollTop = ta.scrollTop;
            pre.scrollLeft = ta.scrollLeft;
        }
        ta.addEventListener('input', render);
        ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
        ta.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') { e.preventDefault(); insertAtCursor(ta, '  '); }
        });
        render();
        return { render, textarea: ta };
    }

    // Wire an "Insert field" dropdown that inserts [[token]] at the cursor.
    function setupInsertDropdown(wrap) {
        const ta = document.getElementById(wrap.dataset.insertFor);
        const btn = wrap.querySelector('[data-insert-toggle]');
        const menu = wrap.querySelector('.insert-field-menu');
        menu.innerHTML = CONTACT_FIELDS.map((f) =>
            `<button type="button" data-token="${f.token}"><span>${f.label}</span><code>${escapeHtml(f.token)}</code></button>`
        ).join('');
        btn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
        menu.addEventListener('click', (e) => {
            const b = e.target.closest('[data-token]');
            if (!b) return;
            insertAtCursor(ta, b.dataset.token);
            menu.hidden = true;
        });
        document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) menu.hidden = true; });
    }

    // ============== View / Edit ==============
    const viewModal = document.getElementById('view-modal');
    const viewName = document.getElementById('view-name');
    const viewMeta = document.getElementById('view-meta');
    const viewFields = document.getElementById('view-fields');
    const viewFieldsCount = document.getElementById('view-fields-count');
    const viewPreview = document.getElementById('view-preview');
    const viewModeToggle = document.getElementById('view-mode-toggle');
    const panePreview = document.getElementById('view-pane-preview');
    const paneEdit = document.getElementById('view-pane-edit');
    const editName = document.getElementById('edit-name');
    const editHtml = document.getElementById('edit-html');
    const editError = document.getElementById('edit-error');
    const editSave = document.getElementById('edit-save');
    const editCancel = document.getElementById('edit-cancel');

    let viewTemplate = null;

    const editEditor = setupCodeEditor(paneEdit.querySelector('.code-editor-shell'));
    setupInsertDropdown(paneEdit.querySelector('.insert-field-wrap'));

    // Client-side mirror of the server's [[token]] extraction (case-insensitive
    // dedupe, first-seen order) so detected fields update live as you type.
    function extractFieldsClient(html) {
        const out = [];
        const seen = new Set();
        const re = /\[\[([^[\]]+?)\]\]/g;
        let m;
        while ((m = re.exec(String(html))) !== null) {
            const f = m[1].trim();
            if (!f) continue;
            const key = f.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(f);
        }
        return out;
    }

    function renderFieldChips(fields) {
        viewFieldsCount.textContent = fields.length ? `(${fields.length})` : '';
        viewFields.innerHTML = fields.length
            ? fields.map((f) => `<span class="field-chip">[[${escapeHtml(f)}]]</span>`).join('')
            : '<span class="field-chips-empty">No fields detected</span>';
    }

    function setViewMode(mode) {
        const editing = mode === 'edit';
        panePreview.hidden = editing;
        paneEdit.hidden = !editing;
        viewModeToggle.querySelectorAll('.view-mode-btn').forEach((b) =>
            b.classList.toggle('active', b.dataset.mode === mode)
        );
        editError.hidden = true;
        if (editing) setTimeout(() => editHtml.focus(), 60);
    }

    viewModal.querySelectorAll('[data-close="view"]').forEach((el) => el.addEventListener('click', () => closeModal(viewModal)));
    viewModal.addEventListener('click', (e) => { if (e.target === viewModal) closeModal(viewModal); });

    viewModeToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.view-mode-btn');
        if (btn) setViewMode(btn.dataset.mode);
    });

    // Live field detection while editing the HTML.
    editHtml.addEventListener('input', () => {
        renderFieldChips(extractFieldsClient(editHtml.value));
    });

    editCancel.addEventListener('click', () => {
        if (!viewTemplate) return;
        editName.value = viewTemplate.name || '';
        editHtml.value = viewTemplate.html || '';
        renderFieldChips(viewTemplate.fields || []);
        setViewMode('preview');
    });

    function showView(t) {
        viewTemplate = t;
        viewName.textContent = t.name;
        const metaBits = [];
        if (t.source_name) metaBits.push(t.source_name);
        metaBits.push(`Uploaded ${formatDate(t.created_at)}`);
        if (t.updated_at && t.updated_at !== t.created_at) metaBits.push(`Edited ${formatDate(t.updated_at)}`);
        viewMeta.textContent = metaBits.join(' · ');
        renderFieldChips(t.fields || []);
        viewPreview.srcdoc = t.html || '';
        editName.value = t.name || '';
        editHtml.value = t.html || '';
        editEditor.render();
    }

    async function openView(id) {
        try {
            const res = await fetch(`/api/templates/${id}`, { headers: authHeaders() });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Could not load template');
            }
            const t = await res.json();
            showView(t);
            setViewMode('preview');
            openModal(viewModal);
        } catch (err) {
            console.error(err);
            showToast('error', err.message || 'Could not open template.');
        }
    }

    editSave.addEventListener('click', async () => {
        if (!viewTemplate) return;
        editError.hidden = true;
        const name = editName.value.trim();
        const html = editHtml.value;
        if (!name) { editError.textContent = 'Template name is required.'; editError.hidden = false; return; }
        if (!html.trim()) { editError.textContent = 'Template HTML cannot be empty.'; editError.hidden = false; return; }
        setButtonLoading(editSave, true, 'Saving…');
        try {
            const res = await fetch(`/api/templates/${viewTemplate._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ name, html }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { editError.textContent = data.error || 'Could not save template.'; editError.hidden = false; return; }
            showView(data);
            setViewMode('preview');
            const n = (data.fields || []).length;
            showToast('success', `Template saved — ${n} field${n === 1 ? '' : 's'} detected.`);
            await loadTemplates();
        } catch (err) {
            console.error(err);
            editError.textContent = 'Network error. Please try again.';
            editError.hidden = false;
        } finally {
            setButtonLoading(editSave, false);
        }
    });

    // ============== Create (paste raw HTML) ==============
    const createBtn = document.getElementById('create-template-btn');
    const createModal = document.getElementById('create-modal');
    const createForm = document.getElementById('create-form');
    const createName = document.getElementById('create-name');
    const createHtml = document.getElementById('create-html');
    const createError = document.getElementById('create-error');
    const createSubmit = document.getElementById('create-submit');
    const createDetected = document.getElementById('create-detected');

    const createEditor = setupCodeEditor(createModal.querySelector('.code-editor-shell'));
    setupInsertDropdown(createModal.querySelector('.insert-field-wrap'));

    function renderDetected(html) {
        const fields = extractFieldsClient(html);
        createDetected.innerHTML = fields.length
            ? '<span class="detected-label">Detected:</span>' +
              fields.map((f) => `<span class="field-chip">[[${escapeHtml(f)}]]</span>`).join('')
            : '<span class="detected-label">No [[fields]] yet — insert some above.</span>';
    }

    createHtml.addEventListener('input', () => renderDetected(createHtml.value));

    createBtn.addEventListener('click', () => {
        createForm.reset();
        createHtml.value = '';
        createEditor.render();
        renderDetected('');
        createError.hidden = true;
        openModal(createModal);
        setTimeout(() => createName.focus(), 80);
    });
    createModal.querySelectorAll('[data-close="create"]').forEach((el) => el.addEventListener('click', () => closeModal(createModal)));
    createModal.addEventListener('click', (e) => { if (e.target === createModal) closeModal(createModal); });

    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        createError.hidden = true;
        const name = createName.value.trim();
        const html = createHtml.value;
        if (!name) { createError.textContent = 'Template name is required.'; createError.hidden = false; return; }
        if (!html.trim()) { createError.textContent = 'Paste some HTML to create a template.'; createError.hidden = false; return; }
        setButtonLoading(createSubmit, true, 'Creating…');
        try {
            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ name, html }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { createError.textContent = data.error || 'Could not create template.'; createError.hidden = false; return; }
            closeModal(createModal);
            const n = (data.fields || []).length;
            showToast('success', `"${data.name}" created — ${n} field${n === 1 ? '' : 's'} detected.`);
            await loadTemplates();
        } catch (err) {
            console.error(err);
            createError.textContent = 'Network error. Please try again.';
            createError.hidden = false;
        } finally {
            setButtonLoading(createSubmit, false);
        }
    });

    // ============== Delete ==============
    const deleteModal = document.getElementById('delete-modal');
    const deleteSubmit = document.getElementById('delete-submit');
    const deleteName = document.getElementById('delete-name');
    const deleteError = document.getElementById('delete-error');
    let deleteTargetId = null;

    deleteModal.querySelectorAll('[data-close="delete"]').forEach((el) => el.addEventListener('click', () => closeModal(deleteModal)));
    deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) closeModal(deleteModal); });

    function openDelete(id) {
        const t = currentTemplates.find((x) => String(x._id) === String(id));
        if (!t) return;
        deleteTargetId = id;
        deleteName.textContent = t.name;
        deleteError.hidden = true;
        openModal(deleteModal);
    }

    deleteSubmit.addEventListener('click', async () => {
        if (!deleteTargetId) return;
        deleteError.hidden = true;
        setButtonLoading(deleteSubmit, true, 'Deleting…');
        try {
            const res = await fetch(`/api/templates/${deleteTargetId}`, { method: 'DELETE', headers: authHeaders() });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                deleteError.textContent = data.error || 'Could not delete template.';
                deleteError.hidden = false;
                return;
            }
            closeModal(deleteModal);
            showToast('success', 'Template deleted.');
            await loadTemplates();
        } catch (err) {
            console.error(err);
            deleteError.textContent = 'Network error. Please try again.';
            deleteError.hidden = false;
        } finally {
            setButtonLoading(deleteSubmit, false);
            deleteTargetId = null;
        }
    });

    // ============== Row action dispatch ==============
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'view') openView(id);
        else if (btn.dataset.action === 'delete') openDelete(id);
    });

    // ============== Esc closes modals ==============
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        [uploadModal, createModal, viewModal, deleteModal].forEach((m) => { if (!m.hidden) closeModal(m); });
    });

    // ============== Init ==============
    renderSkeleton(6);
    loadTemplates();
})();
