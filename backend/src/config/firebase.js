const fs = require('fs');
const admin = require('firebase-admin');
const config = require('./env');

function obtenerCredenciales() {
  const { serviceAccountBase64, serviceAccountPath, projectId, clientEmail, privateKey } = config.firebase;

  if (serviceAccountBase64) {
    const contenido = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
    return admin.credential.cert(contenido);
  }

  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const contenido = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    return admin.credential.cert(contenido);
  }

  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  throw new Error(
    'No se encontraron credenciales de Firebase. Configura FIREBASE_SERVICE_ACCOUNT_PATH ' +
      '(archivo JSON existente) o FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en backend/.env'
  );
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: obtenerCredenciales() });
}

const db = admin.firestore();

module.exports = {
  admin,
  db,
  quejasRef: db.collection(config.firebase.coleccionQuejas),
  imagenesRef: db.collection(config.firebase.coleccionImagenes),
  capturasRef: db.collection(config.firebase.coleccionCapturas)
};
