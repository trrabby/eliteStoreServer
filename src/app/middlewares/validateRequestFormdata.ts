import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";
import catchAsync from "../../shared/catchAsync";

const validateRequestFormdata = (schema: AnyZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const Data = JSON.parse(req.body.data);
    const image = req?.file?.path;
    const ParsedData = { ...Data, image };
    console.log({ fromValidateRequest: ParsedData });
    await schema.parseAsync({
      body: ParsedData,
      cookies: req.cookies,
    });

    next();
  });
};

export default validateRequestFormdata;
