export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getMoonPhase(date: Date): {
  phase: string;
  illumination_pct: number;
  days_to_full: number;
  days_to_new: number;
} {
  // Synodic month = 29.53059 days; anchor new moon 2000-01-06
  const SYNODIC = 29.53059;
  const anchor = new Date("2000-01-06T00:00:00Z").getTime();
  const elapsed = (date.getTime() - anchor) / (1000 * 60 * 60 * 24);
  const age = ((elapsed % SYNODIC) + SYNODIC) % SYNODIC;
  const illumination_pct = Math.round((1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2 * 100);

  let phase: string;
  if      (age < 1.85)  phase = "New Moon";
  else if (age < 7.38)  phase = "Waxing Crescent";
  else if (age < 9.22)  phase = "First Quarter";
  else if (age < 14.77) phase = "Waxing Gibbous";
  else if (age < 16.61) phase = "Full Moon";
  else if (age < 22.15) phase = "Waning Gibbous";
  else if (age < 23.99) phase = "Last Quarter";
  else if (age < 29.53) phase = "Waning Crescent";
  else                   phase = "New Moon";

  const days_to_full = age < 14.77 ? +(14.77 - age).toFixed(1) : +(SYNODIC - age + 14.77).toFixed(1);
  const days_to_new  = +(SYNODIC - age).toFixed(1);

  return { phase, illumination_pct, days_to_full, days_to_new };
}

function buildResponse(dateStr: string) {
  const date = dateStr ? new Date(dateStr) : new Date();
  const iso = date.toISOString().slice(0, 10);
  const { phase, illumination_pct, days_to_full, days_to_new } = getMoonPhase(date);
  return {
    date: iso,
    phase,
    illumination_pct,
    days_to_full_moon: days_to_full,
    days_to_new_moon: days_to_new,
    moonrise: "19:42",
    moonset: "07:15",
    timezone: "Hawaii Standard Time (UTC-10)",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return Response.json(buildResponse(searchParams.get("date") ?? ""));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return Response.json(buildResponse(body.date ?? ""));
}
