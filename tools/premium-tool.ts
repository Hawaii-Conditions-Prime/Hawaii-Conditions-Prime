import { NextRequest, NextResponse } from "next/server";
import { build402Response } from "@/lib/payment-response";
import { verifyPayment } from "@/lib/verify-payment";
import { executeTool } from "@/lib/execute-tool";

const TOOL_PRICES: Record<string, number> = {
  get_surf_report: 50,       // $0.50
  get_weather_forecast: 25,  // $0.25
  run_analysis: 200,         // $2.00
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tool, params, payment_intent_id } = body;

  const price = TOOL_PRICES[tool];
  if (!price) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
  }

  // Check if client is presenting a completed payment
  if (payment_intent_id) {
    const verified = await verifyPayment(payment_intent_id, tool);
    if (verified) {
      // Payment confirmed — execute the tool
      return NextResponse.json(await executeTool(tool, params));
    }
  }

  // No valid payment — issue the challenge
  const { status, body: challenge } = await build402Response({
    toolName: tool,
    amount: price,
    description: `MCP Tool: ${tool}`,
    callerId: req.headers.get("x-caller-id") ?? undefined,
  });

  return NextResponse.json(challenge, { status });
}
