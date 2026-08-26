import { freeToolRoute } from "@/lib/gpt-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = freeToolRoute("get_moon_phase");
