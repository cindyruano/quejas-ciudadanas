const fs = require('fs/promises');
const path = require('path');
const config = require('../config/env');
const { admin, quejasRef } = require('../config/firebase');
const HttpError = require('../utils/HttpError');
const { esIdValido } = require('../utils/validaciones');

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

  const nombreArchivo = `comprobante-${quejaId}.png`;
  const rutaLocal = path.join(config.capturasDir, nombreArchivo);

  await fs.mkdir(config.capturasDir, { recursive: true });
  await fs.writeFile(rutaLocal, req.file.buffer);

  const fecha = new Date();
  await referencia.update({
    captura: {
      archivo: nombreArchivo,
      tamanoBytes: req.file.size,
      fecha: admin.firestore.Timestamp.fromDate(fecha)
    }
  });

  res.status(201).json({
    ok: true,
    mensaje: 'Captura del comprobante guardada correctamente.',
    quejaId,
    archivo: nombreArchivo,
    url: `${req.protocol}://${req.get('host')}/capturas/${encodeURIComponent(nombreArchivo)}`,
    fecha: fecha.toISOString()
  });
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

module.exports = { guardarCaptura, listarCapturas };
