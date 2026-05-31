import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, handleApiError } from "../services/kiotviet.js";

interface Supplier { id: number; code: string; name: string; contactNumber?: string; email?: string; address?: string; debt?: number; totalInvoice?: number; }
interface SupplierRes { total: number; data: Supplier[]; }
interface PurchaseOrderDetail { productId: number; productCode: string; productName: string; quantity: number; price: number; }
interface PurchaseOrder {
  id: number; code: string; purchaseDate: string;
  supplierId?: number; supplierName?: string; supplierCode?: string;
  totalAmount?: number; totalPayment?: number; status?: string;
  purchaseOrderDetails?: PurchaseOrderDetail[];
}
interface PORes { total: number; data: PurchaseOrder[]; }
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
const today = () => new Date().toISOString().split("T")[0];
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; };

export function registerSupplierTools(server: McpServer): void {
  // TOOL 5: Danh sách nhà cung cấp với công nợ
  server.tool(
    "kiotviet_nha_cung_cap",
    "Xem danh sách nhà cung cấp kèm công nợ hiện tại. Dùng khi hỏi về nhà cung cấp, nợ nhà cung cấp",
    {
      pageSize: z.number().optional().default(50).describe("Số lượng mỗi trang"),
      searchTerm: z.string().optional().describe("Tìm theo tên nhà cung cấp"),
    },
    async ({ pageSize = 50, searchTerm }) => {
      try {
        const params: Record<string, unknown> = { pageSize: Math.min(pageSize, 100) };
        if (searchTerm) params.searchTerm = searchTerm;

        const res = await apiGet<SupplierRes>("/suppliers", params);
        const suppliers = res.data || [];

        const totalDebt = suppliers.reduce((s, sup) => s + (sup.debt || 0), 0);

        let r = `🏭 DANH SÁCH NHÀ CUNG CẤP\n`;
        if (searchTerm) r += `🔍 Tìm: "${searchTerm}"\n`;
        r += `Tổng: ${res.total} nhà cung cấp | Hiển thị: ${suppliers.length}\n${"─".repeat(50)}\n`;

        const sorted = [...suppliers].sort((a, b) => (b.debt || 0) - (a.debt || 0));
        for (const s of sorted) {
          r += `\n🏭 ${s.name} [${s.code}]\n`;
          if (s.contactNumber) r += `   📞 ${s.contactNumber}\n`;
          if (s.email) r += `   📧 ${s.email}\n`;
          if (s.address) r += `   📍 ${s.address}\n`;
          const debt = s.debt || 0;
          r += `   💰 Công nợ: ${fmt(debt)} ${debt > 0 ? "⚠️ CÒN NỢ" : "✅ ĐÃ THANH TOÁN"}\n`;
        }

        r += `\n${"─".repeat(50)}\n💸 TỔNG CÔNG NỢ NHÀ CUNG CẤP: ${fmt(totalDebt)}`;
        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );

  // TOOL 6: Chi tiết phiếu nhập từ nhà cung cấp
  server.tool(
    "kiotviet_phieu_nhap",
    "Xem chi tiết phiếu nhập hàng từ nhà cung cấp: ngày nhập, hàng nhập, tổng tiền, công nợ. Dùng khi hỏi về nhập hàng, phiếu nhập",
    {
      fromDate: z.string().optional().describe("Ngày bắt đầu YYYY-MM-DD (mặc định đầu tháng)"),
      toDate: z.string().optional().describe("Ngày kết thúc YYYY-MM-DD (mặc định hôm nay)"),
      supplierId: z.number().optional().describe("ID nhà cung cấp cụ thể (bỏ trống = tất cả)"),
      pageSize: z.number().optional().default(20).describe("Số phiếu mỗi trang"),
    },
    async ({ fromDate, toDate, supplierId, pageSize = 20 }) => {
      try {
        const from = fromDate || firstOfMonth();
        const to = toDate || today();
        const params: Record<string, unknown> = {
          fromPurchaseDate: from,
          toPurchaseDate: to,
          pageSize: Math.min(pageSize, 50),
          includePayment: true,
        };
        if (supplierId) params.supplierId = supplierId;

        const res = await apiGet<PORes>("/purchaseorders", params);
        const orders = res.data || [];

        const totalAmount = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
        const totalPaid = orders.reduce((s, o) => s + (o.totalPayment || 0), 0);

        let r = `📥 PHIẾU NHẬP HÀNG\n📅 ${from} → ${to}\n`;
        r += `Tổng: ${res.total} phiếu | Hiển thị: ${orders.length}\n${"─".repeat(50)}\n`;

        for (const o of orders) {
          const date = o.purchaseDate ? o.purchaseDate.split("T")[0] : "?";
          r += `\n📋 Phiếu ${o.code} | ${date}\n`;
          r += `   🏭 NCC: ${o.supplierName || "Không rõ"}\n`;
          r += `   💰 Tổng tiền: ${fmt(o.totalAmount || 0)}\n`;
          r += `   ✅ Đã trả  : ${fmt(o.totalPayment || 0)}\n`;
          const debt = (o.totalAmount || 0) - (o.totalPayment || 0);
          if (debt > 0) r += `   ⚠️ Còn nợ  : ${fmt(debt)}\n`;
          r += `   Trạng thái: ${translateStatus(o.status)}\n`;

          if (o.purchaseOrderDetails && o.purchaseOrderDetails.length > 0) {
            r += `   📦 Hàng nhập:\n`;
            for (const d of o.purchaseOrderDetails.slice(0, 5)) {
              r += `      • ${d.productName}: ${d.quantity} × ${fmt(d.price)}\n`;
            }
            if (o.purchaseOrderDetails.length > 5) r += `      ... và ${o.purchaseOrderDetails.length - 5} mặt hàng khác\n`;
          }
        }

        r += `\n${"─".repeat(50)}\n📊 TỔNG KẾT:\n`;
        r += `   Tổng nhập : ${fmt(totalAmount)}\n`;
        r += `   Đã thanh toán: ${fmt(totalPaid)}\n`;
        r += `   Còn nợ NCC: ${fmt(totalAmount - totalPaid)}\n`;
        if (res.total > orders.length) r += `\n⚠️ Còn ${res.total - orders.length} phiếu khác. Tăng pageSize để xem thêm.`;

        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );
}

function translateStatus(status?: string): string {
  const map: Record<string, string> = {
    "Completed": "Hoàn thành",
    "Processing": "Đang xử lý",
    "Canceled": "Đã hủy",
    "BackOrder": "Đặt hàng sau",
  };
  return status ? (map[status] || status) : "Không rõ";
}
