import { isParseApiError } from "@/lib/api/client";

type ParseContext = "legal" | "banking" | "menu";

const contextLabels: Record<ParseContext, string> = {
  legal: "legal document",
  banking: "banking document",
  menu: "menu files"
};

export function formatParseError(error: unknown, context: ParseContext) {
  if (!isParseApiError(error)) {
    return `Could not parse the ${contextLabels[context]}. Try again or fill the fields manually.`;
  }

  const serverMessage = error.response.message.trim();

  switch (error.response.error) {
    case "could_not_parse":
      return `We could not read enough data from this ${contextLabels[context]}. Upload another file or fill the fields manually.`;
    case "network_error":
      return "Could not reach the parsing service. Check that the backend is running, then retry or continue manually.";
    case "unsupported_file_type":
      return "This file type is not supported here. Use a PDF or image file.";
    case "file_too_large":
      return "This file is too large to parse. Use a smaller file or fill the fields manually.";
    case "missing_file":
    case "missing_files":
      return "No file was selected. Choose a file to parse or fill the fields manually.";
    case "invalid_response":
    case "invalid_error_response":
      return "The parsing service returned an unexpected response. Retry or continue manually.";
    default:
      return (
        serverMessage ||
        `Could not parse the ${contextLabels[context]}. Try again or fill the fields manually.`
      );
  }
}
