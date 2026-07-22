// Generated from the live Supabase project schema (kyjugzvtdvbbuurksaij).
// Regenerate after every migration: mcp__Supabase__generate_typescript_types.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      org_memberships: {
        Row: {
          created_at: string;
          id: string;
          org_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          org_id: string;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          org_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          company_tin: string | null;
          created_at: string;
          default_pay_frequency: string;
          default_pfa: string | null;
          id: string;
          name: string;
          rc_number: string | null;
          states_of_operation: string[];
        };
        Insert: {
          company_tin?: string | null;
          created_at?: string;
          default_pay_frequency?: string;
          default_pfa?: string | null;
          id?: string;
          name: string;
          rc_number?: string | null;
          states_of_operation?: string[];
        };
        Update: {
          company_tin?: string | null;
          created_at?: string;
          default_pay_frequency?: string;
          default_pfa?: string | null;
          id?: string;
          name?: string;
          rc_number?: string | null;
          states_of_operation?: string[];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_organization: {
        Args: {
          p_company_tin?: string;
          p_default_pay_frequency?: string;
          p_default_pfa?: string;
          p_name: string;
          p_rc_number?: string;
          p_states_of_operation?: string[];
        };
        Returns: {
          company_tin: string | null;
          created_at: string;
          default_pay_frequency: string;
          default_pfa: string | null;
          id: string;
          name: string;
          rc_number: string | null;
          states_of_operation: string[];
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
