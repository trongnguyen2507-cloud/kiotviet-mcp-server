import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, handleApiError } from "../services/kiotviet.js";

export function registerBranchTools(server: McpServer): void {

  // Lấy danh sách chi nhánh
  server.registerTool(
    "kiotviet_get_branches",
    {
      title: "Lấy danh sách chi nhánh",
      description: "Lấy tất cả chi nhánh của cửa hàng trong KiotViet.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const data = await apiGet("/branches");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: handleApiError(e) }], isError: true };
      }
    }
  );

  // Lấy danh sách nhân viên / người dùng
  server.registerTool(
    "kiotviet_get_users",
    {
      title: "Lấy danh sách nhân viên",
      description: "Lấy danh sách nhân viên / tài khoản người dùng trong KiotViet.",
      inputSchema: z.object({
        pageSize: z.number().int().min(1).max(100).default(20).describe("Số nhân viên mỗi trang"),
        currentItem: z.number().int().min(0).default(0).describe("Vị trí bắt đầu"),
        branchId: z.number().int().optional().describe("ID chi nhánh để lọc"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await apiGet("/users", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: handleApiError(e) }], isError: true };
      }
    }
  );

  // Lấy sổ quỹ
  server.registerTool(
    "kiotviet_get_cashflow",
    {
      title: "Lấy sổ quỹ (thu/chi)",
      description: "Lấy danh sách phiếu thu và phiếu chi trong sổ quỹ.",
      inputSchema: z.object({
        pageSize: z.number().int().min(1).max(100).default(20).describe("Số phiếu mỗi trang"),
        currentItem: z.number().int().min(0).default(0).describe("Vị trí bắt đầu"),
        fromDate: z.string().optional().describe("Từ ngày (format: yyyy-MM-dd)"),
        toDate: z.string().optional().describe("Đến ngày (format: yyyy-MM-dd)"),
        branchId: z.number().int().optional().describe("ID chi nhánh"),
        type: z.number().int().optional().describe("Loại: 1=Thu, 2=Chi"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await apiGet("/cashflow", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: handleApiError(e) }], isError: true };
      }
    }
  );

  // Lấy tài khoản ngân hàng
  server.registerTool(
    "kiotviet_get_bank_accounts",
    {
      title: "Lấy danh sách tài khoản ngân hàng",
      description: "Lấy danh sách tài khoản ngân hàng được khai báo trong KiotViet.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const data = await apiGet("/bankaccounts");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: handleApiError(e) }], isError: true };
      }
    }
  );

  // Lấy danh sách thu khác
  server.registerTool(
    "kiotviet_get_surcharges",
    {
      title: "Lấy danh sách thu khác",
      description: "Lấy danh sách các loại thu khác được cài đặt trong KiotViet.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const data = await apiGet("/surcharges");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: handleApiError(e) }], isError: true };
      }
    }
  );
}
