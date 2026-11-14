const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const config = require('../config/env');
const { admin, db, quejasRef, imagenesRef } = require('../config/firebase');
const HttpError = require('../utils/HttpError');
const { validarQueja, esIdValido } = require('../utils/validaciones');

const EXTENSIONES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
// Firestore admite documentos de hasta 1 MiB; dejamos margen para la codificación Base64.
const MAX_BYTES_NUBE = 700 * 1024;

function generarId(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  const sufijo = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `QJ-${y}${m}${d}-${sufijo}`;
}

async function generarIdUnico(fecha) {
  for (let intento = 0; intento < 5; intento++) {
    const id = generarId(fecha);
    const existente = await quejasRef.doc(id).get();
    if (!existente.exists) return id;
  }
  throw new Error('No fue posible generar un ID de seguimiento único.');
}

// Genera una versión optimizada en JPEG para guardarla en la nube (Firestore, Base64).
async function optimizarParaNube(buffer) {
  for (const [lado, calidad] of [[1280, 75], [1024, 65], [800, 55], [640, 45]]) {
    const salida = await sharp(buffer)
      .rotate()
      .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: calidad, mozjpeg: true })
      .toBuffer();
    if (salida.length <= MAX_BYTES_NUBE) return salida;
  }
  throw new HttpError(400, 'La fotografía no pudo optimizarse para su almacenamiento. Intenta con otra imagen.');
}

