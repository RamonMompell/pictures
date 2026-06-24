/* =====================================================================
   ÁBACO — entities.js
   Mapa de entidades: estructura societaria por jurisdicción, con
   relaciones (holding / participadas / operativas) y resumen por entidad.
   ===================================================================== */

const Entities = {
    render() {
        const host = UI.el('entitiesHost');
        const entities = Storage.getEntities();
        const docs = Storage.getDocs();
        const groups = {};
        entities.forEach(e => { (groups[e.group] || (groups[e.group] = [])).push(e); });

        const totalsFor = id => {
            const ds = docs.filter(d => d.entityId === id);
            const ingresos = ds.filter(d => d.direction === 'emitida').reduce((a, d) => a + (d.total || 0), 0);
            const gastos = ds.filter(d => d.direction === 'recibida').reduce((a, d) => a + (d.total || 0), 0);
            return { count: ds.length, ingresos, gastos };
        };

        host.innerHTML = '';
        Object.entries(groups).forEach(([group, list]) => {
            const j = Data.JURISDICTIONS[list[0].jurisdiction];
            const section = UI.h('div', { class: 'ent-group' });
            section.innerHTML = `<div class="ent-group-head"><span class="ent-flag">${j?.flag || ''}</span><h3>${UI.escape(group)}</h3><span class="ent-group-tax">${j?.tax || ''}</span></div>`;
            const grid = UI.h('div', { class: 'ent-cards' });

            list.forEach(e => {
                const t = totalsFor(e.id);
                const rels = [];
                if (e.holds?.length) rels.push(`Holding de ${e.holds.map(id => Data.entityById(id)?.name || id).join(', ')}`);
                if (e.operates?.length) rels.push(`Opera ${e.operates.map(id => Data.entityById(id)?.name || id).join(', ')}`);
                if (e.parentId) rels.push(`Participada de ${Data.entityById(e.parentId)?.name || e.parentId}`);
                if (e.operatedBy) rels.push(`Operada por ${Data.entityById(e.operatedBy)?.name || e.operatedBy}`);

                const card = UI.h('div', { class: 'ent-card', style: `--c:${e.accent || '#6B7280'}`, onclick: () => this.openEditor(e.id) });
                card.innerHTML = `
                    <div class="ent-card-top">
                        <div class="ent-badge">${e.kind === 'person' ? this._personIcon() : this._buildingIcon()}</div>
                        <div>
                            <div class="ent-name">${UI.escape(e.name)}</div>
                            <div class="ent-role">${UI.escape(e.role || '')}</div>
                        </div>
                    </div>
                    ${e.vat ? `<div class="ent-vat">${UI.escape(e.vat)}</div>` : ''}
                    ${rels.length ? `<ul class="ent-rels">${rels.map(r => `<li>${UI.escape(r)}</li>`).join('')}</ul>` : ''}
                    <div class="ent-stats">
                        <div><span>${t.count}</span>docs</div>
                        <div class="pos"><span>${Data.fmtMoney(t.ingresos, e.currency)}</span>emitido</div>
                        <div class="neg"><span>${Data.fmtMoney(t.gastos, e.currency)}</span>recibido</div>
                    </div>`;
                grid.appendChild(card);
            });
            section.appendChild(grid);
            host.appendChild(section);
        });

        // Tarjetas / medios de pago
        const cards = Storage.getCards();
        if (cards.length) {
            const section = UI.h('div', { class: 'ent-group' });
            section.innerHTML = `<div class="ent-group-head"><span class="ent-flag">💳</span><h3>Tarjetas y medios de pago</h3></div>`;
            const grid = UI.h('div', { class: 'ent-cards' });
            cards.forEach(c => {
                const used = docs.filter(d => d.cardId === c.id);
                const total = used.reduce((a, d) => a + (d.total || 0), 0);
                const card = UI.h('div', { class: 'ent-card', style: '--c:#9A7B4F' });
                card.innerHTML = `
                    <div class="ent-card-top"><div class="ent-badge">${this._cardIcon()}</div>
                    <div><div class="ent-name">${UI.escape(c.label)}</div><div class="ent-role">${UI.escape(c.holder || '')}</div></div></div>
                    ${c.notes ? `<div class="ent-role" style="margin-top:6px">${UI.escape(c.notes)}</div>` : ''}
                    <div class="ent-stats"><div><span>${used.length}</span>gastos</div><div class="neg"><span>${Data.fmtMoney(total, c.currency)}</span>total</div></div>`;
                grid.appendChild(card);
            });
            section.appendChild(grid);
            host.appendChild(section);
        }
    },

    openEditor(id) {
        const e = Data.entityById(id);
        if (!e) return;
        const body = UI.el('entEditorBody');
        body.innerHTML = `
            <h3>${UI.escape(e.name)}</h3>
            <label class="field"><span>Identificación fiscal (NIF / CIF / VAT)</span>
                <input type="text" id="entVat" class="inp" value="${UI.escape(e.vat || '')}" placeholder="Ej. B12345678 / ES…"/></label>
            <label class="field"><span>Rol / descripción</span>
                <input type="text" id="entRole" class="inp" value="${UI.escape(e.role || '')}"/></label>
            <label class="field"><span>Moneda por defecto</span>
                <select id="entCurrency" class="inp">${Data.CURRENCIES.map(c => `<option ${c === e.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
            <label class="field"><span>Notas</span>
                <textarea id="entNotes" class="inp" rows="3">${UI.escape(e.notes || '')}</textarea></label>`;
        UI.el('entEditorSave').onclick = () => {
            Storage.upsertEntity({ id, vat: UI.el('entVat').value.trim(), role: UI.el('entRole').value.trim(), currency: UI.el('entCurrency').value, notes: UI.el('entNotes').value.trim() });
            UI.closeModal('modalEntity');
            UI.toast('Entidad actualizada', 'success');
            this.render();
        };
        UI.openModal('modalEntity');
    },

    _buildingIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="16" height="18" rx="1.5"/><line x1="9" y1="7" x2="9" y2="7.5"/><line x1="15" y1="7" x2="15" y2="7.5"/><line x1="9" y1="11" x2="9" y2="11.5"/><line x1="15" y1="11" x2="15" y2="11.5"/><line x1="10" y1="21" x2="14" y2="21"/></svg>'; },
    _personIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></svg>'; },
    _cardIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>'; }
};
