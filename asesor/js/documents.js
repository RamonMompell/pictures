/* =====================================================================
   ÁBACO — documents.js
   Libro de documentos: tabla, filtros, ficha de detalle, hilo con el
   asesor y control de numeración correlativa de facturas emitidas.
   ===================================================================== */

const Documents = {
    filters: { entity: '', direction: '', docType: '', status: '', period: '', q: '' },
    sort: { field: 'date', dir: 'desc' },

    /* ---------- Numeración correlativa ---------- */
    // Separa un número de factura en {prefix, num, pad}. Ej: "2024/014" -> {prefix:"2024/", num:14, pad:3}
    parseNumber(str) {
        if (!str) return null;
        const m = String(str).match(/^(.*?)(\d+)\s*$/);
        if (!m) return { prefix: String(str), num: null, pad: 0, raw: str };
        return { prefix: m[1], num: parseInt(m[2], 10), pad: m[2].length, raw: str };
    },

    issuedFor(entityId) {
        return Storage.getDocs()
            .filter(d => d.entityId === entityId && d.direction === 'emitida' && d.number)
            .map(d => ({ ...d, parsed: this.parseNumber(d.number) }))
            .filter(d => d.parsed && d.parsed.num != null);
    },

    nextNumber(entityId) {
        const issued = this.issuedFor(entityId);
        if (!issued.length) {
            const year = new Date().getFullYear();
            return `${year}/001`;
        }
        // Tomar la serie (prefix) más reciente
        issued.sort((a, b) => new Date(b.date) - new Date(a.date));
        const ref = issued[0].parsed;
        const sameSeries = issued.filter(d => d.parsed.prefix === ref.prefix);
        const max = Math.max(...sameSeries.map(d => d.parsed.num));
        const pad = ref.pad || 3;
        return `${ref.prefix}${String(max + 1).padStart(pad, '0')}`;
    },

    // Detecta huecos y duplicados por serie
    checkCorrelative(entityId) {
        const issued = this.issuedFor(entityId);
        const bySeries = {};
        issued.forEach(d => { (bySeries[d.parsed.prefix] ||= []).push(d.parsed.num); });
        const report = [];
        for (const [prefix, nums] of Object.entries(bySeries)) {
            nums.sort((a, b) => a - b);
            const gaps = [], dups = [];
            const seen = new Set();
            for (let n = nums[0]; n <= nums[nums.length - 1]; n++) {
                if (!nums.includes(n)) gaps.push(n);
            }
            nums.forEach(n => { if (seen.has(n)) dups.push(n); else seen.add(n); });
            report.push({ prefix, count: nums.length, min: nums[0], max: nums[nums.length - 1], gaps, dups });
        }
        return report;
    },

    /* ---------- Filtros y render ---------- */
    apply() {
        let docs = Storage.getDocs().slice();
        const f = this.filters;
        if (f.entity) docs = docs.filter(d => d.entityId === f.entity);
        if (f.direction) docs = docs.filter(d => d.direction === f.direction);
        if (f.docType) docs = docs.filter(d => d.docType === f.docType);
        if (f.status) docs = docs.filter(d => d.status === f.status);
        if (f.period) docs = docs.filter(d => (d.period?.key || Data.parsePeriod(d.date).key) === f.period);
        if (f.q) {
            const q = f.q.toLowerCase();
            docs = docs.filter(d =>
                (d.number || '').toLowerCase().includes(q) ||
                (d.counterparty || '').toLowerCase().includes(q) ||
                (d.taxId || '').toLowerCase().includes(q) ||
                (d.memo || '').toLowerCase().includes(q));
        }

        // Orden: si filtramos emitidas, por número correlativo; si no, por fecha desc
        if (f.direction === 'emitida') {
            docs.sort((a, b) => {
                const pa = this.parseNumber(a.number), pb = this.parseNumber(b.number);
                if (pa?.prefix !== pb?.prefix) return String(pa?.prefix).localeCompare(String(pb?.prefix));
                return (pa?.num || 0) - (pb?.num || 0);
            });
        } else {
            const dirMul = this.sort.dir === 'asc' ? 1 : -1;
            docs.sort((a, b) => {
                if (this.sort.field === 'total') return ((a.total || 0) - (b.total || 0)) * dirMul;
                return (new Date(a.date) - new Date(b.date)) * dirMul;
            });
        }
        return docs;
    },

    render() {
        this.populateFilters();
        // Reflejar los filtros activos en los controles (p.ej. al llegar desde Inicio)
        const sync = (id, v) => { const e = UI.el(id); if (e && e.value !== v) e.value = v; };
        sync('fltEntity', this.filters.entity); sync('fltDirection', this.filters.direction);
        sync('fltDocType', this.filters.docType); sync('fltStatus', this.filters.status);
        sync('fltPeriod', this.filters.period); sync('fltSearch', this.filters.q);
        const docs = this.apply();
        const tbody = UI.el('docsTableBody');
        const empty = UI.el('docsEmpty');
        const banner = UI.el('docsCorrelativeBanner');
        tbody.innerHTML = '';

        // Banner de control correlativo
        banner.innerHTML = '';
        if (this.filters.direction === 'emitida' && this.filters.entity) {
            const rep = this.checkCorrelative(this.filters.entity);
            const issues = rep.filter(r => r.gaps.length || r.dups.length);
            if (rep.length) {
                if (issues.length) {
                    const detail = issues.map(r => `Serie <b>${UI.escape(r.prefix || '—')}</b>: ${r.gaps.length ? 'faltan ' + r.gaps.join(', ') : ''}${r.dups.length ? ' · duplicados ' + r.dups.join(', ') : ''}`).join(' &nbsp;·&nbsp; ');
                    banner.innerHTML = `<div class="banner banner-warn"><b>Numeración con incidencias.</b> ${detail}</div>`;
                } else {
                    const r = rep[0];
                    banner.innerHTML = `<div class="banner banner-ok"><b>Numeración correlativa correcta.</b> Serie ${UI.escape(r.prefix || '—')}: ${r.count} facturas, del ${r.min} al ${r.max}, sin huecos.</div>`;
                }
            }
        }

        empty.style.display = docs.length ? 'none' : '';
        UI.el('docsCount').textContent = `${docs.length} documento${docs.length === 1 ? '' : 's'}`;

        docs.forEach(d => {
            const ent = Data.entityById(d.entityId);
            const dir = Data.DIRECTIONS[d.direction];
            const tr = UI.h('tr', { 'data-id': d.id, onclick: () => this.openDetail(d.id) });
            tr.innerHTML = `
                <td class="nowrap">${Data.fmtDate(d.date)}</td>
                <td><span class="ent-dot" style="--c:${ent?.accent || '#999'}"></span>${UI.escape(ent?.name || '—')}</td>
                <td><span class="tag tag-${d.direction}">${dir?.label || ''}</span></td>
                <td>${Data.DOC_TYPES[d.docType]?.label || '—'}</td>
                <td class="mono">${UI.escape(d.number || '—')}</td>
                <td>${UI.escape(d.counterparty || '—')}</td>
                <td class="num">${d.total != null ? Data.fmtMoney(d.total, d.currency) : '—'}</td>
                <td>${UI.statusPill(d.status)}</td>
                <td class="nowrap">${d.fileId ? '<span class="attach" title="Con archivo adjunto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></span>' : ''}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    populateFilters() {
        if (this._filtersReady) { this._refreshPeriodOptions(); return; }
        UI.fillSelect(UI.el('fltEntity'), Storage.getEntities(), { placeholder: 'Todas las entidades', selected: this.filters.entity });
        UI.fillSelect(UI.el('fltDirection'), Object.entries(Data.DIRECTIONS).map(([id, v]) => ({ id, name: v.label })), { placeholder: 'Emitidas y recibidas' });
        UI.fillSelect(UI.el('fltDocType'), Object.entries(Data.DOC_TYPES).map(([id, v]) => ({ id, name: v.label })), { placeholder: 'Todos los tipos' });
        UI.fillSelect(UI.el('fltStatus'), Object.entries(Data.STATUS).map(([id, v]) => ({ id, name: v.label })), { placeholder: 'Todos los estados' });
        this._refreshPeriodOptions();
        this._filtersReady = true;
    },

    _refreshPeriodOptions() {
        const keys = [...new Set(Storage.getDocs().map(d => d.period?.key || Data.parsePeriod(d.date).key))].sort().reverse();
        const opts = keys.map(k => { const [y, m] = k.split('-'); return { id: k, name: `${Data.MONTHS[+m - 1]} ${y}` }; });
        UI.fillSelect(UI.el('fltPeriod'), opts, { placeholder: 'Todos los periodos', selected: this.filters.period });
    },

    setFilter(key, value) { this.filters[key] = value; this.render(); },

    /* ---------- Ficha de detalle ---------- */
    async openDetail(id) {
        const d = Storage.getDoc(id);
        if (!d) return;
        const ent = Data.entityById(d.entityId);
        const body = UI.el('detailBody');
        const card = Storage.getCards().find(c => c.id === d.cardId);

        const fileBlock = d.fileId
            ? `<div class="detail-file" id="detailFile"><div class="detail-file-loading">Cargando archivo…</div></div>`
            : `<div class="detail-file detail-file-none">Sin archivo adjunto · documento manual</div>`;

        const linesBlock = (d.lineItems && d.lineItems.length)
            ? `<table class="mini-table"><thead><tr><th>Concepto</th><th>Cant.</th><th>Precio</th><th class="num">Importe</th></tr></thead><tbody>${d.lineItems.map(l => `<tr><td>${UI.escape(l.description || '')}</td><td>${l.qty || ''}</td><td>${l.unitPrice != null ? Data.fmtNumber(l.unitPrice) : ''}</td><td class="num">${Data.fmtNumber((l.qty || 0) * (l.unitPrice || 0))}</td></tr>`).join('')}</tbody></table>`
            : '';

        body.innerHTML = `
            <div class="detail-grid">
                <div class="detail-left">
                    ${fileBlock}
                </div>
                <div class="detail-right">
                    <div class="detail-head">
                        <div>
                            <div class="detail-entity"><span class="ent-dot" style="--c:${ent?.accent || '#999'}"></span>${UI.escape(ent?.name || '')}</div>
                            <h3>${UI.escape(Data.DOC_TYPES[d.docType]?.label || 'Documento')} ${d.number ? '· ' + UI.escape(d.number) : ''}</h3>
                            <div class="detail-sub">${Data.DIRECTIONS[d.direction]?.label} · ${Data.fmtDateLong(d.date)}</div>
                        </div>
                        ${UI.statusPill(d.status)}
                    </div>

                    <div class="detail-fields">
                        ${this._field('Contraparte', d.counterparty)}
                        ${this._field('NIF / CIF / VAT', d.taxId)}
                        ${this._field('Categoría', d.category)}
                        ${this._field('Medio de pago', [d.paymentMethod, card ? '· ' + card.label : ''].filter(Boolean).join(' '))}
                        ${this._field('Base imponible', d.base != null ? Data.fmtMoney(d.base, d.currency) : null)}
                        ${this._field('IVA', d.taxRate != null ? `${d.taxRate}% · ${Data.fmtMoney(d.tax || 0, d.currency)}` : (d.tax != null ? Data.fmtMoney(d.tax, d.currency) : null))}
                        ${this._field('Total', d.total != null ? `<b>${Data.fmtMoney(d.total, d.currency)}</b>` : null, true)}
                        ${this._field('Origen', { manual: 'Manual', photo: 'Foto', upload: 'Archivo subido', revolut: 'Import Revolut', holded: 'Holded (auto)' }[d.source] || d.source)}
                    </div>
                    ${linesBlock}
                    ${d.memo ? `<div class="detail-memo">${UI.escape(d.memo)}</div>` : ''}

                    <div class="detail-actions">
                        <label class="detail-status">Estado:
                            <select id="detailStatus">${Object.entries(Data.STATUS).map(([k, v]) => `<option value="${k}" ${d.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
                        </label>
                        ${d.fileId ? `<button class="btn btn-ghost" id="detailDownload">Descargar archivo</button>` : ''}
                        <button class="btn btn-ghost" id="detailEdit">Editar</button>
                        <button class="btn btn-danger-ghost" id="detailDelete">Eliminar</button>
                    </div>

                    <div class="thread">
                        <div class="thread-title">Conversación con el asesor</div>
                        <div class="thread-list" id="threadList">${this._renderThread(d.notes || [])}</div>
                        <div class="thread-compose">
                            <input type="text" id="threadInput" class="inp" placeholder="Escribe una nota o pregunta…"/>
                            <button class="btn btn-primary" id="threadSend">Enviar</button>
                        </div>
                    </div>
                </div>
            </div>`;

        UI.openModal('modalDetail');

        // Cargar archivo
        if (d.fileId) {
            const f = await Storage.getFile(d.fileId);
            const host = UI.el('detailFile');
            if (f && f.blob) {
                const url = URL.createObjectURL(f.blob);
                host.innerHTML = (f.mime || '').startsWith('image/')
                    ? `<img src="${url}" alt="documento"/>`
                    : (f.mime === 'application/pdf'
                        ? `<iframe src="${url}" title="documento" class="detail-pdf"></iframe>`
                        : `<div class="detail-file-none">Archivo: ${UI.escape(f.name || '')}</div>`);
            } else if (host) {
                host.innerHTML = `<div class="detail-file-none">No se encontró el archivo</div>`;
            }
        }

        // Eventos de la ficha
        UI.el('detailStatus').addEventListener('change', e => {
            Storage.updateDoc(id, { status: e.target.value });
            UI.toast('Estado actualizado', 'success');
            App.refreshCurrent();
            this.openDetail(id);
        });
        const dl = UI.el('detailDownload'); if (dl) dl.addEventListener('click', () => this.downloadFile(id));
        UI.el('detailEdit').addEventListener('click', () => { UI.closeModal('modalDetail'); Capture.openEdit(id); });
        UI.el('detailDelete').addEventListener('click', async () => {
            if (await UI.confirm('¿Eliminar este documento y su archivo?', { danger: true, okText: 'Eliminar' })) {
                await Storage.deleteDoc(id);
                UI.closeModal('modalDetail');
                UI.toast('Documento eliminado', 'success');
                App.refreshCurrent();
            }
        });
        const send = () => {
            const input = UI.el('threadInput');
            const text = input.value.trim();
            if (!text) return;
            const author = Storage.getSettings().role === 'asesor' ? 'Asesor' : 'Titular';
            Storage.addDocNote(id, author, text);
            input.value = '';
            UI.el('threadList').innerHTML = this._renderThread(Storage.getDoc(id).notes);
        };
        UI.el('threadSend').addEventListener('click', send);
        UI.el('threadInput').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    },

    _field(label, value, wide = false) {
        if (value == null || value === '') return '';
        return `<div class="dfield ${wide ? 'dfield-wide' : ''}"><span class="dfield-l">${label}</span><span class="dfield-v">${value}</span></div>`;
    },

    _renderThread(notes) {
        if (!notes || !notes.length) return '<div class="thread-empty">Sin mensajes todavía.</div>';
        return notes.map(n => `<div class="thread-msg thread-${n.author === 'Asesor' ? 'asesor' : 'titular'}"><div class="thread-meta"><b>${UI.escape(n.author)}</b> · ${Data.fmtDate(n.ts)}</div><div>${UI.escape(n.text)}</div></div>`).join('');
    },

    async downloadFile(id) {
        const d = Storage.getDoc(id);
        if (!d || !d.fileId) return;
        const f = await Storage.getFile(d.fileId);
        if (!f || !f.blob) { UI.toast('Archivo no encontrado', 'error'); return; }
        const ent = Data.entityById(d.entityId);
        const p = d.period || Data.parsePeriod(d.date);
        const ext = (f.name && f.name.includes('.')) ? f.name.split('.').pop() : (f.mime || '').split('/')[1] || 'bin';
        const name = `${UI.slug(ent?.name)}_${p.year}-${String(p.month).padStart(2, '0')}_${UI.slug(d.docType)}_${UI.slug(d.number || d.counterparty || d.id)}.${ext}`;
        UI.downloadBlob(f.blob, name);
    }
};
