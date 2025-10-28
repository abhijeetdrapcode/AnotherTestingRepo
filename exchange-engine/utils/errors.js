/**
 * Base error class for the application
 */
export class AppError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error codes for different types of errors
 */
export const ErrorCodes = {
  VALIDATION: {
    MISSING_REQUIRED: 'VALIDATION_MISSING_REQUIRED',
    INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
    INVALID_VALUE: 'VALIDATION_INVALID_VALUE',
  },
  DATABASE: {
    RECORD_NOT_FOUND: 'DATABASE_RECORD_NOT_FOUND',
    DUPLICATE_KEY: 'DATABASE_DUPLICATE_KEY',
    QUERY_FAILED: 'DATABASE_QUERY_FAILED',
  },
  AUTH: {
    INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
    TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
    INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
    INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',
  },
  API: {
    RATE_LIMIT_EXCEEDED: 'API_RATE_LIMIT_EXCEEDED',
    INVALID_REQUEST: 'API_INVALID_REQUEST',
    SERVICE_UNAVAILABLE: 'API_SERVICE_UNAVAILABLE',
  },
};

/**
 * Validation error for invalid input data
 */
export class ValidationError extends AppError {
  constructor(message, code = ErrorCodes.VALIDATION.INVALID_VALUE) {
    super(message, code);
  }
}

/**
 * Bad request error for malformed requests
 */
export class BadRequestError extends AppError {
  constructor(message, code = ErrorCodes.API.INVALID_REQUEST) {
    super(message, code);
  }
}

/**
 * Not found error for missing resources
 */
export class NotFoundError extends AppError {
  constructor(message, code = ErrorCodes.DATABASE.RECORD_NOT_FOUND) {
    super(message, code);
  }
}

/**
 * Unauthorized error for missing or invalid authentication
 */
export class UnauthorizedError extends AppError {
  constructor(message, code = ErrorCodes.AUTH.INVALID_CREDENTIALS) {
    super(message, code);
  }
}

/**
 * Forbidden error for insufficient permissions
 */
export class ForbiddenError extends AppError {
  constructor(message, code = ErrorCodes.AUTH.INSUFFICIENT_PERMISSIONS) {
    super(message, code);
  }
}

/**
 * Internal server error for unexpected errors
 */
export class InternalServerError extends AppError {
  constructor(message, code = 'INTERNAL_SERVER_ERROR') {
    super(message, code);
  }
}

export const ErrorObj = {
  COLLECTION_NOT_FOUND: {
    type: 'COLLECTION_NOT_FOUND',
    code: 404,
    status: 'error',
    message: 'Collection not found with provided name.',
    data: '',
    error: 'Collection not found.',
  },
  ITEM_NOT_FOUND: {
    type: 'ITEM_NOT_FOUND',
    code: 404,
    status: 'error',
    message: 'Items not found with provided id.',
    data: '',
    error: 'Items not found with provided id.',
  },
  VALIDATION_FAILED: {
    type: 'VALIDATION_FAILED',
    code: 400,
    status: 'error',
  },
  MISSING_FIELD: {
    type: 'MISSING_FIELD',
    code: 400,
    status: 'error',
    error: 'Required field data missing.',
  },
  MISSING_IDS: {
    type: 'MISSING_IDS',
    code: 400,
    status: 'error',
    message: 'Uuids not found in request body.',
    data: '',
    error: 'Uuids not found in request body.',
  },
  FIELD_VALIDATION_FIELD: {
    type: 'FIELD_VALIDATION_FIELD',
    code: 400,
    status: 'error',
    message: 'Field validation failed.',
    error: 'Field validation failed.',
  },
  UNIQUE_FIELD: {
    type: 'UNIQUE_FIELD',
    code: 400,
    status: 'error',
    data: `Can't save more than one item if Child Of field Reference field is not multi select.`,
    message: `Can't save more than one if reference field is not multi selected.`,
    error: `Can't save more than one if reference field is not multi selected.`,
  },
};
