import { Request, Response, NextFunction } from "express";

const notFound = (req: Request, res: Response, next: NextFunction) => {
  console.log(`Not Found: ${req.method} ${req?.originalUrl}`);
  res.status(404).json({
    message: "Route not found",
    success: false,
    error: "",
  });
};
export default notFound;
