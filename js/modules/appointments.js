/* ============================================================
   Clinia — Ideal appointments / coordination
   ============================================================ */

(function (global) {
  const { el, escapeHtml, toast, openModal, field, formData, fmtDate, statusPill } = UI;

  function listFor(patientId) {
    return DB.appointments
      .where((a) => a.patientId === patientId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function render(root, patientId) {
    if (!Permissions.can(Auth.currentUser(), Permissions.CAP.APPT_PLAN) && !Permissions.can(Auth.currentUser(), Permissions.CAP.PATIENT_READ)) {
      root.innerHTML = '<div class="empty"><h3>Sin acceso</h3></div>';
      return;
    }

    const plan = DB.treatmentPlans.where((p) => p.patientId === patientId)[0];
    const planVersion = plan ? DB.planVersions.get(plan.currentVersionId) : null;

    root.innerHTML = '';
    const header = el('div', { class: 'plan-header' }, [
      el('div', {}, [
        el('h2', { class: 'mb-0' }, 'Citas ideales'),
        el('div', { class: 'plan-meta' }, [
          el('span', {}, 'Traducción operativa del plan a citas concretas'),
        ]),
      ]),
      el('div', { class: 'row' }, [
        el(
          'button',
          {
            class: 'btn',
            onClick: () => generateFromPlan(patientId, planVersion),
          },
          '⚡ Generar desde plan'
        ),
        el(
          'button',
          { class: 'btn btn-primary', onClick: () => openApptModal(patientId) },
          '+ Nueva cita ideal'
        ),
      ]),
    ]);
    root.appendChild(header);

    const appts = listFor(patientId);
    if (appts.length === 0) {
      root.appendChild(
        el('div', { class: 'empty' }, [
          el('div', { class: 'icon' }, '🗓'),
          el('h3', {}, 'Sin citas planificadas'),
          el('p', {}, 'Pulsa "Generar desde plan" para traducir el plan vigente en citas ideales.'),
        ])
      );
      return;
    }

    const list = el('div', { class: 'appt-list' });
    let prevSpecialtyId = null;
    appts.forEach((a, idx) => {
      const sp = DB.specialties.get(a.specialtyId);
      const doc = a.doctorId ? DB.users.get(a.doctorId) : null;
      // Specialist change alert
      if (prevSpecialtyId && prevSpecialtyId !== a.specialtyId) {
        list.appendChild(
          el(
            'div',
            {
              style: {
                background: 'var(--c-warn-50)',
                color: 'var(--c-warn)',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
              },
            },
            '⚠ Cambio de especialista — coordinar con paciente'
          )
        );
      }
      prevSpecialtyId = a.specialtyId;

      const card = el('div', { class: 'appt-card' });
      card.innerHTML = `
        <div class="order">${idx + 1}</div>
        <div>
          <div style="font-weight:600">${escapeHtml(a.title)}</div>
          <div class="text-muted" style="font-size:12.5px; margin-top:2px">${escapeHtml(a.objective || '')}</div>
          <div class="row-wrap" style="margin-top:8px">
            <span class="specialty-chip" style="--specialty-color:${sp?.color || ''}">${escapeHtml(sp?.name || '')}</span>
            <span class="badge">${escapeHtml(a.duration || '')}</span>
            ${doc ? `<span class="badge">${escapeHtml(doc.name)}</span>` : ''}
            ${a.phaseName ? `<span class="badge accent">${escapeHtml(a.phaseName)}</span>` : ''}
          </div>
          ${a.materials ? `<div class="text-soft" style="font-size:11.5px; margin-top:6px">📦 ${escapeHtml(a.materials)}</div>` : ''}
          ${a.prerequisites ? `<div class="text-soft" style="font-size:11.5px; margin-top:2px">⚙ ${escapeHtml(a.prerequisites)}</div>` : ''}
        </div>
        <div class="text-right">
          <div>${statusPill(a.status || 'pending_review')}</div>
          <small class="text-muted">${a.scheduledAt ? fmtDate(a.scheduledAt) : 'Sin fecha'}</small>
        </div>
      `;
      const actions = el('div', { style: { gridColumn: '1 / -1', marginTop: '10px' }, class: 'row' }, [
        el(
          'button',
          {
            class: 'btn btn-sm',
            onClick: () => openApptModal(patientId, a),
          },
          'Editar'
        ),
        el(
          'button',
          {
            class: 'btn btn-sm btn-danger',
            onClick: () => {
              UI.confirm('¿Eliminar esta cita?', { danger: true }).then((ok) => {
                if (!ok) return;
                DB.appointments.remove(a.id);
                render(root, patientId);
              });
            },
          },
          'Eliminar'
        ),
      ]);
      card.appendChild(actions);
      list.appendChild(card);
    });
    root.appendChild(list);
  }

  function generateFromPlan(patientId, planVersion) {
    if (!planVersion) return toast('No hay plan vigente', 'error');
    UI.confirm('¿Generar citas ideales a partir del plan vigente? Esto añadirá citas para cada ítem.', { confirmLabel: 'Generar' }).then((ok) => {
      if (!ok) return;
      const phases = (planVersion.phases || []).reduce((acc, p) => ((acc[p.order] = p), acc), {});
      const items = (planVersion.items || []).slice().sort((a, b) => a.phaseOrder - b.phaseOrder || a.order - b.order);
      const start = listFor(patientId).length;
      items.forEach((it, idx) => {
        const ph = phases[it.phaseOrder];
        DB.appointments.insert({
          patientId,
          planVersionId: planVersion.id,
          planItemId: it.id,
          order: start + idx + 1,
          title: it.title,
          objective: it.justification || '',
          specialtyId: it.specialtyId,
          doctorId: it.assignedDoctorId,
          duration: it.estimatedDuration || '60 min',
          materials: '',
          prerequisites: it.risks || '',
          phaseId: ph?.id,
          phaseName: ph?.name,
          status: 'pending_review',
        });
      });
      Audit.log('appointments.generate', { targetType: 'patient', targetId: patientId, details: { count: items.length } });
      toast(`Se generaron ${items.length} citas ideales`, 'success');
      Patients.renderDetail(document.getElementById('view'), patientId, { tab: 'appointments' });
    });
  }

  function openApptModal(patientId, existing = null) {
    const form = el('form');
    const f1 = field({ label: 'Título', name: 'title', required: true, value: existing?.title });
    const f2 = field({ label: 'Objetivo clínico', name: 'objective', type: 'textarea', value: existing?.objective });
    const f3 = field({
      label: 'Especialidad',
      name: 'specialtyId',
      type: 'select',
      options: DB.specialties.all().map((s) => ({ value: s.id, label: s.name })),
      value: existing?.specialtyId,
    });
    const f4 = field({
      label: 'Profesional preferente',
      name: 'doctorId',
      type: 'select',
      options: [{ value: '', label: '— Sin asignar —' }].concat(
        DB.users.where((u) => Permissions.rolesOf(u).includes('DOCTOR')).map((u) => ({ value: u.id, label: u.name }))
      ),
      value: existing?.doctorId || '',
    });
    const f5 = field({ label: 'Duración', name: 'duration', value: existing?.duration || '60 min' });
    const f6 = field({ label: 'Material necesario', name: 'materials', value: existing?.materials });
    const f7 = field({ label: 'Prerequisitos', name: 'prerequisites', type: 'textarea', value: existing?.prerequisites });
    const f8 = field({ label: 'Fecha prevista', name: 'scheduledAt', type: 'date', value: existing?.scheduledAt });
    form.appendChild(f1.wrap);
    form.appendChild(f2.wrap);
    form.appendChild(el('div', { class: 'form-row form-row-3' }, [f3.wrap, f4.wrap, f5.wrap]));
    form.appendChild(el('div', { class: 'form-row' }, [f6.wrap, f8.wrap]));
    form.appendChild(f7.wrap);

    openModal({
      title: existing ? 'Editar cita ideal' : 'Nueva cita ideal',
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
                if (!data.title) return toast('Título obligatorio', 'error');
                if (existing) DB.appointments.update(existing.id, data);
                else
                  DB.appointments.insert({
                    ...data,
                    patientId,
                    order: listFor(patientId).length + 1,
                    status: 'pending_review',
                  });
                close(null);
                Patients.renderDetail(document.getElementById('view'), patientId, { tab: 'appointments' });
              },
            },
            'Guardar'
          )
        );
      },
    });
  }

  global.Appointments = { render };
})(window);
