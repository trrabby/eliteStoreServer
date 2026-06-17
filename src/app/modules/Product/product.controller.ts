import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { productService } from "./product.service";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";

// ─────────────────────────────────────────
// PRODUCT
// ─────────────────────────────────────────

const createProduct = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await productService.createProduct(email, data);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product created successfully",
    data: result,
  });
});

const getAllProducts = catchAsync(async (req, res) => {
  const {
    page,
    limit,
    status,
    brandIds,
    vendorId,
    categoryIds,
    isFeatured,
    minPrice,
    maxPrice,
    search,
    sortBy,
    tags,
    minRating,
  } = req.query;

  const normalizeToNumberArray = (value: any): number[] | undefined => {
    if (!value) return undefined;

    if (Array.isArray(value)) {
      return value.map(Number).filter(Boolean);
    }

    // fallback: single value support
    return [Number(value)].filter(Boolean);
  };

  const result = await productService.getAllProducts({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,

    brandIds: normalizeToNumberArray(brandIds),
    categoryIds: normalizeToNumberArray(categoryIds),

    vendorId: vendorId ? Number(vendorId) : undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,

    isFeatured: isFeatured ? isFeatured === "true" : undefined,

    status: status ? String(status) : undefined,
    search: search ? String(search) : undefined,
    sortBy: sortBy ? String(sortBy) : undefined,

    tags: tags ? String(tags).split(",") : undefined,
    minRating: minRating ? Number(minRating) : undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Products retrieved successfully",
    data: result,
  });
});

const getProductByIdPublic = catchAsync(async (req, res) => {
  const publicId = req.params.id;
  const result = await productService.getProductByIdPublic(publicId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product retrieved successfully",
    data: result,
  });
});

const getProductBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const result = await productService.getProductBySlug(slug);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product retrieved successfully",
    data: result,
  });
});

const getProductById = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const result = await productService.getProductById(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product retrieved successfully",
    data: result,
  });
});

const getMyProducts = catchAsync(async (req, res) => {
  const { email } = req.user as { email: string };
  const { page, limit, status } = req.query;
  // console.log(req);
  const result = await productService.getMyProducts(email, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status ? String(status) : undefined,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Products retrieved successfully",
    data: result,
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await productService.updateProduct(id, email, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

const deleteProduct = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const { email } = req.user as { email: string };
  const result = await productService.deleteProduct(id, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result,
    data: null,
  });
});

// ─────────────────────────────────────────
// IMAGES
// ─────────────────────────────────────────

const addProductImages = catchAsync(async (req, res) => {
  const productId = Number(req.params.id);
  const { email } = req.user as { email: string };
  const files = req.files as Express.Multer.File[];

  if (!files?.length) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "No images uploaded",
      data: null,
    });
  }

  const uploadedImages = await Promise.all(
    files.map(async (file, index) => {
      const result: any = await uploadToCloudinary(file.buffer, "products");

      return {
        url: result.secure_url,
        altText: req.body.altText ?? null,
        sortOrder: index,
      };
    }),
  );
  const result = await productService.addProductImages(
    productId,
    email,
    uploadedImages,
  );

  return sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Images uploaded successfully",
    data: result,
  });
});

export default addProductImages;

const setPrimaryImage = catchAsync(async (req, res) => {
  const productId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  const { email } = req.user as { email: string };
  const result = await productService.setPrimaryImage(
    productId,
    imageId,
    email,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result,
    data: null,
  });
});

const deleteProductImage = catchAsync(async (req, res) => {
  const productId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  const { email } = req.user as { email: string };
  await productService.deleteProductImage(productId, imageId, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Image deleted successfully",
    data: null,
  });
});

// ─────────────────────────────────────────
// VARIANTS
// ─────────────────────────────────────────

const createVariant = catchAsync(async (req, res) => {
  const productId = Number(req.params.id);
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await productService.createVariant(productId, email, data);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Variant created successfully",
    data: result,
  });
});

const getProductVariants = catchAsync(async (req, res) => {
  const productId = Number(req.params.id);
  const result = await productService.getProductVariants(productId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Variants retrieved successfully",
    data: result,
  });
});

const updateVariant = catchAsync(async (req, res) => {
  const variantId = Number(req.params.variantId);
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  console.log(variantId, email, data);
  const result = await productService.updateVariant(variantId, email, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Variant updated successfully",
    data: result,
  });
});

const updateStock = catchAsync(async (req, res) => {
  const variantId = Number(req.params.variantId);
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await productService.updateStock(variantId, email, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Stock updated successfully",
    data: result,
  });
});

const deleteVariant = catchAsync(async (req, res) => {
  const variantId = Number(req.params.variantId);
  const { email } = req.user as { email: string };
  await productService.deleteVariant(variantId, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Variant deleted successfully",
    data: null,
  });
});

// ─────────────────────────────────────────
// ATTRIBUTES
// ─────────────────────────────────────────

const addAttribute = catchAsync(async (req, res) => {
  const productId = Number(req.params.id);
  const { email } = req.user as { email: string };
  const data = JSON.parse(req?.body?.data)?.attributes;
  // console.log(data);
  const result = await productService.addAttribute(productId, email, data);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Attribute added successfully",
    data: result,
  });
});

const getAttributes = catchAsync(async (req, res) => {
  const productId = Number(req.params.id);
  const result = await productService.getAttributes(productId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attributes retrieved successfully",
    data: result,
  });
});

const deleteAttribute = catchAsync(async (req, res) => {
  const attributeId = Number(req.params.attributeId);
  const { email } = req.user as { email: string };
  await productService.deleteAttribute(attributeId, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attribute deleted successfully",
    data: null,
  });
});

// ─────────────────────────────────────────
// RELATED PRODUCTS
// ─────────────────────────────────────────

const addRelatedProducts = catchAsync(async (req, res) => {
  const productId = Number(req.params.id);
  const { email } = req.user as { email: string };
  const data = JSON.parse(req.body.data);
  const result = await productService.addRelatedProducts(
    productId,
    email,
    data.relatedProductIds,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result,
    data: null,
  });
});
const getRelatedProducts = catchAsync(async (req, res) => {
  const productId = Number(req.params.id);
  const result = await productService.getRelatedProducts(productId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Related products retrieved successfully",
    data: result,
  });
});
const removeRelatedProduct = catchAsync(async (req, res) => {
  const productId = Number(req.params.id);
  const relatedId = Number(req.params.relatedId);
  const { email } = req.user as { email: string };
  await productService.removeRelatedProduct(productId, relatedId, email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Related product removed",
    data: null,
  });
});

export const ProductController = {
  createProduct,
  getAllProducts,
  getProductByIdPublic,
  getProductBySlug,
  getProductById,
  getMyProducts,
  updateProduct,
  deleteProduct,
  addProductImages,
  setPrimaryImage,
  deleteProductImage,
  createVariant,
  getProductVariants,
  updateVariant,
  updateStock,
  deleteVariant,
  addAttribute,
  getAttributes,
  deleteAttribute,
  addRelatedProducts,
  getRelatedProducts,
  removeRelatedProduct,
};
