import type {
  BankAccountParseResponse,
  LegalParseResponse,
  MenuParseResponse,
  ParseErrorResponse
} from "@/lib/api/types";

const DEFAULT_API_BASE_URL = "http://localhost:8080";

type RequestOptions = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

export class ParseApiError extends Error {
  readonly status: number;
  readonly response: ParseErrorResponse;

  constructor(status: number, response: ParseErrorResponse) {
    super(response.message);
    this.name = "ParseApiError";
    this.status = status;
    this.response = response;
  }
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? DEFAULT_API_BASE_URL;
}

export function isParseApiError(error: unknown): error is ParseApiError {
  return error instanceof ParseApiError;
}

export async function parseLegal(file: File, options?: RequestOptions) {
  const formData = new FormData();
  formData.append("file", file);

  return postMultipart<LegalParseResponse>("/parse/legal", formData, options);
}

export async function parseBankAccount(file: File, options?: RequestOptions) {
  const formData = new FormData();
  formData.append("file", file);

  return postMultipart<BankAccountParseResponse>(
    "/parse/bank_account",
    formData,
    options
  );
}

export async function parseMenu(files: File[] | FileList, options?: RequestOptions) {
  const formData = new FormData();

  for (const file of Array.from(files)) {
    formData.append("files[]", file);
  }

  return postMultipart<MenuParseResponse>("/parse/menu", formData, options);
}

async function postMultipart<TResponse>(
  path: string,
  body: FormData,
  options?: RequestOptions
) {
  const fetcher = options?.fetcher ?? fetch;

  let response: Response;
  try {
    response = await fetcher(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      body,
      signal: options?.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new ParseApiError(0, {
      error: "network_error",
      message: error instanceof Error ? error.message : "Request failed"
    });
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw new ParseApiError(response.status, normalizeErrorPayload(payload));
  }

  return payload as TResponse;
}

async function readJson(response: Response) {
  const text = await response.text();

  if (text.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (!response.ok) {
      return {
        error: "invalid_error_response",
        message: "Server returned a non-JSON error response"
      };
    }

    throw new ParseApiError(response.status, {
      error: "invalid_response",
      message: "Server returned a non-JSON response"
    });
  }
}

function normalizeErrorPayload(payload: unknown): ParseErrorResponse {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    "message" in payload &&
    typeof payload.error === "string" &&
    typeof payload.message === "string"
  ) {
    return {
      error: payload.error,
      message: payload.message
    };
  }

  return {
    error: "request_failed",
    message: "Upload request failed"
  };
}
