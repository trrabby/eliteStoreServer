import cloudinary from "./cloudinary.config";

export const uploadToCloudinary = (fileBuffer: Buffer, folder = "uploads") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(fileBuffer);
  });
};
