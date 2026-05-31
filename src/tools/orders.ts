import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, handleApiError } from "../services/kiotviet.js";

export function registerOrderTools(server: McpServer): void {

  // Lấy danh sách đơn hàng
  server.registerTool(
    "kiotviet_get_orders",
    {
      title: "Lấy danh sách đơn hàng",
      description: "Lấy danh sách đặt hàng từ KiotViet. Hỗ trợ lọc theo trạng thái, ngày, khách hàng.",
      inputSchema: z.object({
        pageSize: z.number().int().min(1).max(100).default(20).describe("Số đơn mỗi trang"),
        currentItem: z.number().int().min(0).default(0).describe("Vị trí bắt đầu"),
        status: z.number().int().optional().describe("Trạng thái: 1=Đặt hàng, 2=Đang giao, 3=Hoàn thành, 4=Hủy"),
        customerId: z.number().int().optional().describe("ID khách hàng để lọc"),
        fromPurchaseDate: z.string().optional().describe("Từ ngày (format: yyyy-MM-dd)"),
        toPurchaseDate: z.string().optional().describe("Đến ngày (format: yyyy-MM-dd)"),
        branchId: z.number().int().optional().describe("ID chi nhánh"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await apiGet("/orders", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: handleApiError(e) }], isError: true };
      }
    }
  );

  // Lấy chi tiết đơn hàng
  server.registerTool(
    "kiotviet_get_order",
    {
      title: "Lấy chi tiết đơn hàng",
      description: "Lấy thông tin chi tiết một đơn hàng theo ID hoặc mã đơn.",
      inputSchema: z.object({
        id: z.number().int().optional().describe("ID đơn hàng"),
        code: z.string().optional().describe("Mã đơn hàng"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, code }) => {
      try {
        const path = code ? `/orders/code/${code}` : `/orders/${id}`;
        const data = await apiGet(path);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: handleApiError(e) }], isError: true };
      }
    }
  );

  // Tạo đơn hàng
  server.registerTool(
    "kiotviet_create_order",
    {
      title: "Tạo đơn hàng mới",
      description: "Tạo mới một đơn đặt hàng trong KiotViet.",
      inputSchema: z.object({
        customerId: z.number().int().optional().describe("ID khách hàng"),
        customerName: z.string().optional().describe("Tên khách hàng"),
        branchId: z.number().int().describe("ID chi nhánh"),
        orderDetails: z.array(z.object({
          productId: z.number().int().describe("ID sản phẩm"),
          quantity: z.number().describe("Số lượng"),
          price: z.number().describe("Giá bán"),
        })).describe("Danh sách sản phẩm trong đơn"),
        description: z.string().optional().describe("Ghi chú đơn hàng"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await apiPost("/orders", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: handleApiError(e) }], isError: true };
      }
    }
  );

  // Lấy danh sách hóa đơn
  server.registerTool(
    "kiotviet_get_invoices",
    {
      title: "Lấy danh sách hóa đơn bán hàng",
      description: "Lấy danh sách hóa đơn bán hàng. Dùng để xem doanh thu, lịch sử bán hàng.",
      inputSchema: z.object({
        pageSize: z.number().int().min(1).max(100).default(20).describe("Số hóa đơn mỗi trang"),
        currentItem: z.number().int().min(0).default(0).describe("Vị trí bắt đầu"),
        fromPurchaseDate: z.string().optional().describe("Từ ngày (format: yyyy-MM-dd)"),
        toPurchaseDate: z.string().optional().describe("Đến ngày (format: yyyy-MM-dd)"),
        customerId: z.number().int().optional().describe("ID khách hàng"),
        branchId: z.number().int().optional().describe("ID chi nhánh"),
        status: z.number().int().optional().describe("Trạng thái hóa đơn"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await apiGet("/invoices", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: handleApiError(e) }], isError: true };
      }
    }
  );

  // Lấy chi tiết hóa đơn
  server.registerTool(
    "kiotviet_get_invoice",
    {
      title: "Lấy chi tiết hóa đơn",
      description: "Lấy thông tin chi tiết một hóa đơn theo ID hoặc mã hóa đơn.",
      inputSchema: z.object({
        id: z.number().int().optional().describe("ID hóa đơn"),
        code: z.string().optional().describe("Mã hóa đơn"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, code }) => {
      try {
        const path = code ? `/invoices/code/${code}` : `/invoices/${id}`;
        const data = await apiGet(path);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: handleApiError(e) }], isError: true };
      }
    }
  );

  // Lấy phiếu nhập hàng
  server.registerTool(
    "kiotviet_get_purchase_orders",
    {
      title: "Lấy danh sách phiếu nhập hàng",
      description: "Lấy danh sách phiếu nhập hàng từ nhà cung cấp.",
      inputSchema: z.object({
        pageSize: z.number().int().min(1).max(100).default(20).describe("Số phiếu mỗi trang"),
        currentItem: z.number().int().min(0).default(0).describe("Vị trí bắt đầu"),
        fromPurchaseDate: z.string().optional().describe("Từ ngày (format: yyyy-MM-dd)"),
        toPurchaseDate: z.string().optional().describe("Đến ngày (format: yyyy-MM-dd)"),
        supplierId: z.number().int().optional().describe("ID nhà cung cấp"),
        branchId: z.number().int().optional().describe("ID chi nhánh"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await apiGet("/purchaseorders", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: handleApiError(e) }], isError: true };
      }
    }
  );
}
