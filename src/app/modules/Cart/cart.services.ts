import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// ─────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────

// get or create cart for user
const getOrCreateCart = async (userId: number) => {
  let cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
    });
  }

  return cart;
};

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// get cart with full item details
const getCart = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              flashSaleItem: {
                include: {
                  flashSale: true,
                },
              },
              images: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true, altText: true },
              },
            },
          },
          variant: {
            select: {
              id: true,
              publicId: true,
              sku: true,
              name: true,
              price: true,
              comparePrice: true,
              stock: true,
              isActive: true,
              optionValues: {
                include: {
                  value: {
                    include: {
                      option: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { addedAt: "desc" },
      },
    },
  });

  if (!cart) {
    return {
      items: [],
      itemCount: 0,
      subtotal: 0,
      savings: 0,
    };
  }

  let subtotal = 0;
  let savings = 0;

  const enrichedItems = cart.items.map((item) => {
    const variantPrice = Number(item.variant.price);
    const variantComparePrice = item.variant.comparePrice
      ? Number(item.variant.comparePrice)
      : null;

    const flash = item.product.flashSaleItem;

    // ✅ resolve effective price
    const effectivePrice = flash?.salePrice
      ? Number(flash.salePrice)
      : variantPrice;

    const effectiveComparePrice = flash ? variantPrice : variantComparePrice;

    // totals
    subtotal += effectivePrice * item.quantity;

    if (effectiveComparePrice && effectiveComparePrice > effectivePrice) {
      savings += (effectiveComparePrice - effectivePrice) * item.quantity;
    }

    return {
      ...item,

      // 🔥 inject resolved pricing (IMPORTANT for frontend consistency)
      price: effectivePrice,
      comparePrice: effectiveComparePrice,

      flashOffer: flash
        ? {
            salePrice: flash.salePrice,
            discountType: flash.discountType,
            discountValue: flash.discountValue,
            flashSale: flash.flashSale,
          }
        : null,
    };
  });

  return {
    id: cart.id,
    items: enrichedItems,
    itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: parseFloat(subtotal.toFixed(2)),
    savings: parseFloat(savings.toFixed(2)),
  };
};

// add item to cart
const addToCart = async (
  email: string,
  payload: {
    productId: number;
    variantId: number;
    quantity: number;
  },
) => {
  // console.log(payload);
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // validate product exists and is active
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
  });

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  if (product.status !== "ACTIVE") {
    throw new AppError(httpStatus.BAD_REQUEST, "This product is not available");
  }

  // validate variant exists, belongs to product, and is active
  const variant = await prisma.productVariant.findFirst({
    where: {
      id: payload.variantId,
      productId: payload.productId,
      isActive: true,
    },
  });

  if (!variant) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Variant not found or unavailable",
    );
  }

  // check stock
  if (variant.stock < payload.quantity) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Insufficient stock. Only ${variant.stock} left.`,
    );
  }

  const cart = await getOrCreateCart(user.id);

  // if variant already in cart — increase quantity
  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_variantId: {
        cartId: cart.id,
        variantId: payload.variantId,
      },
    },
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + payload.quantity;

    // check stock for total quantity
    if (variant.stock < newQuantity) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Cannot add more. Only ${variant.stock} in stock and you already have ${existingItem.quantity} in cart.`,
      );
    }

    const updated = await prisma.cartItem.update({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: payload.variantId,
        },
      },
      data: { quantity: newQuantity },
    });

    return updated;
  }

  // add new cart item
  const cartItem = await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: payload.productId,
      variantId: payload.variantId,
      quantity: payload.quantity,
    },
  });
  console.log(cartItem);
  return cartItem;
};

// update cart item quantity
const updateCartItem = async (
  email: string,
  variantId: number,
  quantity: number,
) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
  });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, "Cart not found");
  }

  const cartItem = await prisma.cartItem.findUnique({
    where: {
      cartId_variantId: { cartId: cart.id, variantId },
    },
  });

  if (!cartItem) {
    throw new AppError(httpStatus.NOT_FOUND, "Item not found in cart");
  }

  // validate stock
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant) {
    throw new AppError(httpStatus.NOT_FOUND, "Variant not found");
  }

  if (variant.stock < quantity) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Insufficient stock. Only ${variant.stock} available.`,
    );
  }

  const updated = await prisma.cartItem.update({
    where: {
      cartId_variantId: { cartId: cart.id, variantId },
    },
    data: { quantity },
  });

  return updated;
};

// remove single item from cart
const removeCartItem = async (email: string, variantId: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
  });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, "Cart not found");
  }

  const cartItem = await prisma.cartItem.findUnique({
    where: {
      cartId_variantId: { cartId: cart.id, variantId },
    },
  });

  if (!cartItem) {
    throw new AppError(httpStatus.NOT_FOUND, "Item not found in cart");
  }

  await prisma.cartItem.delete({
    where: {
      cartId_variantId: { cartId: cart.id, variantId },
    },
  });

  return "Item removed from cart";
};

// clear entire cart
const clearCart = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
  });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, "Cart not found");
  }

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  return "Cart cleared";
};

// validate cart before checkout
// checks stock, product status, variant status
const validateCart = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Cart is empty");
  }

  const issues: string[] = [];

  for (const item of cart.items) {
    // product no longer active
    if (item.product.status !== "ACTIVE") {
      issues.push(`"${item.product.name}" is no longer available`);
    }

    // variant no longer active
    if (!item.variant.isActive) {
      issues.push(`A variant of "${item.product.name}" is no longer available`);
    }

    // insufficient stock
    if (item.variant.stock < item.quantity) {
      issues.push(
        `"${item.product.name}" only has ${item.variant.stock} in stock but you have ${item.quantity} in cart`,
      );
    }
  }

  if (issues.length > 0) {
    return {
      isValid: false,
      issues,
    };
  }

  return {
    isValid: true,
    issues: [],
  };
};

export const cartService = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  validateCart,
};
