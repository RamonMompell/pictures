/* ============================================================
   Clinia — Budget module
   Generates a budget from the consensus plan, supports versions
   (clinical, commercial, final) and discounts.
   ============================================================ */

(function (global) {
  const { el, escapeHtml, fmtMoney, toast, openModal } = UI;

  function getOrInitBudget(patientId) {
    let budget = DB.budgets.where((b) => b.patientId === patientId)[0];
    if (!budget) {
      const plan = DB.treatmentPlans.where((p) => p.patientId === patientId)[0];
      if (!plan) return null;
      budget = DB.budgets.insert({
        patientId,
        planId: plan.id,
        status: 'draft',
      });
    }
    return budget;
  }

  function generateFromPlan(budget, planVersion, type = 'clinical', derivedFromId = null, opts = {}) {
    const u = Auth.currentUser();
    const items = (planVersion.items || []).map((it) => {
      const cat = it.catalogItemId ? DB.catalog.get(it.catalogItemId) : null;
      const unit = it.priceOverride ?? cat?.price ?? 0;
      return {
        id: DB.uid('bi'),
        planItemId: it.id,
        catalogItemId: it.catalogItemId,
        description: it.title,
        specialtyId: it.specialtyId,
        phaseOrder: it.phaseOrder,
        necessity: it.necessity,
        quantity: 1,
        unitPrice: unit,
        discount: 0,
        total: unit,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const discount = opts.discount || 0;
    const tax = 0;
    const total = subtotal - discount + tax;
    const versionNumber =
      (DB.budgetVersions.where((bv) => bv.budgetId === budget.id).length || 0) + 1;
    const bv = DB.budgetVersions.insert({
      budgetId: budget.id,
      versionNumber,
      type,
      derivedFromId,
      planVersionId: planVersion.id,
      authorId: u.id,
      authorName: u.name,
      items,
      totals: {
        subtotal,
        discount,
        tax,
        total,
        necessary: items.filter((i) => i.necessity === 'necessary').reduce((s, i) => s + i.total, 0),
        recommendable: items.filter((i) => i.necessity === 'recommendable').reduce((s, i) => s + i.total, 0),
      },
      status: 'draft',
    });
    DB.budgets.update(budget.id, { currentBudgetVersionId: bv.id, status: 'budgeted' });
    Audit.log('budget.generate', { targetType: 'budget', targetId: budget.id, details: { type, version: versionNumber } });
    return bv;
  }

  function render(root, patientId) {
    const u = Auth.currentUser();
    if (!Permissions.can(u, Permissions.CAP.BUDGET_VIEW)) {
      root.innerHTML = '<div class="empty"><h3>Sin acceso al presupuesto</h3></div>';
      return;
    }
    const budget = getOrInitBudget(patientId);
    if (!budget) {
      root.innerHTML = '<div class="empty"><h3>Crea primero un plan de tratamiento</h3></div>';
      return;
    }
    const plan = DB.treatmentPlans.get(budget.planId);
    const planVersion = plan.currentVersionId ? DB.planVersions.get(plan.currentVersionId) : null;

    root.innerHTML = '';
    const header = el('div', { class: 'plan-header' }, [
      el('div', {}, [
        el('h2', { class: 'mb-0' }, 'Presupuesto'),
        el('div', { class: 'plan-meta' }, [
          el('span', {}, 'Estado: ' + (budget.status || 'draft')),
          el('span', {}, '· Plan v' + (planVersion?.versionNumber || '—')),
        ]),
      ]),
      el('div', { class: 'row' }, [
        el(
          'button',
          {
            class: 'btn btn-primary',
            onClick: () => {
              const bv = generateFromPlan(budget, planVersion, 'clinical');
              toast('Versión clínica v' + bv.versionNumber + ' generada', 'success');
              render(root, patientId);
            },
          },
          'Generar versión clínica'
        ),
      ]),
    ]);
    root.appendChild(header);

    const versions = DB.budgetVersions
      .where((bv) => bv.budgetId === budget.id)
      .sort((a, b) => a.versionNumber - b.versionNumber);

    if (versions.length === 0) {
      root.appendChild(
        el('div', { class: 'empty' }, [
          el('div', { class: 'icon' }, '€'),
          el('h3', {}, 'Sin presupuesto generado'),
          el('p', {}, 'Pulsa "Generar versión clínica" para construir el presupuesto a partir del plan vigente.'),
        ])
      );
      return;
    }

    // Versions selector
    const vCard = el('div', { class: 'card' });
    vCard.appendChild(el('div', { class: 'card-header' }, [el('h3', {}, 'Versiones del presupuesto')]));
    const versionList = el('div', { class: 'version-list' });
    versions.forEach((bv) => {
      const row = el(
        'div',
        {
          class:
            'version-item' +
            (bv.id === budget.currentBudgetVersionId ? ' active' : ''),
          onClick: () => {
            DB.budgets.update(budget.id, { currentBudgetVersionId: bv.id });
            render(root, patientId);
          },
        },
        [
          el('div', {}, [
            el('div', {}, 'v' + bv.versionNumber + ' · ' + bv.type),
            el('small', { class: 'text-muted' }, fmtMoney(bv.totals?.total) + ' · ' + escapeHtml(bv.authorName || '')),
          ]),
          el('div', {}, bv.derivedFromId ? '↳ derivada' : 'original'),
        ]
      );
      versionList.appendChild(row);
    });
    vCard.appendChild(versionList);
    root.appendChild(vCard);

    // Selected version detail
    const current = budget.currentBudgetVersionId
      ? DB.budgetVersions.get(budget.currentBudgetVersionId)
      : versions[versions.length - 1];

    const detail = el('div', { class: 'card' });
    detail.appendChild(
      el('div', { class: 'card-header' }, [
        el('h3', {}, 'Versión v' + current.versionNumber + ' — ' + current.type),
        el('div', { class: 'row' }, [
          el(
            'button',
            {
              class: 'btn btn-sm',
              onClick: () => deriveCommercial(budget, current),
            },
            'Crear versión comercial'
          ),
        ]),
      ])
    );

    const table = el('table', { class: 'table' });
    table.innerHTML = `
      <thead>
        <tr>
          <th>Concepto</th>
          <th>Especialidad</th>
          <th>Necesidad</th>
          <th class="text-right">Cant.</th>
          <th class="text-right">Precio</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    current.items.forEach((it) => {
      const sp = DB.specialties.get(it.specialtyId);
      const tr = el('tr');
      tr.innerHTML = `
        <td>${escapeHtml(it.description)}</td>
        <td><span class="specialty-chip" style="--specialty-color:${sp?.color || ''}">${escapeHtml(sp?.name || '')}</span></td>
        <td><span class="badge ${it.necessity === 'necessary' ? 'danger' : 'info'}">${it.necessity === 'necessary' ? 'Necesario' : 'Recomendable'}</span></td>
        <td class="text-right">${it.quantity}</td>
        <td class="text-right">${fmtMoney(it.unitPrice)}</td>
        <td class="text-right mono">${fmtMoney(it.total)}</td>
      `;
      tbody.appendChild(tr);
    });
    detail.appendChild(table);

    const totals = el('div', { class: 'budget-totals' }, [
      el('div', { class: 'kpi' }, [
        el('div', { class: 'label' }, 'Necesario'),
        el('div', { class: 'value' }, fmtMoney(current.totals.necessary)),
      ]),
      el('div', { class: 'kpi' }, [
        el('div', { class: 'label' }, 'Recomendable'),
        el('div', { class: 'value' }, fmtMoney(current.totals.recommendable)),
      ]),
      el('div', { class: 'kpi' }, [
        el('div', { class: 'label' }, 'Total'),
        el('div', { class: 'value' }, fmtMoney(current.totals.total)),
      ]),
    ]);
    detail.appendChild(totals);

    root.appendChild(detail);
  }

  function deriveCommercial(budget, sourceVersion) {
    if (!Permissions.can(Auth.currentUser(), Permissions.CAP.BUDGET_EDIT)) {
      return toast('Sin permiso para crear versión comercial', 'error');
    }
    UI.prompt('Descuento global (€)', { defaultValue: '0', placeholder: 'Importe' }).then((val) => {
      if (val == null) return;
      const discount = parseFloat(val) || 0;
      const versionNumber =
        (DB.budgetVersions.where((bv) => bv.budgetId === budget.id).length || 0) + 1;
      const items = sourceVersion.items.map((i) => ({ ...i, id: DB.uid('bi') }));
      const subtotal = items.reduce((s, i) => s + i.total, 0);
      const totals = {
        subtotal,
        discount,
        tax: 0,
        total: subtotal - discount,
        necessary: items.filter((i) => i.necessity === 'necessary').reduce((s, i) => s + i.total, 0),
        recommendable: items.filter((i) => i.necessity === 'recommendable').reduce((s, i) => s + i.total, 0),
      };
      const bv = DB.budgetVersions.insert({
        budgetId: budget.id,
        versionNumber,
        type: 'commercial',
        derivedFromId: sourceVersion.id,
        planVersionId: sourceVersion.planVersionId,
        authorId: Auth.currentUser().id,
        authorName: Auth.currentUser().name,
        items,
        totals,
        status: 'draft',
      });
      DB.budgets.update(budget.id, { currentBudgetVersionId: bv.id });
      Audit.log('budget.derive_commercial', { targetType: 'budget', targetId: budget.id, details: { discount, version: versionNumber } });
      toast('Versión comercial v' + versionNumber + ' creada', 'success');
      Patients.renderDetail(document.getElementById('view'), budget.patientId, { tab: 'budget' });
    });
  }

  global.Budget = { render, getOrInitBudget, generateFromPlan };
})(window);
