function notFound(req, res) {
  res.status(404).json({ success: false, message: "Route not found" });
}

function errorHandler(err, req, res, next) {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || "Server error";

  if (err && err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyValue || {});
    if (fields.length > 0) {
      message = `${fields[0]} already exists`;
    } else {
      message = "Duplicate key error";
    }
  }

  if (err && err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((item) => item.message)
      .join(", ");
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = { notFound, errorHandler };
