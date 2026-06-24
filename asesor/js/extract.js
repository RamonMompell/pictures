/* =====================================================================
   ÁBACO — extract.js
   Desglose de datos de facturas / recibos / tickets.
   1) Extracción por reglas (regex) sobre texto -> rellena el formulario.
   2) OCR opcional (Tesseract.js cargado bajo demanda desde CDN) para fotos.
   Degrada con elegancia: si no hay red u OCR, el desglose es manual.
   ===================================================================== */

const Extract = {
    _tesseractLoaded: false,

    /* ---------- Extracción por reglas sobre texto plano ---------- */
    fromText(text) {
        const out = { total: null, base: null, tax: null, taxRate: null, date: null, taxId: null, counterparty: null, currency: null };
        if (!text) return out;
        const t = ' ' + text.replace(/ /g, ' ') + ' ';

        // ---- Moneda ----
        if (/€|eur\b/i.test(t)) out.currency = 'EUR';
        else if (/aed|dhs|د\.إ/i.test(t)) out.currency = 'AED';
        else if (/\$|usd\b/i.test(t)) out.currency = 'USD';
        else if (/£|gbp\b/i.test(t)) out.currency = 'GBP';

        // ---- Identificación fiscal (NIF/CIF/VAT/Tax ID) ----
        const idMatch = t.match(/\b([A-Z]{0,2}\s?[A-Z]?\d{7,9}[A-Z]?)\b/);
        const nif = t.match(/\b([XYZ]?\d{7,8}[A-Z]|[A-HJ-NP-SUVW]\d{7}[0-9A-J])\b/);
        const vat = t.match(/\b(ES[A-Z0-9]{9}|AE\d{15}|[A-Z]{2}\d{8,12})\b/);
        out.taxId = (vat && vat[1]) || (nif && nif[1]) || (idMatch && idMatch[1]) || null;

        // ---- Fecha ----
        out.date = this._findDate(t);

        // ---- Tipo de IVA ----
        const rate = t.match(/\b(21|10|7|5|4)\s?%/);
        if (rate) out.taxRate = Number(rate[1]);

        // ---- Importes ----
        const amounts = this._findAmounts(t);
        // Total: la palabra "total" gana; si no, el mayor importe.
        // El prefijo (?:^|[^a-z]) evita confundir "Subtotal" con "Total".
        const totalLabeled = this._labeledAmount(t, /(?:^|[^a-z])(total\s*(a\s*pagar|factura)?|importe\s*total|amount\s*due|grand\s*total)/i);
        out.total = totalLabeled ?? (amounts.length ? Math.max(...amounts) : null);

        const baseLabeled = this._labeledAmount(t, /(base\s*imponible|subtotal|base|taxable)/i);
        if (baseLabeled != null) out.base = baseLabeled;

        const taxLabeled = this._labeledAmount(t, /(cuota\s*iva|i\.?v\.?a\.?|vat|impuesto|tax)/i);
        if (taxLabeled != null) out.tax = taxLabeled;

        // Derivar lo que falte
        if (out.total != null && out.base != null && out.tax == null) out.tax = +(out.total - out.base).toFixed(2);
        if (out.base != null && out.taxRate != null && out.tax == null) out.tax = +(out.base * out.taxRate / 100).toFixed(2);

        return out;
    },

    _findDate(t) {
        // dd/mm/yyyy o dd-mm-yyyy o dd.mm.yyyy
        let m = t.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
        if (m) {
            let [_, d, mo, y] = m;
            if (y.length === 2) y = '20' + y;
            return this._iso(y, mo, d);
        }
        // yyyy-mm-dd
        m = t.match(/\b(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/);
        if (m) return this._iso(m[1], m[2], m[3]);
        // "12 de mayo de 2024"
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        m = t.match(/\b(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})\b/i);
        if (m) {
            const idx = meses.indexOf(m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
            if (idx >= 0) return this._iso(m[3], idx + 1, m[1]);
        }
        return null;
    },

    _iso(y, mo, d) {
        const yy = Number(y), mm = Number(mo), dd = Number(d);
        if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
        return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    },

    /* Convierte un literal de importe (es/en) a número */
    _toNumber(str) {
        if (!str) return null;
        let s = str.replace(/[^\d.,]/g, '');
        if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
            // El último separador es el decimal
            s = (s.lastIndexOf(',') > s.lastIndexOf('.'))
                ? s.replace(/\./g, '').replace(',', '.')
                : s.replace(/,/g, '');
        } else if (s.indexOf(',') > -1) {
            s = s.replace(',', '.');
        }
        const n = parseFloat(s);
        return isNaN(n) ? null : n;
    },

    _findAmounts(t) {
        const re = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})/g;
        const res = [];
        let m;
        while ((m = re.exec(t)) !== null) {
            const n = this._toNumber(m[1]);
            if (n != null && n > 0) res.push(n);
        }
        return res;
    },

    /* Importe que aparece cerca de una etiqueta concreta */
    _labeledAmount(t, labelRe) {
        const lines = t.split(/[\n\r]+/);
        for (const line of lines) {
            if (labelRe.test(line)) {
                const nums = this._findAmounts(line);
                if (nums.length) return Math.max(...nums);
            }
        }
        // Búsqueda contigua en texto continuo
        const idx = t.search(labelRe);
        if (idx > -1) {
            const window = t.slice(idx, idx + 60);
            const nums = this._findAmounts(window);
            if (nums.length) return nums[0];
        }
        return null;
    },

    /* ---------- OCR opcional (Tesseract.js) ---------- */
    async ensureTesseract() {
        if (this._tesseractLoaded && window.Tesseract) return true;
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            s.onload = () => { this._tesseractLoaded = true; resolve(!!window.Tesseract); };
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
    },

    async ocrImage(fileOrUrl, onProgress) {
        const ok = await this.ensureTesseract();
        if (!ok || !window.Tesseract) throw new Error('OCR no disponible sin conexión');
        const { data } = await window.Tesseract.recognize(fileOrUrl, 'spa+eng', {
            logger: m => { if (onProgress && m.status === 'recognizing text') onProgress(Math.round(m.progress * 100)); }
        });
        return data.text || '';
    }
};
