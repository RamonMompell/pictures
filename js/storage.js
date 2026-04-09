/* ===== DentalPix - Storage Module ===== */
/* Handles all LocalStorage/IndexedDB operations */

const Storage = {
    DB_NAME: 'dentalpix_db',
    DB_VERSION: 1,
    db: null,

    // Initialize IndexedDB for large image storage
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                console.warn('IndexedDB not available, falling back to localStorage');
                resolve();
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('photos')) {
                    const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
                    photoStore.createIndex('patientId', 'patientId', { unique: false });
                    photoStore.createIndex('type', 'type', { unique: false });
                }
                if (!db.objectStoreNames.contains('templates')) {
                    db.createObjectStore('templates', { keyPath: 'id' });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
        });
    },

    // ---- Patient CRUD (localStorage) ----
    getPatients() {
        try {
            return JSON.parse(localStorage.getItem('dp_patients') || '[]');
        } catch { return []; }
    },

    savePatients(patients) {
        localStorage.setItem('dp_patients', JSON.stringify(patients));
    },

    addPatient(patient) {
        const patients = this.getPatients();
        patient.id = patient.id || this.generateId();
        patient.createdAt = patient.createdAt || new Date().toISOString();
        patient.initialPhotoCount = patient.initialPhotoCount || 0;
        patient.finalPhotoCount = patient.finalPhotoCount || 0;
        patients.push(patient);
        this.savePatients(patients);
        this.addActivity('patient', `Paciente "${patient.name}" registrado`);
        return patient;
    },

    updatePatient(id, updates) {
        const patients = this.getPatients();
        const index = patients.findIndex(p => p.id === id);
        if (index !== -1) {
            patients[index] = { ...patients[index], ...updates };
            this.savePatients(patients);
        }
        return patients[index];
    },

    deletePatient(id) {
        const patients = this.getPatients();
        const patient = patients.find(p => p.id === id);
        this.savePatients(patients.filter(p => p.id !== id));
        // Also delete photos from IndexedDB
        this.deletePhotosByPatient(id);
        if (patient) {
            this.addActivity('patient', `Paciente "${patient.name}" eliminado`);
        }
    },

    getPatient(id) {
        return this.getPatients().find(p => p.id === id);
    },

    searchPatients(query) {
        const q = query.toLowerCase().trim();
        return this.getPatients().filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.phone && p.phone.includes(q)) ||
            (p.treatment && p.treatment.toLowerCase().includes(q))
        );
    },

    // ---- Photo Storage (IndexedDB) ----
    async savePhoto(photoData) {
        if (!this.db) {
            // Fallback to localStorage
            return this._savePhotoLS(photoData);
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('photos', 'readwrite');
            const store = tx.objectStore('photos');
            photoData.id = photoData.id || this.generateId();
            photoData.createdAt = new Date().toISOString();
            store.put(photoData);
            tx.oncomplete = () => resolve(photoData);
            tx.onerror = () => reject(tx.error);
        });
    },

    async getPhotos(patientId, type) {
        if (!this.db) return this._getPhotosLS(patientId, type);

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('photos', 'readonly');
            const store = tx.objectStore('photos');
            const index = store.index('patientId');
            const request = index.getAll(patientId);

            request.onsuccess = () => {
                let results = request.result;
                if (type) {
                    results = results.filter(p => p.type === type);
                }
                results.sort((a, b) => (a.order || 0) - (b.order || 0));
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    },

    async deletePhoto(id) {
        if (!this.db) return this._deletePhotoLS(id);

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('photos', 'readwrite');
            const store = tx.objectStore('photos');
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async deletePhotosByPatient(patientId) {
        const photos = await this.getPhotos(patientId);
        for (const photo of photos) {
            await this.deletePhoto(photo.id);
        }
    },

    // localStorage fallback for photos
    _savePhotoLS(photoData) {
        const photos = JSON.parse(localStorage.getItem('dp_photos') || '[]');
        photoData.id = photoData.id || this.generateId();
        photoData.createdAt = new Date().toISOString();
        photos.push(photoData);
        try {
            localStorage.setItem('dp_photos', JSON.stringify(photos));
        } catch (e) {
            console.error('Storage full, try deleting old photos');
            throw new Error('Almacenamiento lleno');
        }
        return photoData;
    },

    _getPhotosLS(patientId, type) {
        const photos = JSON.parse(localStorage.getItem('dp_photos') || '[]');
        return photos
            .filter(p => p.patientId === patientId && (!type || p.type === type))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    },

    _deletePhotoLS(id) {
        const photos = JSON.parse(localStorage.getItem('dp_photos') || '[]');
        localStorage.setItem('dp_photos', JSON.stringify(photos.filter(p => p.id !== id)));
    },

    // ---- Clinic Settings ----
    getSettings() {
        try {
            return JSON.parse(localStorage.getItem('dp_settings') || '{}');
        } catch { return {}; }
    },

    saveSettings(settings) {
        localStorage.setItem('dp_settings', JSON.stringify(settings));
    },

    // ---- Activity Log ----
    getActivities() {
        try {
            return JSON.parse(localStorage.getItem('dp_activities') || '[]');
        } catch { return []; }
    },

    addActivity(type, text) {
        const activities = this.getActivities();
        activities.unshift({
            id: this.generateId(),
            type,
            text,
            timestamp: new Date().toISOString()
        });
        // Keep only last 50 activities
        if (activities.length > 50) activities.length = 50;
        localStorage.setItem('dp_activities', JSON.stringify(activities));
    },

    // ---- Send History ----
    getSendHistory() {
        try {
            return JSON.parse(localStorage.getItem('dp_send_history') || '[]');
        } catch { return []; }
    },

    addSendHistory(entry) {
        const history = this.getSendHistory();
        entry.id = this.generateId();
        entry.timestamp = new Date().toISOString();
        history.unshift(entry);
        if (history.length > 100) history.length = 100;
        localStorage.setItem('dp_send_history', JSON.stringify(history));
        this.addActivity('send', `Plantilla enviada a "${entry.patientName}"`);
    },

    // ---- Stats ----
    getStats() {
        const patients = this.getPatients();
        const history = this.getSendHistory();
        let totalPhotos = 0;
        patients.forEach(p => {
            totalPhotos += (p.initialPhotoCount || 0) + (p.finalPhotoCount || 0);
        });
        return {
            patients: patients.length,
            photos: totalPhotos,
            templates: parseInt(localStorage.getItem('dp_template_count') || '0'),
            sent: history.length
        };
    },

    incrementTemplateCount() {
        const count = parseInt(localStorage.getItem('dp_template_count') || '0');
        localStorage.setItem('dp_template_count', String(count + 1));
    },

    // ---- Utility ----
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }
};
