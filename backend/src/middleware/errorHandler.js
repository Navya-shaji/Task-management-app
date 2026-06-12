const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A record with that value already exists',
    });
  }

  if (err.code === '23503') {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Referenced resource not found',
    });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'Something went wrong',
  });
};

module.exports = errorHandler;
