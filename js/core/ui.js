/* ============================================================
   Clinia — UI helpers
   - Modal, toast, confirm, render utilities
   ============================================================ */

(function (global) {
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function')
        node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.entries(v).forEach(([dk, dv]) => (node.dataset[dk] = dv));
      else if (v !== false && v != null) node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    });
    return node;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  // Format helpers
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(n);
  }
  function fmtAge(birthDateIso) {
    if (!birthDateIso) return '—';
    const b = new Date(birthDateIso);
    const t = new Date();
    let age = t.getFullYear() - b.getFullYear();
    if (
      t.getMonth() < b.getMonth() ||
      (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())
    )
      age--;
    return age + ' años';
  }
  function timeAgo(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'hace segundos';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
    return fmtDate(iso);
  }
  function initials(name) {
    if (!name) return '?';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  // Toast
  let toastContainer;
  function ensureToastContainer() {
    if (!toastContainer) {
      toastContainer = el('div', { class: 'toast-container' });
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }
  function toast(message, type = 'info', timeout = 3500) {
    const t = el('div', { class: `toast ${type}` }, message);
    ensureToastContainer().appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    }, timeout);
  }

  // Modal system
  function openModal({ title, body, footer, size }) {
    return new Promise((resolve) => {
      const close = (value) => {
        document.body.removeChild(backdrop);
        resolve(value);
      };
      const closeBtn = el(
        'button',
        { class: 'close-btn', onClick: () => close(null), 'aria-label': 'Cerrar' },
        '×'
      );
      const header = el('div', { class: 'modal-header' }, [
        el('h3', {}, title || ''),
        closeBtn,
      ]);
      const bodyEl = el('div', { class: 'modal-body' });
      if (typeof body === 'string') bodyEl.innerHTML = body;
      else if (body instanceof Node) bodyEl.appendChild(body);
      const footerEl = el('div', { class: 'modal-footer' });
      if (typeof footer === 'function') footer(footerEl, close);
      else if (footer instanceof Node) footerEl.appendChild(footer);
      else
        footerEl.appendChild(
          el('button', { class: 'btn', onClick: () => close(null) }, 'Cerrar')
        );
      const modal = el('div', { class: 'modal' + (size === 'lg' ? ' lg' : '') }, [
        header,
        bodyEl,
        footerEl,
      ]);
      const backdrop = el(
        'div',
        {
          class: 'modal-backdrop',
          onClick: (e) => {
            if (e.target === backdrop) close(null);
          },
        },
        modal
      );
      document.body.appendChild(backdrop);
    });
  }

  function confirm(message, opts = {}) {
    return openModal({
      title: opts.title || 'Confirmar',
      body: el('p', { class: 'text-muted' }, message),
      footer: (footer, close) => {
        footer.appendChild(
          el('button', { class: 'btn', onClick: () => close(false) }, 'Cancelar')
        );
        footer.appendChild(
          el(
            'button',
            {
              class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'),
              onClick: () => close(true),
            },
            opts.confirmLabel || 'Confirmar'
          )
        );
      },
    });
  }

  function prompt(message, opts = {}) {
    return new Promise((resolve) => {
      const input = el('input', {
        type: 'text',
        class: 'form-input',
        placeholder: opts.placeholder || '',
        value: opts.defaultValue || '',
      });
      const wrap = el('div', { class: 'form-field' }, [
        el('label', {}, message),
        input,
      ]);
      openModal({
        title: opts.title || 'Introduce un valor',
        body: wrap,
        footer: (footer, close) => {
          footer.appendChild(
            el('button', { class: 'btn', onClick: () => close(null) }, 'Cancelar')
          );
          footer.appendChild(
            el(
              'button',
              { class: 'btn btn-primary', onClick: () => close(input.value) },
              opts.confirmLabel || 'Aceptar'
            )
          );
        },
      }).then(resolve);
      setTimeout(() => input.focus(), 50);
    });
  }

  // Form helpers
  function field({ label, name, type = 'text', value = '', placeholder, hint, options, required }) {
    const id = 'f_' + name + '_' + Math.random().toString(36).slice(2, 6);
    let input;
    if (type === 'textarea') {
      input = el('textarea', { id, name, placeholder: placeholder || '' }, value || '');
    } else if (type === 'select') {
      input = el(
        'select',
        { id, name },
        (options || []).map((o) =>
          el(
            'option',
            { value: o.value ?? o, selected: (o.value ?? o) == value ? 'selected' : false },
            o.label ?? o
          )
        )
      );
    } else {
      input = el('input', { id, name, type, placeholder: placeholder || '', value });
    }
    if (required) input.setAttribute('required', 'required');
    const wrap = el('div', { class: 'form-field' }, [
      label ? el('label', { for: id }, label + (required ? ' *' : '')) : null,
      input,
      hint ? el('div', { class: 'hint' }, hint) : null,
    ]);
    return { wrap, input };
  }

  function formData(form) {
    const data = {};
    new FormData(form).forEach((v, k) => {
      if (data[k] != null) {
        if (Array.isArray(data[k])) data[k].push(v);
        else data[k] = [data[k], v];
      } else data[k] = v;
    });
    return data;
  }

  // Render a status pill mapping logical statuses to CSS classes
  function statusPill(status) {
    const map = {
      draft: ['draft', 'Borrador'],
      pending_review: ['pending', 'Pendiente revisión'],
      validating: ['validating', 'En validación'],
      validated: ['validated', 'Validado'],
      changes_requested: ['changes', 'Cambios solicitados'],
      consensus_complete: ['validated', 'Consenso completo'],
      consensus_partial: ['validating', 'Consenso parcial'],
      rejected: ['rejected', 'Rechazado'],
      budgeted: ['budgeted', 'Presupuestado'],
      presented: ['budgeted', 'Presentado'],
      accepted: ['accepted', 'Aceptado'],
      partial_accepted: ['partial', 'Parcial'],
      negotiating: ['changes', 'En negociación'],
      in_progress: ['in-progress', 'En curso'],
      completed: ['validated', 'Completado'],
    };
    const [cls, label] = map[status] || ['draft', status || '—'];
    return `<span class="status ${cls}">${escapeHtml(label)}</span>`;
  }

  global.UI = {
    el,
    escapeHtml,
    fmtDate,
    fmtDateTime,
    fmtMoney,
    fmtAge,
    timeAgo,
    initials,
    toast,
    openModal,
    confirm,
    prompt,
    field,
    formData,
    statusPill,
  };
})(window);
