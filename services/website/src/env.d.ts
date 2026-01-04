/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly CHAT_API_URL: string;
  readonly SITE_URL: string;
  readonly BASE_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
