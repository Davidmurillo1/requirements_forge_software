export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acceptance_criteria: {
        Row: {
          created_at: string
          given_clause: string
          id: string
          project_id: string
          then_clause: string
          updated_at: string
          user_story_id: string
          when_clause: string
        }
        Insert: {
          created_at?: string
          given_clause: string
          id?: string
          project_id: string
          then_clause: string
          updated_at?: string
          user_story_id: string
          when_clause: string
        }
        Update: {
          created_at?: string
          given_clause?: string
          id?: string
          project_id?: string
          then_clause?: string
          updated_at?: string
          user_story_id?: string
          when_clause?: string
        }
        Relationships: [
          {
            foreignKeyName: "acceptance_criteria_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acceptance_criteria_user_story_id_fkey"
            columns: ["user_story_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      annotations: {
        Row: {
          body: string
          created_at: string
          id: string
          project_id: string
          target_id: string | null
          target_kind: Database["public"]["Enums"]["annotation_target_kind"]
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          project_id: string
          target_id?: string | null
          target_kind: Database["public"]["Enums"]["annotation_target_kind"]
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          target_id?: string | null
          target_kind?: Database["public"]["Enums"]["annotation_target_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      assumptions: {
        Row: {
          created_at: string
          description: string
          id: string
          project_id: string
          responsible: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          project_id: string
          responsible?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          responsible?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "assumptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      business_goals: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kpi: string | null
          priority: number | null
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kpi?: string | null
          priority?: number | null
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kpi?: string | null
          priority?: number | null
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      business_process_refs: {
        Row: {
          attachment_path: string | null
          created_at: string
          description: string | null
          id: string
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          attachment_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          attachment_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_process_refs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      detected_issues: {
        Row: {
          body: string
          created_at: string
          id: string
          project_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          turn_id: string | null
          type: Database["public"]["Enums"]["issue_type"]
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          project_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          turn_id?: string | null
          type: Database["public"]["Enums"]["issue_type"]
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          turn_id?: string | null
          type?: Database["public"]["Enums"]["issue_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "detected_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detected_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detected_issues_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_attributes: {
        Row: {
          created_at: string
          data_type: string
          description: string | null
          entity_id: string
          id: string
          is_nullable: boolean
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_type: string
          description?: string | null
          entity_id: string
          id?: string
          is_nullable?: boolean
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_type?: string
          description?: string | null
          entity_id?: string
          id?: string
          is_nullable?: boolean
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_attributes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_attributes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      glossary_terms: {
        Row: {
          created_at: string
          definition: string
          id: string
          project_id: string
          term: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition: string
          id?: string
          project_id: string
          term: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition?: string
          id?: string
          project_id?: string
          term?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "glossary_terms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          criticality: Database["public"]["Enums"]["integration_criticality"]
          direction: Database["public"]["Enums"]["integration_direction"]
          endpoint: string | null
          format: string | null
          frequency: string | null
          id: string
          name: string
          notes: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criticality?: Database["public"]["Enums"]["integration_criticality"]
          direction: Database["public"]["Enums"]["integration_direction"]
          endpoint?: string | null
          format?: string | null
          frequency?: string | null
          id?: string
          name: string
          notes?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criticality?: Database["public"]["Enums"]["integration_criticality"]
          direction?: Database["public"]["Enums"]["integration_direction"]
          endpoint?: string | null
          format?: string | null
          frequency?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      nfrs: {
        Row: {
          category: Database["public"]["Enums"]["nfr_category"]
          created_at: string
          description: string
          id: string
          metric: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["nfr_category"]
          created_at?: string
          description: string
          id?: string
          metric?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["nfr_category"]
          created_at?: string
          description?: string
          id?: string
          metric?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfrs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          created_at: string
          description: string | null
          frustrations: string | null
          goals: string | null
          id: string
          kind: Database["public"]["Enums"]["persona_kind"]
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          frustrations?: string | null
          goals?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["persona_kind"]
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          frustrations?: string | null
          goals?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["persona_kind"]
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_constraints: {
        Row: {
          created_at: string
          description: string
          id: string
          project_id: string
          rationale: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          project_id: string
          rationale?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          rationale?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_constraints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_section_progress: {
        Row: {
          completion_score: number
          last_updated_at: string
          project_id: string
          section: Database["public"]["Enums"]["elicitation_section"]
          status: Database["public"]["Enums"]["section_status"]
        }
        Insert: {
          completion_score?: number
          last_updated_at?: string
          project_id: string
          section: Database["public"]["Enums"]["elicitation_section"]
          status?: Database["public"]["Enums"]["section_status"]
        }
        Update: {
          completion_score?: number
          last_updated_at?: string
          project_id?: string
          section?: Database["public"]["Enums"]["elicitation_section"]
          status?: Database["public"]["Enums"]["section_status"]
        }
        Relationships: [
          {
            foreignKeyName: "project_section_progress_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_name: string | null
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["project_mode"]
          name: string
          owner_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          version: number
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["project_mode"]
          name: string
          owner_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          client_name?: string | null
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["project_mode"]
          name?: string
          owner_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      risks: {
        Row: {
          created_at: string
          description: string
          id: string
          impact: Database["public"]["Enums"]["risk_level"]
          mitigation: string | null
          probability: Database["public"]["Enums"]["risk_level"]
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          impact?: Database["public"]["Enums"]["risk_level"]
          mitigation?: string | null
          probability?: Database["public"]["Enums"]["risk_level"]
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          impact?: Database["public"]["Enums"]["risk_level"]
          mitigation?: string | null
          probability?: Database["public"]["Enums"]["risk_level"]
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_items: {
        Row: {
          created_at: string
          id: string
          justification: string | null
          kind: Database["public"]["Enums"]["scope_kind"]
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          justification?: string | null
          kind: Database["public"]["Enums"]["scope_kind"]
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          justification?: string | null
          kind?: Database["public"]["Enums"]["scope_kind"]
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          current_section: Database["public"]["Enums"]["elicitation_section"]
          ended_at: string | null
          id: string
          mode: Database["public"]["Enums"]["project_mode"]
          notes: string | null
          project_id: string
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          current_section?: Database["public"]["Enums"]["elicitation_section"]
          ended_at?: string | null
          id?: string
          mode: Database["public"]["Enums"]["project_mode"]
          notes?: string | null
          project_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          current_section?: Database["public"]["Enums"]["elicitation_section"]
          ended_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["project_mode"]
          notes?: string | null
          project_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          influence: Database["public"]["Enums"]["stakeholder_influence"]
          name: string
          notes: string | null
          project_id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          influence?: Database["public"]["Enums"]["stakeholder_influence"]
          name: string
          notes?: string | null
          project_id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          influence?: Database["public"]["Enums"]["stakeholder_influence"]
          name?: string
          notes?: string | null
          project_id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      turns: {
        Row: {
          actor: Database["public"]["Enums"]["session_actor"]
          client_request_id: string | null
          created_at: string
          error_code: string | null
          id: string
          payload: Json
          project_id: string
          role: Database["public"]["Enums"]["turn_role"]
          section: Database["public"]["Enums"]["elicitation_section"]
          session_id: string
          status: Database["public"]["Enums"]["turn_status"]
          token_usage: Json | null
        }
        Insert: {
          actor: Database["public"]["Enums"]["session_actor"]
          client_request_id?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          payload: Json
          project_id: string
          role: Database["public"]["Enums"]["turn_role"]
          section: Database["public"]["Enums"]["elicitation_section"]
          session_id: string
          status?: Database["public"]["Enums"]["turn_status"]
          token_usage?: Json | null
        }
        Update: {
          actor?: Database["public"]["Enums"]["session_actor"]
          client_request_id?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          payload?: Json
          project_id?: string
          role?: Database["public"]["Enums"]["turn_role"]
          section?: Database["public"]["Enums"]["elicitation_section"]
          session_id?: string
          status?: Database["public"]["Enums"]["turn_status"]
          token_usage?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "turns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stories: {
        Row: {
          action: string
          as_role: string
          benefit: string
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["story_priority"]
          project_id: string
          updated_at: string
        }
        Insert: {
          action: string
          as_role: string
          benefit: string
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["story_priority"]
          project_id: string
          updated_at?: string
        }
        Update: {
          action?: string
          as_role?: string
          benefit?: string
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["story_priority"]
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_owns_project: { Args: { p_project_id: string }; Returns: boolean }
    }
    Enums: {
      annotation_target_kind:
        | "project"
        | "user_story"
        | "nfr"
        | "entity"
        | "integration"
        | "session"
        | "other"
      elicitation_section:
        | "project_context"
        | "stakeholders_personas"
        | "scope"
        | "business_process"
        | "user_stories"
        | "nfrs"
        | "domain_data"
        | "integrations"
        | "ui_ux"
        | "constraints_assumptions_risks"
        | "glossary"
      integration_criticality: "low" | "medium" | "high"
      integration_direction: "inbound" | "outbound" | "bidirectional"
      issue_severity: "info" | "warning" | "error"
      issue_status: "open" | "resolved" | "dismissed"
      issue_type:
        | "vagueness"
        | "contradiction"
        | "missing_cross_cutting"
        | "missing_metric"
        | "undefined_glossary"
      nfr_category:
        | "functionality"
        | "usability"
        | "reliability"
        | "performance"
        | "supportability"
        | "security"
        | "compliance"
      persona_kind: "primary" | "secondary" | "antagonist"
      project_mode: "consultant" | "self_service"
      project_status: "draft" | "active" | "exported" | "archived"
      risk_level: "low" | "medium" | "high"
      scope_kind: "in" | "out"
      section_status: "not_started" | "in_progress" | "incomplete" | "complete"
      session_actor: "engine" | "consultant" | "stakeholder"
      session_status: "active" | "closed" | "abandoned"
      stakeholder_influence: "low" | "medium" | "high"
      story_priority: "must" | "should" | "could" | "wont"
      turn_role: "question" | "answer" | "followup" | "system" | "meta"
      turn_status: "ok" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      annotation_target_kind: [
        "project",
        "user_story",
        "nfr",
        "entity",
        "integration",
        "session",
        "other",
      ],
      elicitation_section: [
        "project_context",
        "stakeholders_personas",
        "scope",
        "business_process",
        "user_stories",
        "nfrs",
        "domain_data",
        "integrations",
        "ui_ux",
        "constraints_assumptions_risks",
        "glossary",
      ],
      integration_criticality: ["low", "medium", "high"],
      integration_direction: ["inbound", "outbound", "bidirectional"],
      issue_severity: ["info", "warning", "error"],
      issue_status: ["open", "resolved", "dismissed"],
      issue_type: [
        "vagueness",
        "contradiction",
        "missing_cross_cutting",
        "missing_metric",
        "undefined_glossary",
      ],
      nfr_category: [
        "functionality",
        "usability",
        "reliability",
        "performance",
        "supportability",
        "security",
        "compliance",
      ],
      persona_kind: ["primary", "secondary", "antagonist"],
      project_mode: ["consultant", "self_service"],
      project_status: ["draft", "active", "exported", "archived"],
      risk_level: ["low", "medium", "high"],
      scope_kind: ["in", "out"],
      section_status: ["not_started", "in_progress", "incomplete", "complete"],
      session_actor: ["engine", "consultant", "stakeholder"],
      session_status: ["active", "closed", "abandoned"],
      stakeholder_influence: ["low", "medium", "high"],
      story_priority: ["must", "should", "could", "wont"],
      turn_role: ["question", "answer", "followup", "system", "meta"],
      turn_status: ["ok", "failed"],
    },
  },
} as const
