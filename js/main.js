/* ============================================================
   Clinia — App bootstrap
   ============================================================ */

(async function () {
  await DB.init();
  Seed.run();

  // Theme
  const settings = DB.settings.get();
  document.body.dataset.theme = settings.theme || 'light';

  // Render either login or app shell
  function mount() {
    const user = Auth.currentUser();
    if (!user) renderLogin();
    else renderApp(user);
  }

  function renderLogin() {
    const root = document.getElementById('app');
    root.innerHTML = '';
    root.className = '';
    const shell = document.createElement('div');
    shell.className = 'login-shell';

    // Hero
    const hero = document.createElement('div');
    hero.className = 'login-hero';
    hero.innerHTML = `
      <div>
        <div class="brand-logo" style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#14b8a6,#0f766e);display:grid;place-items:center;color:#fff;font-weight:800">C</div>
        <h1>Clinia</h1>
        <p>Plataforma profesional de planificación, validación interdisciplinar
        y coordinación de tratamientos en clínica dental multidisciplinar.</p>
        <ul class="bullets">
          <li>Primera visita configurable y trazable</li>
          <li>Plan multidisciplinar con consenso entre especialistas</li>
          <li>Versionado completo del plan, presupuesto y venta</li>
          <li>Coordinación operativa con citas ideales</li>
          <li>Auditoría exhaustiva y permisos granulares</li>
        </ul>
      </div>
      <div style="color:var(--c-text-soft); font-size:11px;">© Clinia · Build demo</div>
    `;

    // Panel
    const panel = document.createElement('div');
    panel.className = 'login-panel';
    const card = document.createElement('div');
    card.className = 'login-card';
    card.innerHTML = `
      <h2>Acceso clínico</h2>
      <div class="sub">Inicia sesión con tu cuenta para acceder a la plataforma.</div>
      <form id="login-form">
        <div class="form-field">
          <label>Email</label>
          <input type="email" name="email" placeholder="email@clinia.dev" required>
        </div>
        <div class="form-field">
          <label>Contraseña</label>
          <input type="password" name="password" placeholder="••••••" required>
        </div>
        <button class="btn btn-primary btn-lg" style="width:100%">Entrar</button>
        <div id="login-error" class="text-muted" style="color:var(--c-danger); font-size:12px; margin-top:8px"></div>
      </form>
      <div class="demo-users">
        <h4>Usuarios de demostración (contraseña: demo)</h4>
        <div class="demo-user-list" id="demo-users"></div>
      </div>
    `;
    panel.appendChild(card);

    shell.appendChild(hero);
    shell.appendChild(panel);
    root.appendChild(shell);

    // Demo users buttons
    const demoUsers = card.querySelector('#demo-users');
    DB.users.all().slice(0, 7).forEach((u) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = `<span>${u.name}</span><span>${(u.roles || [])[0] || ''}</span>`;
      btn.addEventListener('click', () => {
        card.querySelector('input[name=email]').value = u.email;
        card.querySelector('input[name=password]').value = 'demo';
      });
      demoUsers.appendChild(btn);
    });

    card.querySelector('#login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const res = Auth.login(f.get('email'), f.get('password'));
      if (!res.ok) {
        card.querySelector('#login-error').textContent = res.error;
        return;
      }
      mount();
    });
  }

  function renderApp(user) {
    const root = document.getElementById('app');
    root.innerHTML = '';

    // Impersonation banner (top of screen, full width)
    if (Auth.isImpersonating()) {
      const banner = document.createElement('div');
      banner.className = 'impersonation-banner';
      const real = Auth.realUser();
      banner.innerHTML = `
        <div>
          <strong>👁 Modo "Actuar como"</strong>
          · Estás viendo Clinia como <strong>${UI.escapeHtml(user.name)}</strong>
          (${(user.roles || [])[0] || ''}). Tu cuenta real es <strong>${UI.escapeHtml(real.name)}</strong>.
          Cualquier acción quedará registrada como hecha por ${UI.escapeHtml(user.name)} bajo supervisión del master.
        </div>
        <button class="btn btn-sm">Volver a mi sesión</button>
      `;
      banner.querySelector('button').addEventListener('click', () => {
        Auth.stopImpersonation();
        UI.toast('Volviendo a tu cuenta', 'info');
        mount();
      });
      root.appendChild(banner);
    }

    const shell = document.createElement('div');
    shell.className = 'app-shell';
    if (Auth.isImpersonating()) shell.classList.add('with-banner');

    // Sidebar
    shell.appendChild(buildSidebar(user));

    // Topbar
    shell.appendChild(buildTopbar(user));

    // Main
    const main = document.createElement('main');
    main.className = 'main';
    const view = document.createElement('div');
    view.id = 'view';
    main.appendChild(view);
    shell.appendChild(main);

    root.appendChild(shell);

    // Routes
    Router.routes = [];
    Router.add('', () => Dashboard.render(view));
    Router.add('dashboard', () => Dashboard.render(view));
    Router.add('patients', () => Patients.renderList(view));
    Router.add('patients/new', () => {
      Patients.renderList(view);
      Patients.openCreatePatientModal();
    });
    Router.add('patients/:id', (ctx) => Patients.renderDetail(view, ctx.params.id, ctx.query));
    Router.add('patients/:id/first-visit', (ctx) => FirstVisit.render(view, ctx.params.id));
    Router.add('catalog', () => Catalog.render(view));
    Router.add('users', () => Users.render(view));
    Router.add('audit', () => AuditView.render(view));
    Router.add('settings', () => Settings.render(view));
    Router.setNotFound(() => {
      view.innerHTML = '<div class="empty"><h3>Página no encontrada</h3></div>';
    });

    // Smart landing per role
    const cfg = RoleConfig.configFor(user);
    if (!location.hash || location.hash === '#' || location.hash === '#/') {
      location.hash = cfg.landing || '/dashboard';
    }
    Router.start();

    // Highlight active nav
    DB.Events.on('*', () => {
      // Re-highlight on route change is handled directly in click handlers
    });
    window.addEventListener('hashchange', () => highlightNav());
    highlightNav();
  }

  function highlightNav() {
    const path = (location.hash || '#/dashboard').replace(/^#\/?/, '').split('/')[0] || 'dashboard';
    document.querySelectorAll('.sidebar .nav a').forEach((a) => {
      a.classList.toggle('active', a.dataset.path === path);
    });
  }

  function buildSidebar(user) {
    const cfg = RoleConfig.configFor(user);
    const aside = document.createElement('aside');
    aside.className = 'sidebar';
    aside.style.setProperty('--accent', cfg.accent);

    const brand = document.createElement('div');
    brand.className = 'brand';
    brand.innerHTML = `
      <div class="brand-logo" style="background:linear-gradient(135deg, ${cfg.accent}, #0f766e)">C</div>
      <div>
        <div class="brand-name">Clin<span>ia</span></div>
        <div class="role-tag">${cfg.label}</div>
      </div>
    `;
    aside.appendChild(brand);

    const nav = document.createElement('div');
    nav.className = 'nav';
    aside.appendChild(nav);

    const items = RoleConfig.sidebarFor(user);
    items.forEach((it) => {
      if (it.group) {
        const d = document.createElement('div');
        d.className = 'group-label';
        d.textContent = it.group;
        nav.appendChild(d);
      } else {
        const a = document.createElement('a');
        a.href = '#/' + it.path;
        a.dataset.path = it.path;
        a.innerHTML = `${it.icon || ''}<span>${it.label}</span>`;
        nav.appendChild(a);
      }
    });

    // Big role-themed primary action button
    if (cfg.quickActions && cfg.quickActions.length) {
      const wrap = document.createElement('div');
      wrap.className = 'sidebar-cta';
      cfg.quickActions.forEach((qa) => {
        const btn = document.createElement('button');
        btn.className = 'btn ' + (qa.primary ? 'btn-primary' : '') + ' btn-block';
        btn.textContent = qa.label;
        btn.addEventListener('click', () => handleQuickAction(qa.action));
        wrap.appendChild(btn);
      });
      aside.appendChild(wrap);
    }

    const footer = document.createElement('div');
    footer.className = 'sidebar-footer';
    footer.innerHTML = `Clinia · v0.2<br>Modo demo local`;
    aside.appendChild(footer);

    return aside;
  }

  function handleQuickAction(action) {
    if (action === 'newPatient') {
      Router.go('/patients');
      setTimeout(() => Patients.openCreatePatientModal(), 60);
    }
  }

  function buildTopbar(user) {
    const top = document.createElement('header');
    top.className = 'topbar';

    const left = document.createElement('div');
    left.className = 'breadcrumbs';
    left.innerHTML = `<span>Clinia</span><span class="sep">/</span><span id="bc-current">Inicio</span>`;
    top.appendChild(left);

    const right = document.createElement('div');
    right.className = 'right';

    // Search
    const search = document.createElement('div');
    search.className = 'search';
    search.innerHTML = `
      <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="Buscar paciente, plan…">
    `;
    const searchInput = search.querySelector('input');
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q.length === 0) return;
        Router.go('/patients');
        // Filter using DOM after navigation
        setTimeout(() => {
          const fInput = document.querySelector('.filters-bar input[type=text]');
          if (fInput) {
            fInput.value = q;
            fInput.dispatchEvent(new Event('input'));
          }
        }, 80);
      }
    });
    right.appendChild(search);

    // Master "Actuar como" selector
    const realUser = Auth.realUser();
    if (realUser && (realUser.roles || []).includes('SUPER_ADMIN')) {
      const actBtn = document.createElement('button');
      actBtn.className = 'btn btn-sm act-as-btn';
      actBtn.innerHTML =
        '👁 ' + (Auth.isImpersonating() ? 'Actuando como ' + UI.escapeHtml(user.name.split(' ')[0]) : 'Actuar como…');
      actBtn.addEventListener('click', () => openActAsPicker(realUser));
      right.appendChild(actBtn);
    }

    // Notifications icon
    const unread = DB.notifications.where((n) => n.userId === user.id && !n.read).length;
    const notifBtn = document.createElement('button');
    notifBtn.className = 'icon-btn';
    notifBtn.style.position = 'relative';
    notifBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      ${unread > 0 ? `<span class="notif-badge">${unread}</span>` : ''}
    `;
    notifBtn.addEventListener('click', () => showNotifications(user));
    right.appendChild(notifBtn);

    // User chip
    const chip = document.createElement('div');
    chip.className = 'user-chip';
    chip.innerHTML = `
      <div class="avatar">${UI.initials(user.name)}</div>
      <div>
        <div style="font-weight:600">${UI.escapeHtml(user.name)}</div>
        <div style="font-size:10.5px; color:var(--c-text-soft)">${(user.roles || [])[0] || ''}</div>
      </div>
    `;
    chip.style.cursor = 'pointer';
    chip.addEventListener('click', () => {
      UI.openModal({
        title: 'Sesión',
        body: UI.el('div', {}, [
          UI.el('p', {}, `Conectado como ${user.name} (${user.email})`),
          UI.el('p', { class: 'text-muted' }, 'Roles: ' + (user.roles || []).map((r) => Permissions.label(r)).join(', ')),
        ]),
        footer: (footer, close) => {
          footer.appendChild(
            UI.el('button', { class: 'btn', onClick: () => close(null) }, 'Cancelar')
          );
          footer.appendChild(
            UI.el(
              'button',
              {
                class: 'btn btn-danger',
                onClick: () => {
                  Auth.logout();
                  close(null);
                  mount();
                },
              },
              'Cerrar sesión'
            )
          );
        },
      });
    });
    right.appendChild(chip);

    top.appendChild(right);
    return top;
  }

  function openActAsPicker(realUser) {
    const users = DB.users.where((u) => u.active && u.id !== realUser.id);
    const list = UI.el('div', { class: 'act-as-list' });
    if (Auth.isImpersonating()) {
      list.appendChild(
        UI.el(
          'button',
          {
            class: 'act-as-item act-as-stop',
            onClick: () => {
              Auth.stopImpersonation();
              UI.toast('Volviendo a tu cuenta de master', 'info');
              mount();
            },
          },
          [
            UI.el('div', { class: 'avatar' }, '←'),
            UI.el('div', {}, [
              UI.el('div', {}, 'Volver a mi cuenta'),
              UI.el('small', { class: 'text-muted' }, realUser.name),
            ]),
          ]
        )
      );
    }
    users.forEach((u) => {
      list.appendChild(
        UI.el(
          'button',
          {
            class: 'act-as-item',
            onClick: () => {
              Auth.startImpersonation(u.id);
              UI.toast('Actuando como ' + u.name, 'success');
              mount();
            },
          },
          [
            UI.el('div', { class: 'avatar' }, UI.initials(u.name)),
            UI.el('div', {}, [
              UI.el('div', {}, u.name),
              UI.el('small', { class: 'text-muted' }, (u.roles || []).map((r) => Permissions.label(r)).join(', ')),
            ]),
          ]
        )
      );
    });

    UI.openModal({
      title: '👁 Actuar como otro usuario',
      body: UI.el('div', {}, [
        UI.el(
          'p',
          { class: 'text-muted' },
          'Como master puedes asumir temporalmente la identidad de cualquier doctor para responder, validar planes o escribir comentarios en su nombre. Toda acción quedará registrada en auditoría con tu cuenta real.'
        ),
        list,
      ]),
      footer: (footer, close) => {
        footer.appendChild(
          UI.el('button', { class: 'btn', onClick: () => close(null) }, 'Cancelar')
        );
      },
    });
  }

  function showNotifications(user) {
    const list = DB.notifications
      .where((n) => n.userId === user.id)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const body = UI.el('div');
    if (list.length === 0) body.appendChild(UI.el('div', { class: 'empty' }, 'Sin notificaciones'));
    list.forEach((n) => {
      const item = UI.el(
        'a',
        {
          href: n.targetUrl || '#',
          class: 'activity-item',
          style: { background: n.read ? '' : 'var(--c-brand-50)' },
          onClick: () => DB.notifications.update(n.id, { read: true }),
        },
        [
          UI.el('div', { class: 'avatar' }, '!'),
          UI.el('div', { class: 'text' }, [
            UI.el('div', {}, n.text),
            UI.el('div', { class: 'time' }, UI.timeAgo(n.createdAt)),
          ]),
        ]
      );
      body.appendChild(item);
    });
    UI.openModal({
      title: 'Notificaciones',
      body,
      footer: (footer, close) => {
        footer.appendChild(
          UI.el(
            'button',
            {
              class: 'btn',
              onClick: () => {
                list.forEach((n) => DB.notifications.update(n.id, { read: true }));
                close(null);
              },
            },
            'Marcar todas como leídas'
          )
        );
      },
    });
  }

  function svgIcon(name) {
    const icons = {
      home: '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      users: '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      grid: '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
      user: '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      shield: '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      cog: '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.16.66.43.86.78.2.35.27.76.21 1.16"/></svg>',
    };
    return icons[name] || '';
  }

  // Initial mount
  mount();
})();
