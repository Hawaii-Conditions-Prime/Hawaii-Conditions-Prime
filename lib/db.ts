import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Lazy so importing this module never throws when DATABASE_URL is absent
// (e.g. during `next build` page-data collection). The Neon client is created
// on first query, at request time. Used only as a tagged template: sql`...`.
type Sql = NeonQueryFunction<false, false>;

let _sql: Sql | null = null;
function client(): Sql {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  client()(strings, ...values)) as unknown as Sql;

export default sql;
