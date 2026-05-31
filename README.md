# KiotViet MCP Server cho Đức Điện

MCP Server kết nối Claude với KiotViet, cho phép truy vấn dữ liệu bán hàng trực tiếp từ Claude.ai.

## 📋 Danh sách Tools

| Tool | Mô tả |
|------|-------|
| `kiotviet_get_products` | Lấy danh sách hàng hóa |
| `kiotviet_get_product` | Chi tiết một hàng hóa |
| `kiotviet_create_product` | Thêm hàng hóa mới |
| `kiotviet_update_product` | Cập nhật hàng hóa |
| `kiotviet_delete_product` | Xóa hàng hóa |
| `kiotviet_get_categories` | Danh sách nhóm hàng |
| `kiotviet_get_orders` | Danh sách đơn hàng |
| `kiotviet_get_order` | Chi tiết đơn hàng |
| `kiotviet_create_order` | Tạo đơn hàng mới |
| `kiotviet_get_invoices` | Danh sách hóa đơn bán |
| `kiotviet_get_invoice` | Chi tiết hóa đơn |
| `kiotviet_get_purchase_orders` | Phiếu nhập hàng |
| `kiotviet_get_customers` | Danh sách khách hàng |
| `kiotviet_get_customer` | Chi tiết khách hàng |
| `kiotviet_create_customer` | Thêm khách hàng mới |
| `kiotviet_update_customer` | Cập nhật khách hàng |
| `kiotviet_get_customer_groups` | Nhóm khách hàng |
| `kiotviet_get_suppliers` | Nhà cung cấp |
| `kiotviet_get_branches` | Danh sách chi nhánh |
| `kiotviet_get_users` | Danh sách nhân viên |
| `kiotviet_get_cashflow` | Sổ quỹ thu/chi |
| `kiotviet_get_bank_accounts` | Tài khoản ngân hàng |
| `kiotviet_get_surcharges` | Danh sách thu khác |

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT

### Bước 1: Cài Node.js
Tải và cài Node.js v18+ từ: https://nodejs.org

### Bước 2: Giải nén và cài thư viện
```bash
cd kiotviet-mcp-server
npm install
```

### Bước 3: Tạo file .env
```bash
cp .env.example .env
```
Mở file `.env` và điền thông tin:
- `KIOTVIET_RETAILER`: Tên gian hàng (xem trong URL KiotViet)
- `KIOTVIET_CLIENT_ID`: Lấy từ KiotViet > Thiết lập > Kết nối API
- `KIOTVIET_CLIENT_SECRET`: Mã bảo mật từ KiotViet

### Bước 4: Build
```bash
npm run build
```

### Bước 5: Chạy thử local
```bash
npm start
```
Nếu thấy: `✅ KiotViet MCP Server đang chạy tại http://localhost:3000/mcp` → Thành công!

---

## ☁️ DEPLOY LÊN RAILWAY (Miễn phí)

1. Đăng ký tại https://railway.app (dùng tài khoản GitHub)
2. Tạo project mới → Deploy from GitHub
3. Upload code lên GitHub repo mới
4. Trong Railway, vào **Variables** và thêm:
   - `KIOTVIET_RETAILER`
   - `KIOTVIET_CLIENT_ID`
   - `KIOTVIET_CLIENT_SECRET`
   - `TRANSPORT=http`
5. Railway sẽ tự build và cho bạn một URL dạng: `https://xxx.railway.app`

---

## 🔌 KẾT NỐI VỚI CLAUDE.AI

1. Vào https://claude.ai → **Settings** → **Integrations**
2. Nhấn **Add MCP Server**
3. Nhập URL: `https://your-railway-url.railway.app/mcp`
4. Lưu lại
5. Trong chat mới, Claude sẽ có thể dùng tất cả tools KiotViet!

---

## 💬 Ví dụ câu hỏi sau khi kết nối

- "Kiểm tra tồn kho sản phẩm aptomat Schneider"
- "Hôm nay bán được bao nhiêu đơn hàng?"
- "Cho tôi xem danh sách khách hàng nợ tiền"
- "Sản phẩm nào sắp hết hàng?"
- "Doanh thu tháng này là bao nhiêu?"
