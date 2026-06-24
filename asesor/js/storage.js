/* =====================================================================
   ÁBACO — Panel de Asesoría Fiscal
   storage.js — Persistencia local (localStorage + IndexedDB)
   · Metadatos (entidades, documentos, notas, ajustes) -> localStorage
   · Archivos binarios (fotos / PDF) -> IndexedDB (con fallback)
   ===================================================================== */

const Storage = {
    DB_NAME: 'abaco_db',
    DB_VERSION: 1,
    db: null,
    K: {
        entities: 'ab_entities',
        cards: 'ab_cards',
        docs: 'ab_docs',
        settings: 'ab_settings',
        activity: 'ab_activity'
    },

    async init() {
        // Sembrar entidades / tarjetas la primera vez
        if (!localStorage.getItem(this.K.entities)) {
            localStorage.setItem(this.K.entities, JSON.stringify(Data.SEED_ENTITIES));
        }
        if (!localStorage.getItem(this.K.cards)) {
            localStorage.setItem(this.K.cards, JSON.stringify(Data.SEED_CARDS));
        }
        await this._openDB();
    },

    _openDB() {
        return new Promise((resolve) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB no disponible'); return resolve(); }
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'id' });
                }
            };
            req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
            req.onerror = () => { console.warn('No se pudo abrir IndexedDB'); resolve(); };
        });
    },

    /* ===================== Entidades ===================== */
    getEntities() {
        try { return JSON.parse(localStorage.getItem(this.K.entities) || '[]'); }
        catch { return []; }
    },
    saveEntities(list) { localStorage.setItem(this.K.entities, JSON.stringify(list)); },
    getEntity(id) { return this.getEntities().find(e => e.id === id); },
    upsertEntity(entity) {
        const list = this.getEntities();
        const i = list.findIndex(e => e.id === entity.id);
        if (i === -1) { entity.id = entity.id || Data.generateId(); list.push(entity); }
        else { list[i] = { ...list[i], ...entity }; }
        this.saveEntities(list);
        return entity;
    },

    /* ===================== Tarjetas / medios ===================== */
    getCards() {
        try { return JSON.parse(localStorage.getItem(this.K.cards) || '[]'); }
        catch { return []; }
    },
    saveCards(list) { localStorage.setItem(this.K.cards, JSON.stringify(list)); },
    upsertCard(card) {
        const list = this.getCards();
        const i = list.findIndex(c => c.id === card.id);
        if (i === -1) { card.id = card.id || Data.generateId(); list.push(card); }
        else { list[i] = { ...list[i], ...card }; }
        this.saveCards(list);
        return card;
    },

    /* ===================== Documentos ===================== */
    getDocs() {
        try { return JSON.parse(localStorage.getItem(this.K.docs) || '[]'); }
        catch { return []; }
    },
    saveDocs(list) { localStorage.setItem(this.K.docs, JSON.stringify(list)); },
    getDoc(id) { return this.getDocs().find(d => d.id === id); },

    addDoc(doc) {
        const list = this.getDocs();
        doc.id = doc.id || Data.generateId();
        doc.createdAt = new Date().toISOString();
        doc.updatedAt = doc.createdAt;
        doc.status = doc.status || 'nuevo';
        doc.notes = doc.notes || [];
        list.push(doc);
        this.saveDocs(list);
        const ent = this.getEntity(doc.entityId);
        this.addActivity('upload', `${Data.DIRECTIONS[doc.direction]?.label || ''} · ${ent ? ent.name : ''} · ${doc.number || doc.title || 'documento'}`);
        return doc;
    },

    updateDoc(id, updates) {
        const list = this.getDocs();
        const i = list.findIndex(d => d.id === id);
        if (i === -1) return null;
        list[i] = { ...list[i], ...updates, updatedAt: new Date().toISOString() };
        this.saveDocs(list);
        return list[i];
    },

    async deleteDoc(id) {
        const doc = this.getDoc(id);
        this.saveDocs(this.getDocs().filter(d => d.id !== id));
        if (doc && doc.fileId) await this.deleteFile(doc.fileId);
        this.addActivity('delete', `Documento eliminado`);
    },

    /* Añadir una nota / comentario a un documento (hilo con el asesor) */
    addDocNote(docId, author, text) {
        const doc = this.getDoc(docId);
        if (!doc) return;
        const notes = doc.notes || [];
        notes.push({ id: Data.generateId(), author, text, ts: new Date().toISOString() });
        this.updateDoc(docId, { notes });
        return notes;
    },

    /* ===================== Archivos (IndexedDB) ===================== */
    async saveFile(fileRecord) {
        // fileRecord: { id, blob, name, mime, size }
        fileRecord.id = fileRecord.id || Data.generateId();
        if (!this.db) return this._saveFileLS(fileRecord);
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('files', 'readwrite');
            tx.objectStore('files').put(fileRecord);
            tx.oncomplete = () => resolve(fileRecord);
            tx.onerror = () => reject(tx.error);
        });
    },
    async getFile(id) {
        if (!id) return null;
        if (!this.db) return this._getFileLS(id);
        return new Promise((resolve) => {
            const tx = this.db.transaction('files', 'readonly');
            const req = tx.objectStore('files').get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    },
    async deleteFile(id) {
        if (!this.db) return this._deleteFileLS(id);
        return new Promise((resolve) => {
            const tx = this.db.transaction('files', 'readwrite');
            tx.objectStore('files').delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    },
    async getAllFiles() {
        if (!this.db) {
            try { return Object.values(JSON.parse(localStorage.getItem('ab_files_ls') || '{}')); }
            catch { return []; }
        }
        return new Promise((resolve) => {
            const tx = this.db.transaction('files', 'readonly');
            const req = tx.objectStore('files').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    },
    // Fallback localStorage (solo para archivos pequeños)
    _saveFileLS(rec) {
        const map = JSON.parse(localStorage.getItem('ab_files_ls') || '{}');
        map[rec.id] = rec;
        try { localStorage.setItem('ab_files_ls', JSON.stringify(map)); }
        catch { throw new Error('Almacenamiento lleno'); }
        return rec;
    },
    _getFileLS(id) {
        const map = JSON.parse(localStorage.getItem('ab_files_ls') || '{}');
        return map[id] || null;
    },
    _deleteFileLS(id) {
        const map = JSON.parse(localStorage.getItem('ab_files_ls') || '{}');
        delete map[id];
        localStorage.setItem('ab_files_ls', JSON.stringify(map));
    },

    /* ===================== Ajustes ===================== */
    getSettings() {
        try { return JSON.parse(localStorage.getItem(this.K.settings) || '{}'); }
        catch { return {}; }
    },
    saveSettings(s) {
        localStorage.setItem(this.K.settings, JSON.stringify({ ...this.getSettings(), ...s }));
    },

    /* ===================== Actividad ===================== */
    getActivity() {
        try { return JSON.parse(localStorage.getItem(this.K.activity) || '[]'); }
        catch { return []; }
    },
    addActivity(type, text) {
        const list = this.getActivity();
        list.unshift({ id: Data.generateId(), type, text, ts: new Date().toISOString() });
        if (list.length > 80) list.length = 80;
        localStorage.setItem(this.K.activity, JSON.stringify(list));
    },

    /* ===================== Exportar / importar copia ===================== */
    exportSnapshot() {
        return {
            meta: { app: 'ABACO', exportedAt: new Date().toISOString(), version: 1 },
            entities: this.getEntities(),
            cards: this.getCards(),
            docs: this.getDocs(),
            settings: this.getSettings()
        };
    },
    importSnapshot(snap) {
        if (snap.entities) this.saveEntities(snap.entities);
        if (snap.cards) this.saveCards(snap.cards);
        if (snap.docs) this.saveDocs(snap.docs);
        if (snap.settings) this.saveSettings(snap.settings);
    }
};
