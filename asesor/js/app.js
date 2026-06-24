/* =====================================================================
   ÁBACO — app.js
   Controlador principal: enrutado, panel de inicio y enlace de eventos.
   ===================================================================== */

const App = {
    view: 'inicio',

    async init() {
        await Storage.init();
        this.bindEvents();
        Capture.bindDropzone();
        const hash = location.hash.slice(1) || 'inicio';
        this.showView(hash);
        console.log('ÁBACO listo');
    },

    /* ---------- Enrutado ---------- */
    showView(view) {
        this.view = view;
        UI.qsa('.view').forEach(v => v.classList.remove('active'));
        const target = UI.el(`view-${view}`);
        if (target) target.classList.add('active'); else { UI.el('view-inicio').classList.add('active'); this.view = 'inicio'; }
        UI.qsa('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.view === this.view));
        location.hash = this.view;
        this.refreshCurrent();
        // Cerrar el menú móvil
        document.body.classList.remove('nav-open');
    },

    refreshCurrent() {
        switch (this.view) {
            case 'inicio': this.renderDashboard(); break;
            case 'documentos': Documents.render(); break;
            case 'entidades': Entities.render(); break;
            case 'reportes': Reports.render(); break;
            case 'integraciones': Integrations.render(); break;
        }
    },

    /* ---------- Panel de inicio ---------- */
    renderDashboard() {
        const docs = Storage.getDocs();
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthDocs = docs.filter(d => (d.period?.key || Data.parsePeriod(d.date).key) === monthKey);
        const pending = docs.filter(d => d.status === 'nuevo');
        const ingMonth = monthDocs.filter(d => d.direction === 'emitida').reduce((a, d) => a + (d.total || 0), 0);
        const gasMonth = monthDocs.filter(d => d.direction === 'recibida').reduce((a, d) => a + (d.total || 0), 0);

        UI.el('dashPeriod').textContent = Data.parsePeriod(now.toISOString()).label;
        UI.el('dashKpis').innerHTML = [
            `<div class="kpi kpi-accent"><div class="kpi-label">Pendientes de revisar</div><div class="kpi-value">${pending.length}</div><div class="kpi-sub">${docs.length} documentos en total</div></div>`,
            `<div class="kpi"><div class="kpi-label">Documentos este mes</div><div class="kpi-value">${monthDocs.length}</div><div class="kpi-sub">${Data.parsePeriod(now.toISOString()).label}</div></div>`,
            `<div class="kpi"><div class="kpi-label">Emitido este mes</div><div class="kpi-value pos">${Data.fmtMoney(ingMonth)}</div><div class="kpi-sub">Facturas a clientes</div></div>`,
            `<div class="kpi"><div class="kpi-label">Recibido este mes</div><div class="kpi-value neg">${Data.fmtMoney(gasMonth)}</div><div class="kpi-sub">Gastos y compras</div></div>`
        ].join('');

        // Alertas
        const alerts = [];
        Storage.getEntities().forEach(e => {
            const rep = Documents.checkCorrelative(e.id);
            rep.forEach(r => {
                if (r.gaps.length) alerts.push({ t: 'warn', msg: `<b>${e.name}</b>: faltan números ${r.gaps.slice(0, 6).join(', ')}${r.gaps.length > 6 ? '…' : ''} en la serie ${r.prefix || ''}`, go: 'documentos' });
                if (r.dups.length) alerts.push({ t: 'danger', msg: `<b>${e.name}</b>: números duplicados ${r.dups.join(', ')}`, go: 'documentos' });
            });
        });
        const noTotal = docs.filter(d => d.total == null).length;
        if (noTotal) alerts.push({ t: 'warn', msg: `${noTotal} documento(s) sin importe total. Conviene completarlos.`, go: 'documentos' });
        const noFile = docs.filter(d => !d.fileId).length;
        if (noFile) alerts.push({ t: 'info', msg: `${noFile} documento(s) sin archivo adjunto.`, go: 'documentos' });

        UI.el('dashAlerts').innerHTML = alerts.length
            ? alerts.map(a => `<div class="alert alert-${a.t}" onclick="App.showView('${a.go}')"><span class="alert-dot"></span><span>${a.msg}</span></div>`).join('')
            : `<div class="alert alert-ok"><span class="alert-dot"></span><span>Todo en orden. No hay incidencias.</span></div>`;

        // Documentos recientes
        const recent = docs.slice().sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)).slice(0, 8);
        UI.el('dashRecent').innerHTML = recent.length ? recent.map(d => {
            const e = Data.entityById(d.entityId);
            return `<div class="recent-row" onclick="Documents.openDetail('${d.id}')">
                <span class="ent-dot" style="--c:${e?.accent || '#999'}"></span>
                <span class="recent-main"><b>${UI.escape(e?.name || '')}</b><span class="recent-sub">${Data.DOC_TYPES[d.docType]?.label || ''} ${d.number ? '· ' + UI.escape(d.number) : ''} ${d.counterparty ? '· ' + UI.escape(d.counterparty) : ''}</span></span>
                <span class="recent-amt">${d.total != null ? Data.fmtMoney(d.total, d.currency) : '—'}</span>
                <span class="recent-date">${Data.fmtDate(d.date)}</span>
                ${UI.statusPill(d.status)}
            </div>`;
        }).join('') : '<div class="empty-soft">Aún no hay documentos. Pulsa <b>Capturar</b> para empezar.</div>';

        // Resumen por entidad (mini)
        const byEnt = {};
        docs.forEach(d => { const x = (byEnt[d.entityId] ||= { ing: 0, gas: 0 }); if (d.direction === 'emitida') x.ing += d.total || 0; else x.gas += d.total || 0; });
        UI.el('dashEntities').innerHTML = Storage.getEntities().map(e => {
            const x = byEnt[e.id] || { ing: 0, gas: 0 };
            return `<div class="mini-ent" onclick="Documents.setFilter('entity','${e.id}');App.showView('documentos')">
                <span class="ent-dot" style="--c:${e.accent}"></span>
                <span class="mini-ent-name">${UI.escape(e.name)}</span>
                <span class="mini-ent-fig pos">${Data.fmtMoney(x.ing, e.currency)}</span>
                <span class="mini-ent-fig neg">${Data.fmtMoney(x.gas, e.currency)}</span>
            </div>`;
        }).join('');
    },

    /* ---------- Eventos ---------- */
    bindEvents() {
        // Navegación
        UI.qsa('.nav-link').forEach(l => l.addEventListener('click', e => { e.preventDefault(); this.showView(l.dataset.view); }));
        window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== this.view) this.showView(v); });
        const burger = UI.el('btnBurger'); if (burger) burger.addEventListener('click', () => document.body.classList.toggle('nav-open'));
        const scrim = UI.el('navScrim'); if (scrim) scrim.addEventListener('click', () => document.body.classList.remove('nav-open'));

        // Cerrar modales
        UI.qsa('[data-close]').forEach(b => b.addEventListener('click', () => UI.closeModal(b.dataset.close)));
        UI.qsa('.modal-overlay').forEach(ov => ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('active'); }));
        document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.closeAllModals(); });

        // Capturar
        UI.qsa('[data-capture]').forEach(b => b.addEventListener('click', () => Capture.open()));
        UI.el('btnCapPhoto').addEventListener('click', () => UI.el('capCameraInput').click());
        UI.el('btnCapUpload').addEventListener('click', () => UI.el('capFileInput').click());
        UI.el('capCameraInput').addEventListener('change', e => Capture.handleFiles(e.target.files));
        UI.el('capFileInput').addEventListener('change', e => Capture.handleFiles(e.target.files));
        UI.el('capDirection').addEventListener('change', () => Capture.onDirectionChange());
        UI.el('capEntity').addEventListener('change', () => Capture.onEntityChange());
        UI.el('capBase').addEventListener('input', () => Capture.recalc('base'));
        UI.el('capTaxRate').addEventListener('input', () => Capture.recalc('rate'));
        UI.el('capTotal').addEventListener('change', () => Capture.recalc('total'));
        UI.el('btnCapOcr').addEventListener('click', () => Capture.runOcr());
        UI.el('btnCapExtract').addEventListener('click', () => Capture.extractFromText());
        UI.el('btnAddLine').addEventListener('click', () => Capture.addLine());
        UI.el('btnSuggestNumber').addEventListener('click', () => Capture.suggestNumber());
        UI.el('btnCapSave').addEventListener('click', () => Capture.save());
        UI.el('btnToggleDesglose').addEventListener('click', () => {
            const adv = UI.el('capAdvanced'); adv.classList.toggle('open');
            UI.el('btnToggleDesglose').textContent = adv.classList.contains('open') ? 'Ocultar desglose detallado' : 'Mostrar desglose detallado';
        });

        // Documentos: filtros
        UI.el('fltEntity').addEventListener('change', e => Documents.setFilter('entity', e.target.value));
        UI.el('fltDirection').addEventListener('change', e => Documents.setFilter('direction', e.target.value));
        UI.el('fltDocType').addEventListener('change', e => Documents.setFilter('docType', e.target.value));
        UI.el('fltStatus').addEventListener('change', e => Documents.setFilter('status', e.target.value));
        UI.el('fltPeriod').addEventListener('change', e => Documents.setFilter('period', e.target.value));
        UI.el('fltSearch').addEventListener('input', e => Documents.setFilter('q', e.target.value.trim()));

        // Reportes
        UI.el('repEntity').addEventListener('change', e => Reports.setFilter('entity', e.target.value));
        UI.el('repDirection').addEventListener('change', e => Reports.setFilter('direction', e.target.value));
        UI.el('repYear').addEventListener('change', e => Reports.setFilter('year', e.target.value));
        UI.el('btnExportCSV').addEventListener('click', () => Reports.exportCSV());
        UI.el('btnExportPackage').addEventListener('click', () => Reports.exportPackage());
        UI.el('btnExportBackup').addEventListener('click', () => Reports.exportBackup());

        // Integraciones
        UI.el('btnSaveHolded').addEventListener('click', () => Integrations.saveHolded());
        UI.el('btnSaveSupabase').addEventListener('click', () => Integrations.saveSupabase());
        UI.el('cfgRole').addEventListener('change', () => Integrations.saveRole());
        UI.el('cfgRevolutEntity').addEventListener('change', () => Integrations.saveRevolutEntity());
        UI.el('revolutFileInput').addEventListener('change', e => { Integrations.importRevolut(e.target.files[0]); e.target.value = ''; });
        UI.el('btnImportRevolut').addEventListener('click', () => UI.el('revolutFileInput').click());
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
