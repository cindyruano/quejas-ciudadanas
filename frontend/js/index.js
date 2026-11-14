(() => {
  const form = document.getElementById('form-queja');
  const campos = {
    nombre: document.getElementById('nombre'),
    categoria: document.getElementById('categoria'),
    ubicacion: document.getElementById('ubicacion'),
    descripcion: document.getElementById('descripcion'),
    foto: document.getElementById('foto')
  };
  const zonaFoto = document.getElementById('zona-foto');
  const fotoVacia = document.getElementById('foto-vacia');
  const fotoPreview = document.getElementById('foto-preview');
  const imgPreview = document.getElementById('img-preview');
  const infoFoto = document.getElementById('info-foto');
  const contadorDescripcion = document.getElementById('contador-descripcion');
  const btnEnviar = document.getElementById('btn-enviar');
  const alerta = document.getElementById('alerta');

  let reglas = null; // Se cargan desde la API (/api/configuracion)
  let archivoFoto = null;
  let urlPreview = null;

  // ---------------- Utilidades de interfaz ----------------
  function mostrarAlerta(mensaje, tipo = 'error', detalles = []) {
    const estilos = {
      error: 'bg-red-50 text-red-800 border border-red-200',
      exito: 'bg-green-50 text-green-800 border border-green-200'
    };
    alerta.className = `mb-4 rounded-lg px-4 py-3 text-sm ${estilos[tipo]}`;
    alerta.innerHTML =
      `<p class="font-semibold">${escaparHtml(mensaje)}</p>` +
      (detalles.length ? `<ul class="list-disc ml-5 mt-1">${detalles.map((d) => `<li>${escaparHtml(d)}</li>`).join('')}</ul>` : '');
    alerta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function ocultarAlerta() {
    alerta.className = 'hidden';
    alerta.innerHTML = '';
  }

  function marcarError(campo, mensaje) {
    const contenedor = campo === 'foto' ? zonaFoto : campos[campo];
    contenedor.classList.toggle('invalido', Boolean(mensaje));
    document.querySelector(`[data-error-para="${campo}"]`).textContent = mensaje || '';
  }

  function cambiarEstadoEnvio(enviando) {
    btnEnviar.disabled = enviando;
    document.getElementById('btn-enviar-spinner').classList.toggle('hidden', !enviando);
    document.getElementById('btn-enviar-texto').textContent = enviando ? 'Enviando…' : 'Enviar queja';
  }

  function actualizarContador() {
    if (!reglas) return;
    const largo = campos.descripcion.value.trim().length;
    contadorDescripcion.textContent = `${largo} / ${reglas.limites.descripcionMax}`;
  }

  // ---------------- Carga de configuración ----------------
  async function cargarConfiguracion() {
    try {
      reglas = await Api.obtenerConfiguracion();
      campos.categoria.innerHTML =
        '<option value="">Selecciona una categoría</option>' +
        reglas.categorias.map((c) => `<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`).join('');
      campos.categoria.disabled = false;
      campos.foto.accept = reglas.formatosPermitidos.join(',');
      document.getElementById('texto-formatos').textContent = `JPG, PNG o WEBP · máximo ${reglas.maxFileMb} MB`;
      campos.nombre.maxLength = reglas.limites.nombreMax;
      campos.descripcion.maxLength = reglas.limites.descripcionMax;
      campos.ubicacion.maxLength = reglas.limites.ubicacionMax;
      actualizarContador();
    } catch (error) {
      campos.categoria.innerHTML = '<option value="">No disponible</option>';
      btnEnviar.disabled = true;
      mostrarAlerta(error.message);
    }
  }

  // ---------------- Fotografía ----------------
  function validarArchivo(archivo) {
    if (!archivo) return 'La fotografía es obligatoria.';
    if (!reglas.formatosPermitidos.includes(archivo.type)) return 'Formato no permitido. Usa JPG, PNG o WEBP.';
    if (archivo.size === 0) return 'El archivo está vacío.';
    if (archivo.size > reglas.maxFileMb * 1024 * 1024) return `La imagen excede el máximo de ${reglas.maxFileMb} MB.`;
    return '';
  }

  function quitarFoto() {
    archivoFoto = null;
    campos.foto.value = '';
    if (urlPreview) URL.revokeObjectURL(urlPreview);
    urlPreview = null;
    imgPreview.removeAttribute('src');
    fotoPreview.classList.add('hidden');
    fotoVacia.classList.remove('hidden');
  }

  function seleccionarFoto(archivo) {
    if (!reglas) return;
    const error = validarArchivo(archivo);
    if (error) {
      quitarFoto();
      marcarError('foto', error);
      return;
    }
    // Verifica que la imagen realmente pueda decodificarse antes de aceptarla
    const url = URL.createObjectURL(archivo);
    const prueba = new Image();
    prueba.onload = () => {
      if (urlPreview) URL.revokeObjectURL(urlPreview);
      archivoFoto = archivo;
      urlPreview = url;
      imgPreview.src = url;
      infoFoto.textContent = `${archivo.name} · ${(archivo.size / 1024).toFixed(0)} KB · ${prueba.naturalWidth}×${prueba.naturalHeight}px`;
      fotoVacia.classList.add('hidden');
      fotoPreview.classList.remove('hidden');
      marcarError('foto', '');
    };
    prueba.onerror = () => {
      URL.revokeObjectURL(url);
      quitarFoto();
      marcarError('foto', 'La imagen está dañada o no puede leerse.');
    };
    prueba.src = url;
  }

  campos.foto.addEventListener('change', () => seleccionarFoto(campos.foto.files[0]));

  document.getElementById('btn-quitar-foto').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    quitarFoto();
  });

  ['dragenter', 'dragover'].forEach((evento) =>
    zonaFoto.addEventListener(evento, (e) => {
      e.preventDefault();
      zonaFoto.classList.add('arrastrando');
    })
  );
  ['dragleave', 'drop'].forEach((evento) =>
    zonaFoto.addEventListener(evento, (e) => {
      e.preventDefault();
      zonaFoto.classList.remove('arrastrando');
    })
  );
  zonaFoto.addEventListener('drop', (e) => seleccionarFoto(e.dataTransfer.files[0]));

  // ---------------- Validación del formulario ----------------
  function validarFormulario() {
    const { limites } = reglas;
    const valores = {
      nombre: campos.nombre.value.trim(),
      categoria: campos.categoria.value,
      ubicacion: campos.ubicacion.value.trim(),
      descripcion: campos.descripcion.value.trim()
    };
    const errores = {
      nombre: valores.nombre.length > limites.nombreMax ? `Máximo ${limites.nombreMax} caracteres.` : '',
      categoria: valores.categoria ? '' : 'Selecciona una categoría.',
      ubicacion: !valores.ubicacion
        ? 'La ubicación es obligatoria.'
        : valores.ubicacion.length < limites.ubicacionMin
          ? `Escribe al menos ${limites.ubicacionMin} caracteres.`
          : '',
      descripcion: !valores.descripcion
        ? 'La descripción es obligatoria.'
        : valores.descripcion.length < limites.descripcionMin
          ? `Describe el problema con al menos ${limites.descripcionMin} caracteres.`
          : '',
      foto: validarArchivo(archivoFoto)
    };
    Object.entries(errores).forEach(([campo, mensaje]) => marcarError(campo, mensaje));
    return { valido: Object.values(errores).every((m) => !m), valores };
  }

  ['nombre', 'categoria', 'ubicacion', 'descripcion'].forEach((campo) =>
    campos[campo].addEventListener('input', () => {
      marcarError(campo, '');
      if (campo === 'descripcion') actualizarContador();
    })
  );

  // ---------------- Captura del comprobante ----------------
  async function capturarComprobante(quejaId) {
    const estado = document.getElementById('estado-captura');
    estado.textContent = 'Generando captura del comprobante…';
    try {
      await document.getElementById('comp-foto').decode();
      const lienzo = await html2canvas(document.getElementById('comprobante'), {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      });
      const blob = await new Promise((resolve, reject) =>
        lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))), 'image/png')
      );
      const resultado = await Api.guardarCaptura(quejaId, blob);
      estado.innerHTML = `✔ Captura guardada en el servidor: <span class="font-mono">${escaparHtml(resultado.archivo)}</span>`;
      estado.className = 'text-sm text-green-700';
    } catch (error) {
      estado.textContent = `No se pudo guardar la captura del comprobante: ${error.message}`;
      estado.className = 'text-sm text-amber-700';
    }
  }

  function mostrarConfirmacion(respuesta) {
    const { queja, fechaRegistro } = respuesta;
    document.getElementById('comp-id').textContent = queja.id;
    document.getElementById('comp-fecha').textContent = formatearFecha(fechaRegistro);
    document.getElementById('comp-nombre').textContent = queja.nombre;
    document.getElementById('comp-categoria').textContent = queja.categoria;
    document.getElementById('comp-ubicacion').textContent = queja.ubicacion;
    document.getElementById('comp-estado').textContent = queja.estado;
    document.getElementById('comp-descripcion').textContent = queja.descripcion;
    document.getElementById('comp-foto').src = urlPreview;

    document.getElementById('estado-captura').className = 'text-sm text-slate-600';
    document.getElementById('seccion-formulario').classList.add('hidden');
    document.getElementById('seccion-confirmacion').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------------- Envío ----------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarAlerta();
    if (!reglas) return;

    const { valido, valores } = validarFormulario();
    if (!valido) {
      mostrarAlerta('Revisa los campos marcados antes de enviar.');
      return;
    }

    const datos = new FormData();
    datos.append('nombre', valores.nombre);
    datos.append('categoria', valores.categoria);
    datos.append('ubicacion', valores.ubicacion);
    datos.append('descripcion', valores.descripcion);
    datos.append('foto', archivoFoto, archivoFoto.name);

    cambiarEstadoEnvio(true);
    try {
      const respuesta = await Api.crearQueja(datos);
      mostrarConfirmacion(respuesta);
      // Espera a que el navegador pinte el comprobante antes de capturarlo
      requestAnimationFrame(() => setTimeout(() => capturarComprobante(respuesta.id), 300));
    } catch (error) {
      mostrarAlerta(error.message, 'error', error.detalles);
    } finally {
      cambiarEstadoEnvio(false);
    }
  });

  document.getElementById('btn-nueva').addEventListener('click', () => {
    form.reset();
    quitarFoto();
    Object.keys(campos).forEach((c) => marcarError(c, ''));
    actualizarContador();
    ocultarAlerta();
    document.getElementById('seccion-confirmacion').classList.add('hidden');
    document.getElementById('seccion-formulario').classList.remove('hidden');
  });

  cargarConfiguracion();
})();
