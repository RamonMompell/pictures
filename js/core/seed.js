/* ============================================================
   Clinia — Seed data
   Generates a realistic demo dataset on first run.
   ============================================================ */

(function (global) {
  const Seed = {
    needsSeed() {
      return DB.users.all().length === 0;
    },

    run() {
      if (!this.needsSeed()) return;

      // ---- Organization & clinics ----
      const org = DB.organizations.insert({
        name: 'Grupo Clinia',
        country: 'ES',
      });
      const clinicA = DB.clinics.insert({
        organizationId: org.id,
        name: 'Clinia · Centro',
        address: 'Calle Mayor 1, Madrid',
        timezone: 'Europe/Madrid',
      });
      const clinicB = DB.clinics.insert({
        organizationId: org.id,
        name: 'Clinia · Norte',
        address: 'Av. del Norte 22, Madrid',
        timezone: 'Europe/Madrid',
      });

      // ---- Specialties ----
      const specialties = [
        { code: 'ORTHO', name: 'Ortodoncia', color: '#6366f1', icon: 'orto' },
        { code: 'SURGERY', name: 'Cirugía / Implantología', color: '#dc2626', icon: 'cir' },
        { code: 'PERIO', name: 'Periodoncia', color: '#059669', icon: 'per' },
        { code: 'ESTHETIC', name: 'Estética dental', color: '#db2777', icon: 'est' },
        { code: 'CONSERVATIVE', name: 'Conservadora', color: '#0891b2', icon: 'con' },
        { code: 'PROSTHO', name: 'Prostodoncia', color: '#7c3aed', icon: 'pro' },
        { code: 'ENDO', name: 'Endodoncia', color: '#ea580c', icon: 'end' },
        { code: 'PEDO', name: 'Odontopediatría', color: '#f59e0b', icon: 'ped' },
        { code: 'OCCLUSION', name: 'Oclusión / ATM', color: '#475569', icon: 'occ' },
        { code: 'HYGIENE', name: 'Higiene / Mantenimiento', color: '#14b8a6', icon: 'hig' },
      ].map((s) =>
        DB.specialties.insert({
          ...s,
          active: true,
          organizationId: org.id,
        })
      );
      const sp = (code) => specialties.find((s) => s.code === code);

      // ---- Users ----
      const users = [
        {
          email: 'admin@clinia.dev',
          name: 'Ana Admin',
          roles: ['SUPER_ADMIN'],
          specialties: [],
          clinicIds: [clinicA.id, clinicB.id],
        },
        {
          email: 'director@clinia.dev',
          name: 'Dr. David Director',
          roles: ['DIRECTOR', 'DOCTOR'],
          specialties: [sp('PROSTHO').id],
          clinicIds: [clinicA.id, clinicB.id],
        },
        {
          email: 'planner@clinia.dev',
          name: 'Dra. Paula Planificadora',
          roles: ['PLANNER', 'DOCTOR'],
          specialties: [sp('CONSERVATIVE').id, sp('PROSTHO').id],
          clinicIds: [clinicA.id],
        },
        {
          email: 'ortho@clinia.dev',
          name: 'Dr. Óscar Ortodoncista',
          roles: ['DOCTOR'],
          specialties: [sp('ORTHO').id],
          clinicIds: [clinicA.id],
        },
        {
          email: 'implant@clinia.dev',
          name: 'Dra. Inés Implantóloga',
          roles: ['DOCTOR'],
          specialties: [sp('SURGERY').id],
          clinicIds: [clinicA.id],
        },
        {
          email: 'perio@clinia.dev',
          name: 'Dr. Pedro Periodoncista',
          roles: ['DOCTOR'],
          specialties: [sp('PERIO').id, sp('HYGIENE').id],
          clinicIds: [clinicA.id],
        },
        {
          email: 'esthetic@clinia.dev',
          name: 'Dra. Elena Estética',
          roles: ['DOCTOR'],
          specialties: [sp('ESTHETIC').id, sp('CONSERVATIVE').id],
          clinicIds: [clinicA.id],
        },
        {
          email: 'endo@clinia.dev',
          name: 'Dr. Ernesto Endodoncista',
          roles: ['DOCTOR'],
          specialties: [sp('ENDO').id],
          clinicIds: [clinicA.id],
        },
        {
          email: 'coord@clinia.dev',
          name: 'Carla Coordinadora',
          roles: ['COORDINATOR'],
          specialties: [],
          clinicIds: [clinicA.id],
        },
        {
          email: 'aux@clinia.dev',
          name: 'Aitana Auxiliar',
          roles: ['ASSISTANT'],
          specialties: [],
          clinicIds: [clinicA.id],
        },
      ].map((u) =>
        DB.users.insert({
          ...u,
          active: true,
          passwordHash: Auth.fakeHash('demo'),
          createdAt: DB.now(),
        })
      );

      // ---- Catalog ----
      const catalog = [
        // Hygiene / Perio
        { code: 'HIG-001', name: 'Profilaxis dental', specialtyCode: 'HYGIENE', price: 65, duration: 45, category: 'Higiene' },
        { code: 'PER-001', name: 'Raspado y alisado radicular (cuadrante)', specialtyCode: 'PERIO', price: 95, duration: 45, category: 'Periodoncia' },
        { code: 'PER-002', name: 'Cirugía periodontal por sextante', specialtyCode: 'PERIO', price: 480, duration: 90, category: 'Periodoncia' },
        // Conservative / Endo
        { code: 'CON-001', name: 'Obturación composite simple', specialtyCode: 'CONSERVATIVE', price: 75, duration: 30, category: 'Conservadora' },
        { code: 'CON-002', name: 'Obturación composite compleja', specialtyCode: 'CONSERVATIVE', price: 110, duration: 45, category: 'Conservadora' },
        { code: 'END-001', name: 'Endodoncia unirradicular', specialtyCode: 'ENDO', price: 220, duration: 60, category: 'Endodoncia' },
        { code: 'END-002', name: 'Endodoncia multirradicular', specialtyCode: 'ENDO', price: 320, duration: 90, category: 'Endodoncia' },
        // Surgery
        { code: 'CIR-001', name: 'Extracción simple', specialtyCode: 'SURGERY', price: 90, duration: 30, category: 'Cirugía' },
        { code: 'CIR-002', name: 'Extracción quirúrgica / cordal', specialtyCode: 'SURGERY', price: 210, duration: 60, category: 'Cirugía' },
        { code: 'IMP-001', name: 'Implante dental', specialtyCode: 'SURGERY', price: 950, duration: 60, category: 'Implantología' },
        { code: 'IMP-002', name: 'Elevación de seno', specialtyCode: 'SURGERY', price: 1200, duration: 90, category: 'Implantología' },
        { code: 'IMP-003', name: 'Injerto óseo bloque', specialtyCode: 'SURGERY', price: 850, duration: 75, category: 'Implantología' },
        // Prostho
        { code: 'PRO-001', name: 'Corona de zirconio', specialtyCode: 'PROSTHO', price: 680, duration: 60, category: 'Prostodoncia' },
        { code: 'PRO-002', name: 'Corona sobre implante', specialtyCode: 'PROSTHO', price: 720, duration: 60, category: 'Prostodoncia' },
        { code: 'PRO-003', name: 'Carilla de cerámica', specialtyCode: 'ESTHETIC', price: 580, duration: 60, category: 'Estética' },
        // Ortho
        { code: 'ORT-001', name: 'Ortodoncia con alineadores (caso completo)', specialtyCode: 'ORTHO', price: 4200, duration: 0, category: 'Ortodoncia' },
        { code: 'ORT-002', name: 'Ortodoncia fija multibrackets', specialtyCode: 'ORTHO', price: 3600, duration: 0, category: 'Ortodoncia' },
        { code: 'ORT-003', name: 'Revisión ortodóncica', specialtyCode: 'ORTHO', price: 70, duration: 20, category: 'Ortodoncia' },
        // Esthetic
        { code: 'EST-001', name: 'Blanqueamiento dental combinado', specialtyCode: 'ESTHETIC', price: 380, duration: 60, category: 'Estética' },
      ];
      const catalogItems = catalog.map((c) =>
        DB.catalog.insert({
          code: c.code,
          name: c.name,
          description: c.name,
          specialtyId: sp(c.specialtyCode).id,
          category: c.category,
          price: c.price,
          cost: Math.round(c.price * 0.35),
          duration: c.duration,
          active: true,
          taxRate: 0,
          financeable: c.price >= 200,
        })
      );
      const cat = (code) => catalogItems.find((x) => x.code === code);

      // ---- First visit template ----
      DB.firstVisitTemplates.insert({
        name: 'Plantilla estándar Clinia',
        clinicId: clinicA.id,
        steps: [
          'Recepción y motivo de consulta',
          'Anamnesis y antecedentes médicos',
          'Exploración extraoral',
          'Exploración intraoral',
          'Exploración periodontal',
          'Exploración oclusal y funcional',
          'Análisis estético',
          'Registros: fotografías',
          'Registros: radiografías y CBCT',
          'Registros: escaneado intraoral',
          'Hallazgos clínicos',
          'Diagnóstico preliminar',
          'Propuesta de plan',
          'Asignación por especialidades',
        ],
        defaultPlanner: users.find((u) => u.email === 'planner@clinia.dev').id,
      });

      // ---- Patients ----
      const patientsSeed = [
        {
          name: 'María García López',
          birthDate: '1972-03-14',
          sex: 'F',
          phone: '+34 600 111 222',
          email: 'maria.garcia@example.com',
          source: 'Recomendación',
          motive: 'Quiere mejorar la estética y reponer dos dientes ausentes',
          status: 'in_treatment',
          medical: {
            conditions: 'Hipertensión controlada',
            medication: 'Enalapril 10mg',
            allergies: 'Penicilina',
            habits: 'No fumadora',
          },
        },
        {
          name: 'Carlos Ruiz Pérez',
          birthDate: '1988-11-02',
          sex: 'M',
          phone: '+34 600 222 333',
          email: 'carlos.ruiz@example.com',
          source: 'Google',
          motive: 'Apretamiento, dolor articular ATM y rotura de un molar',
          status: 'planning',
          medical: { conditions: '', medication: '', allergies: '', habits: 'Bruxismo nocturno' },
        },
        {
          name: 'Lucía Fernández Soto',
          birthDate: '2014-07-21',
          sex: 'F',
          phone: '+34 600 333 444',
          email: 'lucia.padre@example.com',
          source: 'Recomendación',
          motive: 'Revisión ortodóncica preventiva',
          status: 'first_visit',
          medical: { conditions: '', medication: '', allergies: '', habits: '' },
        },
        {
          name: 'Javier Moreno Díaz',
          birthDate: '1965-01-30',
          sex: 'M',
          phone: '+34 600 444 555',
          email: 'jmoreno@example.com',
          source: 'Web',
          motive: 'Necesita rehabilitación completa de boca',
          status: 'budget_pending',
          medical: { conditions: 'Diabetes tipo 2', medication: 'Metformina', allergies: '', habits: 'Ex-fumador' },
        },
      ].map((p) => {
        const patient = DB.patients.insert({
          ...p,
          clinicId: clinicA.id,
          createdBy: users.find((u) => u.email === 'planner@clinia.dev').id,
          assignedPlannerId: users.find((u) => u.email === 'planner@clinia.dev').id,
          assignedCoordinatorId: users.find((u) => u.email === 'coord@clinia.dev').id,
        });
        DB.medicalHistories.insert({
          patientId: patient.id,
          ...p.medical,
          updatedBy: patient.createdBy,
        });
        return patient;
      });

      // ---- Demo case for Carlos Ruiz: first visit + plan + validations ----
      const carlos = patientsSeed[1];
      const planner = users.find((u) => u.email === 'planner@clinia.dev');

      const firstVisit = DB.firstVisits.insert({
        patientId: carlos.id,
        plannerId: planner.id,
        clinicId: clinicA.id,
        date: DB.now(),
        status: 'completed',
        templateName: 'Plantilla estándar Clinia',
        sections: {
          motive: 'Apretamiento, dolor ATM y fractura del 36',
          anamnesis:
            'Paciente sano, refiere bruxismo nocturno desde hace 5 años. Episodios de dolor articular bilateral.',
          extraoral:
            'Hipertonía maseterina bilateral. Click articular leve en apertura derecha.',
          intraoral:
            'Facetas de desgaste generalizadas. Fractura cúspide vestibular del 36 con afectación pulpar.',
          perio:
            'Sangrado al sondaje 12%. Bolsas <4 mm. Higiene buena.',
          occlusal: 'Mordida estable. Guía canina perdida en lateralidad derecha.',
          esthetic: 'Sonrisa con desgaste de bordes incisales superiores.',
          radiographic:
            'Lesión apical en 36. Resto sin hallazgos. CBCT confirma necesidad de extracción y reposición.',
          digital: 'Escaneado intraoral correcto. STL guardado en biblioteca.',
          findings:
            '1) Síndrome de bruxismo con afectación funcional\n2) Fractura no restaurable del 36 con lesión apical\n3) Desgaste estético generalizado',
          diagnosis:
            'Patología oclusal primaria con consecuencias estructurales y estéticas. Indicación de tratamiento multidisciplinar.',
          specialties: [sp('OCCLUSION').id, sp('SURGERY').id, sp('PROSTHO').id, sp('ESTHETIC').id, sp('PERIO').id],
        },
      });

      // ---- Treatment plan ----
      const plan = DB.treatmentPlans.insert({
        patientId: carlos.id,
        firstVisitId: firstVisit.id,
        status: 'consensus_partial',
      });

      const phases = [
        { name: 'Fase 1 — Estabilización', description: 'Saneamiento y control oclusal', order: 1 },
        { name: 'Fase 2 — Cirugía', description: 'Extracción e implante 36', order: 2 },
        { name: 'Fase 3 — Restauración', description: 'Corona sobre implante', order: 3 },
        { name: 'Fase 4 — Estética', description: 'Mejora de bordes incisales', order: 4 },
      ];

      const items = [
        {
          title: 'Férula de descarga oclusal',
          description: 'Férula tipo Michigan superior para control del bruxismo.',
          specialtyId: sp('OCCLUSION').id,
          phaseOrder: 1,
          necessity: 'necessary',
          justification: 'Control etiológico del bruxismo antes de rehabilitación.',
          risks: 'Continuación del desgaste, fracaso de futuras restauraciones.',
          estimatedDuration: '2 semanas',
          catalogCode: 'PER-001',
          assignedDoctorEmail: 'perio@clinia.dev',
        },
        {
          title: 'Profilaxis y refuerzo de higiene',
          description: 'Tartrectomía y revisión de técnica de cepillado.',
          specialtyId: sp('HYGIENE').id,
          phaseOrder: 1,
          necessity: 'necessary',
          justification: 'Garantizar tejidos sanos antes de cirugía.',
          risks: 'Riesgo de periimplantitis si no se realiza.',
          estimatedDuration: '1 sesión',
          catalogCode: 'HIG-001',
          assignedDoctorEmail: 'perio@clinia.dev',
        },
        {
          title: 'Extracción del 36',
          description: 'Extracción atraumática y preservación alveolar.',
          specialtyId: sp('SURGERY').id,
          phaseOrder: 2,
          necessity: 'necessary',
          justification: 'Diente no restaurable.',
          risks: 'Pérdida ósea, comprometer futuro implante.',
          estimatedDuration: '1 sesión',
          catalogCode: 'CIR-001',
          assignedDoctorEmail: 'implant@clinia.dev',
        },
        {
          title: 'Implante en posición 36',
          description: 'Colocación de implante 4.1×10 mm.',
          specialtyId: sp('SURGERY').id,
          phaseOrder: 2,
          necessity: 'necessary',
          justification: 'Reposición de pieza ausente.',
          risks: 'Mantenimiento de función masticatoria.',
          estimatedDuration: '3 meses osteointegración',
          catalogCode: 'IMP-001',
          assignedDoctorEmail: 'implant@clinia.dev',
        },
        {
          title: 'Corona sobre implante 36',
          description: 'Corona atornillada de zirconio monolítico.',
          specialtyId: sp('PROSTHO').id,
          phaseOrder: 3,
          necessity: 'necessary',
          justification: 'Restauración final del implante.',
          risks: '—',
          estimatedDuration: '2 sesiones',
          catalogCode: 'PRO-002',
          assignedDoctorEmail: 'director@clinia.dev',
        },
        {
          title: 'Carillas estéticas 12-22',
          description: 'Restauración de bordes incisales con carillas mínimamente invasivas.',
          specialtyId: sp('ESTHETIC').id,
          phaseOrder: 4,
          necessity: 'recommendable',
          justification: 'Mejora estética y restitución de longitud incisal.',
          risks: 'No imprescindible para la salud, pero mejora autoestima y función.',
          estimatedDuration: '3 sesiones',
          catalogCode: 'PRO-003',
          assignedDoctorEmail: 'esthetic@clinia.dev',
        },
      ];

      // Build version 1 with full snapshot of phases + items
      const userByEmail = (e) => users.find((u) => u.email === e);
      const v1Items = items.map((it, idx) => ({
        id: DB.uid('it'),
        order: idx + 1,
        title: it.title,
        description: it.description,
        specialtyId: it.specialtyId,
        phaseOrder: it.phaseOrder,
        necessity: it.necessity,
        justification: it.justification,
        risks: it.risks,
        estimatedDuration: it.estimatedDuration,
        catalogItemId: cat(it.catalogCode)?.id || null,
        priceOverride: null,
        assignedDoctorId: userByEmail(it.assignedDoctorEmail)?.id || null,
        notes: '',
      }));

      const v1Phases = phases.map((p) => ({
        id: DB.uid('ph'),
        name: p.name,
        description: p.description,
        order: p.order,
      }));

      const v1 = DB.planVersions.insert({
        planId: plan.id,
        versionNumber: 1,
        authorId: planner.id,
        authorName: planner.name,
        phases: v1Phases,
        items: v1Items,
        diagnosis: firstVisit.sections.diagnosis,
        summary:
          'Plan multidisciplinar: control oclusal → saneamiento → cirugía implantológica → rehabilitación protésica → mejora estética opcional.',
        changeReason: 'Versión inicial creada desde la primera visita.',
        requiredSpecialties: [
          sp('OCCLUSION').id,
          sp('PERIO').id,
          sp('SURGERY').id,
          sp('PROSTHO').id,
          sp('ESTHETIC').id,
        ],
        status: 'consensus_partial',
      });

      DB.treatmentPlans.update(plan.id, { currentVersionId: v1.id });

      // Some validations on v1
      const validations = [
        {
          versionId: v1.id,
          specialtyId: sp('OCCLUSION').id,
          userId: userByEmail('perio@clinia.dev').id,
          decision: 'approved',
          comment: 'De acuerdo, recomiendo registro funcional adicional.',
        },
        {
          versionId: v1.id,
          specialtyId: sp('SURGERY').id,
          userId: userByEmail('implant@clinia.dev').id,
          decision: 'approved',
          comment: 'Caso quirúrgico estándar, sin contraindicaciones.',
        },
        {
          versionId: v1.id,
          specialtyId: sp('PROSTHO').id,
          userId: userByEmail('director@clinia.dev').id,
          decision: 'approved',
          comment: 'Material adecuado al caso.',
        },
        {
          versionId: v1.id,
          specialtyId: sp('PERIO').id,
          userId: userByEmail('perio@clinia.dev').id,
          decision: 'approved',
          comment: 'Higiene y mantenimiento OK.',
        },
        {
          versionId: v1.id,
          specialtyId: sp('ESTHETIC').id,
          userId: userByEmail('esthetic@clinia.dev').id,
          decision: 'changes_requested',
          comment:
            'Sugiero esperar a evaluar el desgaste tras 6 meses con férula antes de planificar carillas definitivas.',
        },
      ];
      validations.forEach((v) => DB.validations.insert(v));

      // ---- Audit log seed ----
      DB.auditLog.insert({
        userId: planner.id,
        userName: planner.name,
        action: 'plan.create',
        targetType: 'treatment_plan',
        targetId: plan.id,
        details: { version: 1 },
      });

      // ---- Notifications seed ----
      DB.notifications.insert({
        userId: userByEmail('coord@clinia.dev').id,
        type: 'plan_pending_budget',
        text: 'El plan de Carlos Ruiz está casi listo para presupuestar.',
        targetUrl: '#/patients/' + carlos.id,
        read: false,
      });
      DB.notifications.insert({
        userId: userByEmail('esthetic@clinia.dev').id,
        type: 'validation_pending',
        text: 'Tienes un plan pendiente de validar (Carlos Ruiz).',
        targetUrl: '#/patients/' + carlos.id,
        read: false,
      });

      // ---- Settings ----
      DB.settings.set({
        organizationId: org.id,
        activeClinicId: clinicA.id,
        theme: 'light',
        photoImportPath: '~/Pictures/Clinia',
        seededAt: DB.now(),
      });
    },
  };

  global.Seed = Seed;
})(window);
