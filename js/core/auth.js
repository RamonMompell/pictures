/* ============================================================
   Clinia — Auth
   Demo authentication: passwords are NOT hashed in this client-only
   build. The repo factory + audit log are wired so a real backend
   can drop-in replace this module.
   ============================================================ */

(function (global) {
  // Ultra-simple "hash" for demo only — DO NOT use in production.
  function fakeHash(pw) {
    let h = 0;
    for (let i = 0; i < pw.length; i++) h = (h << 5) - h + pw.charCodeAt(i);
    return 'demo$' + Math.abs(h).toString(36);
  }

  const Auth = {
    fakeHash,

    currentUser() {
      const session = DB.session.get();
      if (!session) return null;
      const user = DB.users.get(session.userId);
      if (!user || !user.active) {
        DB.session.clear();
        return null;
      }
      return user;
    },

    isAuthenticated() {
      return !!this.currentUser();
    },

    login(email, password) {
      const norm = (email || '').toLowerCase().trim();
      const user = DB.users.where((u) => u.email.toLowerCase() === norm)[0];
      if (!user) return { ok: false, error: 'Usuario no encontrado' };
      if (!user.active) return { ok: false, error: 'Usuario inactivo o bloqueado' };
      if (user.passwordHash !== fakeHash(password))
        return { ok: false, error: 'Credenciales incorrectas' };
      const session = {
        userId: user.id,
        token: DB.uid('tok'),
        startedAt: DB.now(),
      };
      DB.session.set(session);
      DB.auditLog.insert({
        userId: user.id,
        action: 'login',
        targetType: 'user',
        targetId: user.id,
        details: { email },
      });
      return { ok: true, user };
    },

    logout() {
      const u = this.currentUser();
      if (u) {
        DB.auditLog.insert({
          userId: u.id,
          action: 'logout',
          targetType: 'user',
          targetId: u.id,
        });
      }
      DB.session.clear();
    },

    // Used by user management screen
    setPassword(userId, password) {
      DB.users.update(userId, { passwordHash: fakeHash(password) });
    },

    block(userId, reason) {
      const u = this.currentUser();
      DB.users.update(userId, { active: false, blockedAt: DB.now(), blockedReason: reason });
      DB.auditLog.insert({
        userId: u?.id,
        action: 'user.block',
        targetType: 'user',
        targetId: userId,
        details: { reason },
      });
    },

    unblock(userId) {
      const u = this.currentUser();
      DB.users.update(userId, { active: true, blockedAt: null, blockedReason: null });
      DB.auditLog.insert({
        userId: u?.id,
        action: 'user.unblock',
        targetType: 'user',
        targetId: userId,
      });
    },
  };

  global.Auth = Auth;
})(window);
