const express = require('express');
const router  = express.Router();

router.use('/auth',             require('./auth'));
router.use('/tickets',          require('./tickets'));
router.use('/brokers',          require('./brokers'));
router.use('/categories',       require('./categories'));
router.use('/users',            require('./users'));
router.use('/reports',          require('./reports'));
router.use('/export',           require('./export'));
router.use('/feature-requests', require('./featureRequests'));
router.use('/pptx',             require('./pptx'));

module.exports = router;
