import multer from "multer";

// store file in memory (NOT disk, NOT external adapter)
const storage = multer.memoryStorage();

export const multerUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit (adjust if needed)
  },
});
