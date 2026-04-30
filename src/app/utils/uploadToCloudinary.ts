import cloudinary from "../../config/cloudinary.config";

export const uploadToCloudinary = (buffer: Buffer, folder = "uploads") => {
  return new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(buffer);
  });
};
