/* ============================================================
   Clinia — Catalog management
   ============================================================ */

(function (global) {
  const { el, escapeHtml, fmtMoney, toast, openModal, field, formData } = UI;

  function render(root) {
    if (!Permissions.can(Auth.currentUser(), Permissions.CAP.PATIENT_READ)) {
      root.innerHTML = '<div class="empty"><h3>Sin acceso</h3></div>';
      return;
    }
    root.innerHTML = '';
    root.appendChild(
      el('div', { class: 'page-header' }, [
        el('div', {}, [
          el('h1', {}, 'Catálogo de tratamientos'),
          el('div', { class: 'subtitle' }, 'Conceptos presupuestarios, precios y especialidades'),
        ]),
        el('div', { class: 'actions' }, [
          Permissions.can(Auth.currentUser(), Permissions.CAP.CATALOG_MANAGE)
            ? el('button', { class: 'btn btn-primary', onClick: () => openItemModal() }, '+ Nuevo concepto')
            : null,
        ]),
      ])
    );

    const items = DB.catalog.all();
    if (items.length === 0) {
      root.appendChild(el('div', { class: 'empty' }, 'Sin conceptos en el catálogo.'));
      return;
    }

    const card = el('div', { class: 'patient-table' });
    const table = el('table', { class: 'table' });
    table.innerHTML = `
      <thead>
        <tr>
          <th>Código</th>
          <th>Concepto</th>
          <th>Especialidad</th>
          <th>Categoría</th>
          <th class="text-right">Precio</th>
          <th class="text-right">Coste</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    items.forEach((it) => {
      const sp = DB.specialties.get(it.specialtyId);
      const tr = el('tr');
      tr.innerHTML = `
        <td class="mono">${escapeHtml(it.code)}</td>
        <td>${escapeHtml(it.name)}</td>
        <td><span class="specialty-chip" style="--specialty-color:${sp?.color || ''}">${escapeHtml(sp?.name || '')}</span></td>
        <td>${escapeHtml(it.category || '')}</td>
        <td class="text-right mono">${fmtMoney(it.price)}</td>
        <td class="text-right text-muted">${fmtMoney(it.cost)}</td>
        <td><span class="badge ${it.active ? 'success' : ''}">${it.active ? 'Activo' : 'Inactivo'}</span></td>
        <td class="text-right"></td>
      `;
      const cell = tr.children[7];
      if (Permissions.can(Auth.currentUser(), Permissions.CAP.CATALOG_MANAGE)) {
        cell.appendChild(
          el('button', { class: 'btn btn-sm btn-ghost', onClick: () => openItemModal(it) }, 'Editar')
        );
      }
      tbody.appendChild(tr);
    });
    card.appendChild(table);
    root.appendChild(card);
  }

  function openItemModal(existing = null) {
    const form = el('form');
    const f1 = field({ label: 'Código', name: 'code', value: existing?.code, required: true });
    const f2 = field({ label: 'Nombre', name: 'name', value: existing?.name, required: true });
    const f3 = field({
      label: 'Especialidad',
      name: 'specialtyId',
      type: 'select',
      options: DB.specialties.all().map((s) => ({ value: s.id, label: s.name })),
      value: existing?.specialtyId,
    });
    const f4 = field({ label: 'Categoría', name: 'category', value: existing?.category });
    const f5 = field({ label: 'Precio (€)', name: 'price', type: 'number', value: existing?.price ?? 0 });
    const f6 = field({ label: 'Coste interno (€)', name: 'cost', type: 'number', value: existing?.cost ?? 0 });
    const f7 = field({ label: 'Duración (min)', name: 'duration', type: 'number', value: existing?.duration ?? 0 });
    const f8 = field({ label: 'Descripción', name: 'description', type: 'textarea', value: existing?.description });
    form.appendChild(el('div', { class: 'form-row' }, [f1.wrap, f2.wrap]));
    form.appendChild(el('div', { class: 'form-row' }, [f3.wrap, f4.wrap]));
    form.appendChild(el('div', { class: 'form-row form-row-3' }, [f5.wrap, f6.wrap, f7.wrap]));
    form.appendChild(f8.wrap);

    openModal({
      title: existing ? 'Editar concepto' : 'Nuevo concepto',
      body: form,
      size: 'lg',
      footer: (footer, close) => {
        footer.appendChild(el('button', { class: 'btn', onClick: () => close(null) }, 'Cancelar'));
        footer.appendChild(
          el(
            'button',
            {
              class: 'btn btn-primary',
              onClick: () => {
                const data = formData(form);
                data.price = parseFloat(data.price) || 0;
                data.cost = parseFloat(data.cost) || 0;
                data.duration = parseFloat(data.duration) || 0;
                if (existing) DB.catalog.update(existing.id, data);
                else DB.catalog.insert({ ...data, active: true });
                Audit.log('catalog.' + (existing ? 'update' : 'create'), {
                  targetType: 'catalog',
                  targetId: existing?.id,
                });
                close(null);
                toast('Catálogo actualizado', 'success');
                render(document.getElementById('view'));
              },
            },
            'Guardar'
          )
        );
      },
    });
  }

  global.Catalog = { render };
})(window);
