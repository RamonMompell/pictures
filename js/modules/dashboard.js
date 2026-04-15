/* ============================================================
   Clinia — Dashboard (role-aware, inbox-first)
   Friendly home page tuned to the role of the current user.
   ============================================================ */

(function (global) {
  const { el, escapeHtml, fmtMoney, fmtDate, timeAgo, statusPill, initials } = UI;

  function greetingTime() {
    const h = new Date().getHours();
    if (h < 6) return 'Buenas noches';
    if (h < 13) return 'Buenos días';
    if (h < 21) return 'Buenas tardes';
    return 'Buenas noches';
  }

  function statCard(label, value, sub) {
    return el('div', { class: 'kpi' }, [
      el('div', { class: 'label' }, label),
      el('div', { class: 'value' }, String(value)),
      sub ? el('div', { class: 'sub' }, sub) : null,
    ]);
  }

  function inboxItem(item) {
    const left = el('div', { class: 'inbox-item-left' }, [
      el('div', { class: 'inbox-item-icon', style: { background: item.color + '18', color: item.color } }, item.icon),
      el('div', {}, [
        el('div', { class: 'inbox-item-title' }, item.title),
        el('div', { class: 'inbox-item-sub' }, item.sub),
      ]),
    ]);
    const right = el('div', {}, [
      el(
        'a',
        { class: 'btn btn-sm btn-primary', href: item.primaryUrl },
        item.primaryLabel || 'Abrir'
      ),
    ]);
    return el('div', { class: 'inbox-item' }, [left, right]);
  }

  function inboxSection(user) {
    const cfg = RoleConfig.configFor(user);
    const items = RoleConfig.buildInbox(user);
    const card = el('div', { class: 'card' });
    card.appendChild(
      el('div', { class: 'card-header' }, [
        el('h3', {}, '📥 Tu bandeja de entrada'),
        el('span', { class: 'badge brand' }, items.length + ' tareas'),
      ])
    );
    if (items.length === 0) {
      card.appendChild(
        el('div', { class: 'inbox-empty' }, [
          el('div', { class: 'inbox-empty-icon' }, '✓'),
          el('h4', {}, '¡Estás al día!'),
          el('p', {}, cfg.emptyInboxText || 'No tienes tareas pendientes ahora mismo.'),
        ])
      );
    } else {
      const list = el('div', { class: 'inbox-list' });
      items.slice(0, 8).forEach((it) => list.appendChild(inboxItem(it)));
      card.appendChild(list);
      if (items.length > 8) {
        card.appendChild(
          el('div', { class: 'text-center', style: { marginTop: '12px' } }, [
            el('small', { class: 'text-muted' }, `+${items.length - 8} más`),
          ])
        );
      }
    }
    return card;
  }

  function recentPatientsSection() {
    const card = el('div', { class: 'card' });
    card.appendChild(
      el('div', { class: 'card-header' }, [
        el('h3', {}, '👥 Pacientes recientes'),
        el(
          'a',
          { href: '#/patients', class: 'text-muted', style: { fontSize: '12px' } },
          'Ver todos →'
        ),
      ])
    );
    const list = DB.patients
      .all()
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 5);
    if (list.length === 0) {
      card.appendChild(el('div', { class: 'empty' }, 'Aún no hay pacientes.'));
      return card;
    }
    const ul = el('div', { class: 'compact-list' });
    list.forEach((p) => {
      ul.appendChild(
        el(
          'a',
          { href: '#/patients/' + p.id, class: 'compact-item' },
          [
            el('div', { class: 'avatar-sm' }, initials(p.name)),
            el('div', { class: 'compact-item-body' }, [
              el('div', { class: 'compact-item-title' }, p.name),
              el('div', { class: 'compact-item-sub' }, statusLabel(p.status)),
            ]),
            el('div', { class: 'text-muted', style: { fontSize: '11px' } }, timeAgo(p.updatedAt || p.createdAt)),
          ]
        )
      );
    });
    card.appendChild(ul);
    return card;
  }

  function statusLabel(s) {
    return ({
      first_visit: 'Primera visita',
      planning: 'En planificación',
      budget_pending: 'Pendiente de presupuesto',
      in_treatment: 'En tratamiento',
      completed: 'Completado',
    }[s] || s || '—');
  }

  function activitySection() {
    const log = DB.auditLog.all().slice().reverse().slice(0, 6);
    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-header' }, [el('h3', {}, '📋 Actividad reciente')]));
    if (log.length === 0) {
      card.appendChild(el('div', { class: 'empty' }, 'Sin actividad reciente.'));
      return card;
    }
    const list = el('div', { class: 'activity-list' });
    log.forEach((l) => {
      list.appendChild(
        el('div', { class: 'activity-item' }, [
          el('div', { class: 'avatar' }, initials(l.userName || 'S')),
          el('div', { class: 'text' }, [
            el('div', {}, escapeHtml(l.userName || 'Sistema') + ' · ' + escapeHtml(l.action)),
            el('div', { class: 'time' }, timeAgo(l.createdAt)),
          ]),
        ])
      );
    });
    card.appendChild(list);
    return card;
  }

  function welcomeHero(user) {
    const cfg = RoleConfig.configFor(user);
    const stats = RoleConfig.quickStats(user);

    const hero = el('div', { class: 'role-hero', style: { '--accent': cfg.accent } });
    hero.innerHTML = `
      <div class="role-hero-body">
        <div class="role-pill">${escapeHtml(cfg.label)}</div>
        <h1>${greetingTime()}, ${escapeHtml(user.name.split(' ')[0])}</h1>
        <p>${escapeHtml(cfg.greeting)}</p>
      </div>
    `;
    if (stats.length) {
      const stripe = el('div', { class: 'role-hero-stats' });
      stats.forEach((s) => {
        stripe.appendChild(
          el('div', { class: 'role-hero-stat' }, [
            el('div', { class: 'v' }, String(s.value)),
            el('div', { class: 'l' }, s.label),
          ])
        );
      });
      hero.appendChild(stripe);
    }
    return hero;
  }

  function suggestedActions(user) {
    const role = RoleConfig.primaryRole(user);
    const items = [];
    if (role === 'PLANNER') {
      items.push({ icon: '➕', title: 'Crear paciente', sub: 'Empieza un caso nuevo', url: '#/patients/new' });
      items.push({ icon: '📋', title: 'Ver pacientes', sub: 'Continúa con tus casos', url: '#/patients' });
      items.push({ icon: '📚', title: 'Catálogo', sub: 'Conceptos y precios', url: '#/catalog' });
    } else if (role === 'DOCTOR') {
      items.push({ icon: '✓', title: 'Pacientes', sub: 'Revisa los planes que te llegan', url: '#/patients' });
      items.push({ icon: '⚙', title: 'Mis ajustes', sub: 'Especialidades y preferencias', url: '#/settings' });
    } else if (role === 'COORDINATOR') {
      items.push({ icon: '€', title: 'Presupuestos', sub: 'Pacientes pendientes de venta', url: '#/patients' });
      items.push({ icon: '➕', title: 'Nuevo paciente', sub: 'Alta administrativa', url: '#/patients/new' });
      items.push({ icon: '📚', title: 'Catálogo', sub: 'Conceptos y precios', url: '#/catalog' });
    } else if (role === 'ASSISTANT') {
      items.push({ icon: '🗓', title: 'Pacientes', sub: 'Próximas citas y checklist', url: '#/patients' });
    } else if (role === 'RECEPTION') {
      items.push({ icon: '➕', title: 'Nuevo paciente', sub: 'Alta administrativa', url: '#/patients/new' });
      items.push({ icon: '👥', title: 'Pacientes', sub: 'Buscar y editar fichas', url: '#/patients' });
    } else {
      items.push({ icon: '📊', title: 'Auditoría', sub: 'Trazabilidad del sistema', url: '#/audit' });
      items.push({ icon: '👥', title: 'Usuarios', sub: 'Gestión de equipo', url: '#/users' });
      items.push({ icon: '⚙', title: 'Ajustes', sub: 'Configuración global', url: '#/settings' });
    }
    if (items.length === 0) return null;
    const wrap = el('div', { class: 'card' });
    wrap.appendChild(el('div', { class: 'card-header' }, [el('h3', {}, '⚡ Atajos para ti')]));
    const grid = el('div', { class: 'shortcut-grid' });
    items.forEach((it) => {
      grid.appendChild(
        el('a', { href: it.url, class: 'shortcut' }, [
          el('div', { class: 'shortcut-icon' }, it.icon),
          el('div', {}, [
            el('div', { class: 'shortcut-title' }, it.title),
            el('div', { class: 'shortcut-sub' }, it.sub),
          ]),
        ])
      );
    });
    wrap.appendChild(grid);
    return wrap;
  }

  function render(root) {
    const user = Auth.currentUser();
    root.innerHTML = '';

    root.appendChild(welcomeHero(user));

    // Friendly first-time hint card if new user
    if (!DB.settings.get()['onboarded_' + user.id]) {
      const cfg = RoleConfig.configFor(user);
      const onboard = el('div', { class: 'onboarding-card' }, [
        el('div', { class: 'row-sb' }, [
          el('div', {}, [
            el('h3', {}, '👋 Bienvenida a Clinia'),
            el('p', { class: 'text-muted' }, [
              'Esta es tu pantalla de inicio como ',
              el('strong', {}, cfg.label.toLowerCase()),
              '. Aquí ves lo que necesitas hacer hoy. Ve a Pacientes para abrir un caso concreto.',
            ]),
          ]),
          el(
            'button',
            {
              class: 'btn btn-ghost btn-sm',
              onClick: (e) => {
                const s = DB.settings.get();
                s['onboarded_' + user.id] = true;
                DB.settings.set(s);
                e.target.closest('.onboarding-card').remove();
              },
            },
            'Entendido ✓'
          ),
        ]),
      ]);
      root.appendChild(onboard);
    }

    // Two-column layout
    const grid = el('div', { class: 'dashboard-main' });
    const left = el('div');
    const right = el('div');
    left.appendChild(inboxSection(user));
    const sa = suggestedActions(user);
    if (sa) left.appendChild(sa);
    right.appendChild(recentPatientsSection());
    if (Permissions.can(user, Permissions.CAP.AUDIT_VIEW) || RoleConfig.primaryRole(user) === 'DIRECTOR') {
      right.appendChild(activitySection());
    }
    grid.appendChild(left);
    grid.appendChild(right);
    root.appendChild(grid);
  }

  global.Dashboard = { render };
})(window);
