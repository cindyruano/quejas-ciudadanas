// Cliente HTTP compartido por ambas pantallas.
const Api = (() => {
  const base = window.APP_CONFIG.API_URL.replace(/\/$/, '');

  async function solicitar(ruta, opciones = {}) {
    let respuesta;
    try {
      respuesta = await fetch(`${base}${ruta}`, opciones);
    } catch {
      throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.');
    }

    let cuerpo = null;
    try {
      cuerpo = await respuesta.json();
    } catch {
      cuerpo = null;
    }

    if (!respuesta.ok) {
      const error = new Error(cuerpo?.mensaje || `Error HTTP ${respuesta.status}`);
      error.status = respuesta.status;
      error.detalles = cuerpo?.detalles || [];
      throw error;
    }
    return cuerpo;
  }

  return {
    obtenerConfiguracion: () => solicitar('/api/configuracion'),
    crearQueja: (formData) => solicitar('/api/quejas', { method: 'POST', body: formData }),
    listarQuejas: (filtros) => {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([clave, valor]) => {
        if (valor) params.append(clave, valor);
      });
      const qs = params.toString();
      return solicitar(`/api/quejas${qs ? `?${qs}` : ''}`);
    },
    guardarCaptura: (quejaId, blob) => {
      const formData = new FormData();
      formData.append('quejaId', quejaId);
      formData.append('captura', blob, `comprobante-${quejaId}.png`);
      return solicitar('/api/capturas', { method: 'POST', body: formData });
    }
  };
})();

function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatearFecha(iso) {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}
