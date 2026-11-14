const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
require('./config/firebase'); // Inicializa Firebase al arrancar (falla rápido si faltan credenciales)

const quejasRoutes = require('./routes/quejas.routes');
const capturasRoutes = require('./routes/capturas.routes');
const { noEncontrado, manejadorErrores } = require('./middlewares/errorHandler');
const HttpError = require('./utils/HttpError');
const { LIMITES } = require('./utils/validaciones');

for (const carpeta of [config.uploadsDir, config.capturasDir]) {
  fs.mkdirSync(carpeta, { recursive: true });
}

const app = express();
// Necesario detrás del proxy HTTPS del hosting para que req.protocol sea "https"
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      // Peticiones sin origen (curl, Postman) o con un origen permitido en .env
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(new HttpError(403, `Origen no permitido por CORS: ${origin}`));
    }
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.use('/uploads', express.static(config.uploadsDir));
app.use('/capturas', express.static(config.capturasDir));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, servicio: 'API de Quejas Ciudadanas', fecha: new Date().toISOString() });
});

// Configuración que consume el frontend (evita valores fijos en el cliente)
app.get('/api/configuracion', (req, res) => {
  res.json({
    ok: true,
    categorias: config.categorias,
    maxFileMb: config.maxFileMb,
    formatosPermitidos: ['image/jpeg', 'image/png', 'image/webp'],
    limites: LIMITES
  });
});

app.use('/api/quejas', quejasRoutes);
app.use('/api/capturas', capturasRoutes);

app.use(noEncontrado);
app.use(manejadorErrores);

app.listen(config.port, () => {
  console.log(`API de Quejas Ciudadanas escuchando en http://localhost:${config.port}`);
  console.log(`Orígenes CORS permitidos: ${config.corsOrigins.join(', ') || '(ninguno)'}`);
});
