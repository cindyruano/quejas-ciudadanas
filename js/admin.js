(() => {
  const filtros = {
    q: document.getElementById('f-busqueda'),
    categoria: document.getElementById('f-categoria'),
    desde: document.getElementById('f-desde'),
    hasta: document.getElementById('f-hasta')
  };
  const lista = document.getElementById('lista-quejas');
  const alerta = document.getElementById('alerta');
  const modal = document.getElementById('modal');

  const COLORES = ['bg-blue-600', 'bg-emerald-600', 'bg-amber-500', 'bg-rose-600', 'bg-violet-600', 'bg-cyan-600', 'bg-orange-500', 'bg-slate-500'];

  let quejasActuales = [];
  let temporizadorBusqueda = null;
  let solicitudActual = 0;

  function mostrarAlerta(mensaje) {
    alerta.className = 'rounded-lg px-4 py-3 text-sm bg-red-50 text-red-800 border border-red-200';
    alerta.textContent = mensaje;
  }

  function ocultarAlerta() {
    alerta.className = 'hidden';
  }

  // Convierte las fechas del filtro (hora local) a ISO para el backend
  function rangoFechas() {
    const desde = filtros.desde.value ? new Date(`${filtros.desde.value}T00:00:00`).toISOString() : '';
    const hasta = filtros.hasta.value ? new Date(`${filtros.hasta.value}T23:59:59.999`).toISOString() : '';
    return { desde, hasta };
  }

  function renderMetricas(m) {
    document.getElementById('m-total').textContent = m.total;
    document.getElementById('m-hoy').textContent = m.registradasHoy;
    document.getElementById('m-7dias').textContent = m.ultimos7Dias;
    document.getElementById('m-anonimas').textContent = m.anonimas;

    const entradas = Object.entries(m.porCategoria).sort((a, b) => b[1] - a[1]);
    const maximo = Math.max(1, ...entradas.map(([, n]) => n));
    document.getElementById('grafica-categorias').innerHTML = entradas
      .map(([categoria, cantidad], i) => {
        const porcentaje = m.total ? ((cantidad / m.total) * 100).toFixed(1) : '0.0';
        return `
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-slate-700">${escaparHtml(categoria)}</span>
              <span class="text-slate-500">${cantidad} · ${porcentaje}%</span>
            </div>
            <div class="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div class="barra-categoria h-full rounded-full ${COLORES[i % COLORES.length]}" style="width:${(cantidad / maximo) * 100}%"></div>
            </div>
          </div>`;
      })
      .join('');
  }

  function renderLista(quejas) {
    document.getElementById('vacio').classList.toggle('hidden', quejas.length > 0);
    lista.innerHTML = quejas
      .map(
        (q) => `
        <article class="tarjeta-queja bg-white rounded-xl shadow overflow-hidden flex flex-col cursor-pointer" data-id="${escaparHtml(q.id)}" tabindex="0">
          <img src="${escaparHtml(q.imagenUrl)}" alt="Fotografía de la queja ${escaparHtml(q.id)}" loading="lazy" class="h-48 w-full object-cover bg-slate-200" />
          <div class="p-4 flex flex-col gap-2 flex-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-semibold bg-blue-50 text-blue-800 rounded-full px-2.5 py-1">${escaparHtml(q.categoria)}</span>
              <span class="text-xs text-slate-500">${escaparHtml(q.estado)}</span>
            </div>
            <p class="font-mono text-sm font-bold text-slate-800">${escaparHtml(q.id)}</p>
            <p class="text-sm text-slate-600 texto-3-lineas">${escaparHtml(q.descripcion)}</p>
            <div class="mt-auto pt-2 text-xs text-slate-500 space-y-1">
              <p>📍 ${escaparHtml(q.ubicacion)}</p>
              <p>🕒 ${escaparHtml(formatearFecha(q.fechaRegistro))} · 👤 ${escaparHtml(q.nombre)}</p>
            </div>
          </div>
        </article>`
      )
      .join('');
  }

  function abrirDetalle(id) {
    const q = quejasActuales.find((item) => item.id === id);
    if (!q) return;
    document.getElementById('modal-titulo').textContent = q.id;
    const enlaces = [
      q.fotoLocalUrl ? `<a href="${escaparHtml(q.fotoLocalUrl)}" target="_blank" rel="noopener" class="text-blue-700 hover:underline">Foto original (carpeta /uploads)</a>` : '',
      q.capturaUrl
        ? `<a href="${escaparHtml(q.capturaUrl)}" target="_blank" rel="noopener" class="text-blue-700 hover:underline">Captura del comprobante (carpeta /capturas)</a>`
        : '<span class="text-slate-400">Sin captura de comprobante</span>'
    ].filter(Boolean);

    document.getElementById('modal-contenido').innerHTML = `
      <img src="${escaparHtml(q.imagenUrl)}" alt="Fotografía de la queja" class="w-full max-h-[50vh] object-contain bg-slate-100 rounded-lg" />
      <dl class="grid sm:grid-cols-2 gap-4 mt-5 text-sm">
        <div><dt class="text-slate-500">Categoría</dt><dd class="font-medium">${escaparHtml(q.categoria)}</dd></div>
        <div><dt class="text-slate-500">Estado</dt><dd class="font-medium">${escaparHtml(q.estado)}</dd></div>
        <div><dt class="text-slate-500">Fecha y hora del reporte</dt><dd class="font-medium">${escaparHtml(formatearFecha(q.fechaRegistro))}</dd></div>
        <div><dt class="text-slate-500">Ciudadano</dt><dd class="font-medium">${escaparHtml(q.nombre)}</dd></div>
        <div class="sm:col-span-2"><dt class="text-slate-500">Ubicación / zona</dt><dd class="font-medium">${escaparHtml(q.ubicacion)}</dd></div>
        <div class="sm:col-span-2"><dt class="text-slate-500">Descripción original</dt><dd class="whitespace-pre-line">${escaparHtml(q.descripcion)}</dd></div>
      </dl>
      <div class="flex flex-wrap gap-4 mt-5 text-sm">${enlaces.join('')}</div>`;
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function cerrarDetalle() {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  async function cargarQuejas() {
    const numero = ++solicitudActual;
    const { desde, hasta } = rangoFechas();
    document.getElementById('cargando').classList.remove('hidden');
    ocultarAlerta();

    try {
      const respuesta = await Api.listarQuejas({
        q: filtros.q.value.trim(),
        categoria: filtros.categoria.value,
        desde,
        hasta
      });
      if (numero !== solicitudActual) return; // Ignora respuestas de filtros anteriores
      quejasActuales = respuesta.quejas;
      renderMetricas(respuesta.metricas);
      renderLista(respuesta.quejas);
      document.getElementById('resumen-filtro').textContent =
        `Mostrando ${respuesta.totalFiltrado} de ${respuesta.metricas.total} quejas registradas`;
      document.getElementById('ultima-actualizacion').textContent =
        `Actualizado: ${new Date().toLocaleTimeString('es-MX')}`;
    } catch (error) {
      if (numero !== solicitudActual) return;
      mostrarAlerta(error.message);
    } finally {
      if (numero === solicitudActual) document.getElementById('cargando').classList.add('hidden');
    }
  }

  async function cargarCategorias() {
    const config = await Api.obtenerConfiguracion();
    filtros.categoria.innerHTML =
      '<option value="">Todas</option>' +
      config.categorias.map((c) => `<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`).join('');
  }

  // ---------------- Eventos ----------------
  filtros.q.addEventListener('input', () => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(cargarQuejas, 350);
  });
  [filtros.categoria, filtros.desde, filtros.hasta].forEach((el) => el.addEventListener('change', cargarQuejas));
  document.getElementById('form-filtros').addEventListener('submit', (e) => {
    e.preventDefault();
    cargarQuejas();
  });
  document.getElementById('btn-limpiar').addEventListener('click', () => {
    Object.values(filtros).forEach((el) => (el.value = ''));
    cargarQuejas();
  });
  document.getElementById('btn-actualizar').addEventListener('click', cargarQuejas);

  lista.addEventListener('click', (e) => {
    const tarjeta = e.target.closest('[data-id]');
    if (tarjeta) abrirDetalle(tarjeta.dataset.id);
  });
  lista.addEventListener('keydown', (e) => {
    const tarjeta = e.target.closest('[data-id]');
    if (tarjeta && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      abrirDetalle(tarjeta.dataset.id);
    }
  });
  document.getElementById('modal-cerrar').addEventListener('click', cerrarDetalle);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarDetalle();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarDetalle();
  });

  (async () => {
    try {
      await cargarCategorias();
    } catch (error) {
      mostrarAlerta(error.message);
    }
    cargarQuejas();
  })();
})();
