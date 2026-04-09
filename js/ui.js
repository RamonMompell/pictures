/* ===== DentalPix - UI Helpers ===== */
/* Toasts, modals, comparison slider, shared UI components */

const UI = {
    // Toast notifications
    toast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="#00b894" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="#4a90d9" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="#f39c12" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Modal management
    openModal(id) {
        document.getElementById(id).classList.add('active');
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    },

    // Initialize comparison slider
    initComparisonSlider() {
        const slider = document.getElementById('comparisonSlider');
        const handle = document.getElementById('comparisonHandle');
        const afterDiv = document.getElementById('comparisonAfter');

        if (!slider || !handle) return;

        let isDragging = false;

        const updatePosition = (clientX) => {
            const rect = slider.getBoundingClientRect();
            let x = (clientX - rect.left) / rect.width;
            x = Math.max(0.05, Math.min(0.95, x));

            handle.style.left = (x * 100) + '%';
            afterDiv.style.clipPath = `inset(0 ${(1 - x) * 100}% 0 0)`;
        };

        const onStart = (e) => {
            isDragging = true;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            updatePosition(clientX);
        };

        const onMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            updatePosition(clientX);
        };

        const onEnd = () => { isDragging = false; };

        slider.addEventListener('mousedown', onStart);
        slider.addEventListener('touchstart', onStart, { passive: true });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
    },

    // Show comparison overlay
    showComparison(beforeUrl, afterUrl) {
        const overlay = document.getElementById('comparisonOverlay');
        document.getElementById('comparisonBeforeImg').src = beforeUrl;
        document.getElementById('comparisonAfterImg').src = afterUrl;
        overlay.style.display = 'flex';

        // Reset slider position
        document.getElementById('comparisonHandle').style.left = '50%';
        document.getElementById('comparisonAfter').style.clipPath = 'inset(0 50% 0 0)';
    },

    hideComparison() {
        document.getElementById('comparisonOverlay').style.display = 'none';
    },

    // Render activity list
    renderActivities() {
        const container = document.getElementById('recentActivity');
        const activities = Storage.getActivities().slice(0, 10);

        if (activities.length === 0) {
            container.innerHTML = '<p class="empty-state">No hay actividad reciente</p>';
            return;
        }

        container.innerHTML = activities.map(a => `
            <div class="activity-item">
                <div class="activity-dot ${a.type}"></div>
                <span class="activity-text">${a.text}</span>
                <span class="activity-time">${this.timeAgo(a.timestamp)}</span>
            </div>
        `).join('');
    },

    // Render send history
    renderSendHistory() {
        const container = document.getElementById('sendHistory');
        const history = Storage.getSendHistory();

        if (history.length === 0) {
            container.innerHTML = '<p class="empty-state">No hay envios registrados</p>';
            return;
        }

        container.innerHTML = history.map(h => `
            <div class="history-item">
                <div>
                    <span class="history-patient">${h.patientName}</span>
                    <span class="history-type">(${h.type})</span>
                </div>
                <span class="history-date">${this.timeAgo(h.timestamp)}</span>
            </div>
        `).join('');
    },

    // Update stats on dashboard
    updateStats() {
        const stats = Storage.getStats();
        document.getElementById('statPatients').textContent = stats.patients;
        document.getElementById('statPhotos').textContent = stats.photos;
        document.getElementById('statTemplates').textContent = stats.templates;
        document.getElementById('statSent').textContent = stats.sent;
    },

    // Time ago formatter
    timeAgo(isoString) {
        const now = new Date();
        const date = new Date(isoString);
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Ahora';
        if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)}h`;
        if (seconds < 604800) return `Hace ${Math.floor(seconds / 86400)}d`;
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    },

    // Load and display settings
    loadSettings() {
        const settings = Storage.getSettings();
        if (settings.clinicName) document.getElementById('settingClinicName').value = settings.clinicName;
        if (settings.clinicPhone) document.getElementById('settingClinicPhone').value = settings.clinicPhone;
        if (settings.clinicEmail) document.getElementById('settingClinicEmail').value = settings.clinicEmail;
        if (settings.clinicWeb) document.getElementById('settingClinicWeb').value = settings.clinicWeb;
        if (settings.clinicAddress) document.getElementById('settingClinicAddress').value = settings.clinicAddress;
        if (settings.basePath) document.getElementById('settingBasePath').value = settings.basePath;
        if (settings.msgInitial) document.getElementById('settingMsgInitial').value = settings.msgInitial;
        if (settings.msgFinal) document.getElementById('settingMsgFinal').value = settings.msgFinal;
        if (settings.msgComparison) document.getElementById('settingMsgComparison').value = settings.msgComparison;

        // Load logo
        if (settings.logoDataUrl) {
            this.displayLogo(settings.logoDataUrl);
        }

        // Update sidebar
        this.updateSidebar(settings);
    },

    saveSettings() {
        const settings = {
            clinicName: document.getElementById('settingClinicName').value.trim(),
            clinicPhone: document.getElementById('settingClinicPhone').value.trim(),
            clinicEmail: document.getElementById('settingClinicEmail').value.trim(),
            clinicWeb: document.getElementById('settingClinicWeb').value.trim(),
            clinicAddress: document.getElementById('settingClinicAddress').value.trim(),
            basePath: document.getElementById('settingBasePath').value.trim(),
            msgInitial: document.getElementById('settingMsgInitial').value.trim(),
            msgFinal: document.getElementById('settingMsgFinal').value.trim(),
            msgComparison: document.getElementById('settingMsgComparison').value.trim(),
            logoDataUrl: Storage.getSettings().logoDataUrl || null
        };

        Storage.saveSettings(settings);
        this.updateSidebar(settings);
        this.toast('Ajustes guardados correctamente', 'success');
    },

    updateSidebar(settings) {
        const nameEl = document.getElementById('sidebarClinicName');
        const logoEl = document.getElementById('sidebarLogo');

        if (settings.clinicName) {
            nameEl.textContent = settings.clinicName;
        }

        if (settings.logoDataUrl) {
            logoEl.innerHTML = `<img src="${settings.logoDataUrl}" alt="Logo">`;
        }
    },

    displayLogo(dataUrl) {
        const preview = document.getElementById('logoPreview');
        preview.innerHTML = `<img src="${dataUrl}" alt="Logo de la clinica">`;
    },

    removeLogo() {
        const settings = Storage.getSettings();
        settings.logoDataUrl = null;
        Storage.saveSettings(settings);

        document.getElementById('logoPreview').innerHTML = `
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="8" y="8" width="48" height="48" rx="8"/>
                <circle cx="24" cy="28" r="6"/>
                <path d="M56 44L42 30L16 56"/>
            </svg>
            <p>Arrastra tu logo aqui o haz clic</p>`;

        document.getElementById('sidebarLogo').innerHTML = `
            <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="4" y="4" width="32" height="32" rx="4"/>
                <text x="20" y="25" text-anchor="middle" font-size="10" fill="currentColor" stroke="none">LOGO</text>
            </svg>`;

        this.toast('Logo eliminado', 'info');
    }
};
