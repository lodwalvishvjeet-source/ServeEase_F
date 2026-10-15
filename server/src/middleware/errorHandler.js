/**
 * Centralized Express Error Handling Middleware
 * 
 * Safely transforms uncaught exceptions and Mongoose/JWT errors
 * into structured JSON responses without leaking internal stack traces.
 */
export const errorHandler = (err, req, res, next) => {
  // If headers have already been sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  console.error('💥 [Server Error]:', err.name || 'Error', err.message);

  // 1. Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const duplicateField = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `An account with this ${duplicateField} already exists.`
    });
  }

  // 2. Mongoose Schema Validation Error
  if (err.name === 'ValidationError') {
    const errorMessages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      error: errorMessages.join('. '),
      details: errorMessages
    });
  }

  // 3. Mongoose Cast Error (Invalid MongoDB ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: `Resource not found with invalid id format: ${err.value}`
    });
  }

  // 4. Custom status code or default 500
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error occurred.';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default errorHandler;