function urlBase(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function aDto(doc, req) {
  const q = doc.data();
  const base = urlBase(req);
  return {
    id: doc.id,
    nombre: q.nombre,
    anonimo: q.anonimo,
    categoria: q.categoria,
    descripcion: q.descripcion,
    ubicacion: q.ubicacion,
    estado: q.estado,
    fechaRegistro: q.fechaRegistro.toDate().toISOString(),
    imagenUrl: `${base}/api/quejas/${doc.id}/imagen`,
    fotoLocalUrl: q.foto ? `${base}/uploads/${encodeURIComponent(q.foto.archivo)}` : null,
    capturaUrl: q.captura ? `${base}/capturas/${encodeURIComponent(q.captura.archivo)}` : null
  };
}

function inicioDelDia(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function calcularMetricas(quejas) {
  const ahora = new Date();
  const hoy = inicioDelDia(ahora).getTime();
  const hace7 = hoy - 6 * 24 * 60 * 60 * 1000;

  const porCategoria = Object.fromEntries(config.categorias.map((c) => [c, 0]));
  let registradasHoy = 0;
  let ultimos7Dias = 0;
  let anonimas = 0;
  let conCaptura = 0;

  for (const q of quejas) {
    const t = new Date(q.fechaRegistro).getTime();
    porCategoria[q.categoria] = (porCategoria[q.categoria] || 0) + 1;
    if (t >= hoy) registradasHoy++;
    if (t >= hace7) ultimos7Dias++;
    if (q.anonimo) anonimas++;
    if (q.capturaUrl) conCaptura++;
  }

  return { total: quejas.length, registradasHoy, ultimos7Dias, anonimas, conCaptura, porCategoria };
}

function parsearFecha(valor, campo) {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new HttpError(400, `El parámetro "${campo}" no es una fecha válida.`);
  }
  return fecha;
}

function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// POST /api/quejas
async function crearQueja(req, res) {
  const { errores, datos } = validarQueja(req.body, req.file);
  if (errores.length) {
    throw new HttpError(400, 'La queja contiene datos inválidos.', errores);
  }

  let metadatos;
  try {
    metadatos = await sharp(req.file.buffer).metadata();
  } catch {
    throw new HttpError(400, 'La fotografía está dañada o no es una imagen válida.');
  }
  if (!metadatos.width || !metadatos.height) {
    throw new HttpError(400, 'La fotografía está dañada o no es una imagen válida.');
  }

  const versionNube = await optimizarParaNube(req.file.buffer);

  const fecha = new Date();
  const id = await generarIdUnico(fecha);
  const nombreArchivo = `${id}${EXTENSIONES[req.file.mimetype]}`;
  const rutaLocal = path.join(config.uploadsDir, nombreArchivo);

  await fs.mkdir(config.uploadsDir, { recursive: true });
  await fs.writeFile(rutaLocal, req.file.buffer);

  const registro = {
    nombre: datos.nombre || 'Anónimo',
    anonimo: !datos.nombre,
    categoria: datos.categoria,
    descripcion: datos.descripcion,
    ubicacion: datos.ubicacion,
    estado: 'Recibida',
    fechaRegistro: admin.firestore.Timestamp.fromDate(fecha),
    foto: {
      archivo: nombreArchivo,
      nombreOriginal: req.file.originalname,
      mimetype: req.file.mimetype,
      tamanoBytes: req.file.size,
      ancho: metadatos.width,
      alto: metadatos.height
    },
    captura: null
  };

  try {
    const lote = db.batch();
    lote.set(quejasRef.doc(id), registro);
    lote.set(imagenesRef.doc(id), {
      quejaId: id,
      mimetype: 'image/jpeg',
      tamanoBytes: versionNube.length,
      base64: versionNube.toString('base64')
    });
    await lote.commit();
  } catch (error) {
    // Si Firebase falla, se revierte el archivo local para no dejar registros incompletos.
    await fs.unlink(rutaLocal).catch(() => {});
    throw error;
  }

  res.status(201).json({
    ok: true,
    mensaje: 'Queja registrada correctamente.',
    id,
    fechaRegistro: fecha.toISOString(),
    queja: {
      id,
      nombre: registro.nombre,
      categoria: registro.categoria,
      descripcion: registro.descripcion,
      ubicacion: registro.ubicacion,
      estado: registro.estado
    }
  });
}

// GET /api/quejas
async function listarQuejas(req, res) {
  const categoria = typeof req.query.categoria === 'string' ? req.query.categoria.trim() : '';
  const busqueda = typeof req.query.q === 'string' ? normalizar(req.query.q.trim()) : '';
  const desde = parsearFecha(req.query.desde, 'desde');
  const hasta = parsearFecha(req.query.hasta, 'hasta');

  if (categoria && !config.categorias.includes(categoria)) {
    throw new HttpError(400, 'La categoría del filtro no es válida.');
  }
  if (desde && hasta && desde > hasta) {
    throw new HttpError(400, 'La fecha "desde" no puede ser posterior a la fecha "hasta".');
  }

  const snapshot = await quejasRef.orderBy('fechaRegistro', 'desc').get();
  const todas = snapshot.docs.map((doc) => aDto(doc, req));

  const filtradas = todas.filter((q) => {
    const fecha = new Date(q.fechaRegistro);
    if (categoria && q.categoria !== categoria) return false;
    if (desde && fecha < desde) return false;
    if (hasta && fecha > hasta) return false;
    if (busqueda) {
      const texto = normalizar(`${q.id} ${q.nombre} ${q.categoria} ${q.descripcion} ${q.ubicacion}`);
      if (!texto.includes(busqueda)) return false;
    }
    return true;
  });

  res.json({
    ok: true,
    metricas: calcularMetricas(todas),
    totalFiltrado: filtradas.length,
    quejas: filtradas
  });
}

// GET /api/quejas/:id
async function obtenerQueja(req, res) {
  const { id } = req.params;
  if (!esIdValido(id)) throw new HttpError(400, 'El ID de seguimiento no tiene un formato válido.');

  const doc = await quejasRef.doc(id).get();
  if (!doc.exists) throw new HttpError(404, `No existe una queja con el ID ${id}.`);

  res.json({ ok: true, queja: aDto(doc, req) });
}

// GET /api/quejas/:id/imagen  -> sirve la fotografía almacenada en Firebase
async function obtenerImagen(req, res) {
  const { id } = req.params;
  if (!esIdValido(id)) throw new HttpError(400, 'El ID de seguimiento no tiene un formato válido.');

  const doc = await imagenesRef.doc(id).get();
  if (!doc.exists) throw new HttpError(404, `No existe una fotografía para la queja ${id}.`);

  const { base64, mimetype } = doc.data();
  const buffer = Buffer.from(base64, 'base64');
  res.set('Content-Type', mimetype);
  res.set('Content-Length', buffer.length);
  res.set('Cache-Control', 'public, max-age=86400, immutable');
  res.send(buffer);
}

module.exports = { crearQueja, listarQuejas, obtenerQueja, obtenerImagen };
