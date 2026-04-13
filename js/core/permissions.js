/* ============================================================
   Clinia — Permissions / RBAC
   Capability-based permissions composed by role.
   ============================================================ */

(function (global) {
  // Roles
  const ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    DIRECTOR: 'DIRECTOR',
    DOCTOR: 'DOCTOR',
    PLANNER: 'PLANNER',
    COORDINATOR: 'COORDINATOR',
    ASSISTANT: 'ASSISTANT',
    RECEPTION: 'RECEPTION',
  };

  const ROLE_LABELS = {
    SUPER_ADMIN: 'Super Admin',
    DIRECTOR: 'Director clínico',
    DOCTOR: 'Doctor / Especialista',
    PLANNER: 'Planificador',
    COORDINATOR: 'Coordinadora',
    ASSISTANT: 'Auxiliar / Enfermería',
    RECEPTION: 'Recepción',
  };

  // Capability list
  const CAP = {
    PATIENT_READ: 'patient:read',
    PATIENT_WRITE: 'patient:write',
    PATIENT_DELETE: 'patient:delete',
    PATIENT_SENSITIVE: 'patient:sensitive',
    FIRST_VISIT_RUN: 'first_visit:run',
    FILES_UPLOAD: 'files:upload',
    FILES_DELETE: 'files:delete',
    PLAN_CREATE: 'plan:create',
    PLAN_EDIT: 'plan:edit',
    PLAN_VALIDATE: 'plan:validate',
    PLAN_FORCE_APPROVE: 'plan:force_approve',
    BUDGET_VIEW: 'budget:view',
    BUDGET_EDIT: 'budget:edit',
    BUDGET_PRICE_EDIT: 'budget:price_edit',
    COMMERCIAL_RUN: 'commercial:run',
    APPT_PLAN: 'appointment:plan',
    CHAT_USE: 'chat:use',
    CATALOG_MANAGE: 'catalog:manage',
    USERS_MANAGE: 'users:manage',
    USERS_BLOCK: 'users:block',
    SETTINGS_MANAGE: 'settings:manage',
    AUDIT_VIEW: 'audit:view',
    DASHBOARD_FINANCE: 'dashboard:finance',
    DASHBOARD_MASTER: 'dashboard:master',
    EXPORT: 'export',
  };

  // Map roles → capabilities
  const ROLE_CAPS = {
    SUPER_ADMIN: Object.values(CAP),
    DIRECTOR: [
      CAP.PATIENT_READ,
      CAP.PATIENT_WRITE,
      CAP.PATIENT_SENSITIVE,
      CAP.FIRST_VISIT_RUN,
      CAP.FILES_UPLOAD,
      CAP.PLAN_CREATE,
      CAP.PLAN_EDIT,
      CAP.PLAN_VALIDATE,
      CAP.PLAN_FORCE_APPROVE,
      CAP.BUDGET_VIEW,
      CAP.BUDGET_EDIT,
      CAP.BUDGET_PRICE_EDIT,
      CAP.COMMERCIAL_RUN,
      CAP.APPT_PLAN,
      CAP.CHAT_USE,
      CAP.CATALOG_MANAGE,
      CAP.AUDIT_VIEW,
      CAP.DASHBOARD_FINANCE,
      CAP.DASHBOARD_MASTER,
      CAP.EXPORT,
    ],
    PLANNER: [
      CAP.PATIENT_READ,
      CAP.PATIENT_WRITE,
      CAP.PATIENT_SENSITIVE,
      CAP.FIRST_VISIT_RUN,
      CAP.FILES_UPLOAD,
      CAP.FILES_DELETE,
      CAP.PLAN_CREATE,
      CAP.PLAN_EDIT,
      CAP.BUDGET_VIEW,
      CAP.CHAT_USE,
      CAP.EXPORT,
    ],
    DOCTOR: [
      CAP.PATIENT_READ,
      CAP.PATIENT_SENSITIVE,
      CAP.FIRST_VISIT_RUN,
      CAP.FILES_UPLOAD,
      CAP.PLAN_VALIDATE,
      CAP.PLAN_EDIT,
      CAP.BUDGET_VIEW,
      CAP.CHAT_USE,
    ],
    COORDINATOR: [
      CAP.PATIENT_READ,
      CAP.PATIENT_WRITE,
      CAP.BUDGET_VIEW,
      CAP.BUDGET_EDIT,
      CAP.COMMERCIAL_RUN,
      CAP.APPT_PLAN,
      CAP.CHAT_USE,
      CAP.EXPORT,
    ],
    ASSISTANT: [
      CAP.PATIENT_READ,
      CAP.FILES_UPLOAD,
      CAP.CHAT_USE,
      CAP.APPT_PLAN,
    ],
    RECEPTION: [CAP.PATIENT_READ, CAP.PATIENT_WRITE],
  };

  function rolesOf(user) {
    if (!user) return [];
    if (Array.isArray(user.roles)) return user.roles;
    if (user.role) return [user.role];
    return [];
  }

  function capsOf(user) {
    const set = new Set();
    rolesOf(user).forEach((r) => {
      (ROLE_CAPS[r] || []).forEach((c) => set.add(c));
    });
    // Per-user overrides
    (user?.extraCaps || []).forEach((c) => set.add(c));
    return set;
  }

  const Permissions = {
    ROLES,
    ROLE_LABELS,
    CAP,
    ROLE_CAPS,
    can(user, cap) {
      if (!user || !user.active) return false;
      return capsOf(user).has(cap);
    },
    canAny(user, ...caps) {
      const c = capsOf(user);
      return caps.some((x) => c.has(x));
    },
    canAll(user, ...caps) {
      const c = capsOf(user);
      return caps.every((x) => c.has(x));
    },
    rolesOf,
    capsOf,
    label(role) {
      return ROLE_LABELS[role] || role;
    },
  };

  global.Permissions = Permissions;
})(window);
