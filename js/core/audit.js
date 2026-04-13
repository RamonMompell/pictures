/* ============================================================
   Clinia — Audit log helper
   Convenience wrapper around DB.auditLog.insert that automatically
   captures the current actor.
   ============================================================ */

(function (global) {
  const Audit = {
    log(action, { targetType, targetId, details } = {}) {
      const u = (typeof Auth !== 'undefined' && Auth.currentUser()) || null;
      DB.auditLog.insert({
        userId: u?.id || null,
        userName: u?.name || 'Sistema',
        action,
        targetType: targetType || null,
        targetId: targetId || null,
        details: details || null,
      });
    },
  };
  global.Audit = Audit;
})(window);
