import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import AppError from "../../errors/AppError";

// get or create wishlist for user
const getOrCreateWishlist = async (userId: number) => {
  let wishlist = await prisma.wishlist.findUnique({
    where: { userId },
  });

  if (!wishlist) {
    wishlist = await prisma.wishlist.create({
      data: { userId },
    });
  }

  return wishlist;
};

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

// get wishlist with full product details
const getWishlist = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const wishlist = await prisma.wishlist.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id:               true,
              publicId:         true,
              name:             true,
              slug:             true,
              status:           true,
              averageRating:    true,
              reviewCount:      true,
              images: {
                where:  { isPrimary: true },
                take:   1,
                select: { url: true, altText: true },
              },
              variants: {
                where:  { isDefault: true, isActive: true },
                take:   1,
                select: {
                  price:        true,
                  comparePrice: true,
                  stock:        true,
                },
              },
              brand: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
        orderBy: { addedAt: "desc" },
      },
    },
  });

  // no wishlist yet — return empty
  if (!wishlist) {
    return {
      items:     [],
      itemCount: 0,
    };
  }

  return {
    id:        wishlist.id,
    items:     wishlist.items,
    itemCount: wishlist.items.length,
  };
};

// add product to wishlist
const addToWishlist = async (email: string, productId: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // validate product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  const wishlist = await getOrCreateWishlist(user.id);

  // check already in wishlist
  const existingItem = await prisma.wishlistItem.findUnique({
    where: {
      wishlistId_productId: {
        wishlistId: wishlist.id,
        productId,
      },
    },
  });

  if (existingItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Product is already in your wishlist"
    );
  }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productId,
      },
    });

    // increment product wishlist count
    await tx.product.update({
      where: { id: productId },
      data:  { wishlistCount: { increment: 1 } },
    });

    return created;
  });

  return item;
};

// remove product from wishlist
const removeFromWishlist = async (email: string, productId: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const wishlist = await prisma.wishlist.findUnique({
    where: { userId: user.id },
  });

  if (!wishlist) {
    throw new AppError(httpStatus.NOT_FOUND, "Wishlist not found");
  }

  const item = await prisma.wishlistItem.findUnique({
    where: {
      wishlistId_productId: {
        wishlistId: wishlist.id,
        productId,
      },
    },
  });

  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found in wishlist");
  }

  await prisma.$transaction(async (tx) => {
    await tx.wishlistItem.delete({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId,
        },
      },
    });

    // decrement product wishlist count — floor at 0
    await tx.product.update({
      where: { id: productId },
      data: {
        wishlistCount: {
          decrement: 1,
        },
      },
    });
  });

  return "Product removed from wishlist";
};

// toggle — add if not in wishlist, remove if already in
const toggleWishlist = async (email: string, productId: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  const wishlist = await getOrCreateWishlist(user.id);

  const existingItem = await prisma.wishlistItem.findUnique({
    where: {
      wishlistId_productId: {
        wishlistId: wishlist.id,
        productId,
      },
    },
  });

  if (existingItem) {
    // remove
    await prisma.$transaction(async (tx) => {
      await tx.wishlistItem.delete({
        where: {
          wishlistId_productId: {
            wishlistId: wishlist.id,
            productId,
          },
        },
      });
      await tx.product.update({
        where: { id: productId },
        data:  { wishlistCount: { decrement: 1 } },
      });
    });

    return { wishlisted: false, message: "Removed from wishlist" };
  }

  // add
  await prisma.$transaction(async (tx) => {
    await tx.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId },
    });
    await tx.product.update({
      where: { id: productId },
      data:  { wishlistCount: { increment: 1 } },
    });
  });

  return { wishlisted: true, message: "Added to wishlist" };
};

// check if a specific product is wishlisted
const checkWishlisted = async (email: string, productId: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const wishlist = await prisma.wishlist.findUnique({
    where: { userId: user.id },
  });

  if (!wishlist) return { wishlisted: false };

  const item = await prisma.wishlistItem.findUnique({
    where: {
      wishlistId_productId: {
        wishlistId: wishlist.id,
        productId,
      },
    },
  });

  return { wishlisted: !!item };
};

// move item from wishlist to cart
const moveToCart = async (email: string, productId: number) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const wishlist = await prisma.wishlist.findUnique({
    where: { userId: user.id },
  });

  if (!wishlist) {
    throw new AppError(httpStatus.NOT_FOUND, "Wishlist not found");
  }

  const wishlistItem = await prisma.wishlistItem.findUnique({
    where: {
      wishlistId_productId: {
        wishlistId: wishlist.id,
        productId,
      },
    },
  });

  if (!wishlistItem) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found in wishlist");
  }

  // get default variant for product
  const defaultVariant = await prisma.productVariant.findFirst({
    where: {
      productId,
      isDefault: true,
      isActive:  true,
    },
  });

  if (!defaultVariant) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "No active variant found for this product"
    );
  }

  if (defaultVariant.stock < 1) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Product is out of stock"
    );
  }

  // get or create cart
  let cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId: user.id } });
  }

  await prisma.$transaction(async (tx) => {
    // add to cart — merge if already exists
    const existing = await tx.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId:    cart!.id,
          variantId: defaultVariant.id,
        },
      },
    });

    if (existing) {
      await tx.cartItem.update({
        where: {
          cartId_variantId: {
            cartId:    cart!.id,
            variantId: defaultVariant.id,
          },
        },
        data: { quantity: { increment: 1 } },
      });
    } else {
      await tx.cartItem.create({
        data: {
          cartId:    cart!.id,
          productId,
          variantId: defaultVariant.id,
          quantity:  1,
        },
      });
    }

    // remove from wishlist
    await tx.wishlistItem.delete({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist!.id,
          productId,
        },
      },
    });

    // decrement wishlist count
    await tx.product.update({
      where: { id: productId },
      data:  { wishlistCount: { decrement: 1 } },
    });
  });

  return "Product moved to cart";
};

// clear entire wishlist
const clearWishlist = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const wishlist = await prisma.wishlist.findUnique({
    where: { userId: user.id },
    include: { items: { select: { productId: true } } },
  });

  if (!wishlist || wishlist.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Wishlist is already empty");
  }

  await prisma.$transaction(async (tx) => {
    // decrement wishlist count for all products
    await Promise.all(
      wishlist.items.map((item) =>
        tx.product.update({
          where: { id: item.productId },
          data:  { wishlistCount: { decrement: 1 } },
        })
      )
    );

    await tx.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id },
    });
  });

  return "Wishlist cleared";
};

export const wishlistService = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  checkWishlisted,
  moveToCart,
  clearWishlist,
};