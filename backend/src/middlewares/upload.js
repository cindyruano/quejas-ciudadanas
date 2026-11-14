const multer = require('multer');
const config = require('../config/env');
const HttpError = require('../utils/HttpError');
const { MIME_PERMITIDOS } = require('../utils/validaciones');

// Los archivos se reciben en memoria y solo se escriben en disco
// después de validar todos los campos, así no quedan archivos huérfanos.
const almacenamiento = multer.memoryStorage();

const uploadFoto = multer({
  storage: almacenamiento,
  limits: { fileSize: config.maxFileMb * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!MIME_PERMITIDOS.includes(file.mimetype)) {
      return cb(new HttpError(400, 'Formato de imagen no permitido. Usa JPG, PNG o WEBP.'));
    }
    cb(null, true);
  }
}).single('foto');

const uploadCaptura = multer({
  storage: almacenamiento,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'image/png') {
      return cb(new HttpError(400, 'La captura debe enviarse en formato PNG.'));
    }
    cb(null, true);
  }
}).single('captura');

module.exports = { uploadFoto, uploadCaptura };
