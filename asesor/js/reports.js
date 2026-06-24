/* =====================================================================
   ÁBACO — reports.js
   Reportes para el asesor: IVA soportado / repercutido, resumen por
   entidad, categoría y mes, y exportación (CSV + paquete ZIP + copia).
   ===================================================================== */

const Reports = {
    filters: { entity: '', year: '', direction: '' },

    _filtered() {
        let docs = Storage.getDocs().slice();
        const f = this.filters;
        if (f.entity) docs = docs.filter(d => d.entityId === f.entity);
        if (f.direction) docs = docs.filter(d => d.direction === f.direction);
        if (f.year) docs = docs.filter(d => String((d.period?.year) || Data.parsePeriod(d.date).year) === String(f.year));
        return docs;
    },

    render() {
        // Filtros
        if (!this._ready) {
            UI.fillSelect(UI.el('repEntity'), Storage.getEntities(), { placeholder: 'Todas las entidades' });
            UI.fillSelect(UI.el('repDirection'), Object.entries(Data.DIRECTIONS).map(([id, v]) => ({ id, name: v.label })), { placeholder: 'Emitidas y recibidas' });
            this._ready = true;
        }
        const years = [...new Set(Storage.getDocs().map(d => (d.period?.year) || Data.parsePeriod(d.date).year))].sort().reverse();
        UI.fillSelect(UI.el('repYear'), years.map(y => ({ id: y, name: String(y) })), { placeholder: 'Todos los años', selected: this.filters.year });

        const docs = this._filtered();
        const ingresos = docs.filter(d => d.direction === 'emitida');
        const gastos = docs.filter(d => d.direction === 'recibida');
        const sum = (arr, k) => arr.reduce((a, d) => a + (Number(d[k]) || 0), 0);

        const totalIng = sum(ingresos, 'total'), totalGas = sum(gastos, 'total');
        const ivaRep = sum(ingresos, 'tax'), ivaSop = sum(gastos, 'tax');

        // KPIs
        UI.el('repKpis').innerHTML = [
            this._kpi('Ingresos (emitido)', Data.fmtMoney(totalIng), 'pos', `${ingresos.length} facturas`),
            this._kpi('Gastos (recibido)', Data.fmtMoney(totalGas), 'neg', `${gastos.length} documentos`),
            this._kpi('Resultado', Data.fmtMoney(totalIng - totalGas), (totalIng - totalGas) >= 0 ? 'pos' : 'neg', 'Ingresos − Gastos'),
            this._kpi('IVA repercutido', Data.fmtMoney(ivaRep), '', 'En facturas emitidas'),
            this._kpi('IVA soportado', Data.fmtMoney(ivaSop), '', 'En facturas recibidas'),
            this._kpi('IVA a liquidar', Data.fmtMoney(ivaRep - ivaSop), (ivaRep - ivaSop) >= 0 ? 'neg' : 'pos', 'Repercutido − Soportado')
        ].join('');

        // Por entidad
        const byEntity = {};
        docs.forEach(d => {
            const e = (byEntity[d.entityId] ||= { ing: 0, gas: 0, n: 0 });
            e.n++; if (d.direction === 'emitida') e.ing += d.total || 0; else e.gas += d.total || 0;
        });
        UI.el('repByEntity').innerHTML = Object.entries(byEntity).map(([id, v]) => {
            const e = Data.entityById(id);
            return `<tr><td><span class="ent-dot" style="--c:${e?.accent || '#999'}"></span>${UI.escape(e?.name || id)}</td><td class="num">${v.n}</td><td class="num pos">${Data.fmtMoney(v.ing, e?.currency)}</td><td class="num neg">${Data.fmtMoney(v.gas, e?.currency)}</td><td class="num">${Data.fmtMoney(v.ing - v.gas, e?.currency)}</td></tr>`;
        }).join('') || '<tr><td colspan="5" class="muted">Sin datos</td></tr>';

        // Por categoría (gastos)
        const byCat = {};
        gastos.forEach(d => { byCat[d.category || 'Sin categoría'] = (byCat[d.category || 'Sin categoría'] || 0) + (d.total || 0); });
        const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
        const maxCat = catEntries.length ? catEntries[0][1] : 1;
        UI.el('repByCategory').innerHTML = catEntries.map(([c, v]) =>
            `<div class="bar-row"><span class="bar-label">${UI.escape(c)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (v / maxCat) * 100)}%"></div></div><span class="bar-val">${Data.fmtMoney(v)}</span></div>`
        ).join('') || '<div class="muted">Sin gastos en el periodo</div>';

        // Por mes
        const byMonth = {};
        docs.forEach(d => {
            const k = d.period?.key || Data.parsePeriod(d.date).key;
            const m = (byMonth[k] ||= { ing: 0, gas: 0 });
            if (d.direction === 'emitida') m.ing += d.total || 0; else m.gas += d.total || 0;
        });
        UI.el('repByMonth').innerHTML = Object.keys(byMonth).sort().reverse().map(k => {
            const [y, mo] = k.split('-'); const m = byMonth[k];
            return `<tr><td>${Data.MONTHS[+mo - 1]} ${y}</td><td class="num pos">${Data.fmtMoney(m.ing)}</td><td class="num neg">${Data.fmtMoney(m.gas)}</td><td class="num">${Data.fmtMoney(m.ing - m.gas)}</td></tr>`;
        }).join('') || '<tr><td colspan="4" class="muted">Sin datos</td></tr>';
    },

    _kpi(label, value, cls, sub) {
        return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value ${cls}">${value}</div><div class="kpi-sub">${sub}</div></div>`;
    },

    setFilter(key, val) { this.filters[key] = val; this.render(); },

    /* ---------- Exportación CSV ---------- */
    _csv(docs) {
        const headers = ['Fecha', 'Año', 'Mes', 'Trimestre', 'Entidad', 'Dirección', 'Tipo', 'Número', 'Contraparte', 'NIF/CIF/VAT', 'Categoría', 'Medio de pago', 'Moneda', 'Base', 'Tipo IVA %', 'Cuota IVA', 'Total', 'Estado', 'Archivo', 'Notas'];
        const esc = v => {
            const s = String(v ?? '');
            return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        const rows = docs.map(d => {
            const ent = Data.entityById(d.entityId);
            const p = d.period || Data.parsePeriod(d.date);
            return [
                Data.fmtDate(d.date), p.year, p.month, `${p.quarter}T`, ent?.name || '', Data.DIRECTIONS[d.direction]?.label,
                Data.DOC_TYPES[d.docType]?.label, d.number, d.counterparty, d.taxId, d.category, d.paymentMethod,
                d.currency, d.base ?? '', d.taxRate ?? '', d.tax ?? '', d.total ?? '', Data.STATUS[d.status]?.label,
                d.fileName || '', d.memo || ''
            ].map(esc).join(';');
        });
        return '﻿' + [headers.join(';'), ...rows].join('\r\n');
    },

    exportCSV() {
        const docs = this._filtered().sort((a, b) => new Date(a.date) - new Date(b.date));
        if (!docs.length) { UI.toast('No hay documentos para exportar', 'info'); return; }
        const ent = this.filters.entity ? UI.slug(Data.entityById(this.filters.entity)?.name) : 'todas';
        UI.downloadText(this._csv(docs), `abaco_libro_${ent}_${this.filters.year || 'todos'}.csv`, 'text/csv');
        UI.toast('CSV exportado', 'success');
    },

    /* ---------- Paquete ZIP para el asesor ---------- */
    async exportPackage() {
        const docs = this._filtered().sort((a, b) => new Date(a.date) - new Date(b.date));
        if (!docs.length) { UI.toast('No hay documentos para empaquetar', 'info'); return; }
        UI.toast('Generando paquete…', 'info');
        const files = [];
        // Libro contable
        files.push({ name: 'libro_contable.csv', data: new TextEncoder().encode(this._csv(docs)) });

        // Resumen
        const ing = docs.filter(d => d.direction === 'emitida').reduce((a, d) => a + (d.total || 0), 0);
        const gas = docs.filter(d => d.direction === 'recibida').reduce((a, d) => a + (d.total || 0), 0);
        const resumen = [
            'ÁBACO — Paquete para asesoría',
            `Generado: ${Data.fmtDateLong(new Date().toISOString())}`,
            `Documentos: ${docs.length}`,
            `Ingresos (emitido): ${Data.fmtMoney(ing)}`,
            `Gastos (recibido): ${Data.fmtMoney(gas)}`,
            '',
            'Estructura: <Entidad>/<Año-Mes>/<archivo>'
        ].join('\n');
        files.push({ name: 'RESUMEN.txt', data: new TextEncoder().encode(resumen) });

        // Archivos adjuntos organizados por entidad / año-mes
        let count = 0;
        for (const d of docs) {
            if (!d.fileId) continue;
            const f = await Storage.getFile(d.fileId);
            if (!f || !f.blob) continue;
            const ent = Data.entityById(d.entityId);
            const p = d.period || Data.parsePeriod(d.date);
            const ext = (f.name && f.name.includes('.')) ? f.name.split('.').pop() : ((f.mime || '').split('/')[1] || 'bin');
            const fname = `${UI.slug(ent?.name)}/${p.year}-${String(p.month).padStart(2, '0')}/${UI.slug(d.docType)}_${UI.slug(d.number || d.counterparty || d.id)}.${ext}`;
            const bytes = new Uint8Array(await f.blob.arrayBuffer());
            files.push({ name: fname, data: bytes });
            count++;
        }

        const blob = await Zip.build(files);
        const tag = this.filters.entity ? UI.slug(Data.entityById(this.filters.entity)?.name) : 'todas';
        UI.downloadBlob(blob, `abaco_paquete_${tag}_${this.filters.year || 'todos'}.zip`);
        UI.toast(`Paquete listo · ${count} archivo${count === 1 ? '' : 's'} adjuntos`, 'success');
    },

    exportBackup() {
        UI.downloadText(JSON.stringify(Storage.exportSnapshot(), null, 2), `abaco_copia_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
        UI.toast('Copia de seguridad descargada', 'success');
    }
};
