import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, handleApiError } from "../services/kiotviet.js";

interface Inventory { branchId: number; branchName: string; onHand: number; }
interface Product {
  id: number; code: string; name: string; fullName?: string;
  categoryId?: number; categoryName?: string;
  basePrice: number; cost?: number;
  inventories?: Inventory[];
  isActive?: boolean;
}
interface ProductRes { total: number; data: Product[]; }
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";

export function registerProductTools(server: McpServer): void {
  // TOOL 3: Danh sách hàng hóa với giá vốn, giá bán
  server.tool(
    "kiotviet_hang_hoa",
    "Xem danh sách hàng hóa với giá bán và giá vốn. Dùng khi hỏi về sản phẩm, hàng hóa, giá vốn, giá bán, biên lợi nhuận",
    {
      pageSize: z.number().optional().default(50).describe("Số lượng mỗi trang, tối đa 100"),
      page: z.number().optional().default(1).describe("Trang số (bắt đầu từ 1)"),
      searchTerm: z.string().optional().describe("Tìm kiếm theo tên hoặc mã sản phẩm"),
      categoryName: z.string().optional().describe("Lọc theo tên nhóm hàng"),
    },
    async ({ pageSize = 50, page = 1, searchTerm, categoryName }) => {
      try {
        const params: Record<string, unknown> = {
          pageSize: Math.min(pageSize, 100),
          currentItem: (page - 1) * Math.min(pageSize, 100),
          includeInventory: true,
          includePricebook: true,
        };
        if (searchTerm) params.name = searchTerm;

        const res = await apiGet<ProductRes>("/products", params);
        const products = res.data || [];
        const totalPages = Math.ceil(res.total / Math.min(pageSize, 100));

        let r = `📦 DANH SÁCH HÀNG HÓA\n`;
        if (searchTerm) r += `🔍 Tìm kiếm: "${searchTerm}"\n`;
        r += `Trang ${page}/${totalPages} | Hiển thị ${products.length}/${res.total} sản phẩm\n${"─".repeat(50)}\n`;

        for (const p of products) {
          const margin = p.cost && p.basePrice ? ((p.basePrice - p.cost) / p.basePrice * 100).toFixed(1) : "?";
          r += `\n📌 ${p.name} [${p.code}]\n`;
          if (p.categoryName) r += `   Nhóm     : ${p.categoryName}\n`;
          r += `   Giá bán  : ${fmt(p.basePrice)}\n`;
          r += `   Giá vốn  : ${p.cost ? fmt(p.cost) : "Chưa cài"}\n`;
          if (p.cost && p.basePrice) r += `   Biên lợi : ${margin}%\n`;
          if (!p.isActive) r += `   ⚠️ Ngừng kinh doanh\n`;
        }

        if (totalPages > 1) r += `\n📄 Còn ${totalPages - page} trang. Yêu cầu page=${page + 1} để xem tiếp.`;
        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );

  // TOOL 4: Tồn kho theo chi nhánh
  server.tool(
    "kiotviet_ton_kho",
    "Xem tồn kho hàng hóa từng chi nhánh. Dùng khi hỏi về tồn kho, số lượng hàng còn, hàng sắp hết",
    {
      pageSize: z.number().optional().default(50).describe("Số lượng sản phẩm mỗi trang, tối đa 100"),
      page: z.number().optional().default(1).describe("Trang số"),
      searchTerm: z.string().optional().describe("Tìm theo tên hoặc mã sản phẩm"),
      branchName: z.string().optional().describe("Lọc theo tên chi nhánh cụ thể"),
      lowStock: z.boolean().optional().describe("true = chỉ hiện hàng sắp hết (tồn kho < 5)"),
    },
    async ({ pageSize = 50, page = 1, searchTerm, branchName, lowStock }) => {
      try {
        const params: Record<string, unknown> = {
          pageSize: Math.min(pageSize, 100),
          currentItem: (page - 1) * Math.min(pageSize, 100),
          includeInventory: true,
          includePricebook: true,
        };
        if (searchTerm) params.name = searchTerm;

        const res = await apiGet<ProductRes>("/products", params);
        let products = res.data || [];

        // Lọc hàng sắp hết nếu cần
        if (lowStock) {
          products = products.filter(p => {
            const total = (p.inventories || []).reduce((s, i) => s + (i.onHand || 0), 0);
            return total < 5;
          });
        }

        const totalPages = Math.ceil(res.total / Math.min(pageSize, 100));
        let r = `📦 TỒN KHO THEO CHI NHÁNH\n`;
        if (lowStock) r += `⚠️ Chỉ hiện hàng sắp hết (tồn < 5)\n`;
        if (searchTerm) r += `🔍 Tìm: "${searchTerm}"\n`;
        r += `Trang ${page}/${totalPages}\n${"─".repeat(50)}\n`;

        for (const p of products) {
          const inventories = p.inventories || [];
          const filtered = branchName
            ? inventories.filter(i => i.branchName?.toLowerCase().includes(branchName.toLowerCase()))
            : inventories;
          const totalStock = filtered.reduce((s, i) => s + (i.onHand || 0), 0);

          r += `\n📌 ${p.name} [${p.code}]\n`;
          if (filtered.length === 0) {
            r += `   Không có tồn kho\n`;
          } else {
            for (const inv of filtered) {
              const qty = inv.onHand || 0;
              const icon = qty <= 0 ? "🔴" : qty < 5 ? "🟡" : "🟢";
              r += `   ${icon} ${inv.branchName}: ${qty} cái\n`;
            }
            r += `   📊 Tổng tồn: ${totalStock} cái\n`;
          }
        }

        if (products.length === 0) r += "\n⚠️ Không tìm thấy sản phẩm nào.";
        if (totalPages > 1) r += `\n📄 Còn ${totalPages - page} trang. Yêu cầu page=${page + 1} để xem tiếp.`;
        return { content: [{ type: "text", text: r }] };
      } catch (e) { return { content: [{ type: "text", text: handleApiError(e) }] }; }
    }
  );
}
