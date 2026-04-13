/* ============================================================
   Clinia — Patient files (photos, x-rays, CBCT, STL, PDFs)
   ============================================================ */

(function (global) {
  const { el, escapeHtml, toast, fmtDate, openModal } = UI;

  const CATEGORIES = [
    { value: 'photo_extraoral', label: 'Foto extraoral', icon: '📸' },
    { value: 'photo_intraoral', label: 'Foto intraoral', icon: '📷' },
    { value: 'xray_pano', label: 'Panorámica', icon: '🦷' },
    { value: 'xray_periapical', label: 'Periapical', icon: '🦷' },
    { value: 'xray_lateral', label: 'Telerradiografía', icon: '🦷' },
    { value: 'cbct', label: 'CBCT', icon: '🧠' },
    { value: 'scan', label: 'Escaneado intraoral', icon: '🖥' },
    { value: 'consent', label: 'Consentimiento', icon: '📄' },
    { value: 'document', label: 'Documento', icon: '📁' },
  ];

  function render(root, patientId) {
    if (!Permissions.can(Auth.currentUser(), Permissions.CAP.PATIENT_READ)) {
      root.innerHTML = '<div class="empty"><h3>Sin acceso</h3></div>';
      return;
    }
    root.innerHTML = '';

    const header = el('div', { class: 'plan-header' }, [
      el('div', {}, [
        el('h2', { class: 'mb-0' }, 'Biblioteca de archivos'),
        el('div', { class: 'plan-meta' }, [el('span', {}, 'Fotos · radiografías · CBCT · STL · documentos')]),
      ]),
      el('div', { class: 'row' }, [
        el(
          'button',
          {
            class: 'btn btn-primary',
            onClick: () => openUploadModal(patientId, () => render(root, patientId)),
          },
          '+ Subir archivo'
        ),
      ]),
    ]);
    root.appendChild(header);

    const filterBar = el('div', { class: 'filters-bar' });
    const select = el(
      'select',
      {},
      [{ value: '', label: 'Todas las categorías' }]
        .concat(CATEGORIES)
        .map((o) => el('option', { value: o.value }, o.label))
    );
    select.addEventListener('change', () => loadFiles(select.value));
    filterBar.appendChild(select);
    root.appendChild(filterBar);

    const grid = el('div', { class: 'file-grid' });
    root.appendChild(grid);

    async function loadFiles(filter) {
      grid.innerHTML = '<div class="text-muted">Cargando…</div>';
      const files = await DB.files.listByPatient(patientId);
      grid.innerHTML = '';
      const filtered = filter ? files.filter((f) => f.category === filter) : files;
      if (filtered.length === 0) {
        grid.appendChild(
          el('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, [
            el('div', { class: 'icon' }, '🗂'),
            el('h3', {}, 'Sin archivos'),
            el('p', {}, 'Sube fotografías, radiografías o documentos.'),
          ])
        );
        return;
      }
      filtered.forEach((f) => {
        const cat = CATEGORIES.find((c) => c.value === f.category) || { label: f.category || 'Otro', icon: '📁' };
        const tile = el('div', { class: 'file-tile' });
        const thumb = el('div', { class: 'thumb' });
        if (f.dataUrl && f.mime && f.mime.startsWith('image/')) {
          thumb.appendChild(el('img', { src: f.dataUrl, alt: f.name }));
        } else {
          thumb.appendChild(el('div', {}, cat.icon + ' ' + (f.mime || '')));
        }
        tile.appendChild(thumb);
        tile.appendChild(el('div', { class: 'name' }, f.name));
        tile.appendChild(el('div', { class: 'cat' }, cat.label + ' · ' + fmtDate(f.createdAt)));
        const actions = el('div', { class: 'row', style: { marginTop: '6px', justifyContent: 'space-between' } }, [
          el(
            'button',
            { class: 'btn btn-sm btn-ghost', onClick: () => openPreview(f) },
            'Ver'
          ),
          el(
            'button',
            {
              class: 'btn btn-sm btn-danger',
              onClick: async () => {
                if (!(await UI.confirm('¿Eliminar archivo?', { danger: true }))) return;
                await DB.files.remove(f.id);
                Audit.log('file.delete', { targetType: 'patient', targetId: patientId });
                loadFiles(filter);
              },
            },
            'Borrar'
          ),
        ]);
        tile.appendChild(actions);
        grid.appendChild(tile);
      });
    }
    loadFiles('');
  }

  function openPreview(file) {
    openModal({
      title: file.name,
      size: 'lg',
      body: file.mime && file.mime.startsWith('image/') ? el('img', { src: file.dataUrl, style: { maxWidth: '100%' } }) : el('p', {}, 'Vista previa no disponible'),
      footer: (footer, close) => {
        footer.appendChild(el('button', { class: 'btn', onClick: () => close(null) }, 'Cerrar'));
      },
    });
  }

  function openUploadModal(patientId, onDone) {
    if (!Permissions.can(Auth.currentUser(), Permissions.CAP.FILES_UPLOAD)) {
      return toast('Sin permiso para subir archivos', 'error');
    }
    const inputFile = el('input', { type: 'file', accept: 'image/*,.pdf' });
    const select = el(
      'select',
      { name: 'category' },
      CATEGORIES.map((c) => el('option', { value: c.value }, c.label))
    );
    const wrap = el('div', {}, [
      el('div', { class: 'form-field' }, [el('label', {}, 'Categoría'), select]),
      el('div', { class: 'form-field' }, [el('label', {}, 'Archivo'), inputFile]),
    ]);

    openModal({
      title: 'Subir archivo',
      body: wrap,
      footer: (footer, close) => {
        footer.appendChild(el('button', { class: 'btn', onClick: () => close(null) }, 'Cancelar'));
        footer.appendChild(
          el(
            'button',
            {
              class: 'btn btn-primary',
              onClick: async () => {
                const f = inputFile.files[0];
                if (!f) return toast('Selecciona un archivo', 'error');
                const reader = new FileReader();
                reader.onload = async () => {
                  await DB.files.put({
                    patientId,
                    name: f.name,
                    category: select.value,
                    mime: f.type,
                    size: f.size,
                    dataUrl: reader.result,
                    uploadedBy: Auth.currentUser().id,
                  });
                  Audit.log('file.upload', { targetType: 'patient', targetId: patientId, details: { name: f.name } });
                  toast('Archivo subido', 'success');
                  close(null);
                  onDone && onDone();
                };
                reader.readAsDataURL(f);
              },
            },
            'Subir'
          )
        );
      },
    });
  }

  global.Files = { render, CATEGORIES };
})(window);
