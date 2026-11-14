const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { uploadCaptura } = require('../middlewares/upload');
const controlador = require('../controllers/capturas.controller');

const router = Router();

router.post('/', uploadCaptura, asyncHandler(controlador.guardarCaptura));
router.get('/', asyncHandler(controlador.listarCapturas));

module.exports = router;
