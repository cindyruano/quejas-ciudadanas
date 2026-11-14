// URL base de la API: en local usa el backend de la máquina; publicado usa el backend en Render.
window.APP_CONFIG = {
  API_URL: ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:3000'
    : 'https://quejas-ciudadanas.onrender.com'
};
