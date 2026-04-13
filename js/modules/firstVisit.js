/* ============================================================
   Clinia — First Visit wizard
   Configurable, step-based, with autosave of sections.
   ============================================================ */

(function (global) {
  const { el, escapeHtml, toast, openModal, fmtDateTime } = UI;

  const STEPS = [
    { key: 'motive', label: 'Motivo de consulta' },
    { key: 'anamnesis', label: 'Anamnesis y antecedentes' },
    { key: 'extraoral', label: 'Exploración extraoral' },
    { key: 'intraoral', label: 'Exploración intraoral' },
    { key: 'perio', label: 'Exploración periodontal' },
    { key: 'occlusal', label: 'Exploración oclusal' },
    { key: 'esthetic', label: 'Análisis estético' },
    { key: 'photos', label: 'Fotografías' },
    { key: 'radiographic', label: 'Radiografías y CBCT' },
    { key: 'digital', label: 'Escaneado intraoral' },
    { key: 'findings', label: 'Hallazgos' },
    { key: 'diagnosis', label: 'Diagnóstico' },
    { key: 'specialties', label: 'Asignar especialidades' },
    { key: 'review', label: 'Revisión y envío' },
  ];

  function getOrCreateVisit(patientId) {
    let visit = DB.firstVisits.where((v) => v.patientId === patientId)[0];
    if (!visit) {
      const u = Auth.currentUser();
      visit = DB.firstVisits.insert({
        patientId,
        plannerId: u.id,
        clinicId: DB.settings.get().activeClinicId,
        status: 'in_progress',
        date: DB.now(),
        templateName: 'Plantilla estándar Clinia',
        sections: {},
      });
      Audit.log('first_visit.create', { targetType: 'patient', targetId: patientId });
    }
    return visit;
  }

  function render(root, patientId) {
    const patient = DB.patients.get(patientId);
    if (!patient) {
      root.innerHTML = '<div class="empty"><h3>Paciente no encontrado</h3></div>';
      return;
    }
    if (!Permissions.can(Auth.currentUser(), Permissions.CAP.FIRST_VISIT_RUN)) {
      root.innerHTML = '<div class="empty"><h3>Sin permiso para realizar primera visita</h3></div>';
      return;
    }
    const visit = getOrCreateVisit(patientId);
    if (!visit.sections) visit.sections = {};

    let currentStep = 0;
    root.innerHTML = '';
    root.appendChild(
      el('div', { class: 'page-header' }, [
        el('div', {}, [
          el('h1', {}, 'Primera visita'),
          el('div', { class: 'subtitle' }, patient.name + ' · ' + visit.templateName),
        ]),
        el('div', { class: 'actions' }, [
          el(
            'button',
            { class: 'btn', onClick: () => Router.go('/patients/' + patientId) },
            '← Volver al paciente'
          ),
          el(
            'button',
            { class: 'btn btn-accent', onClick: () => triggerAIAssist(visit) },
            '✨ Asistente IA'
          ),
        ]),
      ])
    );

    const wizard = el('div', { class: 'wizard' });
    const stepsCol = el('div', { class: 'steps' });
    const content = el('div', { class: 'content' });
    wizard.appendChild(stepsCol);
    wizard.appendChild(content);
    root.appendChild(wizard);

    function renderSteps() {
      stepsCol.innerHTML = '';
      STEPS.forEach((s, i) => {
        const filled = !!(visit.sections && visit.sections[s.key]);
        stepsCol.appendChild(
          el(
            'button',
            {
              class:
                'step' +
                (i === currentStep ? ' active' : '') +
                (filled && i !== currentStep ? ' done' : ''),
              onClick: () => {
                currentStep = i;
                renderAll();
              },
            },
            [el('span', { class: 'n' }, String(i + 1)), el('span', {}, s.label)]
          )
        );
      });
    }

    function renderStepContent() {
      content.innerHTML = '';
      const step = STEPS[currentStep];
      content.appendChild(el('h2', {}, step.label));
      content.appendChild(
        el('p', { class: 'text-muted' }, descFor(step.key))
      );

      if (step.key === 'specialties') {
        content.appendChild(specialtyPicker(visit));
      } else if (step.key === 'photos' || step.key === 'radiographic' || step.key === 'digital') {
        content.appendChild(filePlaceholder(patient, step.key));
      } else if (step.key === 'review') {
        content.appendChild(renderReview(visit, patient));
      } else {
        const ta = el('textarea', {
          rows: 10,
          style: { width: '100%', minHeight: '220px' },
          placeholder: 'Escribe aquí…',
        });
        ta.value = visit.sections[step.key] || '';
        ta.addEventListener('input', () => {
          visit.sections[step.key] = ta.value;
          DB.firstVisits.update(visit.id, { sections: visit.sections });
        });
        const wrap = el('div', { class: 'form-field' }, [ta]);
        content.appendChild(wrap);
      }

      // Wizard nav
      const nav = el('div', { class: 'wizard-nav' });
      nav.appendChild(
        el(
          'button',
          {
            class: 'btn',
            disabled: currentStep === 0 ? 'disabled' : false,
            onClick: () => {
              if (currentStep > 0) {
                currentStep--;
                renderAll();
              }
            },
          },
          '← Anterior'
        )
      );
      if (currentStep < STEPS.length - 1) {
        nav.appendChild(
          el(
            'button',
            {
              class: 'btn btn-primary',
              onClick: () => {
                currentStep++;
                renderAll();
              },
            },
            'Siguiente →'
          )
        );
      } else {
        nav.appendChild(
          el(
            'button',
            {
              class: 'btn btn-primary',
              onClick: () => finishVisit(visit, patient),
            },
            '✓ Finalizar y enviar a validación'
          )
        );
      }
      content.appendChild(nav);
    }

    function renderAll() {
      renderSteps();
      renderStepContent();
    }
    renderAll();
  }

  function descFor(key) {
    const map = {
      motive: 'Motivo principal por el que el paciente acude a la consulta.',
      anamnesis: 'Antecedentes médicos, medicación, enfermedades sistémicas, hábitos.',
      extraoral: 'Inspección facial, ATM, musculatura, ganglios.',
      intraoral: 'Exploración de tejidos blandos y duros intraorales.',
      perio: 'Sondaje, sangrado, recesiones, movilidad.',
      occlusal: 'Análisis oclusal, función, ATM.',
      esthetic: 'Línea media, sonrisa, proporciones, color.',
      photos: 'Capturas extraorales e intraorales del paciente.',
      radiographic: 'Panorámica, periapicales, CBCT.',
      digital: 'Escaneado intraoral y modelos.',
      findings: 'Resumen de hallazgos clínicos relevantes.',
      diagnosis: 'Diagnóstico estructurado por especialidades.',
      specialties: 'Marca las especialidades implicadas en este caso.',
      review: 'Revisa el informe completo antes de enviarlo a validación interdisciplinar.',
    };
    return map[key] || '';
  }

  function specialtyPicker(visit) {
    const wrap = el('div', { class: 'row-wrap' });
    const selected = new Set(visit.sections.specialties || []);
    DB.specialties.all().forEach((sp) => {
      const isSel = selected.has(sp.id);
      const btn = el(
        'button',
        {
          class: 'specialty-chip',
          style: {
            '--specialty-color': sp.color,
            background: isSel ? 'var(--c-brand-50)' : 'var(--c-bg-alt)',
            border: isSel ? '1px solid var(--c-brand)' : '1px solid transparent',
            cursor: 'pointer',
            padding: '6px 12px',
            fontSize: '12px',
          },
          onClick: (e) => {
            e.preventDefault();
            if (selected.has(sp.id)) selected.delete(sp.id);
            else selected.add(sp.id);
            visit.sections.specialties = Array.from(selected);
            DB.firstVisits.update(visit.id, { sections: visit.sections });
            // Re-render this picker
            const newPicker = specialtyPicker(visit);
            wrap.replaceWith(newPicker);
          },
        },
        sp.name
      );
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function filePlaceholder(patient, key) {
    return el('div', { class: 'card', style: { background: 'var(--c-bg-alt)' } }, [
      el('p', { class: 'text-muted' }, 'Adjunta los archivos correspondientes desde la pestaña de Archivos del paciente.'),
      el(
        'button',
        {
          class: 'btn',
          onClick: () => Router.go('/patients/' + patient.id + '?tab=files'),
        },
        'Abrir biblioteca de archivos'
      ),
    ]);
  }

  function renderReview(visit, patient) {
    const wrap = el('div');
    const card = el('div', { class: 'card' });
    card.appendChild(el('h3', {}, 'Resumen del informe'));
    STEPS.forEach((s) => {
      if (['photos', 'radiographic', 'digital', 'specialties', 'review'].includes(s.key)) return;
      if (visit.sections[s.key]) {
        const block = el('div', { style: { marginBottom: '12px' } });
        block.appendChild(el('div', { style: { fontSize: '11px', color: 'var(--c-text-soft)', textTransform: 'uppercase', letterSpacing: '.05em' } }, s.label));
        block.appendChild(el('div', { style: { fontSize: '13px', whiteSpace: 'pre-wrap' } }, visit.sections[s.key]));
        card.appendChild(block);
      }
    });
    if (visit.sections.specialties && visit.sections.specialties.length) {
      const sp = el('div');
      sp.appendChild(el('div', { style: { fontSize: '11px', color: 'var(--c-text-soft)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: '12px' } }, 'Especialidades implicadas'));
      const chips = el('div', { class: 'row-wrap', style: { marginTop: '6px' } });
      visit.sections.specialties.forEach((id) => {
        const s = DB.specialties.get(id);
        if (s) chips.appendChild(el('span', { class: 'specialty-chip', style: { '--specialty-color': s.color } }, s.name));
      });
      sp.appendChild(chips);
      card.appendChild(sp);
    }
    wrap.appendChild(card);

    const exportCard = el('div', { class: 'card' });
    exportCard.appendChild(el('h3', {}, 'Exportar informe'));
    exportCard.appendChild(el('p', { class: 'text-muted' }, 'Genera el informe clínico de la primera visita en formato imprimible.'));
    exportCard.appendChild(
      el(
        'button',
        { class: 'btn', onClick: () => exportReport(visit, patient) },
        '🖨 Generar informe'
      )
    );
    wrap.appendChild(exportCard);
    return wrap;
  }

  function exportReport(visit, patient) {
    const win = window.open('', '_blank');
    if (!win) {
      toast('No se pudo abrir la ventana de impresión', 'error');
      return;
    }
    const sections = STEPS.filter((s) => visit.sections[s.key] && typeof visit.sections[s.key] === 'string');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Informe — ${escapeHtml(patient.name)}</title>
      <style>
        body{font-family: -apple-system,Segoe UI,sans-serif; max-width:780px; margin:40px auto; color:#0f172a; padding:0 20px}
        h1{font-size:24px; margin:0}
        h2{font-size:16px; color:#0f766e; border-bottom:1px solid #e3e8f0; padding-bottom:4px; margin-top:24px}
        .meta{color:#64748b; font-size:13px; margin-top:4px}
        p{white-space:pre-wrap; font-size:13.5px; line-height:1.55}
      </style>
      </head><body>
        <h1>Informe de primera visita</h1>
        <div class="meta">Paciente: ${escapeHtml(patient.name)} · Fecha: ${escapeHtml(fmtDateTime(visit.date))}</div>
        ${sections.map((s) => `<h2>${escapeHtml(s.label)}</h2><p>${escapeHtml(visit.sections[s.key])}</p>`).join('')}
      </body></html>`;
    win.document.write(html);
    win.document.close();
  }

  function finishVisit(visit, patient) {
    UI.confirm('Marcar la primera visita como completada y crear plan inicial.', { confirmLabel: 'Sí, finalizar' }).then((ok) => {
      if (!ok) return;
      DB.firstVisits.update(visit.id, { status: 'completed', completedAt: DB.now() });
      DB.patients.update(patient.id, { status: 'planning' });

      // Create initial plan if none
      let plan = DB.treatmentPlans.where((p) => p.patientId === patient.id)[0];
      if (!plan) {
        const u = Auth.currentUser();
        plan = DB.treatmentPlans.insert({
          patientId: patient.id,
          firstVisitId: visit.id,
          status: 'draft',
        });
        const v1 = DB.planVersions.insert({
          planId: plan.id,
          versionNumber: 1,
          authorId: u.id,
          authorName: u.name,
          phases: [
            { id: DB.uid('ph'), name: 'Fase 1', description: '', order: 1 },
          ],
          items: [],
          diagnosis: visit.sections.diagnosis || '',
          summary: visit.sections.findings || '',
          changeReason: 'Versión inicial creada desde la primera visita.',
          requiredSpecialties: visit.sections.specialties || [],
          status: 'draft',
        });
        DB.treatmentPlans.update(plan.id, { currentVersionId: v1.id });
      }
      Audit.log('first_visit.complete', { targetType: 'patient', targetId: patient.id });
      toast('Primera visita finalizada', 'success');
      Router.go('/patients/' + patient.id + '?tab=plan');
    });
  }

  function triggerAIAssist(visit) {
    // Placeholder for future IA integration. We mark fields as suggestions.
    openModal({
      title: '✨ Asistente del Planificador',
      body: el('div', {}, [
        el('p', {}, 'En producción este botón conectará con un proveedor LLM (Anthropic Claude u otro) para:'),
        el('ul', {}, [
          el('li', {}, 'Transcribir la conversación de la primera visita'),
          el('li', {}, 'Resumir anamnesis y motivo de consulta'),
          el('li', {}, 'Proponer hallazgos, diagnóstico y plan de tratamiento'),
          el('li', {}, 'Marcar las sugerencias como contenido asistido por IA, sin cerrar el caso'),
        ]),
        el('p', { class: 'text-muted' }, 'Por ahora el flujo está preparado pero la integración real no está conectada. Los campos de la primera visita ya soportan trazabilidad de origen.'),
      ]),
      footer: (footer, close) => {
        footer.appendChild(
          el('button', { class: 'btn btn-primary', onClick: () => close(null) }, 'Entendido')
        );
      },
    });
  }

  global.FirstVisit = { render };
})(window);
