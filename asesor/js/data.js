/* =====================================================================
   ÁBACO — Panel de Asesoría Fiscal
   data.js — Configuración, entidades semilla y taxonomías
   ===================================================================== */

const Data = {
    /* ---- Entidades (sociedades y personas) ----
       Estructura real declarada por el titular:
       · Aliseo Dental: holding de Zyra Dental + sociedad operativa de Nylo Dental
       · Zyra Dental: participada por Aliseo Dental
       · Nylo Dental: operada por Aliseo Dental                              */
    SEED_ENTITIES: [
        // ---- España ----
        {
            id: 'dentalgram', name: 'Dentalgram', kind: 'company',
            jurisdiction: 'ES', group: 'España', currency: 'EUR',
            role: 'Sociedad', vat: '', accent: '#3E5C76', notes: ''
        },
        {
            id: 'mompell-mico', name: 'Mompell Mico', kind: 'company',
            jurisdiction: 'ES', group: 'España', currency: 'EUR',
            role: 'Sociedad', vat: '', accent: '#4A6670', notes: ''
        },
        {
            id: 'aliseo-dental', name: 'Aliseo Dental', kind: 'company',
            jurisdiction: 'ES', group: 'España', currency: 'EUR',
            role: 'Holding · Sociedad operativa de Nylo Dental', vat: '',
            accent: '#2F5D62', holds: ['zyra-dental'], operates: ['nylo-dental'],
            notes: 'Sociedad holding de Zyra Dental y sociedad operativa de Nylo Dental.'
        },
        {
            id: 'zyra-dental', name: 'Zyra Dental', kind: 'company',
            jurisdiction: 'ES', group: 'España', currency: 'EUR',
            role: 'Participada por Aliseo Dental', vat: '', parentId: 'aliseo-dental',
            accent: '#5E8B7E', notes: 'Participada del holding Aliseo Dental.'
        },
        {
            id: 'nylo-dental', name: 'Nylo Dental', kind: 'company',
            jurisdiction: 'ES', group: 'España', currency: 'EUR',
            role: 'Operada por Aliseo Dental', vat: '', operatedBy: 'aliseo-dental',
            accent: '#7AA095', notes: 'Actividad operada a través de Aliseo Dental.'
        },
        // ---- Dubái (EAU) ----
        {
            id: 'persona-dubai', name: 'Persona física · Dubái', kind: 'person',
            jurisdiction: 'AE', group: 'Dubái (EAU)', currency: 'AED',
            role: 'Persona física residente', vat: '', accent: '#9A7B4F', notes: ''
        },
        {
            id: 'genius-x', name: 'Genius X', kind: 'company',
            jurisdiction: 'AE', group: 'Dubái (EAU)', currency: 'AED',
            role: 'Sociedad (EAU)', vat: '', accent: '#B08D57', notes: ''
        },
        // ---- Estados Unidos ----
        {
            id: 'coresolutions', name: 'Coresolutions LLC', kind: 'company',
            jurisdiction: 'US', group: 'Estados Unidos', currency: 'USD',
            role: 'LLC (EE. UU.)', vat: '', accent: '#6B7A8F', notes: ''
        }
    ],

    /* ---- Medios de pago / tarjetas ---- */
    SEED_CARDS: [
        {
            id: 'revolut-alejandra', label: 'Revolut · Alejandra', type: 'card',
            holder: 'Alejandra (persona física)', currency: 'EUR',
            notes: 'Gastos pagados con la tarjeta Revolut de Alejandra.'
        }
    ],

    /* ---- Taxonomías ---- */
    JURISDICTIONS: {
        ES: { label: 'España', flag: '🇪🇸', tax: 'IVA' },
        AE: { label: 'Emiratos Árabes Unidos', flag: '🇦🇪', tax: 'VAT' },
        US: { label: 'Estados Unidos', flag: '🇺🇸', tax: 'Sales Tax' }
    },

    DIRECTIONS: {
        recibida: { label: 'Recibida', hint: 'Factura/recibo de un proveedor (gasto)', sign: -1 },
        emitida:  { label: 'Emitida',  hint: 'Factura que tú emites a un cliente (ingreso)', sign: 1 }
    },

    DOC_TYPES: {
        factura:      { label: 'Factura', strict: true },
        recibo:       { label: 'Recibo', strict: false },
        ticket:       { label: 'Ticket / Tique', strict: false },
        proforma:     { label: 'Proforma', strict: false },
        nota_credito: { label: 'Nota de crédito / Abono', strict: true },
        otro:         { label: 'Otro documento', strict: false }
    },

    EXPENSE_CATEGORIES: [
        'Restauración', 'Alojamiento y viajes', 'Transporte', 'Material y suministros',
        'Equipamiento', 'Servicios profesionales', 'Software y suscripciones',
        'Marketing y publicidad', 'Oficina', 'Telefonía e internet',
        'Comisiones bancarias', 'Impuestos y tasas', 'Formación', 'Salud', 'Otros gastos'
    ],

    INCOME_CATEGORIES: [
        'Ventas y servicios', 'Honorarios', 'Alquileres', 'Intereses', 'Otros ingresos'
    ],

    PAYMENT_METHODS: ['Tarjeta', 'Transferencia', 'Efectivo', 'Domiciliación', 'Pasarela (Stripe/PayPal)', 'Otro'],

    CURRENCIES: ['EUR', 'AED', 'USD', 'GBP'],

    STATUS: {
        nuevo:     { label: 'Nuevo', hint: 'Pendiente de revisar por el asesor', color: '#B08D57' },
        revisado:  { label: 'Revisado', hint: 'Validado por el asesor', color: '#5E8B7E' },
        incidencia:{ label: 'Incidencia', hint: 'Requiere atención o falta información', color: '#C2554D' }
    },

    /* Tipos de IVA habituales en España (sugeridos) */
    VAT_RATES: [21, 10, 4, 0],

    /* ---- Helpers de formato ---- */
    fmtMoney(amount, currency = 'EUR') {
        const n = Number(amount) || 0;
        try {
            return new Intl.NumberFormat('es-ES', {
                style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2
            }).format(n);
        } catch {
            return `${n.toFixed(2)} ${currency}`;
        }
    },

    fmtNumber(n) {
        return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
    },

    fmtDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d)) return '—';
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    },

    fmtDateLong(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d)) return '—';
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
    },

    MONTHS: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],

    /* Devuelve {year, month, day, quarter, key} a partir de una fecha ISO */
    parsePeriod(iso) {
        const d = iso ? new Date(iso) : new Date();
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const quarter = Math.floor((month - 1) / 3) + 1;
        return {
            year, month, day, quarter,
            key: `${year}-${String(month).padStart(2, '0')}`,
            label: `${this.MONTHS[month - 1]} ${year}`,
            quarterLabel: `${quarter}T ${year}`
        };
    },

    entityById(id) {
        const all = (window.Storage ? Storage.getEntities() : this.SEED_ENTITIES);
        return all.find(e => e.id === id);
    },

    /* Color/acento de una entidad con respaldo neutro */
    entityAccent(id) {
        const e = this.entityById(id);
        return (e && e.accent) || '#6B7280';
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
};
