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
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";

export function registerCustomerTools(server: McpServer): void {
  // TOOL 9: Danh sách khách hàng
  server.tool(
    "kiotviet_khach_hang",
    "Xem danh sách khách hàng, công nợ khách hàng, thông tin liên hệ. Dùng khi hỏi về khách hàng, nợ khách hàng",
    {
      pageSize: z.number().optional().default(30).describe("Số khách mỗi trang"),
      page: z.number().optional().default(1).describe("Trang số"),
      searchTerm: z.string().optional().describe("Tìm theo tên hoặc số điện thoại"),
      hasDebt: z.boolean().optional().describe("true = chỉ hiện khách đang nợ"),
      groupName: z.string().optional().describe("Lọc theo nhóm khách hàng"),
    },
    async ({ pageSize = 30, page = 1, searchTerm, hasDebt, groupName }) => {
      try {
        const params: Record<string, unknown> = {
          pageSize: Math.min(pageSize, 100),
          currentItem: (page - 1) * Math.min(pageSize, 100),
        };
        if (searchTerm) params.searchTerm = searchTerm;
        if (groupName) params.groupName = groupName;
        if (hasDebt) params.hasDebt = true;

        const res = await apiGet<CustomerRes>("/customers", params);
        const customers = res.data || [];
        const totalPages = Math.ceil(res.total / Math.min(pageSize, 100));
        const totalDebt = customers.reduce((s, c) => s + (c.debt || 0), 0);

        let r = `👥 DANH SÁCH KHÁCH HÀNG\n`;
        if (searchTerm) r += `🔍 Tìm: "${searchTerm}"\n`;
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
        if (totalDebt > 0) r += `\n${"─".repeat(50)}\n💰 Tổng công nợ khách hàng: ${fmt(totalDebt)}`;
        if (totalPages > 1 && page < totalPages) r += `\n📄 Còn ${totalPages - page} trang.`;
        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );
}
