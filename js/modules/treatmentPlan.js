/* ============================================================
   Clinia — Treatment Plan module
   Plan with phases, items, validation/consensus, versions.
   ============================================================ */

(function (global) {
  const { el, escapeHtml, fmtMoney, fmtDateTime, toast, openModal, field, formData, statusPill } = UI;

  function getOrInitPlan(patientId) {
    let plan = DB.treatmentPlans.where((p) => p.patientId === patientId)[0];
    if (!plan) {
      const u = Auth.currentUser();
      plan = DB.treatmentPlans.insert({ patientId, status: 'draft' });
      const v1 = DB.planVersions.insert({
        planId: plan.id,
        versionNumber: 1,
        authorId: u.id,
        authorName: u.name,
        phases: [{ id: DB.uid('ph'), name: 'Fase 1', description: '', order: 1 }],
        items: [],
        diagnosis: '',
        summary: '',
        changeReason: 'Versión inicial.',
        requiredSpecialties: [],
        status: 'draft',
      });
      DB.treatmentPlans.update(plan.id, { currentVersionId: v1.id });
    }
    return plan;
  }

  function currentVersion(plan) {
    return plan.currentVersionId ? DB.planVersions.get(plan.currentVersionId) : null;
  }

  function allVersions(plan) {
    return DB.planVersions
      .where((v) => v.planId === plan.id)
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }

  function consensusState(version) {
    const required = version.requiredSpecialties || [];
    const validations = DB.validations.where((v) => v.versionId === version.id);
    const decisions = required.map((spId) => {
      const lastForSpec = validations.filter((v) => v.specialtyId === spId).pop();
      return { specialtyId: spId, decision: lastForSpec?.decision || 'pending', validation: lastForSpec };
    });
    const allApproved = decisions.length > 0 && decisions.every((d) => d.decision === 'approved');
    const anyRejected = decisions.some((d) => d.decision === 'rejected');
    const anyChanges = decisions.some((d) => d.decision === 'changes_requested');
    let status = 'pending_review';
    if (allApproved) status = 'consensus_complete';
    else if (anyRejected) status = 'rejected';
    else if (anyChanges) status = 'changes_requested';
    else if (decisions.some((d) => d.decision === 'approved')) status = 'consensus_partial';
    return { decisions, status };
  }

  function render(root, patientId) {
    const patient = DB.patients.get(patientId);
    const plan = getOrInitPlan(patientId);
    const version = currentVersion(plan);
    const cs = consensusState(version);

    root.innerHTML = '';

    // Header strip
    const header = el('div', { class: 'plan-header' }, [
      el('div', {}, [
        el('h2', { class: 'mb-0' }, 'Plan de tratamiento'),
        el(
          'div',
          { class: 'plan-meta' },
          [
            el('span', {}, 'Versión actual: v' + version.versionNumber),
            el('span', {}, '· Autor: ' + escapeHtml(version.authorName || '—')),
            el('span', {}, '· ' + fmtDateTime(version.createdAt)),
          ]
        ),
      ]),
      el('div', { class: 'row' }, [
        el(
          'button',
          { class: 'btn', onClick: () => showVersionsModal(plan) },
          'Versiones (' + allVersions(plan).length + ')'
        ),
        el(
          'button',
          { class: 'btn', onClick: () => openItemModal(patient.id) },
          '+ Añadir ítem'
        ),
        el(
          'button',
          { class: 'btn', onClick: () => openPhaseModal(plan, version) },
          '+ Fase'
        ),
        el(
          'button',
          {
            class: 'btn btn-primary',
            onClick: () => sendForReview(plan, version),
          },
          'Enviar a validación'
        ),
      ]),
    ]);
    root.appendChild(header);

    // Status pill
    root.appendChild(
      el('div', { class: 'row', style: { marginBottom: '12px' } }, [
        el('span', { html: statusPill(cs.status) }),
      ])
    );
    root.lastChild.firstChild.outerHTML = statusPill(cs.status);

    // Diagnosis & summary
    const diagCard = el('div', { class: 'card' });
    diagCard.innerHTML = `
      <div class="card-header"><h3>Diagnóstico y resumen</h3></div>
      <p><strong>Diagnóstico:</strong> ${escapeHtml(version.diagnosis || '—')}</p>
      <p><strong>Resumen:</strong> ${escapeHtml(version.summary || '—')}</p>
    `;
    root.appendChild(diagCard);

    // Phases + items timeline
    const timeline = el('div', { class: 'plan-timeline' });
    const phasesCol = el('div', { class: 'plan-phases' });
    const itemsCol = el('div', { class: 'plan-items' });

    const phases = (version.phases || []).slice().sort((a, b) => a.order - b.order);
    let activePhaseOrder = phases[0]?.order || 1;

    function renderPhases() {
      phasesCol.innerHTML = '';
      phases.forEach((p) => {
        const itemsInPhase = (version.items || []).filter((i) => i.phaseOrder === p.order);
        phasesCol.appendChild(
          el(
            'div',
            {
              class: 'plan-phase' + (p.order === activePhaseOrder ? ' active' : ''),
              onClick: () => {
                activePhaseOrder = p.order;
                renderPhases();
                renderItems();
              },
            },
            [
              el('div', {}, p.name),
              el('small', {}, itemsInPhase.length + ' ítems'),
            ]
          )
        );
      });
    }

    function renderItems() {
      itemsCol.innerHTML = '';
      const items = (version.items || [])
        .filter((i) => i.phaseOrder === activePhaseOrder)
        .sort((a, b) => a.order - b.order);
      if (items.length === 0) {
        itemsCol.appendChild(el('div', { class: 'empty' }, 'Sin ítems en esta fase.'));
        return;
      }
      items.forEach((it) => {
        const sp = DB.specialties.get(it.specialtyId);
        const cat = it.catalogItemId ? DB.catalog.get(it.catalogItemId) : null;
        const price = it.priceOverride ?? cat?.price ?? 0;
        const card = el('div', { class: 'plan-item' });
        card.innerHTML = `
          <div class="plan-item-head">
            <div>
              <div class="plan-item-title">${escapeHtml(it.title)}</div>
              <div class="plan-item-desc">${escapeHtml(it.description || '')}</div>
            </div>
            <div class="text-right">
              <div class="mono" style="font-weight:600">${fmtMoney(price)}</div>
              <small>${escapeHtml(it.estimatedDuration || '')}</small>
            </div>
          </div>
          <div class="plan-item-meta">
            <span class="specialty-chip" style="--specialty-color:${sp?.color || ''}">${escapeHtml(sp?.name || '—')}</span>
            <span class="badge ${it.necessity === 'necessary' ? 'danger' : 'info'}">${it.necessity === 'necessary' ? 'Necesario' : 'Recomendable'}</span>
            ${it.assignedDoctorId ? `<span class="badge">${escapeHtml(DB.users.get(it.assignedDoctorId)?.name || '')}</span>` : ''}
          </div>
        `;
        const actions = el('div', { class: 'row', style: { marginTop: '10px', gap: '6px' } }, [
          el(
            'button',
            { class: 'btn btn-sm', onClick: () => openItemModal(patientId, it) },
            'Editar'
          ),
          el(
            'button',
            {
              class: 'btn btn-sm btn-danger',
              onClick: () => removeItem(plan, version, it.id),
            },
            'Eliminar'
          ),
        ]);
        card.appendChild(actions);
        itemsCol.appendChild(card);
      });
    }

    timeline.appendChild(phasesCol);
    timeline.appendChild(itemsCol);
    root.appendChild(timeline);
    renderPhases();
    renderItems();

    // Consensus panel
    const consensus = el('div', { class: 'card' });
    consensus.appendChild(
      el('div', { class: 'card-header' }, [
        el('h3', {}, 'Consenso interdisciplinar'),
        el('span', { html: statusPill(cs.status) }),
      ])
    );
    // Replace the status pill html
    consensus.querySelector('.card-header span').outerHTML = statusPill(cs.status);

    if (cs.decisions.length === 0) {
      consensus.appendChild(el('p', { class: 'text-muted' }, 'Aún no se han marcado especialidades implicadas.'));
    } else {
      const list = el('div', { class: 'consensus-panel' });
      cs.decisions.forEach((d) => {
        const sp = DB.specialties.get(d.specialtyId);
        const row = el('div', { class: 'consensus-row' });
        row.innerHTML = `
          <div class="sp-name">
            <span class="specialty-chip" style="--specialty-color:${sp?.color || ''}">${escapeHtml(sp?.name || '')}</span>
          </div>
          <div>${statusPill(d.decision === 'approved' ? 'validated' : d.decision === 'pending' ? 'pending_review' : d.decision)}</div>
        `;
        consensus.appendChild(row);
      });
    }

    // Decision actions for current user
    const u = Auth.currentUser();
    const userSpecs = u.specialties || [];
    const myPendingSpecs = (version.requiredSpecialties || []).filter((sId) =>
      userSpecs.includes(sId)
    );
    if (myPendingSpecs.length > 0 && Permissions.can(u, Permissions.CAP.PLAN_VALIDATE)) {
      consensus.appendChild(el('div', { class: 'sep-line' }));
      consensus.appendChild(el('h3', {}, 'Tu decisión'));
      myPendingSpecs.forEach((sId) => {
        const sp = DB.specialties.get(sId);
        const block = el('div', { style: { marginBottom: '12px' } });
        block.appendChild(el('div', { style: { fontSize: '13px', fontWeight: '600' } }, sp.name));
        const commentInput = el('textarea', {
          placeholder: 'Comentario (opcional)…',
          style: { width: '100%', marginTop: '6px' },
        });
        const group = el('div', { class: 'decision-group' }, [
          el(
            'button',
            {
              class: 'btn btn-primary',
              onClick: () => decide(plan, version, sId, 'approved', commentInput.value),
            },
            '✓ Aprobar'
          ),
          el(
            'button',
            {
              class: 'btn',
              onClick: () => decide(plan, version, sId, 'changes_requested', commentInput.value),
            },
            '↺ Solicitar cambios'
          ),
          el(
            'button',
            {
              class: 'btn btn-danger',
              onClick: () => decide(plan, version, sId, 'rejected', commentInput.value),
            },
            '✗ Rechazar'
          ),
        ]);
        block.appendChild(commentInput);
        block.appendChild(group);
        consensus.appendChild(block);
      });
    }

    root.appendChild(consensus);
  }

  function openItemModal(patientId, existing = null) {
    const plan = getOrInitPlan(patientId);
    const version = currentVersion(plan);
    const phases = (version.phases || []).slice().sort((a, b) => a.order - b.order);

    const form = el('form');
    const f1 = field({ label: 'Título del tratamiento', name: 'title', required: true, value: existing?.title });
    const f2 = field({ label: 'Descripción', name: 'description', type: 'textarea', value: existing?.description });
    const f3 = field({
      label: 'Especialidad',
      name: 'specialtyId',
      type: 'select',
      options: DB.specialties.all().map((s) => ({ value: s.id, label: s.name })),
      value: existing?.specialtyId,
    });
    const f4 = field({
      label: 'Fase',
      name: 'phaseOrder',
      type: 'select',
      options: phases.map((p) => ({ value: p.order, label: p.name })),
      value: existing?.phaseOrder || 1,
    });
    const f5 = field({
      label: 'Necesidad',
      name: 'necessity',
      type: 'select',
      options: [
        { value: 'necessary', label: 'Necesario por salud / función' },
        { value: 'recommendable', label: 'Recomendable / estético' },
      ],
      value: existing?.necessity || 'necessary',
    });
    const f6 = field({ label: 'Justificación clínica', name: 'justification', type: 'textarea', value: existing?.justification });
    const f7 = field({ label: 'Riesgos si no se realiza', name: 'risks', type: 'textarea', value: existing?.risks });
    const f8 = field({ label: 'Duración estimada', name: 'estimatedDuration', value: existing?.estimatedDuration });
    const f9 = field({
      label: 'Concepto del catálogo',
      name: 'catalogItemId',
      type: 'select',
      options: [{ value: '', label: '— Sin asociar —' }].concat(
        DB.catalog.all().map((c) => ({
          value: c.id,
          label: `${c.code} · ${c.name} · ${c.price}€`,
        }))
      ),
      value: existing?.catalogItemId || '',
    });
    const f10 = field({
      label: 'Profesional asignado',
      name: 'assignedDoctorId',
      type: 'select',
      options: [{ value: '', label: '— Sin asignar —' }].concat(
        DB.users.where((u) => Permissions.rolesOf(u).includes('DOCTOR')).map((u) => ({
          value: u.id,
          label: u.name,
        }))
      ),
      value: existing?.assignedDoctorId || '',
    });
    form.appendChild(f1.wrap);
    form.appendChild(f2.wrap);
    form.appendChild(el('div', { class: 'form-row form-row-3' }, [f3.wrap, f4.wrap, f5.wrap]));
    form.appendChild(el('div', { class: 'form-row' }, [f8.wrap, f9.wrap]));
    form.appendChild(f10.wrap);
    form.appendChild(f6.wrap);
    form.appendChild(f7.wrap);

    openModal({
      title: existing ? 'Editar ítem del plan' : 'Añadir ítem al plan',
      size: 'lg',
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
                const items = (version.items || []).slice();
                if (existing) {
                  const idx = items.findIndex((i) => i.id === existing.id);
                  items[idx] = { ...existing, ...data, phaseOrder: parseInt(data.phaseOrder) || 1 };
                } else {
                  items.push({
                    id: DB.uid('it'),
                    order: items.length + 1,
                    ...data,
                    phaseOrder: parseInt(data.phaseOrder) || 1,
                  });
                }
                // Update specialties required
                const newReq = Array.from(
                  new Set(items.map((i) => i.specialtyId).filter(Boolean))
                );
                createNewVersionIfNeeded(plan, version, { items, requiredSpecialties: newReq, changeReason: existing ? 'Edición de ítem: ' + data.title : 'Añadido ítem: ' + data.title });
                close(null);
                toast('Plan actualizado', 'success');
                Patients.renderDetail(document.getElementById('view'), plan.patientId, { tab: 'plan' });
              },
            },
            existing ? 'Guardar cambios' : 'Añadir ítem'
          )
        );
      },
    });
  }

  function openPhaseModal(plan, version) {
    const form = el('form');
    const f1 = field({ label: 'Nombre de la fase', name: 'name', required: true });
    const f2 = field({ label: 'Descripción', name: 'description', type: 'textarea' });
    form.appendChild(f1.wrap);
    form.appendChild(f2.wrap);
    openModal({
      title: 'Nueva fase',
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
                if (!data.name) return toast('Nombre obligatorio', 'error');
                const phases = (version.phases || []).slice();
                phases.push({ id: DB.uid('ph'), order: phases.length + 1, ...data });
                createNewVersionIfNeeded(plan, version, { phases, changeReason: 'Añadida fase: ' + data.name });
                close(null);
                Patients.renderDetail(document.getElementById('view'), plan.patientId, { tab: 'plan' });
              },
            },
            'Crear fase'
          )
        );
      },
    });
  }

  function removeItem(plan, version, itemId) {
    UI.confirm('¿Eliminar este ítem del plan?', { danger: true }).then((ok) => {
      if (!ok) return;
      const items = (version.items || []).filter((i) => i.id !== itemId);
      createNewVersionIfNeeded(plan, version, { items, changeReason: 'Eliminado un ítem' });
      Patients.renderDetail(document.getElementById('view'), plan.patientId, { tab: 'plan' });
    });
  }

  // Core: when version is in approved/validated state, modifying creates a new version
  function createNewVersionIfNeeded(plan, version, patch) {
    const u = Auth.currentUser();
    const cs = consensusState(version);
    const isLocked = ['consensus_complete', 'budgeted', 'accepted'].includes(version.status);
    const hasAnyDecisions = DB.validations.where((v) => v.versionId === version.id).length > 0;

    if (isLocked || hasAnyDecisions) {
      // Snapshot a new version
      const v = DB.planVersions.insert({
        planId: plan.id,
        versionNumber: (allVersions(plan).slice(-1)[0]?.versionNumber || 0) + 1,
        authorId: u.id,
        authorName: u.name,
        phases: patch.phases || version.phases,
        items: patch.items || version.items,
        diagnosis: patch.diagnosis ?? version.diagnosis,
        summary: patch.summary ?? version.summary,
        requiredSpecialties: patch.requiredSpecialties || version.requiredSpecialties,
        changeReason: patch.changeReason || 'Modificación',
        status: 'draft',
      });
      DB.treatmentPlans.update(plan.id, { currentVersionId: v.id, status: 'draft' });
      Audit.log('plan.new_version', {
        targetType: 'treatment_plan',
        targetId: plan.id,
        details: { from: version.versionNumber, to: v.versionNumber, reason: patch.changeReason },
      });
      toast(`Nueva versión v${v.versionNumber} creada — el consenso se reinicia`, 'warn');
    } else {
      DB.planVersions.update(version.id, patch);
      Audit.log('plan.update', { targetType: 'treatment_plan', targetId: plan.id });
    }
  }

  function sendForReview(plan, version) {
    if (!version.requiredSpecialties || version.requiredSpecialties.length === 0) {
      return toast('Marca las especialidades implicadas antes de enviar a validación', 'error');
    }
    DB.planVersions.update(version.id, { status: 'pending_review' });
    DB.treatmentPlans.update(plan.id, { status: 'consensus_partial' });
    // Notify all specialists
    version.requiredSpecialties.forEach((spId) => {
      const doctors = DB.users.where((u) => (u.specialties || []).includes(spId));
      doctors.forEach((doc) => {
        DB.notifications.insert({
          userId: doc.id,
          type: 'validation_pending',
          text: `Plan pendiente de validación (${DB.specialties.get(spId)?.name})`,
          targetUrl: '#/patients/' + plan.patientId + '?tab=plan',
          read: false,
        });
      });
    });
    Audit.log('plan.send_review', { targetType: 'treatment_plan', targetId: plan.id });
    toast('Plan enviado a validación', 'success');
    Patients.renderDetail(document.getElementById('view'), plan.patientId, { tab: 'plan' });
  }

  function decide(plan, version, specialtyId, decision, comment) {
    const u = Auth.currentUser();
    DB.validations.insert({
      versionId: version.id,
      specialtyId,
      userId: u.id,
      userName: u.name,
      decision,
      comment,
    });
    Audit.log('plan.validate.' + decision, {
      targetType: 'treatment_plan',
      targetId: plan.id,
      details: { specialtyId, comment },
    });
    const cs = consensusState(version);
    if (cs.status === 'consensus_complete') {
      DB.planVersions.update(version.id, { status: 'consensus_complete' });
      DB.treatmentPlans.update(plan.id, { status: 'consensus_complete' });
      DB.patients.update(plan.patientId, { status: 'budget_pending' });
      toast('🎉 Consenso completo', 'success');
    } else if (decision === 'changes_requested' || decision === 'rejected') {
      DB.planVersions.update(version.id, { status: 'changes_requested' });
      DB.treatmentPlans.update(plan.id, { status: 'changes_requested' });
      toast('Decisión registrada — el plan necesita revisión', 'warn');
    } else {
      DB.planVersions.update(version.id, { status: 'consensus_partial' });
      DB.treatmentPlans.update(plan.id, { status: 'consensus_partial' });
      toast('Decisión registrada', 'success');
    }
    Patients.renderDetail(document.getElementById('view'), plan.patientId, { tab: 'plan' });
  }

  function showVersionsModal(plan) {
    const versions = allVersions(plan);
    const list = el('div', { class: 'version-list' });
    versions.forEach((v) => {
      const row = el(
        'div',
        {
          class: 'version-item' + (v.id === plan.currentVersionId ? ' active' : ''),
          onClick: () => {
            DB.treatmentPlans.update(plan.id, { currentVersionId: v.id });
            UI.toast('Cambiado a v' + v.versionNumber, 'info');
            // Refresh
            Patients.renderDetail(document.getElementById('view'), plan.patientId, { tab: 'plan' });
          },
        },
        [
          el('div', {}, [
            el('div', {}, 'v' + v.versionNumber + ' · ' + (v.changeReason || '')),
            el('small', { class: 'text-muted' }, escapeHtml(v.authorName) + ' · ' + fmtDateTime(v.createdAt)),
          ]),
          el('div', { html: statusPill(v.status) }),
        ]
      );
      // status pill replacement
      row.lastChild.outerHTML = statusPill(v.status);
      list.appendChild(row);
    });

    openModal({
      title: 'Historial de versiones',
      body: list,
      size: 'lg',
      footer: (footer, close) => {
        footer.appendChild(el('button', { class: 'btn', onClick: () => close(null) }, 'Cerrar'));
      },
    });
  }

  global.TreatmentPlan = {
    render,
    openItemModal,
    getOrInitPlan,
    currentVersion,
    consensusState,
  };
})(window);
