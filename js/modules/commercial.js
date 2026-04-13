/* ============================================================
   Clinia — Commercial / Sales module
   Coordinator presents the budget, registers acceptance,
   and preserves traceability across versions.
   ============================================================ */

(function (global) {
  const { el, escapeHtml, fmtMoney, fmtDateTime, toast, openModal, field, formData, statusPill } = UI;

  function getOrInitStatus(budgetId) {
    let s = DB.commercialStatuses.where((c) => c.budgetId === budgetId)[0];
    if (!s) {
      s = DB.commercialStatuses.insert({
        budgetId,
        status: 'draft',
        history: [],
      });
    }
    return s;
  }

  function render(root, patientId) {
    const u = Auth.currentUser();
    if (!Permissions.can(u, Permissions.CAP.BUDGET_VIEW)) {
      root.innerHTML = '<div class="empty"><h3>Sin acceso</h3></div>';
      return;
    }
    const budget = DB.budgets.where((b) => b.patientId === patientId)[0];
    if (!budget) {
      root.innerHTML =
        '<div class="empty"><h3>Genera primero el presupuesto</h3><p>Desde la pestaña «Presupuesto».</p></div>';
      return;
    }
    const status = getOrInitStatus(budget.id);
    const allVersions = DB.budgetVersions
      .where((bv) => bv.budgetId === budget.id)
      .sort((a, b) => a.versionNumber - b.versionNumber);

    root.innerHTML = '';

    // Top KPIs / status
    const card = el('div', { class: 'card' });
    card.appendChild(
      el('div', { class: 'card-header' }, [
        el('h3', {}, 'Estado comercial'),
        el('span', { class: 'badge' }, statusLabel(status.status)),
      ])
    );

    const cur = budget.currentBudgetVersionId
      ? DB.budgetVersions.get(budget.currentBudgetVersionId)
      : allVersions[allVersions.length - 1];

    const kpis = el('div', { class: 'budget-totals' }, [
      el('div', { class: 'kpi' }, [
        el('div', { class: 'label' }, 'Versión actual'),
        el('div', { class: 'value' }, 'v' + cur.versionNumber),
        el('div', { class: 'sub' }, cur.type),
      ]),
      el('div', { class: 'kpi' }, [
        el('div', { class: 'label' }, 'Total'),
        el('div', { class: 'value' }, fmtMoney(cur.totals.total)),
      ]),
      el('div', { class: 'kpi' }, [
        el('div', { class: 'label' }, 'Aceptado'),
        el('div', { class: 'value' }, fmtMoney(status.acceptedValue || 0)),
      ]),
    ]);
    card.appendChild(kpis);

    // Action buttons
    const actions = el('div', { class: 'row', style: { marginTop: '14px', gap: '8px', flexWrap: 'wrap' } }, [
      el('button', { class: 'btn', onClick: () => updateStatus(status, 'presented', cur, patientId) }, 'Marcar como presentado'),
      el('button', { class: 'btn', onClick: () => updateStatus(status, 'negotiating', cur, patientId) }, 'En negociación'),
      el('button', { class: 'btn', onClick: () => acceptModal(status, cur, patientId, 'accepted') }, '✓ Aceptado total'),
      el('button', { class: 'btn', onClick: () => acceptModal(status, cur, patientId, 'partial_accepted') }, 'Aceptado parcial'),
      el('button', { class: 'btn btn-danger', onClick: () => updateStatus(status, 'rejected', cur, patientId) }, 'Rechazado'),
    ]);
    card.appendChild(actions);

    if (status.objections) {
      const o = el('div', { style: { marginTop: '14px' } });
      o.innerHTML = `<strong>Objeciones / observaciones del paciente:</strong><br>${escapeHtml(status.objections)}`;
      card.appendChild(o);
    }
    root.appendChild(card);

    // Versions traceability
    const trace = el('div', { class: 'card' });
    trace.appendChild(el('div', { class: 'card-header' }, [el('h3', {}, 'Trazabilidad de versiones')]));
    if (allVersions.length === 0) {
      trace.appendChild(el('p', { class: 'text-muted' }, 'Sin versiones generadas.'));
    } else {
      const list = el('div', { class: 'version-list' });
      allVersions.forEach((bv) => {
        const derived = bv.derivedFromId ? '↳ derivada de v' + DB.budgetVersions.get(bv.derivedFromId)?.versionNumber : 'original';
        list.appendChild(
          el('div', { class: 'version-item' + (bv.id === budget.currentBudgetVersionId ? ' active' : '') }, [
            el('div', {}, [
              el('div', {}, 'v' + bv.versionNumber + ' · ' + bv.type + ' · ' + escapeHtml(derived)),
              el('small', { class: 'text-muted' }, escapeHtml(bv.authorName) + ' · ' + fmtMoney(bv.totals.total)),
            ]),
            el('div', {}, fmtDateTime(bv.createdAt)),
          ])
        );
      });
      trace.appendChild(list);
    }
    root.appendChild(trace);

    // History timeline
    if (status.history && status.history.length) {
      const hist = el('div', { class: 'card' });
      hist.appendChild(el('div', { class: 'card-header' }, [el('h3', {}, 'Historial comercial')]));
      const list = el('div', { class: 'activity-list' });
      status.history
        .slice()
        .reverse()
        .forEach((h) => {
          list.appendChild(
            el('div', { class: 'activity-item' }, [
              el('div', { class: 'avatar' }, '€'),
              el('div', { class: 'text' }, [
                el('div', {}, h.action + ' — ' + escapeHtml(h.note || '')),
                el('div', { class: 'time' }, fmtDateTime(h.at)),
              ]),
            ])
          );
        });
      hist.appendChild(list);
      root.appendChild(hist);
    }
  }

  function statusLabel(s) {
    const map = {
      draft: 'Borrador',
      presented: 'Presentado',
      negotiating: 'En negociación',
      accepted: 'Aceptado',
      partial_accepted: 'Parcialmente aceptado',
      rejected: 'Rechazado',
    };
    return map[s] || s;
  }

  function updateStatus(status, newStatus, version, patientId) {
    const u = Auth.currentUser();
    const history = (status.history || []).concat({
      action: statusLabel(newStatus),
      note: '',
      at: DB.now(),
      by: u.id,
      versionId: version.id,
    });
    DB.commercialStatuses.update(status.id, { status: newStatus, history });
    if (newStatus === 'rejected') {
      DB.patients.update(patientId, { status: 'planning' });
    }
    Audit.log('commercial.' + newStatus, { targetType: 'patient', targetId: patientId });
    toast('Estado actualizado', 'success');
    Patients.renderDetail(document.getElementById('view'), patientId, { tab: 'commercial' });
  }

  function acceptModal(status, version, patientId, statusType) {
    const form = el('form');
    const f1 = field({
      label: 'Importe aceptado',
      name: 'acceptedValue',
      type: 'number',
      value: statusType === 'accepted' ? version.totals.total : 0,
    });
    const f2 = field({ label: 'Objeciones / observaciones', name: 'objections', type: 'textarea' });
    const f3 = field({ label: 'Fecha prevista de inicio', name: 'startDate', type: 'date' });
    form.appendChild(f1.wrap);
    form.appendChild(f2.wrap);
    form.appendChild(f3.wrap);
    openModal({
      title: statusType === 'accepted' ? 'Registrar aceptación total' : 'Registrar aceptación parcial',
      body: form,
      footer: (footer, close) => {
        footer.appendChild(el('button', { class: 'btn', onClick: () => close(null) }, 'Cancelar'));
        footer.appendChild(
          el(
            'button',
            {
              class: 'btn btn-primary',
              onClick: () => {
                const data = formData(form);
                const u = Auth.currentUser();
                const history = (status.history || []).concat({
                  action: statusLabel(statusType),
                  note: data.objections || '',
                  at: DB.now(),
                  by: u.id,
                  versionId: version.id,
                });
                DB.commercialStatuses.update(status.id, {
                  status: statusType,
                  acceptedValue: parseFloat(data.acceptedValue) || 0,
                  objections: data.objections,
                  startDate: data.startDate,
                  history,
                });
                DB.patients.update(patientId, { status: 'in_treatment' });
                // Mark the version as final
                DB.budgetVersions.update(version.id, { type: 'final', status: 'accepted' });
                Audit.log('commercial.' + statusType, {
                  targetType: 'patient',
                  targetId: patientId,
                  details: { value: data.acceptedValue },
                });
                close(null);
                toast('Aceptación registrada', 'success');
                Patients.renderDetail(document.getElementById('view'), patientId, { tab: 'commercial' });
              },
            },
            'Registrar'
          )
        );
      },
    });
  }

  global.Commercial = { render };
})(window);
