/* =====================================================================
   ÁBACO — integrations.js
   · Holded  : guarda la configuración y explica el flujo automático.
   · Revolut : importa el CSV de movimientos -> gastos clasificados.
   · Tiempo real (Supabase) : guarda credenciales para la sincronización.
   ===================================================================== */

const Integrations = {
    render() {
        const s = Storage.getSettings();
        const set = (id, v) => { const e = UI.el(id); if (e) e.value = v || ''; };
        set('cfgHoldedKey', s.holdedKey);
        set('cfgHoldedEntity', '');
        UI.fillSelect(UI.el('cfgHoldedEntity'), Storage.getEntities(), { placeholder: '— Asociar a entidad —', selected: s.holdedEntity });
        set('cfgSupaUrl', s.supaUrl);
        set('cfgSupaKey', s.supaKey);
        UI.fillSelect(UI.el('cfgRevolutEntity'), Storage.getEntities(), { placeholder: '— Entidad por defecto —', selected: s.revolutEntity });
        const role = UI.el('cfgRole'); if (role) role.value = s.role || 'titular';

        // Estado de conexiones
        this._status('stHolded', s.holdedKey ? 'Clave guardada (pendiente de servidor de sincronización)' : 'Sin configurar', !!s.holdedKey);
        this._status('stSupa', s.supaUrl && s.supaKey ? 'Credenciales guardadas' : 'Sin configurar', !!(s.supaUrl && s.supaKey));
        const last = s.revolutLast ? `Último import: ${Data.fmtDateLong(s.revolutLast)}` : 'Sin importaciones todavía';
        this._status('stRevolut', last, !!s.revolutLast);
    },

    _status(id, text, ok) {
        const e = UI.el(id);
        if (!e) return;
        e.className = `int-status ${ok ? 'ok' : ''}`;
        e.textContent = text;
    },

    saveHolded() {
        Storage.saveSettings({ holdedKey: UI.el('cfgHoldedKey').value.trim(), holdedEntity: UI.el('cfgHoldedEntity').value });
        UI.toast('Configuración de Holded guardada', 'success');
        this.render();
    },

    saveSupabase() {
        Storage.saveSettings({ supaUrl: UI.el('cfgSupaUrl').value.trim(), supaKey: UI.el('cfgSupaKey').value.trim() });
        UI.toast('Credenciales de sincronización guardadas', 'success');
        this.render();
    },

    saveRole() {
        Storage.saveSettings({ role: UI.el('cfgRole').value });
        UI.toast('Perfil actualizado', 'success');
    },

    saveRevolutEntity() {
        Storage.saveSettings({ revolutEntity: UI.el('cfgRevolutEntity').value });
    },

    /* ---------- Import CSV de Revolut ---------- */
    async importRevolut(file) {
        if (!file) return;
        try {
            const text = await UI.fileToText(file);
            const rows = this._parseCSV(text);
            if (rows.length < 2) { UI.toast('CSV vacío o no reconocido', 'error'); return; }
            const header = rows[0].map(h => h.trim().toLowerCase());
            const col = (...names) => header.findIndex(h => names.some(n => h.includes(n)));
            const iDate = col('completed date', 'started date', 'date');
            const iDesc = col('description', 'concepto', 'reference');
            const iAmount = col('amount', 'importe');
            const iCurr = col('currency', 'moneda');
            const iFee = col('fee', 'comisión');
            if (iAmount === -1) { UI.toast('No encuentro la columna de importe', 'error'); return; }

            let imported = 0, skipped = 0;
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                if (!row || !row.length || !row[iAmount]) continue;
                const amount = parseFloat(String(row[iAmount]).replace(',', '.'));
                if (isNaN(amount) || amount >= 0) { skipped++; continue; } // sólo gastos (negativos)
                const rawDate = (iDate > -1 ? row[iDate] : '') || '';
                const iso = (Extract.fromText(rawDate).date) || new Date().toISOString().slice(0, 10);
                const fee = iFee > -1 ? Math.abs(parseFloat(String(row[iFee]).replace(',', '.')) || 0) : 0;
                const total = +(Math.abs(amount) + fee).toFixed(2);
                const defaultEntity = (UI.el('cfgRevolutEntity') && UI.el('cfgRevolutEntity').value) || Storage.getSettings().revolutEntity || Storage.getEntities()[0].id;
                const doc = {
                    entityId: defaultEntity,
                    direction: 'recibida', docType: 'ticket',
                    number: '', date: iso,
                    counterparty: (iDesc > -1 ? row[iDesc] : '') || 'Gasto Revolut',
                    category: '', paymentMethod: 'Tarjeta', cardId: 'revolut-alejandra',
                    currency: (iCurr > -1 ? (row[iCurr] || 'EUR') : 'EUR').toUpperCase().slice(0, 3),
                    base: null, taxRate: null, tax: null, total,
                    lineItems: [], memo: 'Importado del extracto de Revolut · adjuntar recibo si procede',
                    source: 'revolut', period: Data.parsePeriod(iso)
                };
                Storage.addDoc(doc);
                imported++;
            }
            Storage.saveSettings({ revolutLast: new Date().toISOString() });
            UI.toast(`Revolut: ${imported} gastos importados${skipped ? `, ${skipped} ingresos omitidos` : ''}`, 'success', 4500);
            this.render();
            App.refreshCurrent();
        } catch (e) {
            console.error(e);
            UI.toast('No se pudo procesar el CSV', 'error');
        }
    },

    // Parser CSV sencillo: soporta comillas y delimitador , o ;
    _parseCSV(text) {
        const delimiter = (text.split('\n')[0].split(';').length > text.split('\n')[0].split(',').length) ? ';' : ',';
        const rows = [];
        let row = [], field = '', inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i], next = text[i + 1];
            if (inQuotes) {
                if (c === '"' && next === '"') { field += '"'; i++; }
                else if (c === '"') inQuotes = false;
                else field += c;
            } else {
                if (c === '"') inQuotes = true;
                else if (c === delimiter) { row.push(field); field = ''; }
                else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
                else if (c === '\r') { /* ignore */ }
                else field += c;
            }
        }
        if (field.length || row.length) { row.push(field); rows.push(row); }
        return rows.filter(r => r.length && r.some(c => c.trim() !== ''));
    }
};
