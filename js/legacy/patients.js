/* ===== DentalPix - Patient Management ===== */
/* Patient CRUD UI, photo association, folder navigation */

const PatientManager = {
    currentPatientId: null,

    // Render patients list
    renderList(filter = '') {
        const container = document.getElementById('patientsList');
        const patients = filter ? Storage.searchPatients(filter) : Storage.getPatients();

        if (patients.length === 0) {
            container.innerHTML = `
                <div class="empty-state-card">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="8.5" cy="7" r="4"/>
                        <line x1="20" y1="8" x2="20" y2="14"/>
                        <line x1="23" y1="11" x2="17" y2="11"/>
                    </svg>
                    <h3>${filter ? 'No se encontraron pacientes' : 'No hay pacientes'}</h3>
                    <p>${filter ? 'Intenta con otro termino de busqueda' : 'Registra tu primer paciente para comenzar'}</p>
                </div>`;
            return;
        }

        container.innerHTML = patients.map(p => `
            <div class="patient-card" data-patient-id="${p.id}" onclick="PatientManager.showDetail('${p.id}')">
                <div class="patient-card-header">
                    <div class="patient-avatar">${this.getInitials(p.name)}</div>
                    <div class="patient-card-info">
                        <h3>${this.escapeHtml(p.name)}</h3>
                        <p>${this.formatTreatment(p.treatment)} · ${this.formatDate(p.createdAt)}</p>
                    </div>
                </div>
                <div class="patient-card-stats">
                    <div class="patient-stat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        ${p.initialPhotoCount || 0} iniciales
                    </div>
                    <div class="patient-stat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        ${p.finalPhotoCount || 0} finales
                    </div>
                    ${p.phone ? `
                    <div class="patient-stat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/>
                        </svg>
                        WhatsApp
                    </div>` : ''}
                </div>
            </div>
        `).join('');
    },

    // Show patient detail modal
    async showDetail(patientId) {
        this.currentPatientId = patientId;
        const patient = Storage.getPatient(patientId);
        if (!patient) return;

        document.getElementById('detailPatientName').textContent = patient.name;

        // Render info tab
        document.getElementById('patientDetailInfo').innerHTML = `
            <div class="form-group">
                <label>Nombre:</label>
                <p style="color: var(--text-primary)">${this.escapeHtml(patient.name)}</p>
            </div>
            <div class="form-group">
                <label>Telefono:</label>
                <p style="color: var(--text-primary)">${patient.phone || 'No registrado'}</p>
            </div>
            <div class="form-group">
                <label>Email:</label>
                <p style="color: var(--text-primary)">${patient.email || 'No registrado'}</p>
            </div>
            <div class="form-group">
                <label>Tratamiento:</label>
                <p style="color: var(--text-primary)">${this.formatTreatment(patient.treatment)}</p>
            </div>
            <div class="form-group">
                <label>Fecha de registro:</label>
                <p style="color: var(--text-primary)">${this.formatDate(patient.createdAt)}</p>
            </div>
            ${patient.notes ? `
            <div class="form-group">
                <label>Notas:</label>
                <p style="color: var(--text-primary)">${this.escapeHtml(patient.notes)}</p>
            </div>` : ''}
        `;

        // Load and render photos
        await this.renderPhotosGrid('initial', patientId);
        await this.renderPhotosGrid('final', patientId);

        // Show modal
        document.getElementById('modalPatientDetail').classList.add('active');

        // Reset to first tab
        this.switchTab('info');
    },

    async renderPhotosGrid(type, patientId) {
        const containerId = type === 'initial' ? 'initialPhotosGrid' : 'finalPhotosGrid';
        const container = document.getElementById(containerId);
        const photos = await Storage.getPhotos(patientId, type);

        if (photos.length === 0) {
            container.innerHTML = `<p class="empty-state">No hay fotos ${type === 'initial' ? 'iniciales' : 'finales'}</p>`;
            return;
        }

        container.innerHTML = photos.map(photo => `
            <div class="photo-thumb" data-photo-id="${photo.id}">
                <img src="${photo.dataUrl}" alt="Foto ${type}" loading="lazy">
                <button class="photo-remove" onclick="event.stopPropagation(); PatientManager.removePhoto('${photo.id}', '${type}', '${patientId}')">&times;</button>
            </div>
        `).join('');
    },

    async removePhoto(photoId, type, patientId) {
        if (!confirm('¿Eliminar esta foto?')) return;

        await Storage.deletePhoto(photoId);

        // Update photo count
        const patient = Storage.getPatient(patientId);
        if (patient) {
            const countKey = type === 'initial' ? 'initialPhotoCount' : 'finalPhotoCount';
            Storage.updatePatient(patientId, {
                [countKey]: Math.max(0, (patient[countKey] || 0) - 1)
            });
        }

        await this.renderPhotosGrid(type, patientId);
        UI.toast('Foto eliminada', 'info');
    },

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
    },

    // Create new patient from modal form
    createPatient() {
        const name = document.getElementById('patientName').value.trim();
        const phone = document.getElementById('patientPhone').value.trim();
        const email = document.getElementById('patientEmail').value.trim();
        const treatment = document.getElementById('patientTreatment').value;
        const notes = document.getElementById('patientNotes').value.trim();

        if (!name) {
            UI.toast('El nombre es obligatorio', 'error');
            return null;
        }

        const patient = Storage.addPatient({ name, phone, email, treatment, notes });

        // Clear form
        document.getElementById('patientName').value = '';
        document.getElementById('patientPhone').value = '';
        document.getElementById('patientEmail').value = '';
        document.getElementById('patientNotes').value = '';

        // Close modal
        document.getElementById('modalNewPatient').classList.remove('active');

        // Refresh list
        this.renderList();

        UI.toast(`Paciente "${name}" registrado`, 'success');
        return patient;
    },

    deleteCurrentPatient() {
        if (!this.currentPatientId) return;
        const patient = Storage.getPatient(this.currentPatientId);
        if (!patient) return;

        if (!confirm(`¿Eliminar al paciente "${patient.name}" y todas sus fotos?`)) return;

        Storage.deletePatient(this.currentPatientId);
        document.getElementById('modalPatientDetail').classList.remove('active');
        this.renderList();
        UI.toast(`Paciente "${patient.name}" eliminado`, 'info');
    },

    // Populate patient select dropdowns
    populateSelects() {
        const patients = Storage.getPatients();
        const selects = [
            'importPatientSelect',
            'templatePatientSelect',
            'whatsappPatientSelect'
        ];

        selects.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = '<option value="">-- Seleccionar paciente --</option>';
            patients.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                select.appendChild(opt);
            });
            if (currentVal) select.value = currentVal;
        });
    },

    // ---- Helpers ----
    getInitials(name) {
        return name.split(' ')
            .filter(w => w.length > 0)
            .slice(0, 2)
            .map(w => w[0].toUpperCase())
            .join('');
    },

    formatTreatment(treatment) {
        const names = {
            ortodoncia: 'Ortodoncia',
            blanqueamiento: 'Blanqueamiento',
            implantes: 'Implantes',
            carillas: 'Carillas',
            endodoncia: 'Endodoncia',
            periodoncia: 'Periodoncia',
            otro: 'Otro'
        };
        return names[treatment] || treatment || 'No especificado';
    },

    formatDate(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
