declare module "multer-storage-cloudinary" {
  import { StorageEngine } from "multer";

  export class CloudinaryStorage implements StorageEngine {
    constructor(options: any);
    _handleFile(req: any, file: any, cb: any): void;
    _removeFile(req: any, file: any, cb: any): void;
  }
}
