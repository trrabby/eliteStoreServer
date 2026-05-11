import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { flashSaleService } from "./FlashSale.service";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";

const createFlashSale = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };

  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  let banner: string | undefined;

  // Upload banner if provided
  if (files?.banner?.[0]) {
    const result: any = await uploadToCloudinary(
      files.banner[0].buffer,
      "flash-sales",
    );
    banner = result.secure_url;
  }

  const data = JSON.parse(req.body.data);

  const result = await flashSaleService.createFlashSale(email, data, banner);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Flash sale created successfully",
    data: result,
  });
});

const getAllFlashSales = catchAsync(async (req, res) => {
  const { page, limit, status, vendorId, isActive } = req.query;
  // check if admin role exists on req.user
  const user = req.user as { role?: string } | undefined;
  const adminView = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const result = await flashSaleService.getAllFlashSales(
    {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: status ? String(status) : undefined,
      vendorId: vendorId ? Number(vendorId) : undefined,
      isActive: isActive ? isActive === "true" : undefined,
    },
    adminView,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Flash sales retrieved successfully",
    data: result,
  });
});

const getActiveFlashSale = catchAsync(async (req, res) => {
  const result = await flashSaleService.getActiveFlashSale();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Active flash sale retrieved",
    data: result,
  });
});

const getFlashSaleBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const result = await flashSaleService.getFlashSaleBySlug(slug);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Flash sale retrieved successfully",
    data: result,
  });
});

const getMyFlashSales = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { page, limit, status } = req.query;
  const result = await flashSaleService.getMyFlashSales(email, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status ? String(status) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My flash sales retrieved",
    data: result,
  });
});

const updateFlashSale = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { publicId } = req.params;
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  let banner: string | undefined;

  // Upload banner if provided
  if (files?.banner?.[0]) {
    const result: any = await uploadToCloudinary(
      files.banner[0].buffer,
      "flash-sales",
    );
    banner = result.secure_url;
  }

  const data = JSON.parse(req.body.data);
  const result = await flashSaleService.updateFlashSale(
    publicId,
    email,
    data,
    banner,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Flash sale updated successfully",
    data: result,
  });
});

const addItems = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { publicId } = req.params;
  const data = JSON.parse(req.body.data);
  const result = await flashSaleService.addItems(publicId, email, data.items);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${result.addedCount} product(s) added. ${result.skippedCount} skipped.`,
    data: result,
  });
});

const updateItem = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { itemPublicId } = req.params;
  const data = JSON.parse(req.body.data);
  const result = await flashSaleService.updateItem(itemPublicId, email, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Flash sale item updated",
    data: result,
  });
});

const removeItem = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { itemPublicId } = req.params;
  await flashSaleService.removeItem(itemPublicId, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Item removed from flash sale",
    data: null,
  });
});

const removeItems = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  // console.log(req.body);
  const { itemPublicIds } = JSON.parse(req.body.data);
  await flashSaleService.removeItems(itemPublicIds, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Items removed from flash sale",
    data: null,
  });
});

const activateFlashSale = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { publicId } = req.params;
  const result = await flashSaleService.activateFlashSale(publicId, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Flash sale activated successfully",
    data: result,
  });
});

const cancelFlashSale = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { publicId } = req.params;
  await flashSaleService.cancelFlashSale(publicId, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Flash sale cancelled",
    data: null,
  });
});

const endExpiredSales = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const result = await flashSaleService.endExpiredSales(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${result.endedCount} expired sale(s) ended`,
    data: result,
  });
});

const deleteFlashSale = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { publicId } = req.params;
  await flashSaleService.deleteFlashSale(publicId, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Flash sale deleted",
    data: null,
  });
});

const getFlashSaleStats = catchAsync(async (req, res) => {
  const result = await flashSaleService.getFlashSaleStats();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Flash sale stats retrieved",
    data: result,
  });
});

export const FlashSaleController = {
  createFlashSale,
  getAllFlashSales,
  getActiveFlashSale,
  getFlashSaleBySlug,
  getMyFlashSales,
  updateFlashSale,
  addItems,
  updateItem,
  removeItem,
  removeItems,
  activateFlashSale,
  cancelFlashSale,
  endExpiredSales,
  deleteFlashSale,
  getFlashSaleStats,
};
