/* ============================================================
   Clinia — Patients module
   List, create, view (full record with tabs)
   ============================================================ */

(function (global) {
  const { el, escapeHtml, fmtDate, fmtAge, initials, statusPill, toast, openModal, field, formData } = UI;

  function badgeForStatus(s) {
    return statusPill(s || 'draft');
  }

  function renderList(root) {
    root.innerHTML = '';
    const user = Auth.currentUser();
    const role = RoleConfig.primaryRole(user);

    // Role-aware subtitle
    const subtitleByRole = {
      PLANNER: 'Empieza una primera visita o continúa con tus casos.',
      DOCTOR: 'Tus pacientes en seguimiento. Abre uno para validar su plan.',
      COORDINATOR: 'Gestiona presupuestos, presentaciones y citas.',
      ASSISTANT: 'Agenda operativa y próximos pasos.',
      DIRECTOR: 'Vista global de los casos de la clínica.',
      RECEPTION: 'Buscar, registrar y editar pacientes.',
      SUPER_ADMIN: 'Vista global de los casos de la organización.',
    };

    const headerActions = el('div', { class: 'actions' });
    if (Permissions.can(user, Permissions.CAP.PATIENT_WRITE)) {
      headerActions.appendChild(
        el(
          'button',
          { class: 'btn btn-primary', onClick: () => openCreatePatientModal() },
          '+ Nuevo paciente'
        )
      );
    }

    root.appendChild(
      el('div', { class: 'page-header' }, [
        el('div', {}, [
          el('h1', {}, 'Pacientes'),
          el('div', { class: 'subtitle' }, subtitleByRole[role] || 'Gestión completa de pacientes.'),
        ]),
        headerActions,
      ])
    );

    let patients = DB.patients.all().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    // Filters
    const filters = el('div', { class: 'filters-bar' });
    const search = el('input', { type: 'text', placeholder: 'Buscar por nombre, teléfono…' });
    const statusSel = el(
      'select',
      {},
      [
        { value: '', label: 'Todos los estados' },
        { value: 'first_visit', label: 'Primera visita' },
        { value: 'planning', label: 'Planificación' },
        { value: 'budget_pending', label: 'Presupuesto pendiente' },
        { value: 'in_treatment', label: 'En tratamiento' },
        { value: 'completed', label: 'Completado' },
      ].map((o) => el('option', { value: o.value }, o.label))
    );
    const refresh = () => renderTable(table, patients, search.value, statusSel.value);
    search.addEventListener('input', refresh);
    statusSel.addEventListener('change', refresh);
    filters.appendChild(search);
    filters.appendChild(statusSel);
    root.appendChild(filters);

    const table = el('div', { class: 'patient-table' });
    root.appendChild(table);
    renderTable(table, patients, '', '');
  }

  function renderTable(container, patients, query, status) {
    container.innerHTML = '';
    const filtered = patients.filter((p) => {
      if (status && p.status !== status) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          (p.name || '').toLowerCase().includes(q) ||
          (p.phone || '').includes(q) ||
          (p.email || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
    if (filtered.length === 0) {
      container.appendChild(
        el('div', { class: 'empty' }, [
          el('div', { class: 'icon' }, '👤'),
          el('h3', {}, 'Sin pacientes'),
          el('p', {}, 'Crea el primer paciente para empezar.'),
        ])
      );
      return;
    }
    const table = el('table', { class: 'table' });
    table.innerHTML = `
      <thead>
        <tr>
          <th>Paciente</th>
          <th>Edad</th>
          <th>Teléfono</th>
          <th>Estado</th>
          <th>Última actualización</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    filtered.forEach((p) => {
      const tr = el('tr', { class: 'row-link', onClick: () => Router.go('/patients/' + p.id) });
      tr.innerHTML = `
        <td>
          <div class="patient-row-name">
            <div class="avatar">${escapeHtml(initials(p.name))}</div>
            <div>
              ${escapeHtml(p.name)}
              <small>${escapeHtml(p.email || '')}</small>
            </div>
          </div>
        </td>
        <td>${escapeHtml(fmtAge(p.birthDate))}</td>
        <td>${escapeHtml(p.phone || '—')}</td>
        <td>${badgeForStatus(p.status)}</td>
        <td>${escapeHtml(fmtDate(p.updatedAt || p.createdAt))}</td>
        <td class="text-right"><span class="text-muted">›</span></td>
      `;
      tbody.appendChild(tr);
    });
    container.appendChild(table);
  }

  function openCreatePatientModal() {
    if (!Permissions.can(Auth.currentUser(), Permissions.CAP.PATIENT_WRITE)) {
      return toast('Sin permisos para crear pacientes', 'error');
    }
    const form = el('form');
    const f1 = field({ label: 'Nombre completo', name: 'name', required: true });
    const f2 = field({ label: 'Fecha de nacimiento', name: 'birthDate', type: 'date' });
    const f3 = field({ label: 'Sexo', name: 'sex', type: 'select', options: ['', 'F', 'M', 'Otro'] });
    const f4 = field({ label: 'Teléfono', name: 'phone' });
    const f5 = field({ label: 'Email', name: 'email' });
    const f6 = field({ label: 'DNI / documento', name: 'document' });
    const f7 = field({ label: 'Procedencia', name: 'source' });
    const f8 = field({ label: 'Motivo de consulta', name: 'motive', type: 'textarea' });
    const row1 = el('div', { class: 'form-row' }, [f1.wrap, f2.wrap]);
    const row2 = el('div', { class: 'form-row form-row-3' }, [f3.wrap, f4.wrap, f5.wrap]);
    const row3 = el('div', { class: 'form-row' }, [f6.wrap, f7.wrap]);
    form.appendChild(row1);
    form.appendChild(row2);
    form.appendChild(row3);
    form.appendChild(f8.wrap);

    openModal({
      title: 'Nuevo paciente',
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
                if (!data.name) return toast('El nombre es obligatorio', 'error');
                const settings = DB.settings.get();
                const u = Auth.currentUser();
                const p = DB.patients.insert({
                  ...data,
                  status: 'first_visit',
                  clinicId: settings.activeClinicId,
                  createdBy: u.id,
                  assignedPlannerId: u.id,
                });
                DB.medicalHistories.insert({
                  patientId: p.id,
                  conditions: '',
                  medication: '',
                  allergies: '',
                  habits: '',
                  updatedBy: u.id,
                });
                Audit.log('patient.create', { targetType: 'patient', targetId: p.id });
                close(p);
                toast('Paciente creado', 'success');
                Router.go('/patients/' + p.id);
              },
            },
            'Crear paciente'
          )
        );
      },
    });
  }

  function renderDetail(root, patientId, query = {}) {
    const patient = DB.patients.get(patientId);
    if (!patient) {
      root.innerHTML = '<div class="empty"><h3>Paciente no encontrado</h3></div>';
      return;
    }
    const user = Auth.currentUser();
    if (!Permissions.can(user, Permissions.CAP.PATIENT_READ)) {
      root.innerHTML = '<div class="empty"><h3>Sin acceso</h3></div>';
      return;
    }

    const history = DB.medicalHistories.where((h) => h.patientId === patient.id)[0] || {};
    const planner = patient.assignedPlannerId && DB.users.get(patient.assignedPlannerId);
    const coord = patient.assignedCoordinatorId && DB.users.get(patient.assignedCoordinatorId);

    root.innerHTML = '';

    const cfg = RoleConfig.configFor(user);

    // Role-specific header actions
    const headerActions = el('div', { class: 'actions' });
    const role = RoleConfig.primaryRole(user);
    if (role === 'PLANNER' || Permissions.can(user, Permissions.CAP.FIRST_VISIT_RUN)) {
      headerActions.appendChild(
        el(
          'button',
          { class: 'btn', onClick: () => Router.go('/patients/' + patient.id + '/first-visit') },
          '🩺 Primera visita'
        )
      );
    }
    if (role === 'PLANNER' || role === 'DIRECTOR' || role === 'SUPER_ADMIN') {
      headerActions.appendChild(
        el(
          'button',
          { class: 'btn btn-primary', onClick: () => TreatmentPlan.openItemModal(patient.id) },
          '+ Añadir al plan'
        )
      );
    }
    if (role === 'COORDINATOR') {
      headerActions.appendChild(
        el(
          'button',
          { class: 'btn btn-primary', onClick: () => Router.go('/patients/' + patient.id + '?tab=commercial') },
          '€ Ver venta'
        )
      );
    }
    if (role === 'ASSISTANT') {
      headerActions.appendChild(
        el(
          'button',
          { class: 'btn btn-primary', onClick: () => Router.go('/patients/' + patient.id + '?tab=appointments') },
          '🗓 Próximas citas'
        )
      );
    }

    const header = el('div', { class: 'patient-header' }, [
      el('div', { class: 'avatar' }, initials(patient.name)),
      el('div', { class: 'patient-header-body' }, [
        el('h1', {}, patient.name),
        el('div', { class: 'meta' }),
      ]),
      headerActions,
    ]);
    header.querySelector('.meta').innerHTML = `
      <span>${escapeHtml(fmtAge(patient.birthDate))}</span>
      <span>· ${escapeHtml(patient.sex || '—')}</span>
      <span>· ${escapeHtml(patient.phone || '—')}</span>
      <span>${badgeForStatus(patient.status)}</span>
    `;
    root.appendChild(header);

    // Tabs filtered & ordered by role
    const allowed = cfg.patientTabs || ['summary', 'plan', 'budget', 'commercial', 'appointments', 'files', 'chat', 'history', 'audit'];
    const tabs = allowed;
    const tabLabels = {
      summary: 'Resumen',
      plan: 'Plan de tratamiento',
      budget: 'Presupuesto',
      commercial: 'Venta',
      appointments: 'Citas ideales',
      files: 'Archivos',
      chat: 'Chat interno',
      history: 'Historia clínica',
      audit: 'Actividad',
    };
    // Default tab follows the role unless overridden by query
    const roleDefault = cfg.defaultPatientTab && tabs.includes(cfg.defaultPatientTab) ? cfg.defaultPatientTab : tabs[0];
    const active = tabs.includes(query.tab) ? query.tab : roleDefault;
    const tabsEl = el('div', { class: 'tabs' });
    tabs.forEach((t) => {
      tabsEl.appendChild(
        el(
          'button',
          {
            class: 'tab' + (t === active ? ' active' : ''),
            onClick: () => Router.go('/patients/' + patient.id + '?tab=' + t),
          },
          tabLabels[t]
        )
      );
    });
    root.appendChild(tabsEl);

    const content = el('div');
    root.appendChild(content);

    if (active === 'summary') renderSummary(content, patient, history, planner, coord);
    else if (active === 'plan') TreatmentPlan.render(content, patient.id);
    else if (active === 'budget') Budget.render(content, patient.id);
    else if (active === 'commercial') Commercial.render(content, patient.id);
    else if (active === 'appointments') Appointments.render(content, patient.id);
    else if (active === 'files') Files.render(content, patient.id);
    else if (active === 'chat') Chat.render(content, patient.id);
    else if (active === 'history') renderHistory(content, patient, history);
    else if (active === 'audit') renderAudit(content, patient);
  }

  function renderSummary(root, p, history, planner, coord) {
    const left = el('div');
    const card = el('div', { class: 'card' });
    card.innerHTML = `
      <div class="card-header"><h3>Datos administrativos</h3></div>
      <div class="info-grid">
        <dl>
          <dt>Email</dt><dd>${escapeHtml(p.email || '—')}</dd>
          <dt>Documento</dt><dd>${escapeHtml(p.document || '—')}</dd>
          <dt>Procedencia</dt><dd>${escapeHtml(p.source || '—')}</dd>
          <dt>Estado</dt><dd>${statusPill(p.status)}</dd>
        </dl>
        <dl>
          <dt>Clínica</dt><dd>${escapeHtml(DB.clinics.get(p.clinicId)?.name || '—')}</dd>
          <dt>Planificador</dt><dd>${escapeHtml(planner?.name || '—')}</dd>
          <dt>Coordinadora</dt><dd>${escapeHtml(coord?.name || '—')}</dd>
          <dt>Creado</dt><dd>${escapeHtml(fmtDate(p.createdAt))}</dd>
        </dl>
      </div>`;
    left.appendChild(card);

    const motive = el('div', { class: 'card' });
    motive.innerHTML = `
      <div class="card-header"><h3>Motivo de consulta</h3></div>
      <p>${escapeHtml(p.motive || 'No especificado.')}</p>`;
    left.appendChild(motive);

    const med = el('div', { class: 'card' });
    med.innerHTML = `
      <div class="card-header"><h3>Antecedentes médicos</h3></div>
      <div class="info-grid">
        <dl>
          <dt>Enfermedades</dt><dd>${escapeHtml(history.conditions || '—')}</dd>
          <dt>Medicación</dt><dd>${escapeHtml(history.medication || '—')}</dd>
        </dl>
        <dl>
          <dt>Alergias</dt><dd>${escapeHtml(history.allergies || '—')}</dd>
          <dt>Hábitos</dt><dd>${escapeHtml(history.habits || '—')}</dd>
        </dl>
      </div>`;
    left.appendChild(med);

    root.appendChild(left);
  }

  function renderHistory(root, patient, history) {
    const u = Auth.currentUser();
    const form = el('form');
    const f1 = field({ label: 'Enfermedades sistémicas', name: 'conditions', type: 'textarea', value: history.conditions });
    const f2 = field({ label: 'Medicación', name: 'medication', type: 'textarea', value: history.medication });
    const f3 = field({ label: 'Alergias', name: 'allergies', type: 'textarea', value: history.allergies });
    const f4 = field({ label: 'Hábitos', name: 'habits', type: 'textarea', value: history.habits });
    const f5 = field({ label: 'Observaciones', name: 'notes', type: 'textarea', value: history.notes });
    [f1, f2, f3, f4, f5].forEach((f) => form.appendChild(f.wrap));
    const card = el('div', { class: 'card' }, [
      el('div', { class: 'card-header' }, [el('h3', {}, 'Historia clínica')]),
      form,
      el(
        'div',
        { class: 'row', style: { justifyContent: 'flex-end' } },
        [
          el(
            'button',
            {
              class: 'btn btn-primary',
              onClick: () => {
                const data = formData(form);
                if (history.id) DB.medicalHistories.update(history.id, { ...data, updatedBy: u.id });
                else DB.medicalHistories.insert({ patientId: patient.id, ...data, updatedBy: u.id });
                Audit.log('history.update', { targetType: 'patient', targetId: patient.id });
                toast('Historia actualizada', 'success');
              },
            },
            'Guardar cambios'
          ),
        ]
      ),
    ]);
    root.appendChild(card);
  }

  function renderAudit(root, patient) {
    const log = DB.auditLog
      .where((l) => l.targetType === 'patient' && l.targetId === patient.id)
      .reverse();
    const card = el('div', { class: 'card' }, [
      el('div', { class: 'card-header' }, [el('h3', {}, 'Actividad del caso')]),
    ]);
    if (log.length === 0) {
      card.appendChild(el('div', { class: 'empty' }, 'Sin actividad registrada.'));
    } else {
      const list = el('div', { class: 'activity-list' });
      log.forEach((l) => {
        list.appendChild(
          el('div', { class: 'activity-item' }, [
            el('div', { class: 'avatar' }, initials(l.userName || 'S')),
            el('div', { class: 'text' }, [
              el('div', {}, escapeHtml(l.userName || 'Sistema') + ' · ' + escapeHtml(l.action)),
              el('div', { class: 'time' }, fmtDate(l.createdAt)),
            ]),
          ])
        );
      });
      card.appendChild(list);
    }
    root.appendChild(card);
  }

  global.Patients = {
    renderList,
    renderDetail,
    openCreatePatientModal,
  };
})(window);
