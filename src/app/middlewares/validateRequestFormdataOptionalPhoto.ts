import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";
import catchAsync from "../utils/catchAsync";

const validateRequestFormdataOptionalPhoto = (schema: AnyZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const Data = JSON.parse(req.body.data);
    const imgUrl = req?.file?.path;
    const ParsedData = { ...Data, imgUrl };

    // console.log(ParsedData);
    await schema.parseAsync({
      body: ParsedData,
      cookies: req.cookies,
    });

    next();
  });
};

export default validateRequestFormdataOptionalPhoto;
