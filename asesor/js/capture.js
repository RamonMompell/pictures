/* =====================================================================
   ÁBACO — capture.js
   Captura de documentos: foto (cámara) o arrastrar/soltar archivo.
   Al capturar, lo único imprescindible es elegir DÓNDE archivarlo
   (entidad). La fecha (día/mes/año) se detecta y clasifica sola.
   ===================================================================== */

const Capture = {
    pendingFile: null,      // { bytes, name, mime, size, dataUrl }
    lines: [],
    editingId: null,

    open(preset = {}) {
        this.reset();
        this.editingId = null;
        UI.el('capModalTitle').textContent = 'Capturar documento';
        this.populateSelects(preset);
        UI.openModal('modalCapture');
        // Foco en "dónde almacenarla"
        setTimeout(() => UI.el('capEntity').focus(), 120);
    },

    openEdit(id) {
        const d = Storage.getDoc(id);
        if (!d) return;
        this.reset();
        this.editingId = id;
        UI.el('capModalTitle').textContent = 'Editar documento';
        this.populateSelects({ entityId: d.entityId, direction: d.direction, cardId: d.cardId });
        // Volcar valores
        const set = (id, v) => { const e = UI.el(id); if (e) e.value = v ?? ''; };
        set('capEntity', d.entityId); set('capDirection', d.direction); set('capDocType', d.docType);
        set('capNumber', d.number); set('capDate', d.date); set('capCounterparty', d.counterparty);
        set('capTaxId', d.taxId); set('capCurrency', d.currency); set('capBase', d.base);
        set('capTaxRate', d.taxRate); set('capTax', d.tax); set('capTotal', d.total);
        set('capPayment', d.paymentMethod); set('capCard', d.cardId); set('capMemo', d.memo);
        this.onDirectionChange();
        set('capCategory', d.category);
        this.lines = (d.lineItems || []).slice();
        this.renderLines();
        if (d.fileId) {
            Storage.getFile(d.fileId).then(f => {
                if (f && f.blob) this._showPreview(URL.createObjectURL(f.blob), f.mime, f.name);
            });
        }
        UI.openModal('modalCapture');
    },

    reset() {
        this.pendingFile = null;
        this.lines = [];
        ['capNumber', 'capCounterparty', 'capTaxId', 'capBase', 'capTaxRate', 'capTax', 'capTotal', 'capMemo', 'capExtractText']
            .forEach(id => { const e = UI.el(id); if (e) e.value = ''; });
        const prev = UI.el('capPreview');
        if (prev) { prev.innerHTML = ''; prev.classList.remove('has-file'); }
        const dz = UI.el('capDropHint'); if (dz) dz.style.display = '';
        this.renderLines();
        // Fecha por defecto: hoy
        const today = new Date().toISOString().slice(0, 10);
        if (UI.el('capDate')) UI.el('capDate').value = today;
    },

    populateSelects(preset = {}) {
        const entities = Storage.getEntities();
        UI.fillSelect(UI.el('capEntity'), entities, { placeholder: '— Selecciona entidad —', selected: preset.entityId });
        UI.fillSelect(UI.el('capDirection'), Object.entries(Data.DIRECTIONS).map(([id, v]) => ({ id, name: v.label })), { selected: preset.direction || 'recibida' });
        UI.fillSelect(UI.el('capDocType'), Object.entries(Data.DOC_TYPES).map(([id, v]) => ({ id, name: v.label })), { selected: 'factura' });
        UI.fillSelect(UI.el('capPayment'), Data.PAYMENT_METHODS, { placeholder: '— Medio de pago —' });
        UI.fillSelect(UI.el('capCard'), Storage.getCards().map(c => ({ id: c.id, name: c.label })), { placeholder: '— Sin tarjeta concreta —', selected: preset.cardId });
        UI.fillSelect(UI.el('capCurrency'), Data.CURRENCIES, { selected: (Data.entityById(preset.entityId)?.currency) || 'EUR' });
        this.onDirectionChange();
    },

    onDirectionChange() {
        const dir = UI.el('capDirection').value;
        const cats = dir === 'emitida' ? Data.INCOME_CATEGORIES : Data.EXPENSE_CATEGORIES;
        UI.fillSelect(UI.el('capCategory'), cats, { placeholder: '— Categoría —' });
        // Sugerir número correlativo si es emitida
        const btn = UI.el('btnSuggestNumber');
        if (btn) btn.style.display = dir === 'emitida' ? '' : 'none';
    },

    onEntityChange() {
        const ent = Data.entityById(UI.el('capEntity').value);
        if (ent && ent.currency && UI.el('capCurrency')) UI.el('capCurrency').value = ent.currency;
    },

    /* ---------- Archivos ---------- */
    async handleFiles(fileList) {
        const file = fileList && fileList[0];
        if (!file) return;
        try {
            const bytes = await UI.fileToBytes(file);
            const dataUrl = file.type.startsWith('image/') ? await UI.fileToDataURL(file) : null;
            this.pendingFile = { bytes, name: file.name, mime: file.type || 'application/octet-stream', size: file.size, dataUrl };
            this._showPreview(dataUrl, file.type, file.name);
            // Detectar fecha por la fecha de modificación del archivo
            if (file.lastModified) {
                const iso = new Date(file.lastModified).toISOString().slice(0, 10);
                if (UI.el('capDate')) UI.el('capDate').value = iso;
            }
            // Intento de OCR automático si es imagen (sin bloquear)
            UI.el('btnCapOcr').style.display = file.type.startsWith('image/') ? '' : 'none';
        } catch (e) {
            UI.toast('No se pudo leer el archivo', 'error');
        }
    },

    _showPreview(url, mime, name) {
        const prev = UI.el('capPreview');
        if (!prev) return;
        prev.classList.add('has-file');
        const hint = UI.el('capDropHint'); if (hint) hint.style.display = 'none';
        if (url && mime && mime.startsWith('image/')) {
            prev.innerHTML = `<img src="${url}" alt="documento"/><span class="cap-filename">${UI.escape(name || '')}</span>`;
        } else {
            prev.innerHTML = `<div class="cap-fileicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><span class="cap-filename">${UI.escape(name || 'documento')}</span>`;
        }
    },

    bindDropzone() {
        const dz = UI.el('capPreview');
        if (!dz) return;
        ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragging'); }));
        ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragging'); }));
        dz.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) this.handleFiles(e.dataTransfer.files); });
        dz.addEventListener('click', () => UI.el('capFileInput').click());
    },

    /* ---------- Desglose automático ---------- */
    async runOcr() {
        if (!this.pendingFile || !this.pendingFile.dataUrl) { UI.toast('Primero añade una imagen', 'info'); return; }
        const btn = UI.el('btnCapOcr');
        const original = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = 'Leyendo… 0%';
        try {
            const text = await Extract.ocrImage(this.pendingFile.dataUrl, p => { btn.innerHTML = `Leyendo… ${p}%`; });
            UI.el('capExtractText').value = text;
            this.fillFromExtract(Extract.fromText(text));
            UI.toast('Datos extraídos de la imagen', 'success');
        } catch (e) {
            UI.toast('OCR no disponible. Pega el texto o rellena a mano.', 'info', 4200);
        } finally {
            btn.disabled = false; btn.innerHTML = original;
        }
    },

    extractFromText() {
        const text = UI.el('capExtractText').value;
        if (!text.trim()) { UI.toast('Pega el texto del recibo primero', 'info'); return; }
        this.fillFromExtract(Extract.fromText(text));
        UI.toast('Campos rellenados desde el texto', 'success');
    },

    fillFromExtract(d) {
        const setIfEmpty = (id, v) => { const e = UI.el(id); if (e && (!e.value || e.value === '') && v != null && v !== '') e.value = v; };
        setIfEmpty('capDate', d.date);
        setIfEmpty('capTaxId', d.taxId);
        setIfEmpty('capTotal', d.total != null ? Number(d.total).toFixed(2) : '');
        setIfEmpty('capBase', d.base != null ? Number(d.base).toFixed(2) : '');
        setIfEmpty('capTax', d.tax != null ? Number(d.tax).toFixed(2) : '');
        setIfEmpty('capTaxRate', d.taxRate);
        if (d.currency) UI.el('capCurrency').value = d.currency;
        this.recalc();
    },

    /* Auto-cálculo base / IVA / total */
    recalc(source) {
        const num = id => { const v = parseFloat(UI.el(id).value); return isNaN(v) ? null : v; };
        let base = num('capBase'), rate = num('capTaxRate'), tax = num('capTax'), total = num('capTotal');
        if (source === 'base' || source === 'rate') {
            if (base != null && rate != null) {
                tax = +(base * rate / 100).toFixed(2);
                total = +(base + tax).toFixed(2);
                UI.el('capTax').value = tax; UI.el('capTotal').value = total;
            }
        } else if (source === 'total') {
            if (total != null && rate != null && rate > 0) {
                base = +(total / (1 + rate / 100)).toFixed(2);
                tax = +(total - base).toFixed(2);
                UI.el('capBase').value = base; UI.el('capTax').value = tax;
            }
        }
    },

    /* ---------- Líneas de detalle ---------- */
    addLine() {
        this.lines.push({ description: '', qty: 1, unitPrice: 0 });
        this.renderLines();
    },
    removeLine(i) { this.lines.splice(i, 1); this.renderLines(); this.sumLines(); },
    renderLines() {
        const host = UI.el('capLines');
        if (!host) return;
        host.innerHTML = '';
        this.lines.forEach((ln, i) => {
            const row = UI.h('div', { class: 'line-row' }, [
                UI.h('input', { class: 'inp', type: 'text', placeholder: 'Concepto', value: ln.description, oninput: e => { ln.description = e.target.value; } }),
                UI.h('input', { class: 'inp inp-xs', type: 'number', step: '0.01', placeholder: 'Cant.', value: ln.qty, oninput: e => { ln.qty = parseFloat(e.target.value) || 0; this.sumLines(); } }),
                UI.h('input', { class: 'inp inp-sm', type: 'number', step: '0.01', placeholder: 'Precio', value: ln.unitPrice, oninput: e => { ln.unitPrice = parseFloat(e.target.value) || 0; this.sumLines(); } }),
                UI.h('button', { class: 'icon-btn', title: 'Quitar', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', onclick: () => this.removeLine(i) })
            ]);
            host.appendChild(row);
        });
    },
    sumLines() {
        const sum = this.lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
        if (sum > 0) { UI.el('capBase').value = sum.toFixed(2); this.recalc('base'); }
    },

    /* ---------- Sugerir número correlativo (emitidas) ---------- */
    suggestNumber() {
        const entityId = UI.el('capEntity').value;
        if (!entityId) { UI.toast('Elige la entidad primero', 'info'); return; }
        const next = Documents.nextNumber(entityId);
        UI.el('capNumber').value = next;
        UI.toast(`Siguiente número sugerido: ${next}`, 'info');
    },

    /* ---------- Guardar ---------- */
    async save() {
        const entityId = UI.el('capEntity').value;
        if (!entityId) { UI.toast('Indica dónde almacenarla (entidad)', 'error'); UI.el('capEntity').focus(); return; }
        const v = id => UI.el(id).value.trim();
        const numF = id => { const n = parseFloat(UI.el(id).value); return isNaN(n) ? null : n; };
        const date = v('capDate') || new Date().toISOString().slice(0, 10);

        const doc = {
            entityId,
            direction: v('capDirection') || 'recibida',
            docType: v('capDocType') || 'factura',
            number: v('capNumber'),
            date,
            counterparty: v('capCounterparty'),
            taxId: v('capTaxId'),
            category: v('capCategory'),
            paymentMethod: v('capPayment'),
            cardId: v('capCard') || null,
            currency: v('capCurrency') || 'EUR',
            base: numF('capBase'),
            taxRate: numF('capTaxRate'),
            tax: numF('capTax'),
            total: numF('capTotal'),
            lineItems: this.lines.filter(l => l.description || l.unitPrice),
            memo: v('capMemo'),
            period: Data.parsePeriod(date)
        };

        try {
            // Guardar archivo si hay uno pendiente
            if (this.pendingFile) {
                const blob = new Blob([this.pendingFile.bytes], { type: this.pendingFile.mime });
                const fileRec = await Storage.saveFile({ blob, name: this.pendingFile.name, mime: this.pendingFile.mime, size: this.pendingFile.size });
                doc.fileId = fileRec.id;
                doc.fileName = this.pendingFile.name;
                doc.fileMime = this.pendingFile.mime;
            }

            if (this.editingId) {
                const existing = Storage.getDoc(this.editingId);
                doc.fileId = doc.fileId || existing.fileId;
                doc.fileName = doc.fileName || existing.fileName;
                doc.fileMime = doc.fileMime || existing.fileMime;
                doc.source = existing.source;
                Storage.updateDoc(this.editingId, doc);
                UI.toast('Documento actualizado', 'success');
            } else {
                doc.source = this.pendingFile ? (this.pendingFile.mime.startsWith('image/') ? 'photo' : 'upload') : 'manual';
                Storage.addDoc(doc);
                UI.toast('Documento archivado y clasificado', 'success');
            }
            UI.closeModal('modalCapture');
            App.refreshCurrent();
        } catch (e) {
            console.error(e);
            UI.toast(e.message || 'No se pudo guardar', 'error');
        }
    }
};
