/* ============================================================
   Clinia — Audit log viewer
   ============================================================ */

(function (global) {
  const { el, escapeHtml, fmtDateTime, initials } = UI;

  function render(root) {
    if (!Permissions.can(Auth.currentUser(), Permissions.CAP.AUDIT_VIEW)) {
      root.innerHTML = '<div class="empty"><h3>Sin permisos para ver auditoría</h3></div>';
      return;
    }
    root.innerHTML = '';
    root.appendChild(
      el('div', { class: 'page-header' }, [
        el('div', {}, [
          el('h1', {}, 'Auditoría'),
          el('div', { class: 'subtitle' }, 'Registro completo de acciones del sistema'),
        ]),
      ])
    );

    const log = DB.auditLog.all().slice().reverse();
    if (log.length === 0) {
      root.appendChild(el('div', { class: 'empty' }, 'Sin entradas de auditoría.'));
      return;
    }
    const table = el('table', { class: 'table' });
    table.innerHTML = `
      <thead>
        <tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Objeto</th><th>Detalles</th></tr>
      </thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    log.forEach((l) => {
      const tr = el('tr');
      tr.innerHTML = `
        <td class="text-muted">${escapeHtml(fmtDateTime(l.createdAt))}</td>
        <td>${escapeHtml(l.userName || 'Sistema')}</td>
        <td><span class="badge brand">${escapeHtml(l.action)}</span></td>
        <td>${escapeHtml((l.targetType || '') + ' · ' + (l.targetId || ''))}</td>
        <td><small class="text-muted">${escapeHtml(JSON.stringify(l.details || {}))}</small></td>`;
      tbody.appendChild(tr);
    });
    const card = el('div', { class: 'patient-table' }, [table]);
    root.appendChild(card);
  }

  global.AuditView = { render };
})(window);
