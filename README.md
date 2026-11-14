# Sistema de Atención de Quejas Ciudadanas

Examen final — Desarrollo y Diseño Web.

Flujo: **Ciudadano → Frontend → API (Express) → Firebase Firestore + carpetas locales → API → Panel de Administración**

## Sitio publicado

| Componente | URL |
|---|---|
| Portal ciudadano | https://cindyruano.github.io/quejas-ciudadanas/ |
| Panel de administración | https://cindyruano.github.io/quejas-ciudadanas/admin.html |
| API (Render) | https://quejas-ciudadanas.onrender.com/api/health |

- El frontend se publica en **GitHub Pages** desde la rama `gh-pages` (contenido de `/frontend`): `git subtree push --prefix frontend origin gh-pages`.
- El backend se publica en **Render** (plan gratuito) con el Blueprint `render.yaml`. La credencial de Firebase se configura en Render como la variable secreta `FIREBASE_SERVICE_ACCOUNT_BASE64`.
- El plan gratuito de Render suspende el servicio tras 15 min sin uso: la primera petición puede tardar ~50 s mientras despierta. Su disco es temporal, por lo que `/uploads` y `/capturas` se reinician con cada despliegue; la información permanente vive en Firestore.

## Estructura del proyecto

```
Examen Desarrollo Web/
├── .vscode/
│   └── settings.json              # Live Server: raíz /frontend, puerto 5500, ignora /backend
├── backend/
│   ├── package.json
│   ├── .env.example               # Plantilla de variables de entorno
│   ├── .env                       # Tu configuración real (no se versiona)
│   ├── firebase-service-account.json   # Clave privada de Firebase (no se versiona)
│   ├── uploads/                   # Fotografías originales recibidas
│   ├── capturas/                  # Capturas PNG de cada comprobante
│   └── src/
│       ├── server.js              # Arranque de Express, CORS, helmet, rutas, estáticos
│       ├── config/
│       │   ├── env.js             # Lectura y validación de .env
│       │   └── firebase.js        # Inicialización de Firebase Admin / Firestore
│       ├── routes/
│       │   ├── quejas.routes.js
│       │   └── capturas.routes.js
│       ├── controllers/
│       │   ├── quejas.controller.js
│       │   └── capturas.controller.js
│       ├── middlewares/
│       │   ├── upload.js          # Multer (memoria) + filtros de tipo/tamaño
│       │   └── errorHandler.js    # 404 y manejo central de errores 400/500
│       └── utils/
│           ├── HttpError.js
│           ├── asyncHandler.js
│           └── validaciones.js
└── frontend/
    ├── index.html                 # Pantalla A: Portal ciudadano
    ├── admin.html                 # Pantalla B: Panel municipal
    ├── css/styles.css
    └── js/
        ├── config.js              # URL de la API
        ├── api.js                 # Cliente fetch compartido + utilidades
        ├── index.js               # Lógica del formulario, previsualización y captura
        └── admin.js               # Dashboard, métricas, filtros y detalle
```

## Endpoints de la API

| Método | Ruta                     | Descripción                                                                                                                                                                                        |
|--------|--------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| GET    | `/api/health`            | Estado del servicio                                                                                                                                                                                |
| GET    | `/api/configuracion`     | Categorías, tamaño máximo y límites de validación (los consume el frontend)                                                                                                                        |
| POST   | `/api/quejas`            | `multipart/form-data`: `nombre` (opcional), `categoria`, `descripcion`, `ubicacion`, `foto`. Guarda la foto en `/uploads`, el registro y la foto optimizada en Firestore. Devuelve `201` con el ID |
| GET    | `/api/quejas`            | Lista desde Firestore + métricas. Filtros: `categoria`, `desde`, `hasta` (ISO), `q` (palabra clave)                                                                                                |
| GET    | `/api/quejas/:id`        | Detalle de una queja                                                                                                                                                                               |
| GET    | `/api/quejas/:id/imagen` | Fotografía servida desde Firestore                                                                                                                                                                 |
| POST   | `/api/capturas`          | `multipart/form-data`: `quejaId`, `captura` (PNG). Guarda en `/capturas` y la asocia en Firestore                                                                                                  |
| GET    | `/api/capturas`          | Lista los comprobantes guardados en la carpeta local                                                                                                                                               |
| GET    | `/api/quejas/:id/foto-original` | Foto original de `/uploads`; si el disco del servidor ya no la tiene, responde con la copia de Firestore                                                                                    |
| GET    | `/api/capturas/:id`      | Captura del comprobante desde `/capturas` o, si no existe en disco, la copia optimizada guardada en Firestore (colección `capturas`)                                                                |

