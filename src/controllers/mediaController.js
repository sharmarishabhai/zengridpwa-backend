const { Readable } = require("stream");
const cloudinary = require("../config/cloudinary");

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });
}

async function uploadSingle(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "file is required" });
  }

  const folder = req.body.folder || "zengrid";
  const resourceType = req.body.resourceType || "auto";

  const result = await uploadBuffer(req.file.buffer, {
    folder,
    resource_type: resourceType,
    public_id: req.body.publicId || undefined,
  });

  return res.status(201).json({
    success: true,
    file: {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format,
      bytes: result.bytes,
    },
  });
}

async function uploadMultiple(req, res) {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ success: false, message: "files are required" });
  }

  const folder = req.body.folder || "zengrid";
  const resourceType = req.body.resourceType || "auto";
  const files = [];

  for (const file of req.files) {
    const result = await uploadBuffer(file.buffer, {
      folder,
      resource_type: resourceType,
    });
    files.push({
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format,
      bytes: result.bytes,
    });
  }

  return res.status(201).json({ success: true, files });
}

module.exports = { uploadSingle, uploadMultiple };
