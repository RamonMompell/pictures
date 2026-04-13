# Clinia — Plataforma Clínica Multidisciplinar

Plataforma profesional para la gestión, planificación, validación interdisciplinar
y coordinación de tratamientos en una clínica dental multidisciplinar.

> Proyecto construido sobre el repositorio inicial `DentalPix`. Esta versión amplía
> radicalmente el alcance para cubrir el flujo completo:
> **Primera visita → Plan de tratamiento → Consenso clínico → Presupuesto → Venta → Coordinación**.

---

## 1. Filosofía del producto

1. El paciente acude a una **primera visita** con un **PLANIFICADOR**.
2. El planificador documenta anamnesis, exploración, registros y hallazgos.
3. La plataforma genera un **informe estructurado** y una **propuesta de plan**.
4. El plan se desglosa por **especialidades** y pasa a **validación interdisciplinar**.
5. Si un especialista modifica algo, se crea una **nueva versión** y el **consenso se reinicia**.
6. Sólo con **consenso total** el plan queda validado.
7. El plan se traduce a **presupuesto** usando el catálogo de conceptos.
8. La **coordinadora** presenta, negocia y cierra la venta manteniendo **trazabilidad absoluta**
   entre: plan clínico original → plan/presupuesto modificado → plan final aceptado.
9. El sistema traduce el plan en **citas ideales** para coordinar la ejecución.

---

## 2. Stack y arquitectura

Esta versión se entrega como **SPA full-client** para funcionar sin servidor y permitir
su despliegue inmediato (incluyendo `file://`). La arquitectura está deliberadamente preparada
para migrar a un backend real (Node + Prisma + PostgreSQL) sin reescribir la lógica de negocio:

```
┌───────────────────────────────────────────────┐
│  UI Layer (HTML + CSS design system)          │
│  - Shell, navegación, vistas, componentes      │
├───────────────────────────────────────────────┤
│  Module Layer (js/modules/*)                   │
│  - dashboard, patients, firstVisit,            │
│    treatmentPlan, validation, budget,          │
│    commercial, appointments, chat, catalog,    │
│    users, audit, settings                      │
├───────────────────────────────────────────────┤
│  Core Layer (js/core/*)                        │
│  - db (repos por entidad), auth, permissions,  │
│    router, ui helpers, audit, events, seed     │
├───────────────────────────────────────────────┤
│  Storage                                       │
│  - localStorage (entidades)                    │
│  - IndexedDB (archivos/imágenes)               │
└───────────────────────────────────────────────┘
```

**Por qué esta elección:** garantiza que la app se ejecute en el entorno actual, mantiene
todo el modelo de dominio y UX, y el `db` layer está encapsulado por repositorios por
entidad — basta con sustituir `core/db.js` por un cliente HTTP para conectarlo a una API.

### Stack de referencia para producción (recomendado)

Cuando la plataforma se lleve a servidor, la migración natural es:

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Backend:** Node.js (Next route handlers o NestJS) + tRPC/REST
- **ORM:** Prisma
- **DB:** PostgreSQL (con `row level security` por clínica/tenant)
- **Auth:** NextAuth o Auth.js con RBAC + permisos granulares
- **Storage:** S3-compatible (MinIO/R2) para imágenes, CBCT, STL
- **Realtime:** Pusher/Ably o WebSockets propios para chat y consenso
- **IA:** Anthropic Claude para transcripción, resumen y propuestas de diagnóstico
  (siempre como sugerencia marcada, nunca como cierre automático)

---

## 3. Modelo de datos

Entidades implementadas en `js/core/db.js` (cada una con su repositorio CRUD):

