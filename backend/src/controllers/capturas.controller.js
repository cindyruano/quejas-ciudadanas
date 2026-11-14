const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const config = require('../config/env');
const { admin, db, quejasRef, capturasRef } = require('../config/firebase');
const HttpError = require('../utils/HttpError');
const { esIdValido } = require('../utils/validaciones');
const { enviarImagenNube } = require('./quejas.controller');

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Firestore admite documentos de hasta 1 MiB; dejamos margen para la codificación Base64.
const MAX_BYTES_NUBE = 700 * 1024;

function nombreArchivoCaptura(quejaId) {
  return `comprobante-${quejaId}.png`;
}

// Copia de la captura para Firestore: PNG optimizado y, si aún es grande, JPEG reducido.
async function optimizarCaptura(buffer) {
  const png = await sharp(buffer)
    .resize({ width: 1400, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  if (png.length <= MAX_BYTES_NUBE) return { buffer: png, mimetype: 'image/png' };

  for (const [ancho, calidad] of [[1400, 75], [1100, 65], [900, 55]]) {
    const jpeg = await sharp(buffer)
      .resize({ width: ancho, withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: calidad, mozjpeg: true })
      .toBuffer();
    if (jpeg.length <= MAX_BYTES_NUBE) return { buffer: jpeg, mimetype: 'image/jpeg' };
  }
  throw new HttpError(400, 'La captura es demasiado grande para almacenarse.');
}

// POST /api/capturas
async function guardarCaptura(req, res) {
  const quejaId = typeof req.body.quejaId === 'string' ? req.body.quejaId.trim() : '';

  if (!esIdValido(quejaId)) {
    throw new HttpError(400, 'Se requiere un ID de queja válido para asociar la captura.');
  }
  if (!req.file) {
    throw new HttpError(400, 'No se recibió la imagen de la captura (campo "captura").');
  }
  if (req.file.size < FIRMA_PNG.length || !req.file.buffer.subarray(0, 8).equals(FIRMA_PNG)) {
    throw new HttpError(400, 'La captura recibida está dañada o no es un PNG válido.');
  }

  const referencia = quejasRef.doc(quejaId);
  const doc = await referencia.get();
  if (!doc.exists) {
    throw new HttpError(404, `No existe una queja con el ID ${quejaId}.`);
  }

  let versionNube;
  try {
    versionNube = await optimizarCaptura(req.file.buffer);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'La captura recibida está dañada o no es un PNG válido.');
  }

  const nombreArchivo = nombreArchivoCaptura(quejaId);
  await fs.mkdir(config.capturasDir, { recursive: true });
  await fs.writeFile(path.join(config.capturasDir, nombreArchivo), req.file.buffer);

  const fecha = new Date();
  const lote = db.batch();
  lote.update(referencia, {
    captura: {
      archivo: nombreArchivo,
      tamanoBytes: req.file.size,
      fecha: admin.firestore.Timestamp.fromDate(fecha)
    }
  });
  lote.set(capturasRef.doc(quejaId), {
    quejaId,
    mimetype: versionNube.mimetype,
    tamanoBytes: versionNube.buffer.length,
    base64: versionNube.buffer.toString('base64')
  });
  await lote.commit();

  res.status(201).json({
    ok: true,
    mensaje: 'Captura del comprobante guardada correctamente.',
    quejaId,
    archivo: nombreArchivo,
    url: `${req.protocol}://${req.get('host')}/api/capturas/${quejaId}`,
    fecha: fecha.toISOString()
  });
}

// GET /api/capturas/:id -> archivo de /capturas o, si no está en disco, la copia de Firebase
async function obtenerCaptura(req, res) {
  const { id } = req.params;
  if (!esIdValido(id)) throw new HttpError(400, 'El ID de seguimiento no tiene un formato válido.');

  const rutaLocal = path.join(config.capturasDir, nombreArchivoCaptura(id));
  try {
    await fs.access(rutaLocal);
    return res.type('image/png').sendFile(rutaLocal);
  } catch {
    const doc = await capturasRef.doc(id).get();
    if (!doc.exists) throw new HttpError(404, `No existe una captura de comprobante para la queja ${id}.`);
    enviarImagenNube(res, doc.data());
  }
}

// GET /api/capturas -> lista los comprobantes guardados en la carpeta local
async function listarCapturas(req, res) {
  await fs.mkdir(config.capturasDir, { recursive: true });
  const archivos = (await fs.readdir(config.capturasDir)).filter((a) => a.endsWith('.png'));

  const capturas = await Promise.all(
    archivos.map(async (archivo) => {
      const info = await fs.stat(path.join(config.capturasDir, archivo));
      return {
        archivo,
        tamanoBytes: info.size,
        fecha: info.mtime.toISOString(),
        url: `${req.protocol}://${req.get('host')}/capturas/${encodeURIComponent(archivo)}`
      };
    })
  );

  capturas.sort((a, b) => b.fecha.localeCompare(a.fecha));
  res.json({ ok: true, total: capturas.length, capturas });
}

module.exports = { guardarCaptura, obtenerCaptura, listarCapturas };
