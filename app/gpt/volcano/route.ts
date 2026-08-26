import { paidToolRoute } from "@/lib/gpt-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = paidToolRoute("get_volcano_status");
