import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { vendorProfileService } from "./vendorProfile.service";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";

const createVendorProfile = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };

  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  let logo: string | undefined;
  let banner: string | undefined;

  // Upload logo
  if (files?.logo?.[0]) {
    const result: any = await uploadToCloudinary(
      files.logo[0].buffer,
      "vendors",
    );
    logo = result.secure_url;
  }

  // Upload banner
  if (files?.banner?.[0]) {
    const result: any = await uploadToCloudinary(
      files.banner[0].buffer,
      "vendors",
    );
    banner = result.secure_url;
  }

  const data = JSON.parse(req.body.data);

  const result = await vendorProfileService.createVendorProfile(
    email,
    data,
    logo,
    banner,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Vendor profile created successfully",
    data: result,
  });
});

const getAllVendors = catchAsync(async (req, res) => {
  const { page, limit, isVerified, search } = req.query;
  const result = await vendorProfileService.getAllVendors({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    isVerified: isVerified ? isVerified === "true" : undefined,
    search: search ? String(search) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendors retrieved successfully",
    data: result,
  });
});

const getVendorBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const result = await vendorProfileService.getVendorBySlug(slug);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor retrieved successfully",
    data: result,
  });
});

const getMyVendorProfile = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const result = await vendorProfileService.getMyVendorProfile(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor profile retrieved successfully",
    data: result,
  });
});

const updateVendorProfile = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  let logo: string | undefined;
  let banner: string | undefined;

  // Upload logo if provided
  if (files?.logo?.[0]) {
    const result: any = await uploadToCloudinary(
      files.logo[0].buffer,
      "vendors",
    );
    logo = result.secure_url;
  }

  // Upload banner if provided
  if (files?.banner?.[0]) {
    const result: any = await uploadToCloudinary(
      files.banner[0].buffer,
      "vendors",
    );
    banner = result.secure_url;
  }

  const result = await vendorProfileService.updateVendorProfile(
    email,
    data,
    logo,
    banner,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor profile updated successfully",
    data: result,
  });
});

const verifyVendor = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { publicId } = req.params;
  const result = await vendorProfileService.verifyVendor(publicId, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor verified successfully",
    data: result,
  });
});

const deactivateVendor = catchAsync(async (req, res) => {
  const { publicId } = req.params;
  const result = await vendorProfileService.deactivateVendor(publicId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor deactivated successfully",
    data: result,
  });
});

const deleteVendorProfile = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  await vendorProfileService.deleteVendorProfile(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor profile deleted successfully",
    data: null,
  });
});

export const VendorProfileController = {
  createVendorProfile,
  getAllVendors,
  getVendorBySlug,
  getMyVendorProfile,
  updateVendorProfile,
  verifyVendor,
  deactivateVendor,
  deleteVendorProfile,
};
