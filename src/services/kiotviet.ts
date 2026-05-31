import axios, { AxiosInstance } from "axios";

const TOKEN_URL = "https://id.kiotviet.vn/connect/token";
const API_BASE = "https://public.kiotapi.com";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 60000) {
    return cachedToken;
  }

  const clientId = process.env.KIOTVIET_CLIENT_ID;
  const clientSecret = process.env.KIOTVIET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Thiếu KIOTVIET_CLIENT_ID hoặc KIOTVIET_CLIENT_SECRET trong biến môi trường");
  }

  const params = new URLSearchParams();
  params.append("scopes", "PublicApi.Access");
  params.append("grant_type", "client_credentials");
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);

  const response = await axios.post<TokenResponse>(TOKEN_URL, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  cachedToken = response.data.access_token;
  tokenExpiry = now + response.data.expires_in * 1000;
  return cachedToken;
}

export async function createApiClient(): Promise<AxiosInstance> {
  const retailer = process.env.KIOTVIET_RETAILER;
  if (!retailer) {
    throw new Error("Thiếu KIOTVIET_RETAILER trong biến môi trường");
  }

  const token = await getAccessToken();

  return axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      Retailer: retailer,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const client = await createApiClient();
  const response = await client.get<T>(path, { params });
  return response.data;
}

export async function apiPost<T>(path: string, data: unknown): Promise<T> {
  const client = await createApiClient();
  const response = await client.post<T>(path, data);
  return response.data;
}

export async function apiPut<T>(path: string, data: unknown): Promise<T> {
  const client = await createApiClient();
  const response = await client.put<T>(path, data);
  return response.data;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const client = await createApiClient();
  const response = await client.delete<T>(path);
  return response.data;
}

export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    return `Lỗi API KiotViet (${status}): ${message}`;
  }
  if (error instanceof Error) {
    return `Lỗi: ${error.message}`;
  }
  return "Lỗi không xác định";
}
