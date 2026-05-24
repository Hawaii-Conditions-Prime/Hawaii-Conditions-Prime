import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.json({
      ok: false,
      error,
      error_description: errorDescription,
    });
  }

  return NextResponse.json({
    ok: true,
    message: "Stripe OAuth callback received.",
    code_received: Boolean(code),
    state_received: Boolean(state),
  });
}
