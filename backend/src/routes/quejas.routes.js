const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { uploadFoto } = require('../middlewares/upload');
const controlador = require('../controllers/quejas.controller');

const router = Router();

router.post('/', uploadFoto, asyncHandler(controlador.crearQueja));
router.get('/', asyncHandler(controlador.listarQuejas));
router.get('/:id', asyncHandler(controlador.obtenerQueja));
router.get('/:id/imagen', asyncHandler(controlador.obtenerImagen));

module.exports = router;
