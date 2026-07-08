# Product Management System

Đây là dự án học tập cá nhân — một ứng dụng web bán hàng được xây dựng bằng Node.js, Express và MongoDB. Dự án gồm hai phần: trang dành cho khách hàng mua sắm và trang quản trị dành cho admin.

Mục tiêu khi làm dự án này là thực hành xây dựng một web app có đủ các luồng cơ bản của một ứng dụng thương mại điện tử đơn giản: quản lý sản phẩm, giỏ hàng, đặt hàng, đăng ký/đăng nhập, và phân quyền người dùng.

---

## Quá trình xây dựng

Dự án được làm trong quá trình tự học, có tham khảo cấu trúc và cách triển khai từ các mã nguồn mở tương tự trên mạng. Một số phần logic phức tạp hơn (dựng cây danh mục cha–con nhiều cấp, tính giá sau giảm giá, merge giỏ hàng guest vào tài khoản khi đăng nhập) có tận dụng ChatGPT để gợi ý cách xử lý, viết code mẫu, sửa lỗi và debug, sau đó đọc hiểu lại và chỉnh cho khớp với phần còn lại của dự án.

---

## Table of Contents

- [Dự án này làm được gì](#dự-án-này-làm-được-gì)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Application Workflows](#application-workflows)
  - [Authentication Flow](#1-authentication-flow)
  - [Product Management Flow](#2-product-management-flow)
  - [Shopping Cart & Checkout Flow](#3-shopping-cart--checkout-flow)
  - [User Password Recovery Flow](#4-user-password-recovery-flow)
  - [Role-Based Access Control (RBAC) Flow](#5-role-based-access-control-rbac-flow)
  - [Image Upload Flow](#6-image-upload-flow)
- [API Routes Reference](#api-routes-reference)
- [Middleware Pipeline](#middleware-pipeline)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Deployment](#deployment)

---

## Dự án này làm được gì

Ứng dụng được chia thành hai phần độc lập:

**Phần Admin** (truy cập qua `/admin/...`):

| Chức năng | Mô tả |
|---|---|
| Quản lý sản phẩm | Thêm, sửa, xóa sản phẩm. Hỗ trợ xóa mềm (soft delete) và khôi phục từ thùng rác |
| Quản lý danh mục | Danh mục sản phẩm và blog hỗ trợ cấu trúc cha–con nhiều cấp |
| Quản lý blog | Viết và quản lý bài viết, tổ chức theo danh mục |
| Quản lý đơn hàng | Xem danh sách đơn hàng, chi tiết từng đơn |
| Quản lý tài khoản | Tạo và quản lý tài khoản admin |
| Phân quyền (RBAC) | Tạo role, gán quyền theo từng module (xem / sửa / xóa) |
| Cài đặt website | Chỉnh tên website, logo, thông tin liên hệ |
| Dashboard | Thống kê số lượng sản phẩm, tài khoản, người dùng |

**Phần Client** (trang dành cho khách hàng):

| Chức năng | Mô tả |
|---|---|
| Xem sản phẩm | Danh sách, lọc theo danh mục, xem chi tiết |
| Giỏ hàng | Thêm/sửa/xóa sản phẩm trong giỏ. Giỏ hàng lưu qua cookie, không cần đăng nhập |
| Đặt hàng | Nhập thông tin giao hàng, kiểm tra tồn kho, tạo đơn hàng |
| Hủy đơn | Chỉ có thể hủy khi đơn ở trạng thái pending hoặc processing |
| Tài khoản người dùng | Đăng ký, đăng nhập, chỉnh sửa thông tin cá nhân |
| Quên mật khẩu | Gửi OTP qua email, OTP tự hết hạn sau 2 phút |
| Lịch sử đơn hàng | Xem lại các đơn đã đặt |
| Blog | Đọc bài viết |
| Tìm kiếm | Tìm sản phẩm theo từ khóa |

**Một số điểm kỹ thuật đã áp dụng trong quá trình xây dựng:**
- Soft delete: dữ liệu bị xóa chỉ được đánh dấu `deleted: true`, không mất khỏi database
- Ảnh upload lên Cloudinary qua memory stream, không lưu file trên server
- OTP quên mật khẩu dùng MongoDB TTL Index để tự xóa sau 120 giây
- Giỏ hàng guest tự động merge vào tài khoản khi người dùng đăng nhập
- Audit trail: lưu lại ai tạo / ai sửa / ai xóa cho các entity quan trọng
- Deploy lên Vercel (serverless) + MongoDB Atlas

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js |
| **Web Framework** | Express.js v4 |
| **Template Engine** | Pug v3 |
| **Database** | MongoDB (Mongoose ODM) |
| **Cloud Storage** | Cloudinary (ảnh upload) |
| **Email Service** | Nodemailer + Gmail SMTP |
| **Authentication** | Cookie-based Token (md5 hash password) |
| **Session/Flash** | express-session + express-flash |
| **Rich Text Editor** | TinyMCE v7 |
| **Slug Generation** | mongoose-slug-updater |
| **Date Formatting** | Moment.js |
| **File Upload** | Multer (memory storage) + Streamifier |
| **Dev Tool** | Nodemon |
| **Deployment** | Vercel (Serverless) |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        CLIENT                            │
│              Browser (Cookie-based session)              │
└───────────────────────┬──────────────────────────────────┘
                        │ HTTP Request
                        @
┌──────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                        │
│                    index.js (Port 3000)                  │
│                                                          │
│  ┌─────────────────┐      ┌──────────────────────────┐   │
│  │  Client Routes  │      │     Admin Routes         │   │
│  │  /              │      │     /admin/...           │   │
│  │  /products      │      │     (requireAuth)        │   │
│  │  /cart          │      │                          │   │
│  │  /checkout      │      │  Auth → Dashboard        │   │
│  │  /user          │      │  Products / Categories   │   │
│  │  /blogs         │      │  Blogs / Blog-Category   │   │
│  │  /search        │      │  Accounts / Roles        │   │
│  │  /history       │      │  Orders / Settings       │   │
│  │  /contact       │      │  Users / My Account      │   │
│  └────────┬────────┘      └──────────────┬───────────┘   │
│           │                              │               │
│  ┌────────@──────────────────────────────@────────────┐  │
│  │              Middleware Layer                      │  │
│  │  categoryMiddleware | userMiddleware               │  │
│  │  settingsMiddleware | cartsMiddleware              │  │
│  │  authMiddleware (Admin) | uploadCloudinary         │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           │                              │
│  ┌────────────────────────@───────────────────────────┐  │
│  │              Controller Layer                      │  │
│  │        (Business Logic + Data Fetching)            │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           │                              │
│  ┌────────────────────────@───────────────────────────┐  │
│  │               Helper / Utility Layer               │  │
│  │  newPrice | pagination | filterStatus | search     │  │
│  │  createTree | sendMail | generate | orderAndCart   │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           │                              │
│  ┌────────────────────────@───────────────────────────┐  │
│  │                  Model Layer (Mongoose)            │  │
│  └────────────────────────┬───────────────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │
            ┌──────────────@──────────────┐
            │     MongoDB Atlas (Cloud)   │
            │  Collections:               │
            │  product | product-category │
            │  blogs | blogs-category     │
            │  accounts | roles | users   │
            │  orders | carts             │
            │  forgot-password            │
            │  settings-general           │
            └─────────────────────────────┘
                           │
            ┌──────────────@──────────────┐
            │         Cloudinary          │
            │   (Image Cloud Storage)     │
            └─────────────────────────────┘
```

---

## Database Schema

### `accounts` — Tài khoản Admin

```js
{
  fullName: String,
  email: String,
  password: String,       // MD5 hashed
  token: String,          // Random 20-char string dùng cho cookie auth
  phone: String,
  avatar: String,         // Cloudinary URL
  role_id: String,        // Ref to roles._id
  status: String,         // "active" | "inactive"
  deleted: Boolean,       // Soft delete flag
  createdBy: { account_id, createdAt },
  deletedBy: { account_id, deletedAt },
  updatedBy: [{ account_id, titleUpdated, updatedAt }]
}
```

### `users` — Tài khoản Khách hàng

```js
{
  fullName, email,
  password: String,       // MD5 hashed
  token_user: String,     // Random string cho cookie client
  phone, avatar,
  status: "active" | "inactive",
  deleted: Boolean,
  deletedAt: Date,
  timestamps: true        // createdAt, updatedAt
}
```

### `roles` — Nhóm quyền

```js
{
  title: String,
  description: String,
  permissions: [String],  // e.g. ["products_view","products_edit","roles_delete"]
  deleted: Boolean,
  createdBy, updatedBy[], deletedBy
}
```

### `product` — Sản phẩm

```js
{
  title, product_category_id,
  description, price, discountPercentage, stock,
  thumbnail: String,      // Cloudinary URL
  status, featured, position,
  slug: String,           // Auto-generated unique slug từ title
  deleted: Boolean,
  createdBy, deletedBy, updatedBy[]
}
```

### `product-category` & `blogs-category` — Danh mục (hỗ trợ nested)

```js
{
  title, parent_id: String,   // "" nếu là root, ID nếu là sub-category
  description, thumbnail, status, position,
  slug, deleted,
  createdBy, deletedBy, updatedBy[]
}
```

### `blogs` — Bài viết

```js
{
  title, blog_category_id, description, content,
  thumbnail, status, position, slug,
  deleted, createdBy, deletedBy, updatedBy[]
}
```

### `carts` — Giỏ hàng

```js
{
  user_id: String,            // null nếu chưa đăng nhập
  products: [{ products_id, quantity }],
  timestamps: true,           // TTL Index: tự xóa sau 30 ngày không hoạt động
}
```

### `orders` — Đơn hàng

```js
{
  cart_id, user_id,
  userInfo: { name, phone, address },
  products: [{ products_id, quantity, price, discountPercentage }],
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled",
  deleted: Boolean,
  timestamps: true
}
```

### `forgot-password` — OTP quên mật khẩu

```js
{
  email: String,
  otp: String,        // Random 8-digit number
  expireAt: Date,     // TTL Index: tự xóa sau 120 giây
}
```

### `settings-general` — Cài đặt website

```js
{
  websiteName, logo, phone, facebook, email, address, copyright,
  timestamps: true
}
```

---

## Project Structure

```
Product-management/
├── index.js                  # Entry point — Express app setup
├── package.json
├── vercel.json               # Vercel serverless deployment config
├── .env                      # Environment variables (không commit)
├── .gitignore
│
├── config/
│   ├── database.js           # Mongoose connection
│   └── system.js             # System constants (prefixAdmin = "/admin")
│
├── models/                   # Mongoose schemas
│   ├── product.model.js
│   ├── product-category.model.js
│   ├── blog.model.js
│   ├── blog-category.model.js
│   ├── account.model.js
│   ├── user.model.js
│   ├── role.model.js
│   ├── order.model.js
│   ├── cart.model.js
│   ├── forgot-password.model.js
│   └── settings-general.model.js
│
├── routes/
│   ├── admin/
│   │   ├── index.route.js    # Mount tất cả admin routes + auth middleware
│   │   ├── auth.route.js
│   │   ├── dashboard.route.js
│   │   ├── product.route.js
│   │   ├── products-category.route.js
│   │   ├── blogs.route.js
│   │   ├── blogs-category.route.js
│   │   ├── accounts.route.js
│   │   ├── role.route.js
│   │   ├── users.routes.js
│   │   ├── checkout.route.js
│   │   ├── myAccount.route.js
│   │   ├── replacePassword.route.js
│   │   └── settings.route.js
│   └── client/
│       ├── index.route.js    # Mount tất cả client routes + global middlewares
│       ├── home.route.js
│       ├── product.route.js
│       ├── blog.route.js
│       ├── cart.route.js
│       ├── checkout.route.js
│       ├── user.route.js
│       ├── history.route.js
│       ├── searchRoutes.route.js
│       └── contact.route.js
│
├── controllers/
│   ├── admin/
│   │   ├── auth.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── product.controller.js
│   │   ├── product-category.controller.js
│   │   ├── blogs.controller.js
│   │   ├── blogs-category.controller.js
│   │   ├── accounts.controller.js
│   │   ├── role.controller.js
│   │   ├── users.controller.js
│   │   ├── checkout.controller.js
│   │   ├── my-account.controller.js
│   │   ├── replace-password.controller.js
│   │   └── settings.controller.js
│   └── client/
│       ├── home.controller.js
│       ├── product.controller.js
│       ├── blog.controller.js
│       ├── cart.controller.js
│       ├── checkout.controller.js
│       ├── user.controller.js
│       ├── history.controller.js
│       ├── search.controller.js
│       └── contact.controller.js
│
├── middlewares/
│   ├── admin/
│   │   ├── auth.middleware.js            # Token-based auth guard
│   │   └── uploadCloudinary.middleware.js # Multer → Cloudinary stream upload
│   └── client/
│       ├── auth.middleware.js            # Client token guard
│       ├── carts.middleware.js           # Tự tạo cart cookie cho mọi request
│       ├── user.middleware.js            # Inject user info vào res.locals
│       ├── categoryMiddleware.middleware.js # Inject danh mục sản phẩm vào layout
│       └── settings.middleware.js        # Inject cài đặt website vào res.locals
│
├── validates/
│   ├── admin/
│   │   ├── auth.validate.js
│   │   ├── accounts.validate.js
│   │   ├── product.validate.js
│   │   └── product-category.validate.js
│   └── client/
│       ├── user.validate.js
│       ├── slug.validate.js
│       └── quantity.validate.js
│
├── helper/
│   ├── generate.js           # Random string/number generator
│   ├── sendMail.js           # Nodemailer Gmail wrapper
│   ├── newPrice.js           # Tính giá sau discount
│   ├── pagination.js         # Pagination calculator
│   ├── filterStatus.js       # Status filter builder
│   ├── filterSort.js         # Sort query builder
│   ├── search.js             # Search regex builder
│   ├── create-tree.js        # Build nested category tree
│   ├── products-category.js  # Recursive sub-category fetcher
│   ├── orderAndCart.js       # Merge guest cart vào user cart khi login
│   ├── showDetailProducts.js # Enrich cart với product details
│   ├── showCheckout.js       # Enrich order details
│   ├── showBlogCreateAndEdit.js # Enrich danh sách với creator info
│   ├── showBlogDateDetail.js # Format date cho blog detail
│   └── checkPassword.js      # Password check utility
│
├── views/
│   ├── admin/
│   │   ├── layouts/
│   │   │   ├── default.pug   # Admin layout chính
│   │   │   └── auth.pug      # Layout trang login
│   │   ├── partials/
│   │   │   ├── header.pug
│   │   │   └── sider.pug
│   │   ├── mixins/           # Reusable Pug components
│   │   │   ├── table.pug, pagination.pug, alert.pug
│   │   │   ├── sortItem.pug, search.pug, filter-status.pug
│   │   │   ├── select-tree.pug, form-change-multi.pug
│   │   │   ├── helperRolesDetail.pug, alowPass.pug
│   │   │   ├── limitItem.pug, moment.pug
│   │   └── pages/
│   │       └── [module]/     # index, create, edit, detail, trash per module
│   └── client/
│       ├── layouts/default.pug
│       ├── partials/header.pug, footer.pug
│       ├── mixins/
│       └── pages/
│           └── [module]/
│
└── public/
    ├── admin/
    │   ├── css/style.css
    │   └── js/
    │       ├── script.js       # Admin UI interactions (AJAX, multi-select)
    │       ├── permission.js   # Permission matrix UI
    │       ├── product.js      # Product form interactions
    │       └── trash.js        # Trash restore/delete UI
    └── client/
        ├── css/style.css
        ├── js/
        │   ├── script.js
        │   └── cart.js         # Cart AJAX interactions
        └── image/
```

---

## Application Workflows

### 1. Authentication Flow

#### Admin Authentication

```
[Browser] → GET /admin/auth/login
    └─→ Render login form

[Browser] → POST /admin/auth/login { email, password }
    ├─→ [Validate] auth.validate.js kiểm tra required fields
    ├─→ [Controller] Tìm Account theo email (deleted: false)
    ├─→ [Check] md5(password) === account.password ?
    ├─→ [Check] account.status === "active" ?
    ├─→ [Success] Set cookie: token = account.token (không expire)
    └─→ Redirect → /admin/dashboard

[Subsequent Requests] → /admin/...
    └─→ authMiddleware.requireAuth
        ├─→ Đọc req.cookies.token
        ├─→ Account.findOne({ token }) → inject res.locals.user
        ├─→ Role.findOne({ _id: user.role_id }) → inject res.locals.role
        └─→ next() → Controller

[Logout] → GET /admin/auth/logout
    └─→ res.clearCookie("token") → Redirect login
```

#### Client Authentication

```
[Browser] → POST /user/register { fullName, email, password }
    ├─→ Kiểm tra email đã tồn tại chưa
    ├─→ Hash password: md5(password)
    ├─→ Tạo User mới → save()
    ├─→ orderAndCart(): Merge guest cart (cookie cart_id) vào user_id mới
    ├─→ Set cookie: token_user = user.token_user
    └─→ Redirect → /

[Browser] → POST /user/login { email, password }
    ├─→ User.findOne({ email, deleted: false })
    ├─→ md5(password) === user.password ?
    ├─→ user.status === "active" ?
    ├─→ orderAndCart(): Merge guest cart → user cart
    ├─→ Set cookie: token_user
    └─→ Redirect → /
```

---

### 2. Product Management Flow

#### Admin - Tạo / Sửa sản phẩm

```
GET /admin/products/create
    └─→ Render form với danh sách category (tree structure)

POST /admin/products/create
    ├─→ [RBAC] role.permissions.includes("products_create")
    ├─→ uploadCloudinary.middleware: Multer buffer → stream → Cloudinary URL
    │       req.body.thumbnail = cloudinary_url
    ├─→ product.validate: Kiểm tra required fields
    ├─→ Controller tạo Product { ...req.body, createdBy: { account_id } }
    ├─→ mongoose-slug-updater tự sinh slug từ title (unique)
    └─→ Flash success → Redirect /admin/products

PATCH /admin/products/change-status/:status/:id
    ├─→ [RBAC] role.permissions.includes("products_edit")
    ├─→ Đổi status theo giá trị lấy từ param :status ("active" | "inactive")
    └─→ Push updatedBy log

DELETE /admin/products/deleteItem/:id   (soft delete)
    ├─→ [RBAC] role.permissions.includes("products_delete")
    ├─→ Product.updateOne({ deleted: true, deletedBy: {...} })
    └─→ Sản phẩm chuyển vào Trash (vẫn còn trong DB)

PATCH /admin/products/trashCan/recovery/:id   (khôi phục từ Trash)
    ├─→ [RBAC] role.permissions.includes("products_edit")
    └─→ Product.updateOne({ deleted: false }, $push: { updatedBy })

DELETE /admin/products/trashCan/permanentlyDelete/:id   (xóa vĩnh viễn)
    ├─→ [RBAC] role.permissions.includes("products_delete")
    └─→ Product.deleteOne({ _id: id })
```

#### Admin - Danh sách sản phẩm (Filter / Search / Sort / Pagination)

```
GET /admin/products?status=active&keyword=áo&sortkey=price&valuekey=desc&page=2&limit=8

Controller xử lý tuần tự:
1. filterStatus(req.query, find)    → thêm điều kiện status vào find query
2. searchHelper(req.query)          → tạo regex từ keyword
3. Product.countDocuments(find)     → đếm tổng để tính pagination
4. paginationHelper(...)            → tính skip, totalPage, currentPage (limit lấy từ req.query.limit, mặc định 8)
5. filterSort(req.query)            → đọc sortkey/valuekey, tạo sort object { [sortkey]: valuekey }
                                       (nếu không truyền thì mặc định sort theo { position: "desc" })
6. Product.find(find).sort(views).limit().skip()  → lấy data
7. showBlogHelper.showDataIndex()   → enrich với thông tin creator
8. Render view với đầy đủ dữ liệu
```

---

### 3. Shopping Cart & Checkout Flow

```
┌─────────────────────────────────────────────────────────┐
│                  CART INITIALIZATION                    │
│                                                         │
│  Mọi request client → cartsMiddleware.cartId()          │
│  ├─→ Tìm Cart theo cookie cart_id                       │
│  ├─→ Nếu không tồn tại: Tạo Cart mới, set cookie        │
│  │       cart_id (expires: 30 ngày)                     │
│  └─→ Inject totalQuality vào res.locals (hiển thị badge)│
└─────────────────────────────────────────────────────────┘
                         │
                         @
┌─────────────────────────────────────────────────────────┐
│                  ADD TO CART                            │
│                                                         │
│  POST /cart/add/:product_id { quantity }                │
│  ├─→ Cart.findOne({ _id: cookie.cart_id })              │
│  ├─→ Kiểm tra product_id đã có trong cart chưa?         │
│  │   ├─→ Có: tăng quantity                              │
│  │   └─→ Chưa: push { products_id, quantity }           │
│  └─→ Cart.updateOne() → Flash success                   │
└─────────────────────────────────────────────────────────┘
                         │
                         @
┌─────────────────────────────────────────────────────────┐
│                  CHECKOUT FLOW                          │
│                                                         │
│  GET /checkout                                          │
│  ├─→ showDetailProducts.detail(cart):                   │
│  │     Enrich mỗi item với product info + newPrice      │
│  └─→ Render form nhập thông tin giao hàng               │
│                                                         │
│  POST /checkout/order { name, phone, address }          │
│  ├─→ Với mỗi sản phẩm trong cart:                       │
│  │   ├─→ Product.findOne() để lấy price, stock          │
│  │   ├─→ Product.updateOne({ stock: { $gte: qty } },    │
│  │   │       { $inc: { stock: -qty } })                 │
│  │   │   → Nếu modifiedCount=0: Flash error "hết hàng"  │
│  │   └─→ Build products array với snapshot giá          │
│  │         (lưu giá tại thời điểm đặt, không link live) │
│  ├─→ Tạo Order { cart_id, userInfo, products, user_id } │
│  ├─→ Cart.updateOne → xóa products trong giỏ            │
│  └─→ Redirect → /checkout/success/:order_id             │
│                                                         │
│  POST /checkout/cancel/:order_id                        │
│  ├─→ Chỉ cho hủy khi status: "pending" | "processing"   │
│  ├─→ Order.updateOne({ status: "cancelled" })           │
│  └─→ Hoàn trả stock: Product.updateOne $inc +qty        │
└─────────────────────────────────────────────────────────┘
```

---

### 4. User Password Recovery Flow

```
[1] GET /user/password/forgot
    └─→ Render form nhập email

[2] POST /user/password/forgot { email }
    ├─→ User.findOne({ email, deleted: false })
    ├─→ Tạo ForgotPassword { email, otp: random8digits }
    │       TTL Index: tự xóa document sau 120 giây
    ├─→ sendMail() gửi email chứa OTP qua Gmail SMTP
    └─→ Redirect → /user/password/otp?email=xxx

[3] POST /user/password/otp { email, otp }
    ├─→ ForgotPassword.findOne({ email, otp })
    │   └─→ Không tìm thấy (hết hạn/sai): Flash error
    ├─→ Tìm User theo email → Set cookie token_user
    └─→ Redirect → /user/password/reset

[4] POST /user/password/reset { password }
    ├─→ Tìm User theo cookie token_user
    ├─→ User.updateOne({ password: md5(newPassword) })
    └─→ Flash success → Redirect /
```

---

### 5. Role-Based Access Control (RBAC) Flow

```
Permission string format: "{module}_{action}"
Ví dụ: "products_view", "products_edit", "products_delete",
        "roles_edit", "roles_delete", "roles_permissions"

┌──────────────────────────────────────────────────────┐
│                SETUP PERMISSIONS                     │
│                                                      │
│  GET /admin/roles/permission                         │
│  └─→ Render permission matrix: mỗi role x mỗi module │
│                                                      │
│  PATCH /admin/roles/permission                       │
│  ├─→ [RBAC check] role.permissions.includes          │
│  │       ("roles_permissions")                       │
│  ├─→ Parse JSON body: [{ id, permissions[] }]        │
│  └─→ Bulk update Role.updateOne() cho từng role      │
└──────────────────────────────────────────────────────┘
                         │
                         @
┌──────────────────────────────────────────────────────┐
│              RUNTIME PERMISSION CHECK                │
│                                                      │
│  authMiddleware.requireAuth():                       │
│  ├─→ Đọc token cookie → tìm Account                  │
│  └─→ Role.findOne({ _id: account.role_id })          │
│       → inject res.locals.role.permissions (array)   │
│                                                      │
│  Controller action check (ví dụ):                    │
│  if (!res.locals.role.permissions                    │
│       .includes("products_delete")) {                │
│    return res.redirect(back);                        │
│  }                                                   │
│                                                      │
│  View layer check (Pug mixin alowPass):              │
│  +alowPass("products_edit")                          │
│    → Ẩn/hiện button dựa trên permissions             │
└──────────────────────────────────────────────────────┘
```

---

### 6. Image Upload Flow

```
Admin Upload Ảnh (sản phẩm, blog, tài khoản, ...)

[Form] multipart/form-data → POST /admin/products/create

Route setup:
  router.post("/create",
    multer({ storage: memoryStorage() }).single("thumbnail"),
    uploadCloudinary.uploadCloudinary,   // middleware
    validate.createPost,
    controller.createPost
  )

uploadCloudinary.middleware.js:
  ├─→ Kiểm tra req.file có tồn tại không
  ├─→ cloudinary.uploader.upload_stream() → tạo write stream
  ├─→ streamifier.createReadStream(req.file.buffer).pipe(stream)
  │       → Upload trực tiếp buffer lên Cloudinary (không lưu disk)
  ├─→ Nhận result.url từ Cloudinary
  ├─→ req.body[fieldname] = result.url  (ghi đè thành URL)
  └─→ next() → Controller xử lý bình thường với URL ảnh
```

---

## API Routes Reference

### Admin Routes (`/admin/...`)

| Method | Path | Mô tả | Permission |
|---|---|---|---|
| GET | `/admin/auth/login` | Trang đăng nhập | — |
| POST | `/admin/auth/login` | Xử lý đăng nhập | — |
| GET | `/admin/auth/logout` | Đăng xuất | — |
| GET | `/admin/dashboard` | Tổng quan thống kê | Auth |
| GET | `/admin/products` | Danh sách sản phẩm | Auth |
| GET | `/admin/products/detail/:id` | Chi tiết sản phẩm | Auth |
| GET | `/admin/products/create` | Form tạo sản phẩm | Auth |
| POST | `/admin/products/create` | Tạo sản phẩm | `products_create` |
| GET | `/admin/products/edit/:id` | Form sửa sản phẩm | Auth |
| PATCH | `/admin/products/edit/:id` | Cập nhật sản phẩm | `products_edit` |
| PATCH | `/admin/products/change-status/:status/:id` | Đổi trạng thái | `products_edit` |
| PATCH | `/admin/products/change-multi` | Bulk action | `products_edit` |
| DELETE | `/admin/products/deleteItem/:id` | Xóa mềm | `products_delete` |
| GET | `/admin/products/trashCan` | Thùng rác | Auth |
| PATCH | `/admin/products/trashCan/recovery/:id` | Khôi phục | `products_edit` |
| PATCH | `/admin/products/trashCan/change-status/:status/:id` | Đổi trạng thái trong thùng rác | `products_edit` |
| PATCH | `/admin/products/trashCan/change-multi` | Bulk action trong thùng rác | `products_edit` |
| DELETE | `/admin/products/trashCan/permanentlyDelete/:id` | Xóa vĩnh viễn | `products_delete` |
| GET | `/admin/products-category` | Danh mục sản phẩm | Auth |
| POST | `/admin/products-category/create` | Tạo danh mục | `products-category_create` |
| PATCH | `/admin/products-category/edit/:id` | Sửa danh mục | `products-category_edit` |
| DELETE | `/admin/products-category/deleted/:id` | Xóa mềm | `products-category_delete` |
| GET | `/admin/products-category/trash` | Thùng rác danh mục | Auth |
| PATCH | `/admin/products-category/trash/recovery/:id` | Khôi phục | `products-category_edit` |
| DELETE | `/admin/products-category/trash/permanent-delete/:id` | Xóa vĩnh viễn | `products-category_delete` |
| GET | `/admin/blogs` | Danh sách blog | Auth |
| POST | `/admin/blogs/create` | Tạo blog | `blogs_create` |
| PATCH | `/admin/blogs/edit/:id` | Sửa blog | `blogs_edit` |
| DELETE | `/admin/blogs/deleteItem/:id` | Xóa mềm | `blogs_delete` |
| GET | `/admin/blogs/trash` | Thùng rác blog | Auth |
| PATCH | `/admin/blogs/trash/recovery/:id` | Khôi phục | `blogs_edit` |
| DELETE | `/admin/blogs/trash/permanentlyDelete/:id` | Xóa vĩnh viễn | `blogs_delete` |
| GET | `/admin/blogs-category` | Danh mục blog | Auth |
| POST | `/admin/blogs-category/create` | Tạo danh mục blog | `blogs-category_create` |
| PATCH | `/admin/blogs-category/edit/:id` | Sửa danh mục blog | `blogs-category_edit` |
| DELETE | `/admin/blogs-category/deleted/:id` | Xóa mềm | `blogs-category_delete` |
| GET | `/admin/roles` | Danh sách nhóm quyền | Auth |
| POST | `/admin/roles/create` | Tạo role | `roles_edit` |
| PATCH | `/admin/roles/edit/:id` | Sửa role | `roles_edit` |
| DELETE | `/admin/roles/deleted/:id` | Xóa role | `roles_delete` |
| GET | `/admin/roles/permission` | Trang phân quyền | Auth |
| PATCH | `/admin/roles/permission` | Cập nhật ma trận phân quyền | `roles_permissions` |
| GET | `/admin/accounts` | Danh sách tài khoản admin | Auth |
| POST | `/admin/accounts/create` | Tạo tài khoản | `accounts_create` |
| PATCH | `/admin/accounts/edit/:id` | Sửa tài khoản | `accounts_edit` |
| PATCH | `/admin/accounts/change-status/:status/:id` | Đổi trạng thái | `accounts_edit` |
| DELETE | `/admin/accounts/delete/:id` | Xóa | `accounts_delete` |
| GET | `/admin/users` | Danh sách người dùng client | Auth |
| PATCH | `/admin/users/change-status/:status/:id` | Khóa/mở tài khoản | `users_edit` |
| DELETE | `/admin/users/delete/:id` | Xóa | `users_delete` |
| GET | `/admin/checkout` | Danh sách đơn hàng | Auth |
| GET | `/admin/checkout/:id` | Chi tiết đơn hàng | Auth |
| PATCH | `/admin/checkout/:id/status` | Cập nhật trạng thái đơn hàng | Auth |
| GET | `/admin/settings/general` | Cài đặt website | Auth |
| PATCH | `/admin/settings/general` | Cập nhật cài đặt | Auth |
| GET | `/admin/my-account` | Tài khoản của tôi | Auth |
| PATCH | `/admin/my-account/edit` | Sửa tài khoản của tôi | Auth |
| PATCH | `/admin/replace-password/edit` | Đổi mật khẩu admin | Auth |

### Client Routes

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/` | Trang chủ | — |
| GET | `/products` | Danh sách sản phẩm | — |
| GET | `/products/detail/:slug` | Chi tiết sản phẩm | — |
| GET | `/products/:slug_category` | Sản phẩm theo danh mục | — |
| GET | `/blogs` | Danh sách blog | — |
| GET | `/blogs/detail/:slug` | Chi tiết blog | — |
| GET | `/blogs/:slug_category` | Blog theo danh mục | — |
| GET | `/search` | Tìm kiếm | — |
| GET | `/cart` | Giỏ hàng | — |
| POST | `/cart/add/:product_id` | Thêm vào giỏ | — |
| GET | `/cart/update/:product_id/:quantity` | Cập nhật số lượng | — |
| GET | `/cart/delete/:id` | Xóa khỏi giỏ | — |
| GET | `/checkout` | Trang thanh toán | — |
| POST | `/checkout/order` | Đặt hàng | — |
| GET | `/checkout/success/:order_id` | Đặt hàng thành công | — |
| POST | `/checkout/cancel/:order_id` | Hủy đơn hàng | — |
| GET | `/history` | Lịch sử đơn hàng | — |
| GET | `/user/register` | Trang đăng ký | — |
| POST | `/user/register` | Xử lý đăng ký | — |
| GET | `/user/login` | Trang đăng nhập | — |
| POST | `/user/login` | Xử lý đăng nhập | — |
| GET | `/user/logout` | Đăng xuất | — |
| GET/POST | `/user/password/forgot` | Quên mật khẩu | — |
| GET/POST | `/user/password/otp` | Nhập OTP | — |
| GET/POST | `/user/password/reset` | Đặt mật khẩu mới | Required |
| GET | `/user/info` | Thông tin tài khoản | Required |
| GET | `/user/edit` | Form sửa thông tin | Required |
| POST | `/user/edit` | Cập nhật thông tin + avatar | Required |
| GET | `/contact` | Trang liên hệ | — |

> Ghi chú: một số route trong dự án dùng `GET` cho hành động cập nhật/xóa (ví dụ `/cart/update`, `/cart/delete`) thay vì `PATCH`/`DELETE` chuẩn REST. Bảng trên liệt kê đúng theo method thật sự khai báo trong route, không chỉnh sửa lại cho "chuẩn" hơn.

---

## Middleware Pipeline

### Client Request Pipeline

```
Request → [categoryMiddleware] → [userMiddleware] → [settingsMiddleware] → [cartsMiddleware] → Router → Controller

categoryMiddleware:  Inject product categories tree vào res.locals (cho sidebar/menu)
userMiddleware:      Đọc cookie token_user → inject res.locals.user (null nếu chưa login)
settingsMiddleware:  Inject SettingsGeneral (website name, logo, ...) vào res.locals
cartsMiddleware:     Tạo/đọc cart cookie → inject res.locals.totalQuality
```

### Admin Request Pipeline

```
Request → Router → [authMiddleware.requireAuth] → Controller

authMiddleware.requireAuth:
  ├─→ Đọc req.cookies.token
  ├─→ Account.findOne({ token }) → res.locals.user
  └─→ Role.findOne({ _id: user.role_id }) → res.locals.role
```

---

## Environment Variables

Tạo file `.env` tại root directory:

```env
# Server
PORT=3000

# MongoDB Atlas
MONGO_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>

# Email (Gmail SMTP + App Password)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password   # Tạo tại Google Account → Security → App Passwords

# Cloudinary
CLOUD_NAME=your_cloud_name
API_KEY=your_api_key
API_SECRET=your_api_secret
```

> **Lưu ý bảo mật:** File `.env` đã được thêm vào `.gitignore`. Không commit file này lên repository.

---

## Getting Started

### Prerequisites

- Node.js >= 16.x
- npm >= 8.x
- MongoDB Atlas account (hoặc local MongoDB)
- Cloudinary account
- Gmail account với App Password enabled

### Installation

```bash
# 1. Clone repository
git clone <repository-url>
cd Product-management

# 2. Cài đặt dependencies
npm install

# 3. Tạo file .env (xem phần Environment Variables)
cp .env.example .env
# Điền thông tin vào .env

# 4. Khởi động development server
npm start
# → Server chạy tại http://localhost:3000
# → Nodemon tự restart khi có thay đổi
```

### Truy cập ứng dụng

| URL | Mô tả |
|---|---|
| `http://localhost:3000` | Client storefront |
| `http://localhost:3000/admin/auth/login` | Admin panel login |

### Tạo tài khoản Admin đầu tiên

Do chưa có signup flow cho admin, cần tạo thủ công qua MongoDB:

```js
// Insert vào collection "accounts" trên MongoDB Atlas / Compass
{
  fullName: "Admin",
  email: "admin@example.com",
  password: "md5_of_your_password",  // Dùng tool online để hash MD5
  token: "anyRandomString20Chars",
  status: "active",
  deleted: false,
  role_id: "<role_id_with_full_permissions>"
}
```

---

## Deployment

Dự án được cấu hình sẵn deploy lên **Vercel** (Serverless):

```json
// vercel.json
{
  "version": 2,
  "builds": [{ "src": "index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "index.js" }]
}
```

### Deploy steps

```bash
# 1. Cài Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Cấu hình Environment Variables trên Vercel Dashboard
# Project Settings → Environment Variables → thêm tất cả biến từ .env
```

> **Lưu ý:** MongoDB Atlas cần whitelist IP `0.0.0.0/0` (Allow from anywhere) để Vercel serverless functions có thể kết nối.

---

## Author

Dự án cá nhân, xây dựng trong quá trình học full-stack web development với Node.js, Express, MongoDB và Pug.