| Entidad                 | Propósito                                                 |
| ----------------------- | --------------------------------------------------------- |
| `Organization`          | Grupo clínico (tenant raíz)                               |
| `Clinic`                | Sede individual                                           |
| `User`                  | Usuarios con roles, especialidades y clínicas asignadas   |
| `Role`                  | Rol funcional (ver § 4)                                   |
| `Specialty`             | Especialidad clínica configurable                         |
| `Patient`               | Ficha completa del paciente                               |
| `MedicalHistory`        | Antecedentes, alergias, medicación                        |
| `FirstVisit`            | Primera visita con flujo configurable                     |
| `FirstVisitTemplate`    | Plantillas de primera visita                              |
| `ExaminationRecord`     | Registros de exploración                                  |
| `Diagnosis`             | Diagnóstico global y por especialidad                     |
| `TreatmentPlan`         | Plan clínico del paciente (apunta a versión vigente)      |
| `TreatmentPlanVersion`  | Cada versión del plan (snapshot completo)                 |
| `TreatmentPlanItem`     | Ítem del plan con especialidad, fase, orden, justificación|
| `TreatmentPhase`        | Fase del plan                                             |
| `TreatmentDependency`   | Dependencia entre ítems                                   |
| `ValidationRequest`     | Petición de validación por especialidad                   |
| `ValidationDecision`    | Aceptación/rechazo/modificación con trazabilidad          |
| `CatalogItem`           | Concepto presupuestario del catálogo                      |
| `PriceList`             | Precios por clínica/profesional                           |
| `Budget`                | Presupuesto (apunta a versión vigente)                    |
| `BudgetVersion`         | Versión del presupuesto (clínica / comercial / final)     |
| `BudgetItem`            | Ítem presupuestario                                       |
| `CommercialStatus`      | Estado comercial y negociación                            |
| `AppointmentIdeal`      | Cita ideal con objetivo, recursos, fase y dependencias    |
| `PatientFile`           | Archivo/imagen con etiquetas                              |
| `ChatRoom` / `ChatMsg`  | Chat interno por paciente                                 |
| `Comment`               | Comentarios por plan/fase/item/presupuesto                |
| `Notification`          | Notificaciones internas                                   |
| `AuditLog`              | Auditoría de acciones relevantes                          |
| `AIJob`                 | Trabajos de IA (estructura preparada)                     |

---

## 4. Roles y permisos

Roles implementados:

- `SUPER_ADMIN` — acceso total, multi-clínica, configuración global
- `DIRECTOR` — supervisión clínica, protocolos, KPIs
- `DOCTOR` — revisa, valida, modifica planes de su especialidad
- `PLANNER` — realiza primera visita y redacta el plan inicial
- `COORDINATOR` — gestiona venta, negociación y trazabilidad comercial
- `ASSISTANT` — acceso operativo limitado, checklist por cita
- `RECEPTION` — acceso administrativo restringido

Los permisos granulares se definen en `core/permissions.js` como capacidades
(`patient:read`, `plan:validate`, `budget:price-edit`, `user:manage`, etc.)
y se agregan por rol. Cada acción sensible pasa por `Permissions.can(user, capability)`.

---

## 5. Flujos clave

### A. Primera visita
1. Planificador abre paciente → inicia primera visita.
2. Wizard configurable (anamnesis, exploración, registros, hallazgos, diagnóstico).
3. Adjunta fotos/radiografías/escaneados.
4. Genera informe estructurado.
5. Propone plan y especialidades implicadas.
6. Envía a validación.

### B. Validación interdisciplinar
1. Cada especialidad recibe la petición de revisión sobre la versión vigente.
2. Acepta / comenta / solicita cambios / modifica.
3. Cualquier modificación crea una **nueva versión** y **reinicia el consenso**.
4. Estado `consensus_complete` sólo cuando todas las especialidades implicadas aprueban la misma versión.

### C. Presupuestación
1. Cada ítem del plan se enlaza con un `CatalogItem`.
2. `Budget` se genera a partir de la versión aprobada del plan.
3. Totales por fase / especialidad / global.
4. Clasificación necesario vs recomendable.

### D. Venta (coordinadora)
1. Presentación del presupuesto al paciente.
2. Registra aceptación / rechazo / negociación.
3. Si hay cambios, se crea una nueva `BudgetVersion` tipo `commercial` derivada de la original.
4. La versión original **nunca se pierde**.
5. Si el cambio afecta a lo clínico, vuelve al planificador para re-validación.

### E. Coordinación
1. `AppointmentIdeal` traduce el plan en citas operativas.
2. Cada cita conoce fase, especialidad, duración, recursos, prerequisitos.
3. Alertas de cambio de especialista y de bloqueos por dependencias.

---

## 6. Estructura de carpetas

