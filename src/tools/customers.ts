import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, handleApiError } from "../services/kiotviet.js";

interface Customer {
  id: number; code: string; name: string;
  contactNumber?: string; email?: string; address?: string;
  debt?: number; totalInvoiced?: number; totalRevenue?: number;
  rewardPoint?: number; groupName?: string;
}
interface CustomerRes { total: number; data: Customer[]; }
interface InvoiceDetail { productName: string; quantity: number; price: number; }
interface Invoice {
  id: number; code: string; purchaseDate: string;
  branchName: string; total: number; totalPayment: number;
  invoiceDetails?: InvoiceDetail[];
}
interface InvoiceRes { total: number; data: Invoice[]; }
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";

export function registerCustomerTools(server: McpServer): void {

  // TOOL: Tra cứu khách hàng theo số điện thoại + lịch sử mua hàng
  server.tool(
    "kiotviet_tra_cuu_sdt",
    "Tra cứu thông tin khách hàng theo số điện thoại và xem lịch sử mua hàng. Dùng khi hỏi về khách hàng cụ thể, tìm theo SĐT, lịch sử đơn hàng của khách",
    {
      phone: z.string().describe("Số điện thoại cần tra cứu (ví dụ: 0901234567)"),
      showOrders: z.boolean().optional().default(true).describe("Hiện lịch sử đơn hàng gần đây (mặc định: có)"),
      orderLimit: z.number().optional().default(10).describe("Số đơn hàng gần nhất muốn xem (mặc định: 10)"),
    },
    async ({ phone, showOrders = true, orderLimit = 10 }) => {
      try {
        // Chuẩn hóa SĐT: bỏ khoảng trắng, dấu +84 → 0
        const cleanPhone = phone.trim().replace(/^(\+84|84)/, "0").replace(/\s/g, "");

        // Tìm khách theo contactNumber (chính xác hơn searchTerm)
        const res = await apiGet<CustomerRes>("/customers", {
          contactNumber: cleanPhone,
          pageSize: 10,
        });

        // Nếu không tìm thấy, thử lại với searchTerm
        let customers = res.data || [];
        if (customers.length === 0) {
          const res2 = await apiGet<CustomerRes>("/customers", {
            searchTerm: cleanPhone,
            pageSize: 10,
          });
          customers = (res2.data || []).filter(c =>
            c.contactNumber?.replace(/\s/g, "").includes(cleanPhone) ||
            cleanPhone.includes(c.contactNumber?.replace(/\s/g, "") || "____")
          );
        }

        if (customers.length === 0) {
          return { content: [{ type: "text", text: `❌ Không tìm thấy khách hàng nào với SĐT: ${cleanPhone}\n\nCó thể SĐT chưa được lưu vào KiotViet hoặc nhập sai số.` }] };
        }

        let r = `📱 KẾT QUẢ TRA CỨU SĐT: ${cleanPhone}\n${"─".repeat(50)}\n`;

        for (const c of customers) {
          r += `\n👤 ${c.name} [${c.code}]\n`;
          if (c.contactNumber) r += `   📞 ${c.contactNumber}\n`;
          if (c.address) r += `   📍 ${c.address}\n`;
          if (c.groupName) r += `   🏷️ Nhóm: ${c.groupName}\n`;
          if (c.totalRevenue) r += `   💳 Tổng đã mua: ${fmt(c.totalRevenue)}\n`;
          if (c.totalInvoiced) r += `   🧾 Số lần mua: ${c.totalInvoiced} đơn\n`;
          if (c.rewardPoint) r += `   ⭐ Điểm tích lũy: ${c.rewardPoint}\n`;
          const debt = c.debt || 0;
          if (debt > 0) r += `   ⚠️ Đang nợ: ${fmt(debt)}\n`;

          // Lấy lịch sử đơn hàng nếu cần
          if (showOrders && c.id) {
            try {
              const invRes = await apiGet<InvoiceRes>("/invoices", {
                customerIds: c.id,
                pageSize: Math.min(orderLimit, 20),
              });
              const invoices = invRes.data || [];

              if (invoices.length === 0) {
                r += `   📋 Chưa có hóa đơn nào\n`;
              } else {
                r += `\n   📋 LỊCH SỬ MUA HÀNG (${invoices.length} đơn gần nhất / tổng ${invRes.total}):\n`;
                for (const inv of invoices) {
                  const date = inv.purchaseDate?.split("T")[0];
                  r += `\n   🧾 ${inv.code} | ${date} | ${inv.branchName}\n`;
                  r += `      💰 ${fmt(inv.total)}`;
                  const unpaid = inv.total - inv.totalPayment;
                  if (unpaid > 0) r += ` | ⚠️ Còn nợ: ${fmt(unpaid)}`;
                  r += "\n";
                  if (inv.invoiceDetails && inv.invoiceDetails.length > 0) {
                    for (const d of inv.invoiceDetails.slice(0, 3)) {
                      r += `      • ${d.productName}: ${d.quantity} × ${fmt(d.price)}\n`;
                    }
                    if (inv.invoiceDetails.length > 3) {
                      r += `      ... và ${inv.invoiceDetails.length - 3} SP khác\n`;
                    }
                  }
                }
              }
            } catch {
              r += `   ⚠️ Không lấy được lịch sử đơn hàng\n`;
            }
          }
        }

        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );

  // TOOL: Danh sách khách hàng (giữ nguyên, sửa tìm kiếm)
  server.tool(
    "kiotviet_khach_hang",
    "Xem danh sách khách hàng, công nợ khách hàng, thông tin liên hệ. Dùng khi hỏi về danh sách khách hàng, nợ khách hàng",
    {
      pageSize: z.number().optional().default(30).describe("Số khách mỗi trang"),
      page: z.number().optional().default(1).describe("Trang số"),
      searchTerm: z.string().optional().describe("Tìm theo tên khách hàng"),
      phone: z.string().optional().describe("Tìm theo số điện thoại chính xác"),
      hasDebt: z.boolean().optional().describe("true = chỉ hiện khách đang nợ"),
      groupName: z.string().optional().describe("Lọc theo nhóm khách hàng"),
    },
    async ({ pageSize = 30, page = 1, searchTerm, phone, hasDebt, groupName }) => {
      try {
        const params: Record<string, unknown> = {
          pageSize: Math.min(pageSize, 100),
          currentItem: (page - 1) * Math.min(pageSize, 100),
        };
        if (searchTerm) params.searchTerm = searchTerm;
        if (phone) params.contactNumber = phone.trim().replace(/^(\+84|84)/, "0");
        if (groupName) params.groupName = groupName;
        if (hasDebt) params.hasDebt = true;

        const res = await apiGet<CustomerRes>("/customers", params);
        const customers = res.data || [];
        const totalPages = Math.ceil(res.total / Math.min(pageSize, 100));
        const totalDebt = customers.reduce((s, c) => s + (c.debt || 0), 0);

        let r = `👥 DANH SÁCH KHÁCH HÀNG\n`;
        if (searchTerm) r += `🔍 Tên: "${searchTerm}"\n`;
        if (phone) r += `📞 SĐT: "${phone}"\n`;
        if (hasDebt) r += `⚠️ Lọc: khách đang nợ\n`;
        r += `Tổng: ${res.total} khách | Trang ${page}/${totalPages}\n${"─".repeat(50)}\n`;

        const sorted = [...customers].sort((a, b) => (b.debt || 0) - (a.debt || 0));
        for (const c of sorted) {
          r += `\n👤 ${c.name} [${c.code}]\n`;
          if (c.contactNumber) r += `   📞 ${c.contactNumber}\n`;
          if (c.groupName) r += `   🏷️ Nhóm: ${c.groupName}\n`;
          if (c.totalRevenue) r += `   💳 Tổng mua: ${fmt(c.totalRevenue)}\n`;
          const debt = c.debt || 0;
          if (debt > 0) r += `   ⚠️ Còn nợ: ${fmt(debt)}\n`;
          if (c.rewardPoint) r += `   ⭐ Điểm: ${c.rewardPoint}\n`;
        }

        if (customers.length === 0) r += "\nKhông tìm thấy khách hàng nào.";
        if (totalDebt > 0) r += `\n${"─".repeat(50)}\n💰 Tổng công nợ: ${fmt(totalDebt)}`;
        if (totalPages > 1 && page < totalPages) r += `\n📄 Còn ${totalPages - page} trang.`;
        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );
}
