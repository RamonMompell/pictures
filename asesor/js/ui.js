/* =====================================================================
   ÁBACO — ui.js
   Utilidades de interfaz: toasts, modales, helpers DOM, descargas.
   ===================================================================== */

const UI = {
    /* ---- DOM helpers ---- */
    el(id) { return document.getElementById(id); },
    qs(sel, root = document) { return root.querySelector(sel); },
    qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); },

    /* Crea un elemento con atributos e hijos */
    h(tag, attrs = {}, children = []) {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'class') node.className = v;
            else if (k === 'html') node.innerHTML = v;
            else if (k === 'text') node.textContent = v;
            else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
            else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
        }
        (Array.isArray(children) ? children : [children]).forEach(c => {
            if (c == null) return;
            node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return node;
    },

    escape(str) {
        return String(str ?? '').replace(/[&<>"']/g, m => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
        ));
    },

    /* ---- Toasts ---- */
    toast(message, type = 'info', timeout = 3200) {
        let host = this.el('toastHost');
        if (!host) {
            host = this.h('div', { id: 'toastHost', class: 'toast-host' });
            document.body.appendChild(host);
        }
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
            error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        const t = this.h('div', { class: `toast toast-${type}`, html: `<span class="toast-ic">${icons[type] || icons.info}</span><span>${this.escape(message)}</span>` });
        host.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 260); }, timeout);
    },

    /* ---- Modales ---- */
    openModal(id) { const m = this.el(id); if (m) m.classList.add('active'); },
    closeModal(id) { const m = this.el(id); if (m) m.classList.remove('active'); },
    closeAllModals() { this.qsa('.modal-overlay.active').forEach(m => m.classList.remove('active')); },

    /* Confirmación simple (promesa) */
    confirm(message, { title = 'Confirmar', danger = false, okText = 'Aceptar' } = {}) {
        return new Promise((resolve) => {
            const overlay = this.h('div', { class: 'modal-overlay active' });
            const box = this.h('div', { class: 'modal modal-sm' }, [
                this.h('div', { class: 'modal-head' }, [this.h('h3', { text: title })]),
                this.h('div', { class: 'modal-body', html: `<p>${this.escape(message)}</p>` }),
                this.h('div', { class: 'modal-foot' }, [
                    this.h('button', { class: 'btn btn-ghost', text: 'Cancelar', onclick: () => { overlay.remove(); resolve(false); } }),
                    this.h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, text: okText, onclick: () => { overlay.remove(); resolve(true); } })
                ])
            ]);
            overlay.appendChild(box);
            overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
            document.body.appendChild(overlay);
        });
    },

    /* ---- Descargas ---- */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = this.h('a', { href: url, download: filename });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    },
    downloadText(text, filename, mime = 'text/plain') {
        this.downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
    },

    /* ---- Lectura de archivos ---- */
    fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(file);
        });
    },
    fileToBytes(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(new Uint8Array(r.result));
            r.onerror = reject;
            r.readAsArrayBuffer(file);
        });
    },
    fileToText(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = reject;
            r.readAsText(file);
        });
    },

    /* Slug seguro para nombres de archivo */
    slug(str) {
        return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'doc';
    },

    /* Píldora de estado */
    statusPill(status) {
        const s = Data.STATUS[status] || Data.STATUS.nuevo;
        return `<span class="pill" style="--pill:${s.color}">${s.label}</span>`;
    },

    /* Rellena un <select> con opciones */
    fillSelect(select, items, { value = 'id', label = 'name', placeholder = null, selected = null } = {}) {
        if (!select) return;
        select.innerHTML = '';
        if (placeholder !== null) select.appendChild(this.h('option', { value: '', text: placeholder }));
        items.forEach(it => {
            const opt = this.h('option', { value: typeof it === 'string' ? it : it[value], text: typeof it === 'string' ? it : it[label] });
            if (selected != null && opt.value === String(selected)) opt.selected = true;
            select.appendChild(opt);
        });
    }
};