```
/
├── index.html               # Shell SPA
├── css/
│   ├── design-system.css    # Tokens, tipografía, layout, componentes
│   ├── views.css            # Estilos específicos de vistas
│   └── legacy/*             # CSS de DentalPix (archivado)
├── js/
│   ├── main.js              # Bootstrap
│   ├── core/
│   │   ├── db.js            # Capa de datos + repositorios
│   │   ├── seed.js          # Datos de ejemplo
│   │   ├── auth.js          # Sesión y usuarios
│   │   ├── permissions.js   # Capacidades por rol
│   │   ├── router.js        # Router hash-based
│   │   ├── ui.js            # Helpers UI (modal, toast, form)
│   │   ├── audit.js         # Audit log
│   │   └── events.js        # Event bus ligero
│   ├── modules/
│   │   ├── dashboard.js
│   │   ├── patients.js
│   │   ├── firstVisit.js
│   │   ├── treatmentPlan.js
│   │   ├── validation.js
│   │   ├── budget.js
│   │   ├── commercial.js
│   │   ├── appointments.js
│   │   ├── chat.js
│   │   ├── catalog.js
│   │   ├── users.js
│   │   ├── auditView.js
│   │   └── settings.js
│   └── legacy/*             # JS de DentalPix (archivado)
└── README.md
```

---

## 7. Roadmap de implementación

### Fase 1 — Base clínica (implementada)
- [x] Arquitectura y design system
- [x] Auth + roles + permisos granulares
- [x] Gestión de usuarios, especialidades, clínicas
- [x] Ficha de paciente completa
- [x] Primera visita configurable con wizard
- [x] Informe clínico generado
- [x] Subida y biblioteca de archivos por paciente

### Fase 2 — Plan y consenso (implementada)
- [x] Constructor de plan con fases, ítems, dependencias
- [x] Asignación por especialidades
- [x] Versionado completo
- [x] Validación por especialistas con reset de consenso
- [x] Comparador visual de versiones

### Fase 3 — Presupuestos y venta (implementada)
- [x] Catálogo de conceptos con precios por clínica
- [x] Generación de presupuesto a partir del plan
- [x] Clasificación necesario / recomendable
- [x] Módulo comercial con trazabilidad original → negociado → aceptado
- [x] Estado comercial y objeciones

### Fase 4 — Coordinación y chat (implementada)
- [x] Citas ideales con recursos, duración, prerequisitos
- [x] Detección de cambios de especialista
- [x] Chat interno por paciente con menciones

### Fase 5 — Analítica, auditoría y IA (implementada)
- [x] Dashboards por rol (master, planificador, coordinadora, especialista)
- [x] Audit log exhaustivo
- [x] Hooks preparados para asistente IA (transcripción, resumen, propuesta)
- [x] Notificaciones internas

### Pendiente para producción
- [ ] Migración a backend real (Next.js + Prisma + PostgreSQL)
- [ ] Integración real con proveedores de IA (transcripción + LLM)
- [ ] Importación automatizada desde carpeta local del usuario
- [ ] Integración DICOM/CBCT
- [ ] Firma digital legal

---

## 8. Usuarios de demostración

Al primer arranque se siembran varios usuarios de ejemplo. Login desde la pantalla inicial:

| Email                      | Rol            | Contraseña |
| -------------------------- | -------------- | ---------- |
| `admin@clinia.dev`         | Super Admin    | `demo`     |
| `director@clinia.dev`      | Director       | `demo`     |
| `planner@clinia.dev`       | Planificador   | `demo`     |
| `ortho@clinia.dev`         | Doctor Orto    | `demo`     |
| `implant@clinia.dev`       | Cirugía/Impl   | `demo`     |
| `perio@clinia.dev`         | Periodoncia    | `demo`     |
| `coord@clinia.dev`         | Coordinadora   | `demo`     |

Las contraseñas son únicamente para demostración local. El backend real debe usar
hashing (argon2/bcrypt), rotación de sesión y MFA opcional.

---

## 9. Cómo ejecutar

```bash
# 1. Clonar
git clone <repo>
cd pictures

# 2. Abrir
# opción A — abrir index.html directamente en el navegador
# opción B — servir estáticamente
npx http-server .     # o: python3 -m http.server 8080
```

Al primer arranque se inicializan automáticamente los datos de ejemplo
(especialidades, catálogo, pacientes, plan de tratamiento demo).
Para reiniciar: desde **Ajustes → Restablecer datos de demo**.
