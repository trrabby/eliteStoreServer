import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';
import catchAsync from '../utils/catchAsync';

const validateRequestFormdataMustPhotoArray = (schema: AnyZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const Data = JSON.parse(req.body.data);
    const prevUploadedFiles =
      JSON.parse(req.body.data)?.previousUploadedImg || [];
    const newUploads = Array.isArray(req.files) ? req.files : [];
    const thumbnails = [...prevUploadedFiles, ...newUploads];
    const ParsedData = { ...Data, thumbnails };
    // console.log(ParsedData);
    await schema.parseAsync({
      body: ParsedData,
      cookies: req.cookies,
    });

    next();
  });
};

export default validateRequestFormdataMustPhotoArray;
