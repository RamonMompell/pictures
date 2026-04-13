/* ============================================================
   Clinia — Data Layer
   Lightweight repository pattern over localStorage.
   Each entity has its own namespaced store. The API mimics what a
   real backend would expose so swapping it for an HTTP client only
   requires changing this file.
   ============================================================ */

(function (global) {
  const NS = 'clinia.';

  // Tiny event emitter so views can react to data changes
  const Events = {
    listeners: {},
    on(event, fn) {
      (this.listeners[event] = this.listeners[event] || []).push(fn);
      return () => this.off(event, fn);
    },
    off(event, fn) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
    },
    emit(event, payload) {
      (this.listeners[event] || []).forEach((fn) => {
        try {
          fn(payload);
        } catch (e) {
          console.error('event handler failed', event, e);
        }
      });
      // Also broadcast a generic "*" event with metadata
      (this.listeners['*'] || []).forEach((fn) => fn({ event, payload }));
    },
  };

  function read(key) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('db read failed', key, e);
      return null;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
    } catch (e) {
      console.error('db write failed', key, e);
      throw e;
    }
  }
  function uid(prefix = '') {
    return (
      (prefix ? prefix + '_' : '') +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8)
    );
  }
  function now() {
    return new Date().toISOString();
  }

  // Generic repository factory
  function repo(name) {
    const KEY = name;
    return {
      all() {
        return read(KEY) || [];
      },
      save(list) {
        write(KEY, list);
      },
      get(id) {
        return this.all().find((x) => x.id === id) || null;
      },
      where(predicate) {
        return this.all().filter(predicate);
      },
      insert(item) {
        const list = this.all();
        item.id = item.id || uid(name.slice(0, 3));
        item.createdAt = item.createdAt || now();
        item.updatedAt = now();
        list.push(item);
        this.save(list);
        Events.emit(name + ':created', item);
        Events.emit(name + ':changed', item);
        return item;
      },
      update(id, updates) {
        const list = this.all();
        const idx = list.findIndex((x) => x.id === id);
        if (idx === -1) return null;
        list[idx] = { ...list[idx], ...updates, id, updatedAt: now() };
        this.save(list);
        Events.emit(name + ':updated', list[idx]);
        Events.emit(name + ':changed', list[idx]);
        return list[idx];
      },
      remove(id) {
        const list = this.all();
        const item = list.find((x) => x.id === id);
        this.save(list.filter((x) => x.id !== id));
        Events.emit(name + ':deleted', item);
        Events.emit(name + ':changed', item);
        return item;
      },
      bulkInsert(items) {
        const list = this.all().concat(items);
        this.save(list);
        items.forEach((i) => Events.emit(name + ':created', i));
        return items;
      },
      clear() {
        write(KEY, []);
      },
    };
  }

  // ---- File / image storage (IndexedDB for binaries) ----
  const FileStore = {
    DB_NAME: 'clinia_files',
    DB_VERSION: 1,
    db: null,
    async init() {
      return new Promise((resolve) => {
        if (typeof indexedDB === 'undefined') {
          console.warn('IndexedDB not available — file blobs will use localStorage');
          resolve();
          return;
        }
        const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('files')) {
            const store = db.createObjectStore('files', { keyPath: 'id' });
            store.createIndex('patientId', 'patientId', { unique: false });
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve();
        };
        req.onerror = () => {
          console.warn('IndexedDB open failed');
          resolve();
        };
      });
    },
    async put(file) {
      file.id = file.id || uid('file');
      file.createdAt = file.createdAt || now();
      if (!this.db) {
        // Fallback to localStorage list (small files only)
        const list = read('files_lite') || [];
        list.push(file);
        write('files_lite', list);
        return file;
      }
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('files', 'readwrite');
        tx.objectStore('files').put(file);
        tx.oncomplete = () => resolve(file);
        tx.onerror = () => reject(tx.error);
      });
    },
    async listByPatient(patientId) {
      if (!this.db) {
        return (read('files_lite') || []).filter((f) => f.patientId === patientId);
      }
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('files', 'readonly');
        const idx = tx.objectStore('files').index('patientId');
        const req = idx.getAll(patientId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },
    async remove(id) {
      if (!this.db) {
        write(
          'files_lite',
          (read('files_lite') || []).filter((f) => f.id !== id)
        );
        return;
      }
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('files', 'readwrite');
        tx.objectStore('files').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };

  // ---- Top-level data API ----
  const DB = {
    Events,
    uid,
    now,
    write,
    read,

    // Repositories
    organizations: repo('organizations'),
    clinics: repo('clinics'),
    users: repo('users'),
    specialties: repo('specialties'),
    patients: repo('patients'),
    medicalHistories: repo('medical_histories'),
    firstVisits: repo('first_visits'),
    firstVisitTemplates: repo('first_visit_templates'),
    examinations: repo('examinations'),
    diagnoses: repo('diagnoses'),
    treatmentPlans: repo('treatment_plans'),
    planVersions: repo('plan_versions'),
    validations: repo('validations'),
    catalog: repo('catalog'),
    budgets: repo('budgets'),
    budgetVersions: repo('budget_versions'),
    commercialStatuses: repo('commercial_statuses'),
    appointments: repo('appointments'),
    chatMessages: repo('chat_messages'),
    comments: repo('comments'),
    notifications: repo('notifications'),
    auditLog: repo('audit_log'),
    aiJobs: repo('ai_jobs'),

    files: FileStore,

    settings: {
      get() {
        return read('settings') || {};
      },
      set(patch) {
        const s = { ...this.get(), ...patch };
        write('settings', s);
        Events.emit('settings:changed', s);
        return s;
      },
    },

    session: {
      get() {
        return read('session') || null;
      },
      set(s) {
        write('session', s);
        Events.emit('session:changed', s);
      },
      clear() {
        localStorage.removeItem(NS + 'session');
        Events.emit('session:changed', null);
      },
    },

    async init() {
      await FileStore.init();
    },

    // Wipe everything (used by Settings → reset demo)
    resetAll() {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(NS)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      Events.emit('db:reset');
    },
  };

  global.DB = DB;
})(window);
