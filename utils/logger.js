const moment = require('moment');

const Logger = {
    log: (message, level = 'info') => console[level](`[${moment().format()}] ${message}`),
};

module.exports = { Logger };