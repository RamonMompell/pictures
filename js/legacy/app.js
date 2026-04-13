/* ===== DentalPix - Main Application Controller ===== */
/* Router, event binding, initialization */

const App = {
    currentView: 'dashboard',
    pendingImports: [], // Files pending import processing

    async init() {
        // Initialize storage
        await Storage.init();

        // Set up routing
        this.setupRouting();

        // Bind all events
        this.bindEvents();

        // Load initial data
        this.loadInitialData();

        // Initialize comparison slider
        UI.initComparisonSlider();

        // Navigate to current hash or dashboard
        const hash = window.location.hash.slice(1) || 'dashboard';
        this.navigate(hash);

        console.log('DentalPix initialized');
    },

    // ---- Routing ----
    setupRouting() {
        window.addEventListener('hashchange', () => {
            const view = window.location.hash.slice(1) || 'dashboard';
            this.showView(view);
        });
    },

    navigate(view) {
        window.location.hash = view;
    },

    showView(view) {
        this.currentView = view;

        // Hide all views, show target
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(`view-${view}`);
        if (target) target.classList.add('active');

        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.view === view);
        });

        // Refresh view-specific data
        this.onViewEnter(view);
    },

    onViewEnter(view) {
        switch (view) {
            case 'dashboard':
                UI.updateStats();
                UI.renderActivities();
                break;
            case 'patients':
                PatientManager.renderList();
                break;
            case 'import':
                PatientManager.populateSelects();
                break;
            case 'templates':
                PatientManager.populateSelects();
                this.renderTemplatePreview();
                break;
            case 'whatsapp':
                PatientManager.populateSelects();
                UI.renderSendHistory();
                break;
            case 'settings':
                UI.loadSettings();
                break;
        }
    },

    loadInitialData() {
        PatientManager.populateSelects();
        UI.loadSettings();
    },

    // ---- Event Binding ----
    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate(link.dataset.view);
            });
        });

        // Modal close buttons
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                UI.closeModal(btn.dataset.closeModal);
            });
        });

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('active');
            });
        });

        // ---- Patient Events ----
        document.getElementById('btnNewPatient').addEventListener('click', () => {
            UI.openModal('modalNewPatient');
        });

        document.getElementById('btnSavePatient').addEventListener('click', () => {
            PatientManager.createPatient();
            PatientManager.populateSelects();
            UI.updateStats();
        });

        document.getElementById('searchPatients').addEventListener('input', (e) => {
            PatientManager.renderList(e.target.value);
        });

        document.getElementById('btnDeletePatient').addEventListener('click', () => {
            PatientManager.deleteCurrentPatient();
            PatientManager.populateSelects();
            UI.updateStats();
        });

        // Patient detail tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                PatientManager.switchTab(btn.dataset.tab);
            });
        });

        // Create template from patient detail
        document.getElementById('btnCreateTemplateFromDetail').addEventListener('click', () => {
            if (PatientManager.currentPatientId) {
                document.getElementById('templatePatientSelect').value = PatientManager.currentPatientId;
                UI.closeModal('modalPatientDetail');
                this.navigate('templates');
            }
        });

        // ---- Import Events ----
        this.bindImportEvents();

        // ---- Template Events ----
        this.bindTemplateEvents();

        // ---- WhatsApp Events ----
        this.bindWhatsAppEvents();

        // ---- Settings Events ----
        this.bindSettingsEvents();

        // ---- Comparison ----
        document.getElementById('closeComparison').addEventListener('click', () => {
            UI.hideComparison();
        });

        // Add photo buttons in patient detail
        document.getElementById('btnAddInitialPhotos').addEventListener('click', () => {
            document.getElementById('importPatientSelect').value = PatientManager.currentPatientId;
            document.getElementById('importPhotoType').value = 'initial';
            UI.closeModal('modalPatientDetail');
            this.navigate('import');
        });

        document.getElementById('btnAddFinalPhotos').addEventListener('click', () => {
            document.getElementById('importPatientSelect').value = PatientManager.currentPatientId;
            document.getElementById('importPhotoType').value = 'final';
            UI.closeModal('modalPatientDetail');
            this.navigate('import');
        });
    },

    // ---- Import Module ----
    bindImportEvents() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const folderInput = document.getElementById('folderInput');

        // Click to select files
        document.getElementById('btnSelectFiles').addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        document.getElementById('btnSelectFolder').addEventListener('click', (e) => {
            e.stopPropagation();
            folderInput.click();
        });

        // Drop zone click
        dropZone.addEventListener('click', () => fileInput.click());

        // Drag & Drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) this.processImportFiles(files);
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) this.processImportFiles(files);
            fileInput.value = '';
        });

        // Folder input change
        folderInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) this.processImportFiles(files);
            folderInput.value = '';
        });

        // Confirm import
        document.getElementById('btnConfirmImport').addEventListener('click', () => {
            this.confirmImport();
        });

        // Clear import
        document.getElementById('btnClearImport').addEventListener('click', () => {
            this.clearImport();
        });
    },

    async processImportFiles(files) {
        const autoCrop = document.getElementById('autoCropEnabled').checked;
        const autoEnhance = document.getElementById('autoEnhance').checked;

        UI.toast(`Procesando ${files.length} imagen(es)...`, 'info');

        const results = await ImageProcessor.processFiles(files, { autoCrop, autoEnhance }, (current, total) => {
            document.getElementById('importCount').textContent = `(${current}/${total})`;
        });

        const valid = results.filter(r => !r.error);
        this.pendingImports = [...this.pendingImports, ...valid];

        if (valid.length > 0) {
            this.renderImportPreview();
            UI.toast(`${valid.length} imagen(es) procesadas correctamente`, 'success');
        }

        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
            UI.toast(`${errors.length} imagen(es) con errores`, 'warning');
        }
    },

    renderImportPreview() {
        const preview = document.getElementById('importPreview');
        const grid = document.getElementById('previewGrid');
        const count = document.getElementById('importCount');

        preview.style.display = 'block';
        count.textContent = `(${this.pendingImports.length} fotos)`;

        grid.innerHTML = this.pendingImports.map((img, idx) => `
            <div class="preview-item">
                <img src="${img.dataUrl}" alt="${img.originalName}">
                <button class="remove-preview" onclick="window.app.removeImportPreview(${idx})">&times;</button>
                ${img.wasCropped ? '<span class="crop-indicator">Recortada</span>' : ''}
            </div>
        `).join('');
    },

    removeImportPreview(index) {
        this.pendingImports.splice(index, 1);
        if (this.pendingImports.length === 0) {
            this.clearImport();
        } else {
            this.renderImportPreview();
        }
    },

    async confirmImport() {
        const patientId = document.getElementById('importPatientSelect').value;
        const photoType = document.getElementById('importPhotoType').value;

        if (!patientId) {
            UI.toast('Selecciona un paciente primero', 'warning');
            return;
        }

        if (this.pendingImports.length === 0) {
            UI.toast('No hay fotos para importar', 'warning');
            return;
        }

        UI.toast('Guardando fotos...', 'info');

        let saved = 0;
        for (let i = 0; i < this.pendingImports.length; i++) {
            const img = this.pendingImports[i];
            try {
                await Storage.savePhoto({
                    patientId,
                    type: photoType,
                    dataUrl: img.dataUrl,
                    width: img.width,
                    height: img.height,
                    originalName: img.originalName,
                    order: i
                });
                saved++;
            } catch (e) {
                UI.toast(`Error guardando: ${e.message}`, 'error');
                break;
            }
        }

        // Update patient photo count
        const patient = Storage.getPatient(patientId);
        if (patient) {
            const countKey = photoType === 'initial' ? 'initialPhotoCount' : 'finalPhotoCount';
            Storage.updatePatient(patientId, {
                [countKey]: (patient[countKey] || 0) + saved
            });
        }

        Storage.addActivity('import', `${saved} fotos ${photoType === 'initial' ? 'iniciales' : 'finales'} importadas para "${patient.name}"`);

        UI.toast(`${saved} fotos guardadas correctamente`, 'success');
        this.clearImport();
        UI.updateStats();
    },

    clearImport() {
        this.pendingImports = [];
        document.getElementById('importPreview').style.display = 'none';
        document.getElementById('previewGrid').innerHTML = '';
        document.getElementById('importCount').textContent = '';
    },

    // ---- Template Module ----
    bindTemplateEvents() {
        // Template selection
        document.getElementById('templateOptions').addEventListener('click', (e) => {
            const option = e.target.closest('.template-option');
            if (!option) return;

            document.querySelectorAll('.template-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        });

        // Color & style changes
        document.getElementById('templateBorderRadius').addEventListener('input', (e) => {
            document.getElementById('borderRadiusValue').textContent = e.target.value + 'px';
        });

        // Generate template
        document.getElementById('btnGenerateTemplate').addEventListener('click', () => {
            this.generateTemplate();
        });

        // Download template
        document.getElementById('btnDownloadTemplate').addEventListener('click', () => {
            this.downloadCurrentTemplate();
        });

        // Share on WhatsApp
        document.getElementById('btnShareWhatsApp').addEventListener('click', () => {
            this.shareTemplateWhatsApp();
        });

        // Auto-regenerate on patient/type change
        document.getElementById('templatePatientSelect').addEventListener('change', () => {
            this.renderTemplatePreview();
        });

        document.getElementById('templateType').addEventListener('change', () => {
            this.renderTemplatePreview();
        });
    },

    async renderTemplatePreview() {
        const canvas = document.getElementById('templateCanvas');
        const ctx = canvas.getContext('2d');

        // Draw empty state
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '16px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Selecciona un paciente y genera la plantilla', canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'left';
    },

    async generateTemplate() {
        const patientId = document.getElementById('templatePatientSelect').value;
        const templateType = document.getElementById('templateType').value;
        const selectedLayout = document.querySelector('.template-option.selected');
        const layout = selectedLayout ? selectedLayout.dataset.template : 'classic';

        if (!patientId) {
            UI.toast('Selecciona un paciente', 'warning');
            return;
        }

        const patient = Storage.getPatient(patientId);
        if (!patient) return;

        UI.toast('Generando plantilla...', 'info');

        // Get photos based on template type
        let photos = [];
        if (templateType === 'comparison') {
            const initial = await Storage.getPhotos(patientId, 'initial');
            const final = await Storage.getPhotos(patientId, 'final');
            photos = [initial[0], final[0]].filter(Boolean);
        } else {
            photos = await Storage.getPhotos(patientId, templateType);
        }

        if (photos.length === 0) {
            UI.toast(`No hay fotos ${templateType === 'initial' ? 'iniciales' : templateType === 'final' ? 'finales' : ''} para este paciente`, 'warning');
            return;
        }

        const canvas = document.getElementById('templateCanvas');
        const settings = Storage.getSettings();

        await TemplateEngine.render(canvas, {
            layout,
            photos,
            bgColor: document.getElementById('templateBgColor').value,
            textColor: document.getElementById('templateTextColor').value,
            borderRadius: parseInt(document.getElementById('templateBorderRadius').value),
            title: document.getElementById('templateTitle').value || `${PatientManager.formatTreatment(patient.treatment)}`,
            subtitle: document.getElementById('templateSubtitle').value || `Paciente: ${patient.name}`,
            logoDataUrl: settings.logoDataUrl || null,
            clinicName: settings.clinicName || '',
            type: templateType
        });

        UI.toast('Plantilla generada', 'success');
    },

    async downloadCurrentTemplate() {
        const patientId = document.getElementById('templatePatientSelect').value;
        const patient = patientId ? Storage.getPatient(patientId) : null;
        const canvas = document.getElementById('templateCanvas');
        const templateType = document.getElementById('templateType').value;

        const name = patient ? patient.name.replace(/\s+/g, '_') : 'plantilla';
        await TemplateEngine.downloadTemplate(canvas, `${name}_${templateType}`);
        UI.toast('Plantilla descargada', 'success');
    },

    async shareTemplateWhatsApp() {
        const patientId = document.getElementById('templatePatientSelect').value;
        if (!patientId) {
            UI.toast('Selecciona un paciente', 'warning');
            return;
        }

        const patient = Storage.getPatient(patientId);
        if (!patient) return;

        const settings = Storage.getSettings();
        const templateType = document.getElementById('templateType').value;
        const message = WhatsApp.getDefaultMessage(templateType, settings);

        const canvas = document.getElementById('templateCanvas');
        await WhatsApp.sendTemplate(canvas, patient, message, settings);

        UI.toast('Plantilla preparada para enviar', 'success');
        UI.updateStats();
    },

    // ---- WhatsApp Module ----
    bindWhatsAppEvents() {
        // Command execution
        document.getElementById('btnExecuteCommand').addEventListener('click', () => {
            this.executeWhatsAppCommand();
        });

        document.getElementById('whatsappCommand').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.executeWhatsAppCommand();
        });

        // Patient select auto-fill phone
        document.getElementById('whatsappPatientSelect').addEventListener('change', (e) => {
            const patient = Storage.getPatient(e.target.value);
            if (patient && patient.phone) {
                document.getElementById('whatsappPhone').value = patient.phone;
            }
        });

        // Send button
        document.getElementById('btnSendWhatsApp').addEventListener('click', () => {
            this.sendDirectWhatsApp();
        });
    },

    executeWhatsAppCommand() {
        const query = document.getElementById('whatsappCommand').value.trim();
        if (!query) return;

        const result = WhatsApp.executeCommand(query);
        const container = document.getElementById('commandResults');
        container.style.display = 'block';

        if (!result.found) {
            container.innerHTML = `
                <p style="color: var(--text-muted); text-align: center; padding: 12px;">
                    No se encontro ningun paciente con "${query}"
                </p>
                <button class="btn btn-secondary btn-small" onclick="document.getElementById('importPatientSelect').value=''; window.app.navigate('patients'); document.getElementById('btnNewPatient').click();">
                    Crear nuevo paciente
                </button>`;
            return;
        }

        container.innerHTML = result.results.map(p => `
            <div class="command-result-item" onclick="window.app.handleCommandResult('${p.id}')">
                <div>
                    <strong>${PatientManager.escapeHtml(p.name)}</strong>
                    <span style="color: var(--text-muted); margin-left: 8px; font-size: 0.85rem;">
                        ${p.initialPhotoCount || 0} iniciales / ${p.finalPhotoCount || 0} finales
                    </span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); window.app.quickTemplateAction('${p.id}', 'initial')">Plantilla Inicial</button>
                    <button class="btn btn-small btn-success" onclick="event.stopPropagation(); window.app.quickTemplateAction('${p.id}', 'final')">Plantilla Final</button>
                    <button class="btn btn-small btn-outline" onclick="event.stopPropagation(); window.app.quickTemplateAction('${p.id}', 'comparison')">Antes/Despues</button>
                </div>
            </div>
        `).join('');
    },

    async handleCommandResult(patientId) {
        const patient = Storage.getPatient(patientId);
        if (!patient) return;

        // Fill WhatsApp form
        document.getElementById('whatsappPatientSelect').value = patientId;
        if (patient.phone) {
            document.getElementById('whatsappPhone').value = patient.phone;
        }

        const settings = Storage.getSettings();
        const msg = WhatsApp.getDefaultMessage('initial', settings);
        document.getElementById('whatsappMessage').value = WhatsApp.formatMessage(msg, {
            nombre: patient.name,
            clinica: settings.clinicName || 'nuestra clinica'
        });
    },

    async quickTemplateAction(patientId, type) {
        // Navigate to templates and auto-generate
        document.getElementById('templatePatientSelect').value = patientId;
        document.getElementById('templateType').value = type;

        if (type === 'comparison') {
            // Select before/after layout
            document.querySelectorAll('.template-option').forEach(o => o.classList.remove('selected'));
            const baOption = document.querySelector('[data-template="beforeafter"]');
            if (baOption) baOption.classList.add('selected');
        }

        this.navigate('templates');

        // Wait for view to render, then generate
        setTimeout(() => this.generateTemplate(), 100);
    },

    async sendDirectWhatsApp() {
        const patientId = document.getElementById('whatsappPatientSelect').value;
        const phone = document.getElementById('whatsappPhone').value.trim();
        const message = document.getElementById('whatsappMessage').value.trim();

        if (!phone) {
            UI.toast('Introduce un numero de telefono', 'warning');
            return;
        }

        if (!message) {
            UI.toast('Escribe un mensaje', 'warning');
            return;
        }

        const patient = patientId ? Storage.getPatient(patientId) : { name: 'Desconocido', id: null };

        // Check which attachments are selected
        const attachInitial = document.getElementById('attachInitial').checked;
        const attachFinal = document.getElementById('attachFinal').checked;
        const attachComparison = document.getElementById('attachComparison').checked;

        // If any templates need generating, download them first
        if (patientId && (attachInitial || attachFinal || attachComparison)) {
            const settings = Storage.getSettings();
            const canvas = document.createElement('canvas');
            canvas.width = 1200;
            canvas.height = 900;

            if (attachInitial) {
                const photos = await Storage.getPhotos(patientId, 'initial');
                if (photos.length > 0) {
                    await TemplateEngine.render(canvas, {
                        layout: 'classic', photos,
                        bgColor: '#1a1a2e', textColor: '#ffffff',
                        title: PatientManager.formatTreatment(patient.treatment),
                        subtitle: `Paciente: ${patient.name}`,
                        logoDataUrl: settings.logoDataUrl, clinicName: settings.clinicName,
                        type: 'initial'
                    });
                    await TemplateEngine.downloadTemplate(canvas, `${patient.name.replace(/\s+/g, '_')}_inicial`);
                }
            }

            if (attachFinal) {
                const photos = await Storage.getPhotos(patientId, 'final');
                if (photos.length > 0) {
                    await TemplateEngine.render(canvas, {
                        layout: 'classic', photos,
                        bgColor: '#1a1a2e', textColor: '#ffffff',
                        title: PatientManager.formatTreatment(patient.treatment),
                        subtitle: `Paciente: ${patient.name}`,
                        logoDataUrl: settings.logoDataUrl, clinicName: settings.clinicName,
                        type: 'final'
                    });
                    await TemplateEngine.downloadTemplate(canvas, `${patient.name.replace(/\s+/g, '_')}_final`);
                }
            }

            if (attachComparison) {
                const initial = await Storage.getPhotos(patientId, 'initial');
                const final = await Storage.getPhotos(patientId, 'final');
                const photos = [initial[0], final[0]].filter(Boolean);
                if (photos.length === 2) {
                    await TemplateEngine.render(canvas, {
                        layout: 'beforeafter', photos,
                        bgColor: '#1a1a2e', textColor: '#ffffff',
                        title: PatientManager.formatTreatment(patient.treatment),
                        subtitle: `Paciente: ${patient.name}`,
                        logoDataUrl: settings.logoDataUrl, clinicName: settings.clinicName,
                        type: 'comparison'
                    });
                    await TemplateEngine.downloadTemplate(canvas, `${patient.name.replace(/\s+/g, '_')}_antes_despues`);
                }
            }
        }

        // Open WhatsApp
        WhatsApp.openChat(phone, message + '\n\n(Adjunta las imagenes descargadas)');

        // Log
        Storage.addSendHistory({
            patientName: patient.name,
            patientId: patient.id,
            phone,
            type: 'direct',
            message: message.substring(0, 100)
        });

        UI.toast('WhatsApp abierto - adjunta las imagenes descargadas', 'success');
        UI.renderSendHistory();
        UI.updateStats();
    },

    // ---- Settings Module ----
    bindSettingsEvents() {
        document.getElementById('btnSaveSettings').addEventListener('click', () => {
            UI.saveSettings();
        });

        document.getElementById('btnResetSettings').addEventListener('click', () => {
            if (confirm('¿Restablecer todos los ajustes a los valores por defecto?')) {
                Storage.saveSettings({});
                UI.loadSettings();
                UI.toast('Ajustes restablecidos', 'info');
            }
        });

        // Logo upload
        const logoArea = document.getElementById('logoUploadArea');
        const logoInput = document.getElementById('logoInput');

        logoArea.addEventListener('click', () => logoInput.click());

        logoArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            logoArea.style.borderColor = 'var(--primary)';
        });

        logoArea.addEventListener('dragleave', () => {
            logoArea.style.borderColor = '';
        });

        logoArea.addEventListener('drop', (e) => {
            e.preventDefault();
            logoArea.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.processLogo(file);
            }
        });

        logoInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.processLogo(e.target.files[0]);
            }
        });

        document.getElementById('btnRemoveLogo').addEventListener('click', () => {
            UI.removeLogo();
        });
    },

    async processLogo(file) {
        try {
            const result = await ImageProcessor.processImage(file, {
                autoCrop: true,
                autoEnhance: false,
                maxWidth: 400,
                maxHeight: 200
            });

            const settings = Storage.getSettings();
            settings.logoDataUrl = result.dataUrl;
            Storage.saveSettings(settings);

            UI.displayLogo(result.dataUrl);
            UI.updateSidebar(settings);
            UI.toast('Logo actualizado', 'success');
        } catch (e) {
            UI.toast('Error procesando el logo', 'error');
        }
    }
};

// Expose app globally
window.app = App;

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
