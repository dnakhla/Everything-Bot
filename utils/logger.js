import moment from 'moment';

/**
 * Logger utility for consistent logging across the application
 */
export const Logger = {
  /**
     * Log a message with a timestamp and specified log level
     * @param {string} message - The message to log
     * @param {string} level - The log level (info, warn, error, debug)
     */
  log: (message, level = 'info') => {
    if (!console[level]) {
      console.warn(`Invalid log level: ${level}. Using 'info' instead.`);
      level = 'info';
    }
    console[level](`[${moment().format()}] ${message}`);
  }
};