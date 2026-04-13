/* ============================================================
   Clinia — Dashboard module (role-aware)
   ============================================================ */

(function (global) {
  const { el, fmtMoney, fmtDate, timeAgo, statusPill, initials, escapeHtml } = UI;

  function kpi(label, value, sub) {
    return el('div', { class: 'kpi' }, [
      el('div', { class: 'label' }, label),
      el('div', { class: 'value' }, value),
      sub ? el('div', { class: 'sub' }, sub) : null,
    ]);
  }

  function calcMetrics() {
    const patients = DB.patients.all();
    const plans = DB.treatmentPlans.all();
    const versions = DB.planVersions.all();
    const budgets = DB.budgets.all();
    const budgetVersions = DB.budgetVersions.all();
    const commercial = DB.commercialStatuses.all();
    const validations = DB.validations.all();

    const totalBudgeted = budgetVersions
      .filter((v) => ['clinical', 'commercial'].includes(v.type))
      .reduce((s, v) => s + (v.totals?.total || 0), 0);
    const totalAccepted = commercial
      .filter((c) => c.status === 'accepted')
      .reduce((s, c) => s + (c.acceptedValue || 0), 0);
    const acceptanceRate = budgets.length
      ? Math.round(
          (commercial.filter((c) => c.status === 'accepted').length / budgets.length) * 100
        )
      : 0;

    const consensusComplete = versions.filter((v) => v.status === 'consensus_complete').length;
    const consensusPending = versions.filter((v) =>
      ['consensus_partial', 'validating', 'pending_review'].includes(v.status)
    ).length;

    return {
      patients: patients.length,
      newThisMonth: patients.filter((p) => {
        const d = new Date(p.createdAt);
        const t = new Date();
        return d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
      }).length,
      plans: plans.length,
      consensusComplete,
      consensusPending,
      validations: validations.length,
      totalBudgeted,
      totalAccepted,
      acceptanceRate,
    };
  }

  function recentActivity() {
    const log = DB.auditLog.all().slice().reverse().slice(0, 10);
    if (!log.length)
      return el('div', { class: 'empty' }, 'Sin actividad reciente.');
    const list = el('div', { class: 'activity-list' });
    log.forEach((l) => {
      list.appendChild(
        el('div', { class: 'activity-item' }, [
          el('div', { class: 'avatar' }, initials(l.userName || 'S')),
          el('div', { class: 'text' }, [
            el('div', {}, `${escapeHtml(l.userName || 'Sistema')} · ${escapeHtml(l.action)}`),
            el('div', { class: 'time' }, timeAgo(l.createdAt)),
          ]),
        ])
      );
    });
    return list;
  }

  function specialtyBreakdown() {
    const validations = DB.validations.all();
    const specs = DB.specialties.all();
    const counts = {};
    validations.forEach((v) => {
      counts[v.specialtyId] = (counts[v.specialtyId] || 0) + 1;
    });
    const wrap = el('div');
    specs.forEach((s) => {
      const n = counts[s.id] || 0;
      const max = Math.max(...Object.values(counts), 1);
      const pct = Math.round((n / max) * 100);
      wrap.appendChild(
        el('div', { style: { marginBottom: '10px' } }, [
          el(
            'div',
            { class: 'row-sb', style: { fontSize: '12px', marginBottom: '4px' } },
            [el('span', {}, s.name), el('span', { class: 'text-muted' }, n)]
          ),
          el(
            'div',
            { style: { height: '6px', background: 'var(--c-bg-alt)', borderRadius: '4px', overflow: 'hidden' } },
            [
              el('div', {
                style: {
                  width: pct + '%',
                  height: '100%',
                  background: s.color || 'var(--c-brand)',
                  transition: 'width .3s',
                },
              }),
            ]
          ),
        ])
      );
    });
    return wrap;
  }

  function pendingValidationsForUser(user) {
    const userSpecs = user.specialties || [];
    const validations = DB.validations.all();
    const versions = DB.planVersions.all();
    const plans = DB.treatmentPlans.all();
    const list = [];
    versions.forEach((v) => {
      if (!['validating', 'pending_review', 'consensus_partial'].includes(v.status)) return;
      (v.requiredSpecialties || []).forEach((sId) => {
        if (!userSpecs.includes(sId)) return;
        const decided = validations.find(
          (val) => val.versionId === v.id && val.specialtyId === sId && val.userId === user.id
        );
        if (!decided || decided.decision === 'pending') {
          const plan = plans.find((p) => p.id === v.planId);
          const patient = plan && DB.patients.get(plan.patientId);
          list.push({ version: v, plan, patient, specialtyId: sId });
        }
      });
    });
    return list;
  }

  function render(root) {
    const user = Auth.currentUser();
    const m = calcMetrics();
    root.innerHTML = '';

    // Welcome
    root.appendChild(
      el('div', { class: 'dashboard-welcome' }, [
        el('div', {}, [
          el('h1', {}, 'Hola, ' + user.name.split(' ')[0]),
          el(
            'p',
            {},
            'Plataforma de planificación interdisciplinar — ' +
              new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
          ),
        ]),
        el('div', {}, [
          el(
            'button',
            {
              class: 'btn btn-primary',
              onClick: () => Router.go('/patients/new'),
            },
            '+ Nuevo paciente'
          ),
        ]),
      ])
    );

    // KPIs
    const kpis = el('div', { class: 'dashboard-kpis' }, [
      kpi('Pacientes', m.patients, `+${m.newThisMonth} este mes`),
      kpi('Planes activos', m.plans, `${m.consensusComplete} con consenso`),
      kpi('Presupuestado', fmtMoney(m.totalBudgeted), 'global'),
      kpi('Aceptado', fmtMoney(m.totalAccepted), m.acceptanceRate + '% aceptación'),
    ]);
    root.appendChild(kpis);

    // Main grid
    const main = el('div', { class: 'dashboard-main' });

    // Left: pending tasks (depends on role)
    const leftCard = el('div', { class: 'card' });
    leftCard.appendChild(
      el('div', { class: 'card-header' }, [
        el('h3', {}, 'Tu trabajo pendiente'),
        el('span', { class: 'badge brand' }, Permissions.rolesOf(user)[0]),
      ])
    );

    const tasks = [];

    // Doctor / Director: validations pending
    if (Permissions.canAny(user, Permissions.CAP.PLAN_VALIDATE)) {
      const pv = pendingValidationsForUser(user);
      pv.slice(0, 5).forEach((p) => {
        tasks.push({
          icon: '✓',
          title: `Validar plan de ${p.patient?.name || '—'}`,
          sub: `Versión ${p.version.versionNumber} · ${
            DB.specialties.get(p.specialtyId)?.name || ''
          }`,
          link: '#/patients/' + p.patient?.id + '?tab=plan',
        });
      });
    }

    // Planner: drafts and changes_requested
    if (Permissions.can(user, Permissions.CAP.PLAN_CREATE)) {
      const drafts = DB.planVersions.where(
        (v) =>
          v.authorId === user.id &&
          ['draft', 'changes_requested'].includes(v.status)
      );
      drafts.slice(0, 5).forEach((v) => {
        const plan = DB.treatmentPlans.get(v.planId);
        const patient = plan && DB.patients.get(plan.patientId);
        tasks.push({
          icon: '✎',
          title: `Plan en borrador: ${patient?.name || ''}`,
          sub: `v${v.versionNumber} · ${v.status}`,
          link: '#/patients/' + patient?.id + '?tab=plan',
        });
      });
    }

    // Coordinator: pending budgets
    if (Permissions.can(user, Permissions.CAP.COMMERCIAL_RUN)) {
      const pendingComm = DB.commercialStatuses.where(
        (c) => !['accepted', 'rejected'].includes(c.status)
      );
      pendingComm.slice(0, 5).forEach((c) => {
        const budget = DB.budgets.get(c.budgetId);
        const patient = budget && DB.patients.get(budget.patientId);
        tasks.push({
          icon: '€',
          title: `Presupuesto pendiente: ${patient?.name || ''}`,
          sub: c.status,
          link: '#/patients/' + patient?.id + '?tab=budget',
        });
      });
    }

    if (tasks.length === 0) {
      leftCard.appendChild(el('div', { class: 'empty' }, 'No tienes tareas pendientes 🎉'));
    } else {
      const ul = el('div', { class: 'activity-list' });
      tasks.forEach((t) => {
        const a = el('a', { href: t.link, class: 'activity-item' }, [
          el('div', { class: 'avatar' }, t.icon),
          el('div', { class: 'text' }, [
            el('div', {}, t.title),
            el('div', { class: 'time' }, t.sub),
          ]),
        ]);
        ul.appendChild(a);
      });
      leftCard.appendChild(ul);
    }
    main.appendChild(leftCard);

    // Right column: stats + activity
    const right = el('div');
    const card2 = el('div', { class: 'card' });
    card2.appendChild(el('div', { class: 'card-header' }, [el('h3', {}, 'Carga por especialidad')]));
    card2.appendChild(specialtyBreakdown());
    right.appendChild(card2);

    const card3 = el('div', { class: 'card' });
    card3.appendChild(el('div', { class: 'card-header' }, [el('h3', {}, 'Actividad reciente')]));
    card3.appendChild(recentActivity());
    right.appendChild(card3);

    main.appendChild(right);
    root.appendChild(main);
  }

  global.Dashboard = { render };
})(window);
