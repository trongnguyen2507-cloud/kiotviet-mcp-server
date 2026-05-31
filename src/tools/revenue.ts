import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, handleApiError } from "../services/kiotviet.js";

interface Invoice {
  id: number; code: string; purchaseDate: string;
  branchId: number; branchName: string;
  total: number; totalPayment: number; discount: number;
}
interface InvoiceRes { total: number; data: Invoice[]; }
interface Branch { id: number; branchName: string; isActive: boolean; }
interface BranchRes { data: Branch[]; }

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
const today = () => new Date().toISOString().split("T")[0];
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; };

async function fetchAllInvoices(params: Record<string, unknown>): Promise<Invoice[]> {
  const all: Invoice[] = [];
  let currentItem = 0;
  while (true) {
    const res = await apiGet<InvoiceRes>("/invoices", { ...params, pageSize: 100, currentItem });
    const data = res.data || [];
    all.push(...data);
    if (all.length >= res.total || data.length < 100) break;
    currentItem += 100;
    if (currentItem > 2000) break; // giới hạn 2000 hóa đơn
  }
  return all;
}

export function registerRevenueTools(server: McpServer): void {
  // TOOL 1: Doanh thu theo chi nhánh
  server.tool(
    "kiotviet_doanh_thu",
    "Xem doanh thu bán hàng theo chi nhánh trong khoảng thời gian. Dùng khi hỏi về doanh thu, tiền bán hàng, tổng thu",
    {
      fromDate: z.string().optional().describe("Ngày bắt đầu YYYY-MM-DD (mặc định đầu tháng)"),
      toDate: z.string().optional().describe("Ngày kết thúc YYYY-MM-DD (mặc định hôm nay)"),
      branchId: z.number().optional().describe("ID chi nhánh cụ thể, bỏ trống = tất cả"),
    },
    async ({ fromDate, toDate, branchId }) => {
      try {
        const from = fromDate || firstOfMonth();
        const to = toDate || today();
        const params: Record<string, unknown> = { fromPurchaseDate: from, toPurchaseDate: to };
        if (branchId) params.branchId = branchId;

        const [branchRes, invoices] = await Promise.all([
          apiGet<BranchRes>("/branches"),
          fetchAllInvoices(params),
        ]);

        const byBranch: Record<number, { name: string; revenue: number; paid: number; count: number }> = {};
        for (const inv of invoices) {
          if (!byBranch[inv.branchId]) byBranch[inv.branchId] = { name: inv.branchName || `CN ${inv.branchId}`, revenue: 0, paid: 0, count: 0 };
          byBranch[inv.branchId].revenue += inv.total || 0;
          byBranch[inv.branchId].paid += inv.totalPayment || 0;
          byBranch[inv.branchId].count++;
        }

        const totalRevenue = Object.values(byBranch).reduce((s, b) => s + b.revenue, 0);
        const totalPaid = Object.values(byBranch).reduce((s, b) => s + b.paid, 0);

        let r = `📊 BÁO CÁO DOANH THU\n📅 ${from} → ${to}\n${"─".repeat(40)}\n`;
        const branches = branchRes.data || [];
        const sorted = Object.entries(byBranch).sort(([,a],[,b]) => b.revenue - a.revenue);

        for (const [id, d] of sorted) {
          r += `\n🏪 ${d.name}\n`;
          r += `   Doanh thu : ${fmt(d.revenue)}\n`;
          r += `   Đã thu    : ${fmt(d.paid)}\n`;
          r += `   Còn nợ    : ${fmt(d.revenue - d.paid)}\n`;
          r += `   Hóa đơn   : ${d.count} đơn\n`;
        }

        if (sorted.length === 0) {
          r += "\n⚠️ Không có hóa đơn trong khoảng thời gian này.";
        } else {
          r += `\n${"─".repeat(40)}\n📈 TỔNG TẤT CẢ CHI NHÁNH\n`;
          r += `   Tổng doanh thu : ${fmt(totalRevenue)}\n`;
          r += `   Tổng đã thu    : ${fmt(totalPaid)}\n`;
          r += `   Tổng còn nợ   : ${fmt(totalRevenue - totalPaid)}\n`;
          r += `   Tổng hóa đơn  : ${invoices.length} đơn\n`;
          if (branches.length > 0) {
            const inactiveBranches = branches.filter(b => !byBranch[b.id]).map(b => b.branchName);
            if (inactiveBranches.length) r += `\n⚪ Chi nhánh không có doanh thu: ${inactiveBranches.join(", ")}`;
          }
        }
        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );

  // TOOL 2: Chi nhánh (phụ trợ)
  server.tool(
    "kiotviet_chi_nhanh",
    "Lấy danh sách chi nhánh và ID của từng chi nhánh. Dùng để biết ID chi nhánh trước khi lọc báo cáo",
    {},
    async () => {
      try {
        const res = await apiGet<BranchRes>("/branches");
        const branches = res.data || [];
        let r = `🏪 DANH SÁCH CHI NHÁNH (${branches.length} chi nhánh)\n${"─".repeat(40)}\n`;
        for (const b of branches) {
          r += `• [ID: ${b.id}] ${b.branchName} ${b.isActive ? "✅" : "❌ (đã tắt)"}\n`;
        }
        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );
}
