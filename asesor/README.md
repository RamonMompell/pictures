# ÁBACO · Panel de asesoría fiscal

Panel privado para centralizar la documentación fiscal de todas las entidades y
comunicarte con tu asesor: captura de facturas y recibos (foto o archivo),
clasificación automática por fecha y entidad, control de numeración correlativa
de facturas emitidas y reportes listos para la asesoría.

Es una aplicación **100 % estática** (HTML + CSS + JavaScript, sin dependencias
ni servidor). Los datos se guardan en el navegador: metadatos en `localStorage`
y los archivos (fotos / PDF) en `IndexedDB`.

## Estructura

```
asesor/
├── index.html              # Shell + todas las vistas y modales
├── manifest.webmanifest    # Instalable como app en el móvil (PWA)
├── assets/icon.svg
├── css/styles.css          # Sistema de diseño (carbón + marfil + latón)
└── js/
    ├── data.js             # Entidades semilla y taxonomías
    ├── storage.js          # Persistencia (localStorage + IndexedDB)
    ├── zip.js              # Empaquetado ZIP sin dependencias
    ├── extract.js          # Desglose de datos (regex + OCR opcional)
    ├── ui.js               # Toasts, modales, helpers
    ├── capture.js          # Captura: foto / arrastrar-soltar / desglose
    ├── documents.js        # Libro + numeración correlativa + ficha
    ├── entities.js         # Mapa de estructura societaria
    ├── reports.js          # KPIs y exportación (CSV / ZIP / copia)
    ├── integrations.js     # Holded · Revolut · tiempo real
    └── app.js              # Router + panel de inicio + eventos
```

## Cómo usarlo

Ábrelo servido como sitio estático (no con `file://`, para que funcionen los
módulos y la cámara). Por ejemplo:

```bash
cd asesor
python3 -m http.server 8080
# abre http://localhost:8080
```

## Entidades incluidas

- **España:** Dentalgram · Mompell Mico · Aliseo Dental (holding de Zyra Dental y
  sociedad operativa de Nylo Dental) · Zyra Dental · Nylo Dental.
- **Dubái (EAU):** Persona física · Genius X.
- **Estados Unidos:** Coresolutions LLC.
- **Medios de pago:** tarjeta Revolut (Alejandra).

## Flujos automatizados — qué hace falta

| Flujo | Estado | Qué necesito de ti |
|---|---|---|
| Captura de recibos/facturas recibidas | ✅ Operativo | Nada |
| Clasificación por fecha/entidad | ✅ Operativo | Nada |
| Numeración correlativa de emitidas | ✅ Operativo | Confirmar el formato de serie |
| Reportes + paquete para asesor | ✅ Operativo | Nada |
| Import de gastos de Revolut (CSV) | ✅ Operativo | Subir el CSV del extracto |
| **Holded → archivo automático de emitidas** | ⚙️ Preparado | Clave API de Holded + conector |
| **Tiempo real con el asesor** | ⚙️ Preparado | Proyecto Supabase (URL + anon key) |

### Holded (facturas emitidas automáticas)

La clave API de Holded **no puede vivir en una web pública**. El patrón previsto
es un pequeño conector (función serverless / webhook) que, al emitir una factura
en Holded, descarga su PDF y la registra aquí con su número correlativo. Para
montarlo necesito: la **clave API de Holded** y la correspondencia
**cuenta de Holded ↔ entidad**.

### Tiempo real (Supabase)

Para que el asesor lo vea en directo, crea un proyecto gratuito en Supabase y
pega la **URL** y la **anon key** en *Automatización*. Activamos la
sincronización y el asesor entra con su propio acceso. Sin esto, se comparte
mediante el botón **Paquete para asesor (ZIP)**.

> No se sube nada a internet sin tu configuración explícita: por defecto, todo
> queda en tu dispositivo.
