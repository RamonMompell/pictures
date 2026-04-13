/* ============================================================
   Clinia — Users & roles management
   ============================================================ */

(function (global) {
  const { el, escapeHtml, fmtDate, toast, openModal, field, formData, initials } = UI;

  function render(root) {
    const u = Auth.currentUser();
    if (!Permissions.can(u, Permissions.CAP.USERS_MANAGE)) {
      root.innerHTML = '<div class="empty"><h3>Sin permisos para gestionar usuarios</h3></div>';
      return;
    }

    root.innerHTML = '';
    root.appendChild(
      el('div', { class: 'page-header' }, [
        el('div', {}, [
          el('h1', {}, 'Usuarios y permisos'),
          el('div', { class: 'subtitle' }, 'Roles, especialidades, accesos y bloqueos'),
        ]),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn btn-primary', onClick: () => openUserModal() }, '+ Nuevo usuario'),
        ]),
      ])
    );

    const users = DB.users.all();
    const card = el('div', { class: 'patient-table' });
    const table = el('table', { class: 'table' });
    table.innerHTML = `
      <thead>
        <tr>
          <th>Usuario</th>
          <th>Email</th>
          <th>Roles</th>
          <th>Especialidades</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    users.forEach((usr) => {
      const tr = el('tr');
      const specs = (usr.specialties || []).map((id) => DB.specialties.get(id)?.name).filter(Boolean).join(', ');
      tr.innerHTML = `
        <td>
          <div class="patient-row-name">
            <div class="avatar">${escapeHtml(initials(usr.name))}</div>
            <div>${escapeHtml(usr.name)}</div>
          </div>
        </td>
        <td>${escapeHtml(usr.email)}</td>
        <td>${(usr.roles || []).map((r) => `<span class="badge">${Permissions.label(r)}</span>`).join(' ')}</td>
        <td><small>${escapeHtml(specs || '—')}</small></td>
        <td><span class="badge ${usr.active ? 'success' : 'danger'}">${usr.active ? 'Activo' : 'Bloqueado'}</span></td>
        <td class="text-right"></td>
      `;
      const cell = tr.children[5];
      cell.appendChild(
        el('button', { class: 'btn btn-sm btn-ghost', onClick: () => openUserModal(usr) }, 'Editar')
      );
      if (usr.active) {
        cell.appendChild(
          el(
            'button',
            {
              class: 'btn btn-sm btn-danger',
              onClick: async () => {
                const reason = await UI.prompt('Motivo del bloqueo');
                if (reason == null) return;
                Auth.block(usr.id, reason);
                toast('Usuario bloqueado', 'warn');
                render(root);
              },
            },
            'Bloquear'
          )
        );
      } else {
        cell.appendChild(
          el(
            'button',
            {
              class: 'btn btn-sm',
              onClick: () => {
                Auth.unblock(usr.id);
                toast('Usuario reactivado', 'success');
                render(root);
              },
            },
            'Desbloquear'
          )
        );
      }
      tbody.appendChild(tr);
    });
    card.appendChild(table);
    root.appendChild(card);
  }

  function openUserModal(existing = null) {
    const form = el('form');
    const f1 = field({ label: 'Nombre completo', name: 'name', required: true, value: existing?.name });
    const f2 = field({ label: 'Email', name: 'email', type: 'email', required: true, value: existing?.email });
    const f3 = field({
      label: 'Rol principal',
      name: 'role',
      type: 'select',
      options: Object.entries(Permissions.ROLE_LABELS).map(([v, l]) => ({ value: v, label: l })),
      value: (existing?.roles || [])[0] || 'DOCTOR',
    });
    form.appendChild(el('div', { class: 'form-row' }, [f1.wrap, f2.wrap]));
    form.appendChild(f3.wrap);
    if (!existing) {
      const f4 = field({ label: 'Contraseña', name: 'password', type: 'password', value: 'demo' });
      form.appendChild(f4.wrap);
    }
    // Specialties checkboxes
    const specWrap = el('div', { class: 'form-field' }, [
      el('label', {}, 'Especialidades'),
    ]);
    const grid = el('div', { class: 'row-wrap' });
    const selected = new Set(existing?.specialties || []);
    DB.specialties.all().forEach((sp) => {
      const btn = el(
        'button',
        {
          type: 'button',
          class: 'specialty-chip',
          style: {
            cursor: 'pointer',
            padding: '6px 12px',
            fontSize: '12px',
            background: selected.has(sp.id) ? 'var(--c-brand-50)' : 'var(--c-bg-alt)',
            border: selected.has(sp.id) ? '1px solid var(--c-brand)' : '1px solid transparent',
            '--specialty-color': sp.color,
          },
          onClick: (e) => {
            e.preventDefault();
            if (selected.has(sp.id)) selected.delete(sp.id);
            else selected.add(sp.id);
            btn.style.background = selected.has(sp.id) ? 'var(--c-brand-50)' : 'var(--c-bg-alt)';
            btn.style.border = selected.has(sp.id) ? '1px solid var(--c-brand)' : '1px solid transparent';
          },
        },
        sp.name
      );
      grid.appendChild(btn);
    });
    specWrap.appendChild(grid);
    form.appendChild(specWrap);

    openModal({
      title: existing ? 'Editar usuario' : 'Nuevo usuario',
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
                if (!data.name || !data.email) return toast('Faltan campos', 'error');
                const payload = {
                  name: data.name,
                  email: data.email,
                  roles: [data.role],
                  specialties: Array.from(selected),
                };
                if (existing) {
                  DB.users.update(existing.id, payload);
                } else {
                  DB.users.insert({
                    ...payload,
                    active: true,
                    passwordHash: Auth.fakeHash(data.password || 'demo'),
                  });
                }
                Audit.log('user.' + (existing ? 'update' : 'create'), {
                  targetType: 'user',
                  targetId: existing?.id || 'new',
                });
                close(null);
                toast('Usuario guardado', 'success');
                render(document.getElementById('view'));
              },
            },
            'Guardar'
          )
        );
      },
    });
  }

  global.Users = { render };
})(window);
