/* ============================================================
   Clinia — Settings
   ============================================================ */

(function (global) {
  const { el, toast, openModal, field, formData } = UI;

  function render(root) {
    root.innerHTML = '';
    root.appendChild(
      el('div', { class: 'page-header' }, [
        el('div', {}, [
          el('h1', {}, 'Configuración'),
          el('div', { class: 'subtitle' }, 'Ajustes de la clínica y de la plataforma'),
        ]),
      ])
    );

    const settings = DB.settings.get();
    const clinics = DB.clinics.all();

    const generalCard = el('div', { class: 'card' });
    generalCard.appendChild(el('div', { class: 'card-header' }, [el('h3', {}, 'General')]));
    const form = el('form');
    const f1 = field({
      label: 'Clínica activa',
      name: 'activeClinicId',
      type: 'select',
      options: clinics.map((c) => ({ value: c.id, label: c.name })),
      value: settings.activeClinicId,
    });
    const f2 = field({
      label: 'Tema',
      name: 'theme',
      type: 'select',
      options: [
        { value: 'light', label: 'Claro' },
        { value: 'dark', label: 'Oscuro' },
      ],
      value: settings.theme || 'light',
    });
    const f3 = field({
      label: 'Ruta de importación de fotos',
      name: 'photoImportPath',
      value: settings.photoImportPath || '',
      hint: 'Ruta local donde el planificador guarda las fotos para asociarlas automáticamente.',
    });
    form.appendChild(el('div', { class: 'form-row' }, [f1.wrap, f2.wrap]));
    form.appendChild(f3.wrap);
    generalCard.appendChild(form);
    generalCard.appendChild(
      el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } }, [
        el(
          'button',
          {
            class: 'btn btn-primary',
            onClick: () => {
              const data = formData(form);
              DB.settings.set(data);
              document.body.dataset.theme = data.theme || 'light';
              toast('Ajustes guardados', 'success');
            },
          },
          'Guardar ajustes'
        ),
      ])
    );
    root.appendChild(generalCard);

    // Specialties management
    const specCard = el('div', { class: 'card' });
    specCard.appendChild(
      el('div', { class: 'card-header' }, [
        el('h3', {}, 'Especialidades'),
        el(
          'button',
          {
            class: 'btn btn-sm btn-primary',
            onClick: () => openSpecialtyModal(() => render(root)),
          },
          '+ Especialidad'
        ),
      ])
    );
    const list = el('div', { class: 'row-wrap' });
    DB.specialties.all().forEach((sp) => {
      list.appendChild(
        el(
          'span',
          { class: 'specialty-chip', style: { '--specialty-color': sp.color, padding: '6px 12px', fontSize: '12px' } },
          sp.name
        )
      );
    });
    specCard.appendChild(list);
    root.appendChild(specCard);

    // Danger zone
    const danger = el('div', { class: 'card', style: { borderColor: 'var(--c-danger)' } });
    danger.appendChild(
      el('div', { class: 'card-header' }, [el('h3', { style: { color: 'var(--c-danger)' } }, 'Zona peligrosa')])
    );
    danger.appendChild(
      el('p', { class: 'text-muted' }, 'Las siguientes acciones son irreversibles a nivel de almacenamiento local.')
    );
    danger.appendChild(
      el('div', { class: 'row' }, [
        el(
          'button',
          {
            class: 'btn btn-danger',
            onClick: async () => {
              if (!(await UI.confirm('Restablecer todos los datos de demostración? Se perderán los cambios locales.', { danger: true }))) return;
              DB.resetAll();
              location.reload();
            },
          },
          'Restablecer datos de demo'
        ),
      ])
    );
    root.appendChild(danger);
  }

  function openSpecialtyModal(onDone) {
    const form = el('form');
    const f1 = field({ label: 'Nombre', name: 'name', required: true });
    const f2 = field({ label: 'Código', name: 'code' });
    const f3 = field({ label: 'Color (hex)', name: 'color', value: '#0f766e' });
    [f1, f2, f3].forEach((f) => form.appendChild(f.wrap));
    openModal({
      title: 'Nueva especialidad',
      body: form,
      footer: (footer, close) => {
        footer.appendChild(el('button', { class: 'btn', onClick: () => close(null) }, 'Cancelar'));
        footer.appendChild(
          el(
            'button',
            {
              class: 'btn btn-primary',
              onClick: () => {
                const data = formData(form);
                if (!data.name) return toast('Nombre obligatorio', 'error');
                DB.specialties.insert({ ...data, active: true });
                close(null);
                onDone && onDone();
              },
            },
            'Guardar'
          )
        );
      },
    });
  }

  global.Settings = { render };
})(window);
