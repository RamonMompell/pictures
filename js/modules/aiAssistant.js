/* ============================================================
   Clinia — AI Assistant
   Listens to the first visit using the browser's Web Speech API,
   keeps a live transcript, and extracts structured clinical
   information using a deterministic local extractor.

   The architecture also supports a real LLM (Claude / OpenAI) when
   an API key is configured in Settings — in that case the transcript
   is sent to the LLM and the JSON response is used instead.

   Important guarantees:
   - Nothing is auto-saved as final. Every AI suggestion is marked
     and the user must accept it explicitly.
   - The original transcript is preserved with timestamps.
   - The audit log records that fields were AI-assisted.
   ============================================================ */

(function (global) {
  const { el, escapeHtml, toast, openModal } = UI;

  // ---------- Local extractor ----------
  // Deterministic Spanish medical-text parser. Not perfect, but useful
  // for prefilling fields when there's no LLM connected. Returns an
  // object keyed by visit section name.
  const KEYWORD_GROUPS = {
    motive: [
      'motivo', 'viene por', 'consulta por', 'quiere', 'le duele', 'le molesta',
      'busca', 'desea', 'quiero', 'me duele', 'me molesta',
    ],
    anamnesis: [
      'antecedente', 'medicación', 'medicacion', 'medicamento', 'alergia',
      'enfermedad', 'diabetes', 'hipertensión', 'hipertension', 'asma',
      'fuma', 'tabaco', 'alcohol', 'embarazo', 'embarazada', 'enalapril',
      'metformina', 'penicilina', 'anticoagulante', 'sintrom', 'omeprazol',
    ],
    extraoral: [
      'asimetría', 'asimetria', 'atm', 'masetero', 'músculo', 'musculo',
      'click articular', 'clic articular', 'apertura', 'desviación', 'desviacion',
      'palpación', 'palpacion', 'ganglio',
    ],
    intraoral: [
      'mucosa', 'lengua', 'paladar', 'encía', 'encia', 'sangrado', 'placa',
      'caries', 'fractura', 'desgaste', 'absceso', 'fístula', 'fistula',
      'restauración', 'restauracion', 'diente', 'molar', 'premolar', 'incisivo',
      'canino', 'cordal', 'muela del juicio',
    ],
    perio: [
      'sondaje', 'bolsa', 'recesión', 'recesion', 'movilidad', 'sangrado al sondaje',
      'periodontitis', 'gingivitis', 'sarro', 'tartrectomía', 'tartrectomia',
    ],
    occlusal: [
      'oclusión', 'oclusion', 'mordida', 'bruxismo', 'apretamiento', 'guía canina',
      'guia canina', 'lateralidad', 'protrusiva', 'overbite', 'overjet',
      'mordida abierta', 'mordida cruzada',
    ],
    esthetic: [
      'estética', 'estetica', 'sonrisa', 'línea media', 'linea media', 'color',
      'blanqueamiento', 'carillas', 'borde incisal', 'proporción', 'proporcion',
    ],
    radiographic: [
      'radiografía', 'radiografia', 'panorámica', 'panoramica', 'periapical',
      'cbct', 'lesión', 'lesion', 'apical', 'reabsorción', 'reabsorcion',
      'imagen radiolúcida', 'radiolucida',
    ],
    digital: [
      'escaneado', 'escáner', 'escaner', 'intraoral', 'stl', 'modelo digital',
    ],
  };

  // Specialty hints
  const SPECIALTY_HINTS = {
    ORTHO: ['ortodoncia', 'brackets', 'alineadores', 'invisalign', 'apiñamiento', 'apinamiento', 'malposición', 'malposicion'],
    SURGERY: ['implante', 'extracción', 'extraccion', 'cirugía', 'cirugia', 'cordal', 'injerto', 'elevación de seno'],
    PERIO: ['periodontal', 'gingivitis', 'periodontitis', 'sondaje', 'bolsa', 'recesión', 'recesion', 'sangrado'],
    ENDO: ['endodoncia', 'pulpa', 'conducto', 'lesión apical', 'lesion apical', 'absceso'],
    PROSTHO: ['corona', 'puente', 'prótesis', 'protesis', 'rehabilitación', 'rehabilitacion'],
    ESTHETIC: ['carilla', 'carillas', 'estética', 'estetica', 'blanqueamiento', 'sonrisa'],
    CONSERVATIVE: ['caries', 'obturación', 'obturacion', 'composite', 'empaste'],
    OCCLUSION: ['bruxismo', 'apretamiento', 'oclusión', 'oclusion', 'atm', 'férula', 'ferula'],
    HYGIENE: ['higiene', 'profilaxis', 'limpieza', 'tartrectomía', 'tartrectomia'],
    PEDO: ['niño', 'niña', 'pediátrico', 'pediatrico', 'lactancia', 'pediatría', 'pediatria'],
  };

  function splitSentences(text) {
    return text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Map keywords → proposed plan items (specialty + treatment title + justification)
  const PROPOSAL_RULES = [
    { match: /caries|obturaci[oó]n|empaste/i, specialty: 'CONSERVATIVE', title: 'Obturación de composite', justification: 'Se ha mencionado caries u obturación.' },
    { match: /endodoncia|conducto|pulpa|lesi[oó]n apical|absceso/i, specialty: 'ENDO', title: 'Tratamiento de conductos', justification: 'Lesión apical o afectación pulpar mencionada.' },
    { match: /implante/i, specialty: 'SURGERY', title: 'Colocación de implante', justification: 'Reposición de pieza ausente.' },
    { match: /extracci[oó]n|cordal|muela del juicio/i, specialty: 'SURGERY', title: 'Extracción dental', justification: 'Indicación de extracción mencionada.' },
    { match: /elevaci[oó]n de seno/i, specialty: 'SURGERY', title: 'Elevación de seno', justification: 'Necesidad ósea para implante posterior.' },
    { match: /bruxismo|apretamiento|f[eé]rula/i, specialty: 'OCCLUSION', title: 'Férula de descarga oclusal', justification: 'Bruxismo o apretamiento detectado.' },
    { match: /sondaje|periodontitis|gingivitis|raspado|alisado/i, specialty: 'PERIO', title: 'Raspado y alisado radicular', justification: 'Periodontitis o sangrado al sondaje.' },
    { match: /higiene|tartrectom[ií]a|profilaxis|placa/i, specialty: 'HYGIENE', title: 'Profilaxis y refuerzo de higiene', justification: 'Necesidad de higiene profesional.' },
    { match: /corona|pr[oó]tesis fija/i, specialty: 'PROSTHO', title: 'Corona de zirconio', justification: 'Restauración protésica indicada.' },
    { match: /carillas?/i, specialty: 'ESTHETIC', title: 'Carillas estéticas', justification: 'Mejora estética solicitada.' },
    { match: /blanqueamiento/i, specialty: 'ESTHETIC', title: 'Blanqueamiento dental', justification: 'Solicitado por el paciente.' },
    { match: /ortodoncia|brackets|invisalign|alineadores|api[ñn]amiento/i, specialty: 'ORTHO', title: 'Tratamiento de ortodoncia', justification: 'Maloclusión o apiñamiento detectado.' },
    { match: /atm|click articular|dolor articular/i, specialty: 'OCCLUSION', title: 'Estudio funcional ATM', justification: 'Sintomatología articular mencionada.' },
  ];

  function proposeItemsFromTranscript(transcript) {
    const lower = transcript.toLowerCase();
    const proposed = [];
    const seen = new Set();
    PROPOSAL_RULES.forEach((rule) => {
      if (rule.match.test(lower)) {
        const key = rule.specialty + '|' + rule.title;
        if (seen.has(key)) return;
        seen.add(key);
        proposed.push({
          specialtyCode: rule.specialty,
          title: rule.title,
          description: rule.justification,
          justification: rule.justification,
          necessity: rule.title.includes('estética') || rule.title.includes('Carillas') || rule.title.includes('Blanqueamiento') ? 'recommendable' : 'necessary',
        });
      }
    });
    return proposed;
  }

  function extractLocally(transcript) {
    const sentences = splitSentences(transcript);
    const result = {};
    Object.keys(KEYWORD_GROUPS).forEach((section) => (result[section] = []));

    sentences.forEach((sentence) => {
      const lower = sentence.toLowerCase();
      Object.entries(KEYWORD_GROUPS).forEach(([section, kws]) => {
        if (kws.some((kw) => lower.includes(kw))) {
          result[section].push(sentence);
        }
      });
    });

    if (result.motive.length === 0 && sentences.length > 0) {
      result.motive = [sentences[0]];
    }

    const findings = [
      ...result.intraoral,
      ...result.extraoral,
      ...result.perio,
      ...result.radiographic,
    ];
    const findingsUnique = Array.from(new Set(findings));

    const diagnosis = sentences.filter((s) =>
      /(diagnóstico|diagnostico|síndrome|sindrome|cuadro|patología|patologia|presenta\b)/i.test(s)
    );

    const specialties = [];
    Object.entries(SPECIALTY_HINTS).forEach(([code, kws]) => {
      if (kws.some((kw) => transcript.toLowerCase().includes(kw))) {
        specialties.push(code);
      }
    });

    const proposedItems = proposeItemsFromTranscript(transcript);
    // Augment with specialties from proposals
    proposedItems.forEach((p) => {
      if (!specialties.includes(p.specialtyCode)) specialties.push(p.specialtyCode);
    });

    return {
      motive: result.motive.join(' '),
      anamnesis: result.anamnesis.join(' ') || '',
      extraoral: result.extraoral.join(' ') || '',
      intraoral: result.intraoral.join(' ') || '',
      perio: result.perio.join(' ') || '',
      occlusal: result.occlusal.join(' ') || '',
      esthetic: result.esthetic.join(' ') || '',
      radiographic: result.radiographic.join(' ') || '',
      digital: result.digital.join(' ') || '',
      findings: findingsUnique.join('\n'),
      diagnosis: diagnosis.join(' ') || 'Pendiente de validación clínica.',
      specialtyCodes: specialties,
      proposedItems,
      summary:
        sentences.length > 0
          ? `Sesión transcrita con ${sentences.length} frases. ${findingsUnique.length} hallazgos detectados, ${proposedItems.length} tratamientos propuestos por la IA.`
          : 'Sin contenido transcrito.',
    };
  }

  // ---------- Optional real LLM call ----------
  // If an API key is configured, send the transcript to Claude.
  // Falls back to local extractor on any error.
  async function extractWithLLM(transcript, apiKey) {
    const systemPrompt = `Eres un asistente clínico para una primera visita dental. Recibes la transcripción literal de la conversación entre planificador y paciente. Tu tarea es extraer información estructurada en JSON estricto con estos campos:
- motive (string): motivo principal de consulta del paciente
- anamnesis (string): antecedentes médicos, medicación, alergias, hábitos relevantes
- extraoral (string): hallazgos extraorales mencionados
- intraoral (string): hallazgos intraorales mencionados
- perio (string): hallazgos periodontales
- occlusal (string): hallazgos oclusales / ATM
- esthetic (string): observaciones estéticas
- radiographic (string): hallazgos radiográficos mencionados
- digital (string): registros digitales mencionados
- findings (string): resumen de hallazgos clínicos relevantes (formato lista con saltos de línea)
- diagnosis (string): propuesta de diagnóstico estructurado
- specialtyCodes (array de strings): de la lista [ORTHO, SURGERY, PERIO, ENDO, PROSTHO, ESTHETIC, CONSERVATIVE, OCCLUSION, HYGIENE, PEDO], las que apliquen
- summary (string): resumen ejecutivo de la sesión, máx 2 frases

Devuelve SOLO el JSON, sin texto extra, sin markdown.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: transcript }],
        }),
      });
      if (!res.ok) throw new Error('LLM error: ' + res.status);
      const data = await res.json();
      const text = (data.content || []).map((c) => c.text).join('');
      const json = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
      return { ...json, _source: 'llm' };
    } catch (e) {
      console.warn('LLM extraction failed, falling back to local extractor', e);
      return { ...extractLocally(transcript), _source: 'local-fallback' };
    }
  }

  // ---------- Speech recognition wrapper ----------
  function getRecognizer() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = 'es-ES';
    r.continuous = true;
    r.interimResults = true;
    return r;
  }

  // ---------- UI: full-screen session ----------
  function openSession(visit, patient, onApply) {
    const recognizer = getRecognizer();
    const supported = !!recognizer;

    let transcript = visit.aiTranscript || '';
    let interim = '';
    let listening = false;
    let extracted = null;

    // Build modal body
    const transcriptArea = el('div', { class: 'ai-transcript' });
    const interimEl = el('div', { class: 'ai-interim' });
    const finalEl = el('div', { class: 'ai-final' });
    transcriptArea.appendChild(finalEl);
    transcriptArea.appendChild(interimEl);

    function paintTranscript() {
      finalEl.textContent = transcript || '';
      interimEl.textContent = interim ? '… ' + interim : '';
      transcriptArea.scrollTop = transcriptArea.scrollHeight;
    }
    paintTranscript();

    const recordBtn = el(
      'button',
      { class: 'ai-record-btn' },
      [el('span', { class: 'dot' }), el('span', { class: 'label' }, supported ? 'Iniciar grabación' : 'Grabación no soportada')]
    );
    if (!supported) recordBtn.classList.add('disabled');

    const statusEl = el('div', { class: 'ai-status' }, supported
      ? 'Listo para escuchar'
      : 'Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge, o pega manualmente el texto en el cuadro inferior.');

    function startListening() {
      if (!recognizer || listening) return;
      listening = true;
      recordBtn.classList.add('recording');
      recordBtn.querySelector('.label').textContent = 'Detener grabación';
      statusEl.textContent = '🔴 Escuchando… habla con normalidad';
      try {
        recognizer.start();
      } catch (e) {
        console.warn(e);
      }
    }
    function stopListening() {
      if (!recognizer || !listening) return;
      listening = false;
      recordBtn.classList.remove('recording');
      recordBtn.querySelector('.label').textContent = 'Reanudar grabación';
      statusEl.textContent = `Pausado — ${transcript.length} caracteres transcritos`;
      try {
        recognizer.stop();
      } catch (e) {
        console.warn(e);
      }
    }
    recordBtn.addEventListener('click', () => {
      if (!supported) return;
      if (listening) stopListening();
      else startListening();
    });

    if (recognizer) {
      recognizer.addEventListener('result', (e) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalChunk += t + ' ';
          else interimChunk += t + ' ';
        }
        if (finalChunk) transcript += finalChunk;
        interim = interimChunk;
        paintTranscript();
      });
      recognizer.addEventListener('end', () => {
        if (listening) {
          // Auto-restart for long sessions
          try {
            recognizer.start();
          } catch (e) {}
        }
      });
      recognizer.addEventListener('error', (e) => {
        console.warn('SpeechRecognition error', e);
        statusEl.textContent = 'Error de reconocimiento: ' + (e.error || 'desconocido');
      });
    }

    // Manual paste textarea (also useful when SR not supported)
    const pasteArea = el('textarea', {
      class: 'ai-paste',
      placeholder: 'O pega aquí texto manualmente (transcripción externa, dictado, etc.)',
    });
    pasteArea.addEventListener('input', () => {
      transcript = pasteArea.value;
      paintTranscript();
    });
    pasteArea.value = transcript;

    // Action: process
    const processBtn = el(
      'button',
      { class: 'btn btn-accent btn-lg' },
      '✨ Procesar con IA'
    );
    const resultArea = el('div', { class: 'ai-result' });

    processBtn.addEventListener('click', async () => {
      if (!transcript.trim()) {
        toast('Sin contenido para procesar', 'error');
        return;
      }
      processBtn.disabled = true;
      processBtn.textContent = 'Procesando…';
      const apiKey = (DB.settings.get() || {}).aiApiKey;
      if (apiKey) {
        extracted = await extractWithLLM(transcript, apiKey);
      } else {
        extracted = extractLocally(transcript);
        extracted._source = 'local';
      }
      processBtn.disabled = false;
      processBtn.textContent = '✨ Procesar de nuevo';
      renderResult();
    });

    function renderResult() {
      resultArea.innerHTML = '';
      if (!extracted) return;

      const banner = el(
        'div',
        { class: 'ai-banner' },
        extracted._source === 'llm'
          ? '🧠 Resultado generado por LLM (Claude). Revisa antes de aplicar.'
          : '🧪 Resultado generado por extractor local. Revisa antes de aplicar. (Configura una API key de Claude en Ajustes para mejor calidad.)'
      );
      resultArea.appendChild(banner);

      const summary = el('div', { class: 'ai-summary' });
      summary.innerHTML = `<strong>Resumen:</strong> ${escapeHtml(extracted.summary || '')}`;
      resultArea.appendChild(summary);

      // Field selection list
      const fieldKeys = ['motive', 'anamnesis', 'extraoral', 'intraoral', 'perio', 'occlusal', 'esthetic', 'radiographic', 'digital', 'findings', 'diagnosis'];
      const fieldLabels = {
        motive: 'Motivo de consulta',
        anamnesis: 'Anamnesis',
        extraoral: 'Exploración extraoral',
        intraoral: 'Exploración intraoral',
        perio: 'Exploración periodontal',
        occlusal: 'Exploración oclusal',
        esthetic: 'Análisis estético',
        radiographic: 'Radiografía',
        digital: 'Registros digitales',
        findings: 'Hallazgos',
        diagnosis: 'Diagnóstico',
      };

      const checks = {};
      const list = el('div', { class: 'ai-fields' });
      fieldKeys.forEach((k) => {
        const value = extracted[k] || '';
        if (!value || value === 'Pendiente de validación clínica.') return;
        const id = 'aif_' + k;
        const cb = el('input', { type: 'checkbox', id, checked: 'checked' });
        checks[k] = cb;
        const item = el('div', { class: 'ai-field-row' }, [
          cb,
          el('div', { class: 'ai-field-body' }, [
            el('label', { for: id }, fieldLabels[k]),
            el('div', { class: 'ai-field-value' }, value),
          ]),
        ]);
        list.appendChild(item);
      });
      resultArea.appendChild(list);

      // Specialties
      if (extracted.specialtyCodes && extracted.specialtyCodes.length) {
        const sp = el('div', { class: 'ai-specialties' });
        sp.appendChild(el('strong', {}, 'Especialidades sugeridas: '));
        extracted.specialtyCodes.forEach((code) => {
          const s = DB.specialties.where((x) => x.code === code)[0];
          if (s) {
            sp.appendChild(
              el(
                'span',
                {
                  class: 'specialty-chip',
                  style: { '--specialty-color': s.color, marginLeft: '4px' },
                },
                s.name
              )
            );
          }
        });
        resultArea.appendChild(sp);
      }

      // Proposed plan items (the IA's own plan proposal)
      const proposedChecks = {};
      if (extracted.proposedItems && extracted.proposedItems.length) {
        const pi = el('div', { class: 'ai-proposed' });
        pi.appendChild(el('h4', {}, '🩺 Plan de tratamiento propuesto por la IA'));
        pi.appendChild(
          el(
            'p',
            { class: 'text-muted', style: { fontSize: '12px' } },
            'Cada ítem se enviará a la especialidad correspondiente para que la valide o proponga cambios.'
          )
        );
        extracted.proposedItems.forEach((item, idx) => {
          const sp = DB.specialties.where((x) => x.code === item.specialtyCode)[0];
          const id = 'aip_' + idx;
          const cb = el('input', { type: 'checkbox', id, checked: 'checked' });
          proposedChecks[idx] = { cb, item, specialty: sp };
          const row = el('div', { class: 'ai-field-row' }, [
            cb,
            el('div', { class: 'ai-field-body' }, [
              el('label', { for: id }, item.title),
              el('div', { class: 'ai-field-value' }, [
                sp
                  ? el(
                      'span',
                      {
                        class: 'specialty-chip',
                        style: { '--specialty-color': sp.color, marginRight: '6px' },
                      },
                      sp.name
                    )
                  : null,
                el('span', {}, item.justification || ''),
              ]),
            ]),
          ]);
          pi.appendChild(row);
        });
        resultArea.appendChild(pi);
      }

      // Apply button
      const applyBtn = el(
        'button',
        { class: 'btn btn-primary btn-lg', style: { marginTop: '14px' } },
        '✓ Aplicar informe + crear plan + avisar especialistas'
      );
      applyBtn.addEventListener('click', () => {
        const u = Auth.currentUser();
        const sections = visit.sections || {};
        const aiMeta = sections._aiMeta || {};
        Object.keys(checks).forEach((k) => {
          if (checks[k].checked && extracted[k]) {
            sections[k] = extracted[k];
            aiMeta[k] = { source: extracted._source || 'local', at: DB.now(), userId: u.id };
          }
        });
        // Specialties
        const specialtyIds = (extracted.specialtyCodes || [])
          .map((c) => DB.specialties.where((x) => x.code === c)[0]?.id)
          .filter(Boolean);
        if (specialtyIds.length) {
          sections.specialties = Array.from(new Set([...(sections.specialties || []), ...specialtyIds]));
          aiMeta.specialties = { source: extracted._source || 'local', at: DB.now(), userId: u.id };
        }
        sections._aiMeta = aiMeta;
        DB.firstVisits.update(visit.id, {
          sections,
          aiTranscript: transcript,
          aiProcessedAt: DB.now(),
        });

        // Auto-create plan with proposed items + send to validation
        let plan = DB.treatmentPlans.where((p) => p.patientId === visit.patientId)[0];
        if (!plan) {
          plan = DB.treatmentPlans.insert({
            patientId: visit.patientId,
            firstVisitId: visit.id,
            status: 'draft',
          });
        }
        // Build items from selected proposals
        const items = [];
        Object.values(proposedChecks).forEach((row, idx) => {
          if (!row.cb.checked) return;
          const sp = row.specialty;
          if (!sp) return;
          // Find a catalog item that matches loosely
          const catItem = DB.catalog.where((c) => c.specialtyId === sp.id)[0];
          items.push({
            id: DB.uid('it'),
            order: idx + 1,
            title: row.item.title,
            description: row.item.description || '',
            specialtyId: sp.id,
            phaseOrder: 1,
            necessity: row.item.necessity || 'necessary',
            justification: row.item.justification || '',
            risks: '',
            estimatedDuration: '',
            catalogItemId: catItem?.id || null,
            priceOverride: null,
            assignedDoctorId: null,
            notes: '',
            _aiGenerated: true,
          });
        });
        // Versioning
        const reqSpecs = Array.from(new Set(items.map((i) => i.specialtyId)));
        const v = DB.planVersions.insert({
          planId: plan.id,
          versionNumber:
            (DB.planVersions.where((x) => x.planId === plan.id).slice(-1)[0]?.versionNumber || 0) + 1,
          authorId: u.id,
          authorName: u.name,
          phases: [{ id: DB.uid('ph'), name: 'Fase 1 — Propuesta IA', description: '', order: 1 }],
          items,
          diagnosis: extracted.diagnosis || '',
          summary: extracted.summary || '',
          changeReason: 'Propuesta inicial generada por la IA tras la primera visita.',
          requiredSpecialties: reqSpecs,
          status: items.length > 0 ? 'pending_review' : 'draft',
        });
        DB.treatmentPlans.update(plan.id, {
          currentVersionId: v.id,
          status: items.length > 0 ? 'pending_review' : 'draft',
        });

        // Notify all relevant specialists
        let notifiedCount = 0;
        reqSpecs.forEach((spId) => {
          const docs = DB.users.where((usr) => (usr.specialties || []).includes(spId));
          docs.forEach((doc) => {
            DB.notifications.insert({
              userId: doc.id,
              type: 'validation_pending',
              text: `🩺 Tienes un plan nuevo pendiente de validar (${DB.patients.get(visit.patientId)?.name || ''})`,
              targetUrl: '#/patients/' + visit.patientId + '?tab=plan',
              read: false,
            });
            notifiedCount++;
          });
        });

        Audit.log('first_visit.ai_apply', {
          targetType: 'patient',
          targetId: visit.patientId,
          details: {
            fields: Object.keys(checks).filter((k) => checks[k].checked),
            proposedItems: items.length,
            notified: notifiedCount,
          },
        });

        if (items.length > 0) {
          toast(`Plan creado con ${items.length} ítems · ${notifiedCount} especialistas notificados ✓`, 'success');
        } else {
          toast('Información aplicada al informe ✓', 'success');
        }
        if (typeof onApply === 'function') onApply();
        closeFn();
      });
      resultArea.appendChild(applyBtn);
    }

    // Build the modal layout
    const body = el('div', { class: 'ai-session' }, [
      el('div', { class: 'ai-session-top' }, [
        el('div', { class: 'ai-record-wrap' }, [recordBtn, statusEl]),
        el(
          'div',
          { class: 'ai-key-hint' },
          'Habla con normalidad. La transcripción aparece en directo. Puedes pausar y reanudar.'
        ),
      ]),
      el('div', { class: 'ai-transcript-wrap' }, [
        el('div', { class: 'ai-section-label' }, 'Transcripción en directo'),
        transcriptArea,
        el(
          'details',
          { class: 'ai-paste-wrap' },
          [
            el('summary', {}, 'Pegar texto manualmente'),
            pasteArea,
          ]
        ),
      ]),
      el('div', { class: 'ai-process-bar' }, [processBtn]),
      resultArea,
    ]);

    let closeFn = null;
    openModal({
      title: '✨ Asistente IA · Primera visita de ' + (patient.name || ''),
      size: 'lg',
      body,
      footer: (footer, close) => {
        closeFn = () => close(null);
        footer.appendChild(
          el(
            'button',
            {
              class: 'btn',
              onClick: () => {
                if (listening) stopListening();
                close(null);
              },
            },
            'Cerrar'
          )
        );
      },
    });
  }

  global.AIAssistant = {
    openSession,
    extractLocally,
    extractWithLLM,
  };
})(window);
