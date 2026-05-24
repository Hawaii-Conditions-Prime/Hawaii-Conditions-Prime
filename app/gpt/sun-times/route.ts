export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const island = searchParams.get("island") ?? "oahu";
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  return Response.json({
    island,
    date,
    sunrise: "06:02",
    sunset: "18:47",
    solar_noon: "12:24",
    golden_hour_morning: "06:02–06:32",
    golden_hour_evening: "18:17–18:47",
    day_length_hours: 12.75,
    timezone: "Hawaii Standard Time (UTC-10)",
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const island: string = body.island ?? "oahu";
  const date: string = body.date ?? new Date().toISOString().slice(0, 10);

  return Response.json({
    island,
    date,
    sunrise: "06:02",
    sunset: "18:47",
    solar_noon: "12:24",
    golden_hour_morning: "06:02–06:32",
    golden_hour_evening: "18:17–18:47",
    day_length_hours: 12.75,
    timezone: "Hawaii Standard Time (UTC-10)",
  });
}
