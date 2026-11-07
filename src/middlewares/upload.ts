import multer from "multer";
import AppErr from "../libs/appErr.js";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype))
      return cb(new AppErr("Only PDF, PNG, JPEG or WebP files are allowed", 415));
    cb(null, true);
  },
});

export default upload;