Errores: `400` (validación, imagen dañada, tamaño excedido), `403` (origen CORS no permitido), `404` (ruta o queja inexistente), `500` (error interno). Todas las respuestas tienen la forma `{ ok, mensaje, detalles }`.

### ¿Por qué Base64 en Firestore y no Firebase Storage?
Desde octubre de 2024, los proyectos nuevos de Firebase necesitan el plan de pago **Blaze** para usar Cloud Storage. Para mantenernos en la capa gratuita (**Spark**), el backend genera una versión optimizada JPEG (< 700 KB) de cada foto y la guarda en Base64 en la colección `imagenes` de Firestore. El panel la obtiene desde Firebase con `GET /api/quejas/:id/imagen`. El archivo original se conserva en `backend/uploads/`.

## Configuración de Firebase (capa gratuita)

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google y pulsa **Crear un proyecto**.
2. Escribe un nombre (ej. `quejas-ciudadanas`), acepta las condiciones, desactiva Google Analytics (no se necesita) y crea el proyecto. Queda en el plan **Spark** (gratis).
3. En el menú lateral: **Bases de datos y almacenamiento → Firestore → Crear base de datos**.
   - Edición **Standard** → ubicación `nam5 (United States)` → **Modo de producción** → **Crear**.
   - Las reglas de producción bloquean el acceso directo de clientes; el backend usa el **Admin SDK**, que no depende de esas reglas.
4. Ve a **⚙ Configuración del proyecto → Cuentas de servicio → SDK de Firebase Admin → Generar nueva clave privada**.
5. Mueve el archivo `.json` descargado a `backend/` y renómbralo como `firebase-service-account.json`.
   > ⚠ Este archivo es una credencial: no lo compartas ni lo subas a GitHub (ya está en `.gitignore`).

## Levantar el proyecto en Visual Studio Code

Requisitos: **Node.js 18+** y la extensión **Live Server** (Ritwick Dey) en VS Code.

1. Abre la carpeta `Examen Desarrollo Web` en VS Code (**Archivo → Abrir carpeta**).
2. Abre una terminal (**Terminal → Nueva terminal**) y ejecuta:
   ```bash
   cd backend
   npm install
   copy .env.example .env      # en macOS/Linux: cp .env.example .env
   ```
3. Revisa `backend/.env`: `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json` debe apuntar a tu clave. Ahí también puedes cambiar las categorías, el tamaño máximo de foto y los orígenes CORS.
4. Inicia la API:
   ```bash
   npm run dev      # con recarga automática (nodemon)
   # o
   npm start
   ```
   Debe aparecer: `API de Quejas Ciudadanas escuchando en http://localhost:3000`.
5. Abre `frontend/index.html` en VS Code y pulsa **Go Live** (barra inferior). Se abrirá `http://127.0.0.1:5500/index.html`.
   - Panel administrativo: `http://127.0.0.1:5500/admin.html`.
   - `.vscode/settings.json` ya configura Live Server para que **no** recargue la página cuando el backend guarda fotos o capturas.
   - Si no usas Live Server: `npx http-server frontend -p 5500` desde la raíz.

## Prueba del flujo completo

1. En el portal, llena el formulario, adjunta una foto (verás la previsualización) y pulsa **Enviar queja**.
2. Aparece el comprobante con el **ID de seguimiento** (ej. `QJ-20261114-2587B3`) y, segundos después, el mensaje *“Captura guardada en el servidor”*.
3. Verifica:
   - `backend/uploads/QJ-…jpg` → fotografía original.
   - `backend/capturas/comprobante-QJ-….png` → captura del comprobante.
   - Firebase Console → Firestore → colecciones `quejas` e `imagenes`.
4. Abre el panel administrativo: verás las métricas, la gráfica por categoría y las tarjetas. Prueba el buscador, el filtro por categoría y el rango de fechas, y haz clic en una tarjeta para ver el detalle con los enlaces a la foto original y a la captura.

## Solución de problemas

| Síntoma                                                 | Causa / solución                                                                  |
|---------------------------------------------------------|-----------------------------------------------------------------------------------|
| `No se encontraron credenciales de Firebase` al iniciar | Falta `backend/firebase-service-account.json` o la ruta en `.env` es incorrecta   |
| `No se pudo conectar con el servidor` en el navegador   | El backend no está corriendo o `frontend/js/config.js` apunta a otro puerto       |
| `Origen no permitido por CORS`                          | Agrega la URL del frontend a `CORS_ORIGINS` en `.env` y reinicia el backend       |
| `EADDRINUSE :3000`                                      | Ya hay otra instancia de la API abierta; ciérrala o cambia `PORT` (y `config.js`) |
| `PERMISSION_DENIED` / `NOT_FOUND` de Firestore          | La base de datos Firestore no se creó en el proyecto de la clave descargada       |
