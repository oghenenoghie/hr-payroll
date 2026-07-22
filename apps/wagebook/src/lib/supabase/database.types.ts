// Generated from the live Supabase project schema (kyjugzvtdvbbuurksaij).
// Regenerate after every migration: mcp__Supabase__generate_typescript_types.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      employees: {
        Row: {
          annual_rent_kobo: number;
          basic_kobo: number;
          created_at: string;
          full_name: string;
          housing_kobo: number;
          id: string;
          manager_id: string | null;
          org_id: string;
          pfa: string | null;
          state_of_residence: string | null;
          status: string;
          tin: string | null;
          tin_valid_from: string | null;
          tin_valid_to: string | null;
          transport_kobo: number;
        };
        Insert: {
          annual_rent_kobo?: number;
          basic_kobo?: number;
          created_at?: string;
          full_name: string;
          housing_kobo?: number;
          id?: string;
          manager_id?: string | null;
          org_id: string;
          pfa?: string | null;
          state_of_residence?: string | null;
          status?: string;
          tin?: string | null;
          tin_valid_from?: string | null;
          tin_valid_to?: string | null;
          transport_kobo?: number;
        };
        Update: {
          annual_rent_kobo?: number;
          basic_kobo?: number;
          created_at?: string;
          full_name?: string;
          housing_kobo?: number;
          id?: string;
          manager_id?: string | null;
          org_id?: string;
          pfa?: string | null;
          state_of_residence?: string | null;
          status?: string;
          tin?: string | null;
          tin_valid_from?: string | null;
          tin_valid_to?: string | null;
          transport_kobo?: number;
        };
        Relationships: [
          {
            foreignKeyName: "employees_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
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
      pay_runs: {
        Row: {
          created_at: string;
          created_by: string | null;
          employee_count: number;
          frequency: string;
          gross_kobo: number;
          id: string;
          net_kobo: number;
          org_id: string;
          period_end: string;
          period_start: string;
          rule_version_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          employee_count?: number;
          frequency: string;
          gross_kobo?: number;
          id?: string;
          net_kobo?: number;
          org_id: string;
          period_end: string;
          period_start: string;
          rule_version_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          employee_count?: number;
          frequency?: string;
          gross_kobo?: number;
          id?: string;
          net_kobo?: number;
          org_id?: string;
          period_end?: string;
          period_start?: string;
          rule_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pay_runs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      payslips: {
        Row: {
          chargeable_income_kobo: number;
          created_at: string;
          cumulative_chargeable_income_before_kobo: number;
          cumulative_paye_paid_before_kobo: number;
          employee_deductions_kobo: number;
          employee_id: string;
          gross_kobo: number;
          id: string;
          net_kobo: number;
          nhf_kobo: number;
          org_id: string;
          pay_run_id: string;
          paye_kobo: number;
          pension_employee_kobo: number;
          pension_employer_kobo: number;
          pensionable_kobo: number;
          rent_relief_kobo: number;
        };
        Insert: {
          chargeable_income_kobo: number;
          created_at?: string;
          cumulative_chargeable_income_before_kobo: number;
          cumulative_paye_paid_before_kobo: number;
          employee_deductions_kobo: number;
          employee_id: string;
          gross_kobo: number;
          id?: string;
          net_kobo: number;
          nhf_kobo: number;
          org_id: string;
          pay_run_id: string;
          paye_kobo: number;
          pension_employee_kobo: number;
          pension_employer_kobo: number;
          pensionable_kobo: number;
          rent_relief_kobo: number;
        };
        Update: {
          chargeable_income_kobo?: number;
          created_at?: string;
          cumulative_chargeable_income_before_kobo?: number;
          cumulative_paye_paid_before_kobo?: number;
          employee_deductions_kobo?: number;
          employee_id?: string;
          gross_kobo?: number;
          id?: string;
          net_kobo?: number;
          nhf_kobo?: number;
          org_id?: string;
          pay_run_id?: string;
          paye_kobo?: number;
          pension_employee_kobo?: number;
          pension_employer_kobo?: number;
          pensionable_kobo?: number;
          rent_relief_kobo?: number;
        };
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payslips_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payslips_pay_run_id_fkey";
            columns: ["pay_run_id"];
            isOneToOne: false;
            referencedRelation: "pay_runs";
            referencedColumns: ["id"];
          },
        ];
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
