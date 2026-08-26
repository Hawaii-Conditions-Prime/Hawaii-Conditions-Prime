// Moon phase, computed locally from the synodic month.
//
// Moonrise/moonset are deliberately not reported: no upstream this service
// can reach publishes them, and inventing times for an ocean-safety product
// would be worse than omitting the field.

const SYNODIC = 29.53059;
const ANCHOR_NEW_MOON = Date.UTC(2000, 0, 6);
const FULL_MOON_AGE = SYNODIC / 2;

export interface MoonPhase {
  date: string;
  phase: string;
  illumination_pct: number;
  moon_age_days: number;
  days_to_full_moon: number;
  days_to_new_moon: number;
  days_since_full_moon: number;
}

export function moonPhase(date = new Date()): MoonPhase {
  const elapsedDays = (date.getTime() - ANCHOR_NEW_MOON) / 86_400_000;
  const age = ((elapsedDays % SYNODIC) + SYNODIC) % SYNODIC;
  const illumination = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;

  let phase: string;
  if (age < 1.85) phase = "New Moon";
  else if (age < 7.38) phase = "Waxing Crescent";
  else if (age < 9.22) phase = "First Quarter";
  else if (age < 14.77) phase = "Waxing Gibbous";
  else if (age < 16.61) phase = "Full Moon";
  else if (age < 22.15) phase = "Waning Gibbous";
  else if (age < 23.99) phase = "Last Quarter";
  else phase = "Waning Crescent";

  const round1 = (n: number) => Number(n.toFixed(1));

  return {
    date: date.toISOString().slice(0, 10),
    phase,
    illumination_pct: Math.round(illumination * 100),
    moon_age_days: round1(age),
    days_to_full_moon: round1(age <= FULL_MOON_AGE ? FULL_MOON_AGE - age : SYNODIC - age + FULL_MOON_AGE),
    days_to_new_moon: round1(SYNODIC - age),
    days_since_full_moon: round1(age >= FULL_MOON_AGE ? age - FULL_MOON_AGE : age + SYNODIC - FULL_MOON_AGE),
  };
}

export function moonPhaseResponse(dateInput?: string) {
  const parsed = dateInput ? new Date(dateInput) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  return {
    ...moonPhase(date),
    timezone: "Pacific/Honolulu (HST, UTC-10)",
    note: "Phase is computed from the synodic month. Moonrise/moonset times are not included — no upstream source is available for them.",
    method: "Synodic month (29.53059 days) from the 2000-01-06 new moon epoch.",
  };
}
