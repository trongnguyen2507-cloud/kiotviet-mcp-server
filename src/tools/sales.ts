import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, handleApiError } from "../services/kiotviet.js";

interface InvoiceDetail { productId: number; productCode: string; productName: string; quantity: number; price: number; discount?: number; }
interface Invoice {
  id: number; code: string; purchaseDate: string;
  branchId: number; branchName: string; customerName?: string;
  total: number; totalPayment: number;
  invoiceDetails?: InvoiceDetail[];
}
interface InvoiceRes { total: number; data: Invoice[]; }
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
const today = () => new Date().toISOString().split("T")[0];
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; };
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; };

export function registerSalesTools(server: McpServer): void {
  // TOOL 7: Đơn hàng bán trong ngày / khoảng thời gian
  server.tool(
    "kiotviet_don_hang",
    "Xem chi tiết đơn hàng bán ra theo ngày hoặc khoảng thời gian. Dùng khi hỏi về đơn hàng, hóa đơn, khách mua hàng",
    {
      fromDate: z.string().optional().describe("Ngày bắt đầu YYYY-MM-DD (mặc định hôm nay)"),
      toDate: z.string().optional().describe("Ngày kết thúc YYYY-MM-DD (mặc định hôm nay)"),
      branchId: z.number().optional().describe("ID chi nhánh, bỏ trống = tất cả"),
      pageSize: z.number().optional().default(20).describe("Số đơn mỗi trang (tối đa 50)"),
      page: z.number().optional().default(1).describe("Trang số"),
    },
    async ({ fromDate, toDate, branchId, pageSize = 20, page = 1 }) => {
      try {
        const from = fromDate || today();
        const to = toDate || today();
        const params: Record<string, unknown> = {
          fromPurchaseDate: from,
          toPurchaseDate: to,
          pageSize: Math.min(pageSize, 50),
          currentItem: (page - 1) * Math.min(pageSize, 50),
          includeInvoiceDelivery: false,
        };
        if (branchId) params.branchId = branchId;

        const res = await apiGet<InvoiceRes>("/invoices", params);
        const invoices = res.data || [];
        const totalPages = Math.ceil(res.total / Math.min(pageSize, 50));

        let r = `🧾 ĐƠN HÀNG BÁN RA\n📅 ${from}${from !== to ? ` → ${to}` : ""}\n`;
        r += `Tổng: ${res.total} đơn | Trang ${page}/${totalPages}\n${"─".repeat(50)}\n`;

        for (const inv of invoices) {
          const date = inv.purchaseDate?.split("T")[0];
          const time = inv.purchaseDate?.split("T")[1]?.substring(0, 5) || "";
          r += `\n🧾 ${inv.code} | ${date} ${time}\n`;
          r += `   🏪 ${inv.branchName}\n`;
          if (inv.customerName) r += `   👤 ${inv.customerName}\n`;
          r += `   💰 ${fmt(inv.total)}\n`;

          if (inv.invoiceDetails && inv.invoiceDetails.length > 0) {
            r += `   📦 Sản phẩm:\n`;
            for (const d of inv.invoiceDetails.slice(0, 4)) {
              r += `      • ${d.productName}: ${d.quantity} × ${fmt(d.price)}\n`;
            }
            if (inv.invoiceDetails.length > 4) r += `      ... và ${inv.invoiceDetails.length - 4} SP khác\n`;
          }
        }

        if (invoices.length === 0) r += "\n⚠️ Không có đơn hàng nào.";
        if (totalPages > 1 && page < totalPages) r += `\n📄 Còn ${totalPages - page} trang nữa.`;
        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );

  // TOOL 8: Phân tích sản phẩm bán chạy và ế
  server.tool(
    "kiotviet_phan_tich_ban_hang",
    "Phân tích sản phẩm bán chạy nhất và sản phẩm không bán được trong khoảng thời gian. Dùng khi hỏi về hàng bán chạy, hàng ế, hiệu quả kinh doanh",
    {
      fromDate: z.string().optional().describe("Ngày bắt đầu YYYY-MM-DD (mặc định đầu tháng)"),
      toDate: z.string().optional().describe("Ngày kết thúc YYYY-MM-DD (mặc định hôm nay)"),
      branchId: z.number().optional().describe("ID chi nhánh cụ thể, bỏ trống = tất cả"),
      topN: z.number().optional().default(10).describe("Số sản phẩm top bán chạy/ế hiển thị"),
    },
    async ({ fromDate, toDate, branchId, topN = 10 }) => {
      try {
        const from = fromDate || firstOfMonth();
        const to = toDate || today();

        // Lấy tất cả hóa đơn trong kỳ (giới hạn 500)
        const allInvoices: Invoice[] = [];
        let currentItem = 0;
        while (allInvoices.length < 500) {
          const params: Record<string, unknown> = {
            fromPurchaseDate: from, toPurchaseDate: to,
            pageSize: 100, currentItem,
          };
          if (branchId) params.branchId = branchId;
          const res = await apiGet<InvoiceRes>("/invoices", params);
          const data = res.data || [];
          allInvoices.push(...data);
          if (allInvoices.length >= res.total || data.length < 100) break;
          currentItem += 100;
        }

        // Tổng hợp theo sản phẩm
        const productStats: Record<string, { name: string; qty: number; revenue: number; orderCount: number }> = {};

        for (const inv of allInvoices) {
          for (const d of (inv.invoiceDetails || [])) {
            const key = d.productCode || String(d.productId);
            if (!productStats[key]) productStats[key] = { name: d.productName, qty: 0, revenue: 0, orderCount: 0 };
            productStats[key].qty += d.quantity;
            productStats[key].revenue += d.quantity * d.price;
            productStats[key].orderCount++;
          }
        }

        const sorted = Object.entries(productStats).sort(([,a],[,b]) => b.qty - a.qty);
        const top = sorted.slice(0, topN);
        const bottom = sorted.filter(([,s]) => s.qty < 2).slice(0, topN);

        let r = `📊 PHÂN TÍCH BÁN HÀNG\n📅 ${from} → ${to}\n`;
        if (branchId) r += `🏪 Chi nhánh ID: ${branchId}\n`;
        r += `Từ ${allInvoices.length} hóa đơn, ${sorted.length} sản phẩm khác nhau\n${"─".repeat(50)}\n`;

        r += `\n🔥 TOP ${topN} HÀNG BÁN CHẠY NHẤT:\n`;
        if (top.length === 0) {
          r += "   Không có dữ liệu\n";
        } else {
          top.forEach(([code, s], i) => {
            r += `\n${i + 1}. ${s.name} [${code}]\n`;
            r += `   Số lượng: ${s.qty} cái | ${s.orderCount} đơn hàng\n`;
            r += `   Doanh thu: ${fmt(s.revenue)}\n`;
          });
        }

        r += `\n${"─".repeat(50)}\n❄️ HÀNG BÁN ÍT / KHÔNG BÁN ĐƯỢC:\n`;
        if (bottom.length === 0) {
          r += "   Tất cả hàng đều có giao dịch tốt! ✅\n";
        } else {
          bottom.forEach(([code, s]) => {
            r += `• ${s.name}: chỉ ${s.qty} cái trong kỳ\n`;
          });
        }

        if (allInvoices.length >= 500) r += `\n⚠️ Phân tích dựa trên 500 hóa đơn gần nhất. Thu hẹp thời gian để chính xác hơn.`;
        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );
}
