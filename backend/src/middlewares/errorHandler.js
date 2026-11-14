const multer = require('multer');
const config = require('../config/env');
const HttpError = require('../utils/HttpError');

function noEncontrado(req, res, next) {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const mensajes = {
      LIMIT_FILE_SIZE: `El archivo excede el tamaño máximo permitido (${config.maxFileMb} MB).`,
      LIMIT_FILE_COUNT: 'Solo se permite un archivo por solicitud.',
      LIMIT_UNEXPECTED_FILE: 'Se recibió un campo de archivo inesperado.'
    };
    return res.status(400).json({ ok: false, mensaje: mensajes[err.code] || err.message, detalles: [] });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, mensaje: 'El cuerpo de la solicitud no es JSON válido.', detalles: [] });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ ok: false, mensaje: err.message, detalles: err.detalles });
  }

  console.error('[ERROR 500]', err);
  return res.status(500).json({
    ok: false,
    mensaje: 'Ocurrió un error interno en el servidor. Intenta nuevamente más tarde.',
    detalles: []
  });
}

module.exports = { noEncontrado, manejadorErrores };
