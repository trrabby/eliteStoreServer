import httpStatus from "http-status";
import { Request } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { CompanyService } from "./company.services";

// create company
const createCompany = catchAsync(async (req, res) => {
  const result = await CompanyService.createCompany(req as Request);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Company created successfully",
    data: result,
  });
});

// get Company
const getCompany = catchAsync(async (req, res) => {
  const result = await CompanyService.getCompany();

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Company get successfully",
    data: result,
  });
});

/// get a Company
const getACompany = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await CompanyService.getACompany(id);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Company a get successfully",
    data: result,
  });
});

/// update A Company
const updateACompany = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await CompanyService.updateACompany(id as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Company updated successfully",
    data: result,
  });
});

/// update A Company
const deleteACompany = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await CompanyService.deleteACompany(id as string);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Company updated successfully",
    data: result,
  });
});

export const companyController = {
  createCompany,
  getCompany,
  getACompany,
  updateACompany,
  deleteACompany,
};
