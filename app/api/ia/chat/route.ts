import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "El chat de IA está en evaluación y por ahora no está disponible." }, { status: 503 });
}
