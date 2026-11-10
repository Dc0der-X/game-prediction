import { withUser, type Identity } from "./db";

export type Programme = {
  id: string; slug: string; title: string; tagline: string; summary: string; overview: string; category: "programme" | "service";
  audience: string[]; prerequisites: string[]; curriculum: { title: string; weeks: string; topics: string[] }[]; outcomes: string[];
  projects: { title: string; description: string }[]; deliverables: string[]; limitations: string[];
  duration: string; delivery_format: string; instructor_info: string;
  price_usd: number | null; price_gbp: number | null; price_cad: number | null; enquiry_only: boolean; status: string; position: number;
};

export const listProgrammes = (viewer: Identity) =>
  withUser(viewer, (sql) => sql<Programme[]>`select * from programmes where status = 'published' order by position, title`);

export const getProgramme = async (viewer: Identity, slug: string) =>
  (await withUser(viewer, (sql) => sql<Programme[]>`select * from programmes where slug = ${slug} and status = 'published'`))[0] ?? null;
