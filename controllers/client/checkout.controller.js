const Cart = require('../../models/cart.model');
const Product = require('../../models/product.model');
const Order = require('../../models/order.model');

const newPriceHelper = require('../../helper/newPrice');
const showDetailProductsHelper = require('../../helper/showDetailProducts');

// [GET] /checkout
module.exports.index = async (req, res) => {
  try {
    const cartId = req.cookies.cart_id;
    const carts = await Cart.findOne({ _id: cartId });

    const result = await showDetailProductsHelper.detail(carts);

    res.render('client/pages/checkout/index', {
      titlePage: 'Thanh toán',
      carts: result,
    });
  } catch (error) {
    req.flash('error', 'Lỗi khi lấy giỏ hàng');
    res.redirect('/');
  }
};

// [POST] /checkout/order
module.exports.order = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userInfo = req.body;
    const cartId = req.cookies.cart_id;

    const cart = await Cart.findOne({ _id: cartId }).session(session);

    if (!cart || cart.products.length === 0) {
      req.flash('error', 'Giỏ hàng của bạn đang trống!');
      res.redirect('/checkout');
      await session.endSession();
      return;
    }

    const products = [];
    for (const product of cart.products) {
      const productInfo = await Product.findOne({ _id: product.products_id })
        .select('price discountPercentage stock title')
        .session(session);

      const result = await Product.updateOne(
        { _id: product.products_id, stock: { $gte: product.quantity } },
        { $inc: { stock: -product.quantity } }
      ).session(session);

      if (result.modifiedCount === 0) {
        await session.abortTransaction();
        await session.endSession();

        req.flash('error', `Sản phẩm "${productInfo ? productInfo.title : 'Không xác định'}" không đủ số lượng trong kho!`);
        res.redirect('/checkout');
        return;
      }

      const objectProduct = {
        products_id: product.products_id,
        quantity: product.quantity,
        price: productInfo.price,
        discountPercentage: productInfo.discountPercentage
      };

      products.push(objectProduct);
    }

    const orderInfo = {
      cart_id: cartId,
      userInfo: userInfo,
      products: products,
    };

    if (res.locals.user) {
      orderInfo.user_id = res.locals.user.id;
    }

    const order = new Order(orderInfo);
    await order.save({ session });

    await Cart.updateOne({ _id: cartId }, { products: [] }).session(session);

    await session.commitTransaction();
    await session.endSession();

    req.flash('success', 'Đặt hàng thành công');
    res.redirect(`/checkout/success/${order.id}`);
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();

    req.flash('error', 'Đặt hàng thất bại. Vui lòng thử lại!');
    res.redirect('/checkout');
  }
};

// [GET] /checkout/success/:order_id
module.exports.success = async (req, res) => {
  const order_id = req.params.order_id;
  const order = await Order.findOne({
    _id: order_id,
  });

  if (order.products.length > 0) {
    for (const item of order.products) {
      const productInfo = await Product.findOne({
        _id: item.products_id,
      }).select('thumbnail title');

      newPriceHelper.priceNewProduct(item);
      item.newPrice = +item.newPrice;
      item.productInfo = productInfo;
      item.totalPrice = item.quantity * item.newPrice;
    }
  }

  order.totalPrice = order.products.reduce((sum, item) => {
    return sum + item.totalPrice;
  }, 0);

  res.render('client/pages/checkout/success', {
    order: order,
    titlePage: 'Đặt hàng thành công',
  });
};

// [POST] /checkout/cancel/:order_id
module.exports.cancel = async (req, res) => {
  const order_id = req.params.order_id;
  const order = await Order.findOne({ _id: order_id });

  if (!order) {
    req.flash('error', 'Không tìm thấy đơn hàng');
    res.redirect('/checkout/success');
    return;
  }

  if (order.status === 'pending' || order.status === 'processing') {
    await Order.updateOne({ _id: order_id }, { status: 'cancelled' });
    req.flash('success', 'Hủy đơn hàng thành công');
    for (const item of order.products) {
      await Product.updateOne(
        { _id: item.products_id },
        { $inc: { stock: +item.quantity } }
      );
    }
  } else {
    req.flash('error', 'Không thể hủy đơn hàng ở trạng thái hiện tại');
  }

  res.redirect(`/checkout/success/${order_id}`);
};
