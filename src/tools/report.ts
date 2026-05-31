import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, handleApiError } from "../services/kiotviet.js";

interface Invoice { branchId: number; branchName: string; total: number; totalPayment: number; }
interface InvoiceRes { total: number; data: Invoice[]; }
interface Product { id: number; name: string; inventories?: {onHand: number}[]; basePrice: number; cost?: number; }
interface ProductRes { total: number; data: Product[]; }
interface Supplier { name: string; debt?: number; }
interface SupplierRes { total: number; data: Supplier[]; }
interface Customer { debt?: number; }
interface CustomerRes { total: number; data: Customer[]; }
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
const today = () => new Date().toISOString().split("T")[0];
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; };

export function registerReportTools(server: McpServer): void {
  // TOOL 10: Báo cáo tổng hợp toàn bộ
  server.tool(
    "kiotviet_bao_cao_tong_hop",
    "Báo cáo tổng hợp toàn bộ hoạt động kinh doanh: doanh thu, tồn kho, công nợ, phân tích. Dùng khi hỏi về tổng quan kinh doanh, báo cáo tháng",
    {
      fromDate: z.string().optional().describe("Ngày bắt đầu YYYY-MM-DD (mặc định đầu tháng)"),
      toDate: z.string().optional().describe("Ngày kết thúc YYYY-MM-DD (mặc định hôm nay)"),
    },
    async ({ fromDate, toDate }) => {
      try {
        const from = fromDate || firstOfMonth();
        const to = toDate || today();

        // Song song lấy tất cả dữ liệu
        const [invoiceRes, productRes, supplierRes, customerRes] = await Promise.all([
          apiGet<InvoiceRes>("/invoices", { fromPurchaseDate: from, toPurchaseDate: to, pageSize: 100 }),
          apiGet<ProductRes>("/products", { pageSize: 100, includeInventory: true }),
          apiGet<SupplierRes>("/suppliers", { pageSize: 100 }),
          apiGet<CustomerRes>("/customers", { pageSize: 100 }),
        ]);

        const invoices = invoiceRes.data || [];
        const products = productRes.data || [];
        const suppliers = supplierRes.data || [];
        const customers = customerRes.data || [];

        // Tính doanh thu theo chi nhánh
        const byBranch: Record<string, { name: string; revenue: number; count: number }> = {};
        let totalRevenue = 0, totalPaid = 0;
        for (const inv of invoices) {
          if (!byBranch[inv.branchId]) byBranch[inv.branchId] = { name: inv.branchName || `CN ${inv.branchId}`, revenue: 0, count: 0 };
          byBranch[inv.branchId].revenue += inv.total || 0;
          byBranch[inv.branchId].count++;
          totalRevenue += inv.total || 0;
          totalPaid += inv.totalPayment || 0;
        }

        // Tồn kho
        const totalStock = products.reduce((s, p) => s + (p.inventories || []).reduce((ss, i) => ss + (i.onHand || 0), 0), 0);
        const stockValue = products.reduce((s, p) => {
          const qty = (p.inventories || []).reduce((ss, i) => ss + (i.onHand || 0), 0);
          return s + qty * (p.cost || p.basePrice || 0);
        }, 0);
        const outOfStock = products.filter(p => (p.inventories || []).reduce((s, i) => s + (i.onHand || 0), 0) <= 0).length;

        // Công nợ
        const supplierDebt = suppliers.reduce((s, sup) => s + (sup.debt || 0), 0);
        const customerDebt = customers.reduce((s, c) => s + (c.debt || 0), 0);

        const d = new Date();
        let r = `\n📊 BÁO CÁO TỔNG HỢP - ${d.toLocaleDateString("vi-VN")}\n`;
        r += `📅 Kỳ báo cáo: ${from} → ${to}\n`;
        r += `${"═".repeat(50)}\n`;

        // Doanh thu
        r += `\n💰 DOANH THU\n${"─".repeat(40)}\n`;
        const sortedBranches = Object.values(byBranch).sort((a, b) => b.revenue - a.revenue);
        for (const b of sortedBranches) {
          const pct = totalRevenue > 0 ? ((b.revenue / totalRevenue) * 100).toFixed(1) : "0";
          r += `• ${b.name}: ${fmt(b.revenue)} (${pct}%) | ${b.count} đơn\n`;
        }
        r += `📈 TỔNG DOANH THU : ${fmt(totalRevenue)}\n`;
        r += `✅ Đã thu          : ${fmt(totalPaid)}\n`;
        r += `⏳ Còn nợ KH       : ${fmt(totalRevenue - totalPaid)}\n`;
        if (invoiceRes.total > 100) r += `⚠️ Chỉ tính ${invoices.length}/${invoiceRes.total} hóa đơn\n`;

        // Tồn kho
        r += `\n📦 TỒN KHO\n${"─".repeat(40)}\n`;
        r += `• Tổng sản phẩm  : ${productRes.total}\n`;
        r += `• Tổng tồn kho   : ${totalStock} cái\n`;
        r += `• Giá trị tồn    : ${fmt(stockValue)}\n`;
        r += `• Hết hàng       : ${outOfStock} sản phẩm ⚠️\n`;

        // Công nợ
        r += `\n💳 CÔNG NỢ\n${"─".repeat(40)}\n`;
        r += `• Nợ nhà cung cấp: ${fmt(supplierDebt)} (${suppliers.filter(s => (s.debt || 0) > 0).length} NCC)\n`;
        r += `• Khách hàng nợ  : ${fmt(customerDebt)} (${customers.filter(c => (c.debt || 0) > 0).length} KH)\n`;

        // Phân tích nhanh
        r += `\n📋 PHÂN TÍCH NHANH\n${"─".repeat(40)}\n`;
        const avgOrderValue = invoices.length > 0 ? totalRevenue / invoices.length : 0;
        r += `• Giá trị trung bình/đơn: ${fmt(avgOrderValue)}\n`;
        r += `• Số đơn hàng trong kỳ : ${invoiceRes.total}\n`;
        if (sortedBranches.length > 1) {
          r += `• Chi nhánh tốt nhất   : ${sortedBranches[0].name} (${fmt(sortedBranches[0].revenue)})\n`;
          r += `• Chi nhánh yếu nhất   : ${sortedBranches[sortedBranches.length - 1].name} (${fmt(sortedBranches[sortedBranches.length - 1].revenue)})\n`;
        }
        const netCash = totalPaid - supplierDebt;
        r += `• Tiền mặt ước tính    : ${fmt(netCash)} ${netCash >= 0 ? "✅" : "⚠️ ÂM"}\n`;
        r += `\n${"═".repeat(50)}\n`;
        r += `💡 Để xem chi tiết hơn, hãy hỏi về từng mục cụ thể.`;

        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );
}
