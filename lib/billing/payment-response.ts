import "server-only";
import { NextResponse } from "next/server";
import { RateUnavailableError } from "@/lib/finance/rates";
import { PaymentError } from "./payments";

export function paymentErrorResponse(error: unknown, tag: string) {
  if (error instanceof PaymentError) {
    return NextResponse.json(
      { error: error.message, ...(error.warnings && { warnings: error.warnings, needsConfirmation: true }) },
      { status: error.status }
    );
  }
  if (error instanceof RateUnavailableError) return NextResponse.json({ error: error.message }, { status: 422 });
  console.error(`[${tag}]`, error);
  return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
}

export function parseReason(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 300) : "";
}
