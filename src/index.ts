import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";

// ─── IMPORT TOOLS ───────────────────────────────────────────────────────────
// Để thêm tool mới: import registerXxxTools từ file mới, rồi thêm vào createServer()
import { registerRevenueTools } from "./tools/revenue.js";
import { registerProductTools } from "./tools/products.js";
import { registerSupplierTools } from "./tools/suppliers.js";
import { registerSalesTools } from "./tools/sales.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerReportTools } from "./tools/report.js";
import { registerBranchTools } from "./tools/branches.js";
import { registerOrderTools } from "./tools/orders.js";

// ─── TẠO SERVER (gọi mỗi request cho stateless mode) ──────────────────────
function createServer(): McpServer {
  const server = new McpServer({ name: "kiotviet-mcp-server", version: "2.0.0" });

  // Đăng ký tools — thêm/bỏ tool ở đây không cần đụng vào code khác
  registerRevenueTools(server);   // doanh thu, chi nhánh
  registerProductTools(server);   // hàng hóa, tồn kho
  registerSupplierTools(server);  // nhà cung cấp, phiếu nhập
  registerSalesTools(server);     // đơn hàng, phân tích bán hàng
  registerCustomerTools(server);  // khách hàng
  registerReportTools(server);    // báo cáo tổng hợp

  registerBranchTools(server);
  registerOrderTools(server);

  return server;
}

// ─── HTTP SERVER ────────────────────────────────────────────────────────────
async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok", version: "2.0.0",
      retailer: process.env.KIOTVIET_RETAILER || "NOT SET",
      hasClientId: !!process.env.KIOTVIET_CLIENT_ID,
      hasClientSecret: !!process.env.KIOTVIET_CLIENT_SECRET,
    });
  });

  app.head("/", (_req, res) => { res.setHeader("MCP-Protocol-Version", "2025-06-18"); res.status(200).end(); });
  app.head("/mcp", (_req, res) => { res.setHeader("MCP-Protocol-Version", "2025-06-18"); res.status(200).end(); });

  async function handleMcp(req: express.Request, res: express.Response): Promise<void> {
    try {
      const method = req.body?.method || "unknown";
      console.error(`📨 ${new Date().toISOString()} - ${method}`);
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on("close", () => transport.close());
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("❌ MCP error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    }
  }

  app.post("/", handleMcp);
  app.post("/mcp", handleMcp);

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, () => {
    console.error(`✅ KiotViet MCP Server v2.0 đang chạy tại http://localhost:${port}`);
    console.error(`📋 Retailer: ${process.env.KIOTVIET_RETAILER || "(chưa cài đặt)"}`);
    console.error(`🛠️  Tools: doanh_thu, chi_nhanh, hang_hoa, ton_kho, nha_cung_cap, phieu_nhap, don_hang, phan_tich_ban_hang, khach_hang, bao_cao_tong_hop`);
  });
}

// ─── STDIO (cho Claude Desktop) ─────────────────────────────────────────────
async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ KiotViet MCP Server v2.0 (stdio) đã khởi động");
}

const mode = process.env.TRANSPORT || "http";
(mode === "http" ? runHTTP() : runStdio()).catch(err => { console.error("Lỗi:", err); process.exit(1); });
