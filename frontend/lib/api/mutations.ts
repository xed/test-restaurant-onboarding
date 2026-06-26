"use client";

import { useMutation } from "@tanstack/react-query";

import {
  ParseApiError,
  parseBankAccount,
  parseLegal,
  parseMenu
} from "@/lib/api/client";
import type {
  BankAccountParseResponse,
  LegalParseResponse,
  MenuParseResponse
} from "@/lib/api/types";

export function useParseLegalMutation() {
  return useMutation<LegalParseResponse, ParseApiError, File>({
    mutationFn: (file) => parseLegal(file)
  });
}

export function useParseBankAccountMutation() {
  return useMutation<BankAccountParseResponse, ParseApiError, File>({
    mutationFn: (file) => parseBankAccount(file)
  });
}

export function useParseMenuMutation() {
  return useMutation<MenuParseResponse, ParseApiError, File[] | FileList>({
    mutationFn: (files) => parseMenu(files)
  });
}
