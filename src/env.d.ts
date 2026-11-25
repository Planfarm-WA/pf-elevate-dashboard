// The environment variables the app reads (Vite fills import.meta.env at build time).
interface ImportMetaEnv {
  /** e.g. https://<project-ref>.supabase.co, or the local stack's API URL. */
  readonly VITE_SUPABASE_URL?: string;
  /** The project's publishable (anon) key. Never the service_role key: VITE_ variables end up in the page. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
