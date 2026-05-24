// Tipos generados por Supabase MCP `generate_typescript_types`.
// Mientras no se aplica la migración inicial, este archivo es un placeholder
// que matchea el shape final de la tabla `projects` para que el código compile.
// Será sobrescrito por completo tras `apply_migration`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProjectStatus = "draft" | "active" | "exported" | "archived";
export type ProjectMode = "consultant" | "self_service";

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          client_name: string | null;
          start_date: string | null;
          status: ProjectStatus;
          mode: ProjectMode;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          client_name?: string | null;
          start_date?: string | null;
          status?: ProjectStatus;
          mode?: ProjectMode;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          client_name?: string | null;
          start_date?: string | null;
          status?: ProjectStatus;
          mode?: ProjectMode;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      project_status: ProjectStatus;
      project_mode: ProjectMode;
    };
    CompositeTypes: Record<string, never>;
  };
};
