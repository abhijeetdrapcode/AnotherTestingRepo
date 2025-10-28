import { logger } from 'drapcode-logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Log levels for different types of logs
 */
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
};

/**
 * Log context interface
 * @typedef {Object} LogContext
 * @property {string} [requestId] - Unique request identifier
 * @property {string} [userId] - User identifier
 * @property {string} [tenantId] - Tenant identifier
 * @property {string} [action] - Action being performed
 * @property {string} [resource] - Resource being accessed
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * Create a structured log entry
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {LogContext} context - Log context
 * @param {Error} [error] - Error object if logging an error
 */
const createLogEntry = (level, message, context = {}, error = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...context,
    environment: process.env.NODE_ENV,
  };

  if (error) {
    logEntry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    };
  }

  return logEntry;
};

/**
 * Log an error with context
 * @param {string} message - Error message
 * @param {Error} error - Error object
 * @param {LogContext} context - Log context
 */
export const logError = (message, error, context = {}) => {
  const logEntry = createLogEntry(LogLevel.ERROR, message, context, error);
  logger.error(logEntry);
};

/**
 * Log a warning with context
 * @param {string} message - Warning message
 * @param {LogContext} context - Log context
 */
export const logWarn = (message, context = {}) => {
  const logEntry = createLogEntry(LogLevel.WARN, message, context);
  logger.warn(logEntry);
};

/**
 * Log an info message with context
 * @param {string} message - Info message
 * @param {LogContext} context - Log context
 */
export const logInfo = (message, context = {}) => {
  const logEntry = createLogEntry(LogLevel.INFO, message, context);
  logger.info(logEntry);
};

/**
 * Log a debug message with context
 * @param {string} message - Debug message
 * @param {LogContext} context - Log context
 */
export const logDebug = (message, context = {}) => {
  const logEntry = createLogEntry(LogLevel.DEBUG, message, context);
  logger.debug(logEntry);
};

/**
 * Create a request logger middleware
 * @returns {Function} Express middleware
 */
export const requestLogger = () => {
  return (req, res, next) => {
    const requestId = uuidv4();
    req.requestId = requestId;

    // Log request start
    logInfo('Request started', {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      body: sanitizeRequestBody(req.body),
      userId: req.user?.id,
      tenantId: req.tenant?.id,
      ip: req.ip,
    });

    // Log response
    const originalSend = res.send;
    res.send = function (body) {
      logInfo('Request completed', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: Date.now() - req._startTime,
        userId: req.user?.id,
        tenantId: req.tenant?.id,
      });
      return originalSend.call(this, body);
    };

    next();
  };
};

/**
 * Sanitize request body to remove sensitive information
 * @param {Object} body - Request body
 * @returns {Object} Sanitized body
 */
const sanitizeRequestBody = (body) => {
  if (!body) return body;

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
};
