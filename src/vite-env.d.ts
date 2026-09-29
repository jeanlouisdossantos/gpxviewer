/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL du fond de carte, ex: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png */
  readonly VITE_TILE_URL?: string;
  /** Attribution HTML affichée en bas de carte pour le fond de carte */
  readonly VITE_TILE_ATTRIBUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
