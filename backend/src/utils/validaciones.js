const config = require('../config/env');

const LIMITES = {
  nombreMax: 100,
  descripcionMin: 20,
  descripcionMax: 2000,
  ubicacionMin: 5,
  ubicacionMax: 200
};

const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const ID_REGEX = /^QJ-\d{8}-[A-F0-9]{6}$/;

function limpiarTexto(valor) {
  if (typeof valor !== 'string') return '';
  return valor.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function limpiarTextoLargo(valor) {
  if (typeof valor !== 'string') return '';
  return valor.normalize('NFC').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function validarQueja(body, archivo) {
  const errores = [];

  const nombre = limpiarTexto(body.nombre);
  const categoria = limpiarTexto(body.categoria);
  const descripcion = limpiarTextoLargo(body.descripcion);
  const ubicacion = limpiarTexto(body.ubicacion);

  if (nombre.length > LIMITES.nombreMax) {
    errores.push(`El nombre no puede exceder ${LIMITES.nombreMax} caracteres.`);
  }

  if (!categoria) {
    errores.push('La categoría es obligatoria.');
  } else if (!config.categorias.includes(categoria)) {
    errores.push('La categoría seleccionada no es válida.');
  }

  if (!descripcion) {
    errores.push('La descripción es obligatoria.');
  } else if (descripcion.length < LIMITES.descripcionMin || descripcion.length > LIMITES.descripcionMax) {
    errores.push(
      `La descripción debe tener entre ${LIMITES.descripcionMin} y ${LIMITES.descripcionMax} caracteres.`
    );
  }

  if (!ubicacion) {
    errores.push('La ubicación o zona es obligatoria.');
  } else if (ubicacion.length < LIMITES.ubicacionMin || ubicacion.length > LIMITES.ubicacionMax) {
    errores.push(
      `La ubicación debe tener entre ${LIMITES.ubicacionMin} y ${LIMITES.ubicacionMax} caracteres.`
    );
  }

  if (!archivo) {
    errores.push('La fotografía es obligatoria.');
  } else if (!MIME_PERMITIDOS.includes(archivo.mimetype)) {
    errores.push('La fotografía debe ser JPG, PNG o WEBP.');
  } else if (archivo.size === 0) {
    errores.push('La fotografía está vacía.');
  }

  return {
    errores,
    datos: { nombre, categoria, descripcion, ubicacion }
  };
}

function esIdValido(id) {
  return typeof id === 'string' && ID_REGEX.test(id);
}

module.exports = { validarQueja, esIdValido, LIMITES, MIME_PERMITIDOS };
