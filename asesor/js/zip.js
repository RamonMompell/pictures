/* =====================================================================
   ÁBACO — zip.js
   Generador ZIP mínimo (modo "store", sin compresión) y sin dependencias.
   Permite empaquetar el CSV + los archivos para entregar al asesor.
   ===================================================================== */

const Zip = {
    _crcTable: null,

    _makeCrcTable() {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c >>> 0;
        }
        return table;
    },

    crc32(bytes) {
        if (!this._crcTable) this._crcTable = this._makeCrcTable();
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            crc = (crc >>> 8) ^ this._crcTable[(crc ^ bytes[i]) & 0xFF];
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    },

    _strBytes(str) { return new TextEncoder().encode(str); },

    /* files: [{ name, data:Uint8Array }]  ->  Blob (application/zip) */
    async build(files) {
        const chunks = [];
        const central = [];
        let offset = 0;

        const writeU16 = (n) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };
        const writeU32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; };

        for (const f of files) {
            const nameBytes = this._strBytes(f.name);
            const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
            const crc = this.crc32(data);

            // Local file header
            const local = [
                writeU32(0x04034b50), writeU16(20), writeU16(0), writeU16(0),
                writeU16(0), writeU16(0),                 // time, date (0)
                writeU32(crc), writeU32(data.length), writeU32(data.length),
                writeU16(nameBytes.length), writeU16(0),
                nameBytes, data
            ];
            const localBytes = this._concat(local);
            chunks.push(localBytes);

            // Central directory record
            const cdr = [
                writeU32(0x02014b50), writeU16(20), writeU16(20), writeU16(0), writeU16(0),
                writeU16(0), writeU16(0),
                writeU32(crc), writeU32(data.length), writeU32(data.length),
                writeU16(nameBytes.length), writeU16(0), writeU16(0),
                writeU16(0), writeU16(0), writeU32(0),
                writeU32(offset),
                nameBytes
            ];
            central.push(this._concat(cdr));
            offset += localBytes.length;
        }

        const centralBytes = this._concat(central);
        const centralOffset = offset;

        const end = this._concat([
            writeU32(0x06054b50), writeU16(0), writeU16(0),
            writeU16(files.length), writeU16(files.length),
            writeU32(centralBytes.length), writeU32(centralOffset), writeU16(0)
        ]);

        return new Blob([...chunks, centralBytes, end], { type: 'application/zip' });
    },

    _concat(parts) {
        let len = 0;
        for (const p of parts) len += p.length;
        const out = new Uint8Array(len);
        let o = 0;
        for (const p of parts) { out.set(p, o); o += p.length; }
        return out;
    }
};
