const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const ROOT_DIR = path.resolve(__dirname, '..', '..');

function lista(valor) {
  return (valor || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const config = {
  rootDir: ROOT_DIR,
  port: Number(process.env.PORT) || 3000,
  corsOrigins: lista(process.env.CORS_ORIGINS),
  maxFileMb: Number(process.env.MAX_FILE_MB) || 5,
  categorias: lista(process.env.CATEGORIAS),
  uploadsDir: path.join(ROOT_DIR, 'uploads'),
  capturasDir: path.join(ROOT_DIR, 'capturas'),
  firebase: {
    serviceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '',
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? path.resolve(ROOT_DIR, process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    coleccionQuejas: process.env.FIRESTORE_COLLECTION_QUEJAS || 'quejas',
    coleccionImagenes: process.env.FIRESTORE_COLLECTION_IMAGENES || 'imagenes'
  }
};

if (config.categorias.length === 0) {
  throw new Error('La variable CATEGORIAS del archivo .env está vacía. Define al menos una categoría.');
}

module.exports = config;
