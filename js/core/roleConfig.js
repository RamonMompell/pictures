/* ============================================================
   Clinia — Role configuration
   Per-role defaults: sidebar, landing, default patient tab,
   inbox builders, quick actions, friendly copy, accent color.
   ============================================================ */

(function (global) {
  const ICON = {
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    cog: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.16.66.43.86.78.2.35.27.76.21 1.16"/></svg>',
    inbox: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    cal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    chart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    money: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  };

  // Per-role configuration
  const ROLE_CONFIG = {
    SUPER_ADMIN: {
      label: 'Super Admin',
      accent: '#0f766e',
      greeting: 'Tienes la vista completa de toda la organización.',
      landing: '/dashboard',
      defaultPatientTab: 'summary',
      sidebar: [
        { group: 'Clínica' },
        { path: 'dashboard', label: 'Inicio', icon: ICON.home },
        { path: 'patients', label: 'Pacientes', icon: ICON.users },
        { group: 'Operativo' },
        { path: 'catalog', label: 'Catálogo', icon: ICON.grid },
        { group: 'Administración' },
        { path: 'users', label: 'Usuarios', icon: ICON.user },
        { path: 'audit', label: 'Auditoría', icon: ICON.shield },
        { path: 'settings', label: 'Ajustes', icon: ICON.cog },
      ],
      patientTabs: ['summary', 'plan', 'budget', 'commercial', 'appointments', 'files', 'chat', 'history', 'audit'],
      quickActions: [
        { label: '+ Paciente', primary: true, action: 'newPatient' },
      ],
    },

    DIRECTOR: {
      label: 'Director clínico',
      accent: '#7c3aed',
      greeting: 'Supervisa los planes, presupuestos y rendimiento de la clínica.',
      landing: '/dashboard',
      defaultPatientTab: 'plan',
      sidebar: [
        { group: 'Clínica' },
        { path: 'dashboard', label: 'Inicio', icon: ICON.home },
        { path: 'patients', label: 'Pacientes', icon: ICON.users },
        { group: 'Operativo' },
        { path: 'catalog', label: 'Catálogo', icon: ICON.grid },
        { path: 'audit', label: 'Auditoría', icon: ICON.shield },
        { group: 'Administración' },
        { path: 'settings', label: 'Ajustes', icon: ICON.cog },
      ],
      patientTabs: ['summary', 'plan', 'budget', 'commercial', 'appointments', 'files', 'chat', 'history', 'audit'],
      quickActions: [
        { label: '+ Paciente', primary: true, action: 'newPatient' },
      ],
    },

    PLANNER: {
      label: 'Planificador',
      accent: '#0f766e',
      greeting: 'Gestiona primeras visitas y construye los planes de tratamiento.',
      landing: '/dashboard',
      defaultPatientTab: 'plan',
      sidebar: [
        { group: 'Mi trabajo' },
        { path: 'dashboard', label: 'Inicio', icon: ICON.home },
        { path: 'patients', label: 'Pacientes', icon: ICON.users },
        { group: 'Recursos' },
        { path: 'catalog', label: 'Catálogo', icon: ICON.grid },
        { path: 'settings', label: 'Ajustes', icon: ICON.cog },
      ],
      patientTabs: ['summary', 'plan', 'budget', 'files', 'chat', 'history'],
      quickActions: [
        { label: '+ Nuevo paciente', primary: true, action: 'newPatient' },
      ],
      emptyInboxText: '¡Estás al día! No tienes primeras visitas ni planes pendientes.',
    },

    DOCTOR: {
      label: 'Especialista',
      accent: '#2563eb',
      greeting: 'Aquí están los planes esperando tu validación.',
      landing: '/dashboard',
      defaultPatientTab: 'plan',
      sidebar: [
        { group: 'Mi trabajo' },
        { path: 'dashboard', label: 'Inicio', icon: ICON.home },
        { path: 'patients', label: 'Pacientes', icon: ICON.users },
        { group: 'Recursos' },
        { path: 'settings', label: 'Ajustes', icon: ICON.cog },
      ],
      patientTabs: ['summary', 'plan', 'files', 'chat', 'history'],
      quickActions: [],
      emptyInboxText: 'Sin planes pendientes de tu validación. ¡Buen trabajo!',
    },

    COORDINATOR: {
      label: 'Coordinadora',
      accent: '#db2777',
      greeting: 'Gestiona presupuestos, presentaciones y citas con los pacientes.',
      landing: '/dashboard',
      defaultPatientTab: 'commercial',
      sidebar: [
        { group: 'Mi trabajo' },
        { path: 'dashboard', label: 'Inicio', icon: ICON.home },
        { path: 'patients', label: 'Pacientes', icon: ICON.users },
        { group: 'Recursos' },
        { path: 'catalog', label: 'Catálogo', icon: ICON.grid },
        { path: 'settings', label: 'Ajustes', icon: ICON.cog },
      ],
      patientTabs: ['summary', 'budget', 'commercial', 'appointments', 'chat', 'plan'],
      quickActions: [
        { label: '+ Nuevo paciente', primary: true, action: 'newPatient' },
      ],
      emptyInboxText: 'Sin presupuestos pendientes ni citas que coordinar.',
    },

    ASSISTANT: {
      label: 'Auxiliar',
      accent: '#0891b2',
      greeting: 'Consulta tu agenda operativa y los próximos pasos del paciente.',
      landing: '/dashboard',
      defaultPatientTab: 'appointments',
      sidebar: [
        { path: 'dashboard', label: 'Inicio', icon: ICON.home },
        { path: 'patients', label: 'Pacientes', icon: ICON.users },
        { path: 'settings', label: 'Ajustes', icon: ICON.cog },
      ],
      patientTabs: ['summary', 'appointments', 'files', 'chat'],
      quickActions: [],
      emptyInboxText: 'Sin tareas operativas asignadas.',
    },

    RECEPTION: {
      label: 'Recepción',
      accent: '#475569',
      greeting: 'Gestiona la entrada de pacientes y la agenda básica.',
      landing: '/patients',
      defaultPatientTab: 'summary',
      sidebar: [
        { path: 'patients', label: 'Pacientes', icon: ICON.users },
        { path: 'settings', label: 'Ajustes', icon: ICON.cog },
      ],
      patientTabs: ['summary', 'appointments'],
      quickActions: [
        { label: '+ Nuevo paciente', primary: true, action: 'newPatient' },
      ],
      emptyInboxText: 'Sin tareas pendientes.',
    },
  };

  function primaryRole(user) {
    const rs = Permissions.rolesOf(user);
    // Choose the most "interactive" role first
    const order = ['PLANNER', 'COORDINATOR', 'DOCTOR', 'DIRECTOR', 'ASSISTANT', 'RECEPTION', 'SUPER_ADMIN'];
    for (const r of order) if (rs.includes(r)) return r;
    return rs[0] || 'DOCTOR';
  }

  function configFor(user) {
    return ROLE_CONFIG[primaryRole(user)] || ROLE_CONFIG.DOCTOR;
  }

  // Filter sidebar entries by capabilities (defensive)
  function sidebarFor(user) {
    const cfg = configFor(user);
    const items = [];
    cfg.sidebar.forEach((it) => {
      if (it.group) {
        items.push(it);
        return;
      }
      // Hide entries the user actually cannot use
      const guards = {
        catalog: () => Permissions.canAny(user, Permissions.CAP.CATALOG_MANAGE, Permissions.CAP.BUDGET_VIEW),
        users: () => Permissions.can(user, Permissions.CAP.USERS_MANAGE),
        audit: () => Permissions.can(user, Permissions.CAP.AUDIT_VIEW),
      };
      if (guards[it.path] && !guards[it.path]()) return;
      items.push(it);
    });
    return items;
  }

  // Build the role-specific inbox: pending actions
  function buildInbox(user) {
    const items = [];
    const role = primaryRole(user);

    // Doctor / Director: validations pending
    if (Permissions.can(user, Permissions.CAP.PLAN_VALIDATE)) {
      const userSpecs = user.specialties || [];
      const versions = DB.planVersions.all();
      const validations = DB.validations.all();
      const plans = DB.treatmentPlans.all();
      versions.forEach((v) => {
        if (!['validating', 'pending_review', 'consensus_partial'].includes(v.status)) return;
        (v.requiredSpecialties || []).forEach((sId) => {
          if (!userSpecs.includes(sId)) return;
          const decided = validations.find(
            (val) => val.versionId === v.id && val.specialtyId === sId && val.userId === user.id
          );
          if (decided && decided.decision !== 'pending') return;
          const plan = plans.find((p) => p.id === v.planId);
          const patient = plan && DB.patients.get(plan.patientId);
          if (!patient) return;
          items.push({
            kind: 'validation',
            icon: '✓',
            color: 'var(--c-info)',
            patient,
            title: `Validar plan de ${patient.name}`,
            sub: `${DB.specialties.get(sId)?.name || ''} · v${v.versionNumber}`,
            primaryLabel: 'Revisar plan',
            primaryUrl: '#/patients/' + patient.id + '?tab=plan',
            meta: { versionId: v.id, specialtyId: sId },
          });
        });
      });
    }

    // Planner: drafts and changes_requested + first visits in progress
    if (Permissions.can(user, Permissions.CAP.PLAN_CREATE) || Permissions.can(user, Permissions.CAP.FIRST_VISIT_RUN)) {
      // First visits in progress
      const visits = DB.firstVisits.where((v) => v.plannerId === user.id && v.status === 'in_progress');
      visits.forEach((v) => {
        const patient = DB.patients.get(v.patientId);
        if (!patient) return;
        items.push({
          kind: 'first_visit',
          icon: '◐',
          color: 'var(--c-warn)',
          patient,
          title: `Continuar primera visita de ${patient.name}`,
          sub: 'En progreso',
          primaryLabel: 'Continuar',
          primaryUrl: '#/patients/' + patient.id + '/first-visit',
        });
      });
      // Drafts and changes_requested
      const drafts = DB.planVersions.where(
        (v) => v.authorId === user.id && ['draft', 'changes_requested'].includes(v.status)
      );
      drafts.forEach((v) => {
        const plan = DB.treatmentPlans.get(v.planId);
        const patient = plan && DB.patients.get(plan.patientId);
        if (!patient) return;
        items.push({
          kind: 'plan_draft',
          icon: '✎',
          color: 'var(--c-brand)',
          patient,
          title: v.status === 'changes_requested' ? `Revisar plan de ${patient.name}` : `Continuar plan de ${patient.name}`,
          sub: v.status === 'changes_requested' ? 'Cambios solicitados por especialistas' : 'Versión en borrador',
          primaryLabel: v.status === 'changes_requested' ? 'Revisar cambios' : 'Continuar',
          primaryUrl: '#/patients/' + patient.id + '?tab=plan',
        });
      });
    }

    // Coordinator: presentations pending, accepted to schedule, transitions
    if (Permissions.can(user, Permissions.CAP.COMMERCIAL_RUN)) {
      // Plans with consensus complete but no budget yet
      const plans = DB.treatmentPlans.all();
      plans.forEach((p) => {
        if (p.status !== 'consensus_complete') return;
        const budget = DB.budgets.where((b) => b.patientId === p.patientId)[0];
        if (budget) return;
        const patient = DB.patients.get(p.patientId);
        if (!patient) return;
        items.push({
          kind: 'budget_pending',
          icon: '€',
          color: 'var(--c-success)',
          patient,
          title: `Generar presupuesto: ${patient.name}`,
          sub: 'El plan tiene consenso completo',
          primaryLabel: 'Generar',
          primaryUrl: '#/patients/' + patient.id + '?tab=budget',
        });
      });

      // Budgets in draft / presented / negotiating
      DB.commercialStatuses.all().forEach((c) => {
        if (['accepted', 'rejected'].includes(c.status)) return;
        const budget = DB.budgets.get(c.budgetId);
        const patient = budget && DB.patients.get(budget.patientId);
        if (!patient) return;
        const labels = {
          draft: 'Sin presentar',
          presented: 'Presentado, esperando respuesta',
          negotiating: 'En negociación',
          partial_accepted: 'Aceptado parcialmente',
        };
        items.push({
          kind: 'commercial',
          icon: '€',
          color: 'var(--c-warn)',
          patient,
          title: `Seguir con ${patient.name}`,
          sub: labels[c.status] || c.status,
          primaryLabel: 'Abrir',
          primaryUrl: '#/patients/' + patient.id + '?tab=commercial',
        });
      });
    }

    // Assistant / everyone with appt_plan: upcoming appointments
    if (role === 'ASSISTANT' || role === 'RECEPTION') {
      const appts = DB.appointments.all().slice(0, 5);
      appts.forEach((a) => {
        const patient = DB.patients.get(a.patientId);
        if (!patient) return;
        items.push({
          kind: 'appointment',
          icon: '🗓',
          color: 'var(--c-info)',
          patient,
          title: a.title,
          sub: patient.name + ' · ' + (a.duration || ''),
          primaryLabel: 'Ver',
          primaryUrl: '#/patients/' + patient.id + '?tab=appointments',
        });
      });
    }

    return items;
  }

  // Quick stats per role for the dashboard hero
  function quickStats(user) {
    const role = primaryRole(user);
    const stats = [];
    if (role === 'PLANNER') {
      const myVisits = DB.firstVisits.where((v) => v.plannerId === user.id);
      const myPlans = DB.planVersions.where((v) => v.authorId === user.id);
      stats.push({ label: 'Primeras visitas', value: myVisits.length });
      stats.push({ label: 'Planes creados', value: myPlans.length });
      stats.push({ label: 'En consenso', value: myPlans.filter((p) => p.status === 'consensus_complete').length });
    } else if (role === 'DOCTOR') {
      const userSpecs = user.specialties || [];
      const myValidations = DB.validations.where((v) => v.userId === user.id);
      stats.push({ label: 'Mis especialidades', value: userSpecs.length });
      stats.push({ label: 'Validaciones realizadas', value: myValidations.length });
      stats.push({ label: 'Aprobadas', value: myValidations.filter((v) => v.decision === 'approved').length });
    } else if (role === 'COORDINATOR') {
      const accepted = DB.commercialStatuses.where((c) => c.status === 'accepted');
      const total = accepted.reduce((s, c) => s + (c.acceptedValue || 0), 0);
      stats.push({ label: 'Presupuestos cerrados', value: accepted.length });
      stats.push({ label: 'Importe aceptado', value: UI.fmtMoney(total) });
      stats.push({ label: 'Pacientes activos', value: DB.patients.where((p) => p.status === 'in_treatment').length });
    } else if (role === 'DIRECTOR' || role === 'SUPER_ADMIN') {
      const all = DB.budgetVersions.all().reduce((s, v) => s + (v.totals?.total || 0), 0);
      stats.push({ label: 'Pacientes', value: DB.patients.all().length });
      stats.push({ label: 'Planes', value: DB.treatmentPlans.all().length });
      stats.push({ label: 'Presupuestado', value: UI.fmtMoney(all) });
    } else {
      stats.push({ label: 'Pacientes', value: DB.patients.all().length });
    }
    return stats;
  }

  global.RoleConfig = {
    ICON,
    ROLE_CONFIG,
    primaryRole,
    configFor,
    sidebarFor,
    buildInbox,
    quickStats,
  };
})(window);
