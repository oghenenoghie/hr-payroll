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
      attendance_records: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          id: string
          marked_by: string
          org_id: string
          paid_pay_run_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          id?: string
          marked_by: string
          org_id: string
          paid_pay_run_id?: string | null
          status: string
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          marked_by?: string
          org_id?: string
          paid_pay_run_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_paid_pay_run_id_fkey"
            columns: ["paid_pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_plans: {
        Row: {
          active: boolean
          category: string
          created_at: string
          employee_cost_kobo: number
          employer_cost_kobo: number
          id: string
          name: string
          org_id: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          employee_cost_kobo?: number
          employer_cost_kobo: number
          id?: string
          name: string
          org_id: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          employee_cost_kobo?: number
          employer_cost_kobo?: number
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_benefit_enrollments: {
        Row: {
          benefit_plan_id: string
          cancelled_at: string | null
          employee_id: string
          enrolled_at: string
          enrolled_by: string
          id: string
          org_id: string
          status: string
        }
        Insert: {
          benefit_plan_id: string
          cancelled_at?: string | null
          employee_id: string
          enrolled_at?: string
          enrolled_by: string
          id?: string
          org_id: string
          status?: string
        }
        Update: {
          benefit_plan_id?: string
          cancelled_at?: string | null
          employee_id?: string
          enrolled_at?: string
          enrolled_by?: string
          id?: string
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_benefit_enrollments_benefit_plan_id_fkey"
            columns: ["benefit_plan_id"]
            isOneToOne: false
            referencedRelation: "benefit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_benefit_enrollments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_benefit_enrollments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          state: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
          state?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_policies: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          org_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          org_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          org_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_compensation_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          employee_id: string
          id: string
          new_basic_kobo: number
          new_housing_kobo: number
          new_transport_kobo: number
          old_basic_kobo: number
          old_housing_kobo: number
          old_transport_kobo: number
          org_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          employee_id: string
          id?: string
          new_basic_kobo: number
          new_housing_kobo: number
          new_transport_kobo: number
          old_basic_kobo: number
          old_housing_kobo: number
          old_transport_kobo: number
          org_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          employee_id?: string
          id?: string
          new_basic_kobo?: number
          new_housing_kobo?: number
          new_transport_kobo?: number
          old_basic_kobo?: number
          old_housing_kobo?: number
          old_transport_kobo?: number
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_compensation_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_compensation_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_compensation_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          document_type: string | null
          employee_id: string
          file_name: string
          id: string
          org_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          document_type?: string | null
          employee_id: string
          file_name: string
          id?: string
          org_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          document_type?: string | null
          employee_id?: string
          file_name?: string
          id?: string
          org_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_offboarding_checklist: {
        Row: {
          assets_returned: boolean
          clearance_obtained: boolean
          employee_id: string
          experience_letter_issued: boolean
          id: string
          notice_period_served: boolean
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assets_returned?: boolean
          clearance_obtained?: boolean
          employee_id: string
          experience_letter_issued?: boolean
          id?: string
          notice_period_served?: boolean
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assets_returned?: boolean
          clearance_obtained?: boolean
          employee_id?: string
          experience_letter_issued?: boolean
          id?: string
          notice_period_served?: boolean
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_offboarding_checklist_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_offboarding_checklist_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_offboarding_checklist_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_onboarding_checklist: {
        Row: {
          contract_signed: boolean
          documentation_collected: boolean
          employee_id: string
          id: string
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contract_signed?: boolean
          documentation_collected?: boolean
          employee_id: string
          id?: string
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contract_signed?: boolean
          documentation_collected?: boolean
          employee_id?: string
          id?: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_onboarding_checklist_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_onboarding_checklist_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_onboarding_checklist_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          employee_id: string
          id: string
          new_status: string
          old_status: string | null
          org_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          employee_id: string
          id?: string
          new_status: string
          old_status?: string | null
          org_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          employee_id?: string
          id?: string
          new_status?: string
          old_status?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_status_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_status_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_status_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          annual_leave_balance_days: number
          annual_rent_kobo: number
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          basic_kobo: number
          branch_id: string | null
          confirmed: boolean
          contract_end_date: string | null
          created_at: string
          date_of_birth: string | null
          department_id: string | null
          email: string | null
          employment_type: string
          full_name: string
          hire_date: string | null
          housing_kobo: number
          id: string
          job_grade_id: string | null
          linked_at: string | null
          manager_id: string | null
          nationality: string | null
          org_id: string
          pfa: string | null
          probation_end_date: string | null
          salary_masked: boolean
          state_of_residence: string | null
          status: string
          tin: string | null
          tin_valid_from: string | null
          tin_valid_to: string | null
          transport_kobo: number
          user_id: string | null
        }
        Insert: {
          annual_leave_balance_days?: number
          annual_rent_kobo?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          basic_kobo?: number
          branch_id?: string | null
          confirmed?: boolean
          contract_end_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          employment_type?: string
          full_name: string
          hire_date?: string | null
          housing_kobo?: number
          id?: string
          job_grade_id?: string | null
          linked_at?: string | null
          manager_id?: string | null
          nationality?: string | null
          org_id: string
          pfa?: string | null
          probation_end_date?: string | null
          salary_masked?: boolean
          state_of_residence?: string | null
          status?: string
          tin?: string | null
          tin_valid_from?: string | null
          tin_valid_to?: string | null
          transport_kobo?: number
          user_id?: string | null
        }
        Update: {
          annual_leave_balance_days?: number
          annual_rent_kobo?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          basic_kobo?: number
          branch_id?: string | null
          confirmed?: boolean
          contract_end_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          employment_type?: string
          full_name?: string
          hire_date?: string | null
          housing_kobo?: number
          id?: string
          job_grade_id?: string | null
          linked_at?: string | null
          manager_id?: string | null
          nationality?: string | null
          org_id?: string
          pfa?: string | null
          probation_end_date?: string | null
          salary_masked?: boolean
          state_of_residence?: string | null
          status?: string
          tin?: string | null
          tin_valid_from?: string | null
          tin_valid_to?: string | null
          transport_kobo?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_job_grade_id_fkey"
            columns: ["job_grade_id"]
            isOneToOne: false
            referencedRelation: "job_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_kobo: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string
          employee_id: string
          id: string
          org_id: string
          paid_pay_run_id: string | null
          requested_by: string
          status: string
          taxable: boolean | null
        }
        Insert: {
          amount_kobo: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description: string
          employee_id: string
          id?: string
          org_id: string
          paid_pay_run_id?: string | null
          requested_by: string
          status?: string
          taxable?: boolean | null
        }
        Update: {
          amount_kobo?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string
          employee_id?: string
          id?: string
          org_id?: string
          paid_pay_run_id?: string | null
          requested_by?: string
          status?: string
          taxable?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_pay_run_id_fkey"
            columns: ["paid_pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      final_settlements: {
        Row: {
          created_at: string
          employee_id: string
          final_period_days_worked: number
          final_period_gross_kobo: number
          gratuity_kobo: number
          id: string
          leave_days_paid: number
          leave_payout_kobo: number
          loan_clearance_kobo: number
          net_settlement_kobo: number
          org_id: string
          pay_run_id: string
          processed_by: string
          service_years: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          final_period_days_worked?: number
          final_period_gross_kobo?: number
          gratuity_kobo: number
          id?: string
          leave_days_paid: number
          leave_payout_kobo: number
          loan_clearance_kobo: number
          net_settlement_kobo: number
          org_id: string
          pay_run_id: string
          processed_by: string
          service_years: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          final_period_days_worked?: number
          final_period_gross_kobo?: number
          gratuity_kobo?: number
          id?: string
          leave_days_paid?: number
          leave_payout_kobo?: number
          loan_clearance_kobo?: number
          net_settlement_kobo?: number
          org_id?: string
          pay_run_id?: string
          processed_by?: string
          service_years?: number
        }
        Relationships: [
          {
            foreignKeyName: "final_settlements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_settlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_settlements_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          connected: boolean
          id: string
          org_id: string
          provider: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          connected?: boolean
          id?: string
          org_id: string
          provider: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          connected?: boolean
          id?: string
          org_id?: string
          provider?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_grades: {
        Row: {
          created_at: string
          id: string
          max_annual_kobo: number
          min_annual_kobo: number
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_annual_kobo: number
          min_annual_kobo: number
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_annual_kobo?: number
          min_annual_kobo?: number
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_grades_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          memo: string
          org_id: string
          pay_run_id: string | null
        }
        Insert: {
          created_at?: string
          entry_date: string
          id?: string
          memo: string
          org_id: string
          pay_run_id?: string | null
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          memo?: string
          org_id?: string
          pay_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_encashment_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days_requested: number
          employee_id: string
          id: string
          org_id: string
          paid_pay_run_id: string | null
          requested_by: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_requested: number
          employee_id: string
          id?: string
          org_id: string
          paid_pay_run_id?: string | null
          requested_by: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_requested?: number
          employee_id?: string
          id?: string
          org_id?: string
          paid_pay_run_id?: string | null
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_encashment_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_encashment_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_encashment_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_encashment_requests_paid_pay_run_id_fkey"
            columns: ["paid_pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          org_id: string
          paid_pay_run_id: string | null
          reason: string | null
          requested_by: string
          start_date: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days: number
          employee_id: string
          end_date: string
          id?: string
          leave_type: string
          org_id: string
          paid_pay_run_id?: string | null
          reason?: string | null
          requested_by: string
          start_date: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          org_id?: string
          paid_pay_run_id?: string | null
          reason?: string | null
          requested_by?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_paid_pay_run_id_fkey"
            columns: ["paid_pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_postings: {
        Row: {
          account_code: string
          amount_kobo: number
          created_at: string
          direction: string
          employee_id: string | null
          id: string
          journal_entry_id: string
          org_id: string
        }
        Insert: {
          account_code: string
          amount_kobo: number
          created_at?: string
          direction: string
          employee_id?: string | null
          id?: string
          journal_entry_id: string
          org_id: string
        }
        Update: {
          account_code?: string
          amount_kobo?: number
          created_at?: string
          direction?: string
          employee_id?: string | null
          id?: string
          journal_entry_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_postings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_postings_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_postings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayments: {
        Row: {
          amount_kobo: number
          created_at: string
          employee_id: string
          id: string
          loan_id: string
          org_id: string
          pay_run_id: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          employee_id: string
          id?: string
          loan_id: string
          org_id: string
          pay_run_id: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          employee_id?: string
          id?: string
          loan_id?: string
          org_id?: string
          pay_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          employee_id: string
          id: string
          monthly_repayment_kobo: number
          org_id: string
          outstanding_kobo: number
          principal_kobo: number
          reason: string | null
          requested_by: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id: string
          id?: string
          monthly_repayment_kobo: number
          org_id: string
          outstanding_kobo: number
          principal_kobo: number
          reason?: string | null
          requested_by: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          monthly_repayment_kobo?: number
          org_id?: string
          outstanding_kobo?: number
          principal_kobo?: number
          reason?: string | null
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          org_id: string
          read_at: string | null
          recipient_user_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          org_id: string
          read_at?: string | null
          recipient_user_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          org_id?: string
          read_at?: string | null
          recipient_user_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          company_tin: string | null
          created_at: string
          default_pay_frequency: string
          default_pfa: string | null
          id: string
          name: string
          rc_number: string | null
          states_of_operation: string[]
        }
        Insert: {
          company_tin?: string | null
          created_at?: string
          default_pay_frequency?: string
          default_pfa?: string | null
          id?: string
          name: string
          rc_number?: string | null
          states_of_operation?: string[]
        }
        Update: {
          company_tin?: string | null
          created_at?: string
          default_pay_frequency?: string
          default_pfa?: string | null
          id?: string
          name?: string
          rc_number?: string | null
          states_of_operation?: string[]
        }
        Relationships: []
      }
      overtime_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          employee_id: string
          hours: number
          id: string
          org_id: string
          paid_pay_run_id: string | null
          rate_multiplier_bps: number
          reason: string | null
          requested_by: string
          status: string
          work_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id: string
          hours: number
          id?: string
          org_id: string
          paid_pay_run_id?: string | null
          rate_multiplier_bps?: number
          reason?: string | null
          requested_by: string
          status?: string
          work_date: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          hours?: number
          id?: string
          org_id?: string
          paid_pay_run_id?: string | null
          rate_multiplier_bps?: number
          reason?: string | null
          requested_by?: string
          status?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_requests_paid_pay_run_id_fkey"
            columns: ["paid_pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_run_reversals: {
        Row: {
          created_at: string
          id: string
          org_id: string
          pay_run_id: string
          reason: string
          reversal_journal_entry_id: string
          reversed_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          pay_run_id: string
          reason: string
          reversal_journal_entry_id: string
          reversed_by: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          pay_run_id?: string
          reason?: string
          reversal_journal_entry_id?: string
          reversed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_run_reversals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_run_reversals_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: true
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_run_reversals_reversal_journal_entry_id_fkey"
            columns: ["reversal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_runs: {
        Row: {
          created_at: string
          created_by: string | null
          employee_count: number
          frequency: string
          gross_kobo: number
          id: string
          net_kobo: number
          org_id: string
          period_end: string
          period_start: string
          rule_version_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_count?: number
          frequency: string
          gross_kobo?: number
          id?: string
          net_kobo?: number
          org_id: string
          period_end: string
          period_start: string
          rule_version_id: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_count?: number
          frequency?: string
          gross_kobo?: number
          id?: string
          net_kobo?: number
          org_id?: string
          period_end?: string
          period_start?: string
          rule_version_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          attendance_absence_deduction_kobo: number
          benefit_employee_deduction_kobo: number
          benefit_employer_cost_kobo: number
          chargeable_income_kobo: number
          created_at: string
          cumulative_chargeable_income_before_kobo: number
          cumulative_paye_paid_before_kobo: number
          employee_deductions_kobo: number
          employee_id: string
          gross_kobo: number
          id: string
          leave_encashment_kobo: number
          net_kobo: number
          new_hire_proration_deduction_kobo: number
          nhf_kobo: number
          non_taxable_reimbursement_kobo: number
          org_id: string
          overtime_pay_kobo: number
          pay_run_id: string
          paye_kobo: number
          pension_employee_kobo: number
          pension_employer_kobo: number
          pensionable_kobo: number
          rent_relief_kobo: number
          salary_change_adjustment_kobo: number
          taxable_reimbursement_kobo: number
          unpaid_leave_deduction_kobo: number
        }
        Insert: {
          attendance_absence_deduction_kobo?: number
          benefit_employee_deduction_kobo?: number
          benefit_employer_cost_kobo?: number
          chargeable_income_kobo: number
          created_at?: string
          cumulative_chargeable_income_before_kobo: number
          cumulative_paye_paid_before_kobo: number
          employee_deductions_kobo: number
          employee_id: string
          gross_kobo: number
          id?: string
          leave_encashment_kobo?: number
          net_kobo: number
          new_hire_proration_deduction_kobo?: number
          nhf_kobo: number
          non_taxable_reimbursement_kobo?: number
          org_id: string
          overtime_pay_kobo?: number
          pay_run_id: string
          paye_kobo: number
          pension_employee_kobo: number
          pension_employer_kobo: number
          pensionable_kobo: number
          rent_relief_kobo: number
          salary_change_adjustment_kobo?: number
          taxable_reimbursement_kobo?: number
          unpaid_leave_deduction_kobo?: number
        }
        Update: {
          attendance_absence_deduction_kobo?: number
          benefit_employee_deduction_kobo?: number
          benefit_employer_cost_kobo?: number
          chargeable_income_kobo?: number
          created_at?: string
          cumulative_chargeable_income_before_kobo?: number
          cumulative_paye_paid_before_kobo?: number
          employee_deductions_kobo?: number
          employee_id?: string
          gross_kobo?: number
          id?: string
          leave_encashment_kobo?: number
          net_kobo?: number
          new_hire_proration_deduction_kobo?: number
          nhf_kobo?: number
          non_taxable_reimbursement_kobo?: number
          org_id?: string
          overtime_pay_kobo?: number
          pay_run_id?: string
          paye_kobo?: number
          pension_employee_kobo?: number
          pension_employer_kobo?: number
          pensionable_kobo?: number
          rent_relief_kobo?: number
          salary_change_adjustment_kobo?: number
          taxable_reimbursement_kobo?: number
          unpaid_leave_deduction_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_acknowledgements: {
        Row: {
          acknowledged_at: string
          employee_id: string
          id: string
          org_id: string
          policy_id: string
        }
        Insert: {
          acknowledged_at?: string
          employee_id: string
          id?: string
          org_id: string
          policy_id: string
        }
        Update: {
          acknowledged_at?: string
          employee_id?: string
          id?: string
          org_id?: string
          policy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_acknowledgements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_acknowledgements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_acknowledgements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_acknowledgements_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "company_policies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employees_masked: {
        Row: {
          annual_leave_balance_days: number | null
          annual_rent_kobo: number | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          basic_kobo: number | null
          branch_id: string | null
          branch_name: string | null
          confirmed: boolean | null
          contract_end_date: string | null
          created_at: string | null
          date_of_birth: string | null
          department_id: string | null
          department_name: string | null
          email: string | null
          employment_type: string | null
          full_name: string | null
          hire_date: string | null
          housing_kobo: number | null
          id: string | null
          job_grade_id: string | null
          job_grade_name: string | null
          linked_at: string | null
          manager_id: string | null
          nationality: string | null
          org_id: string | null
          pfa: string | null
          probation_end_date: string | null
          salary_masked: boolean | null
          state_of_residence: string | null
          status: string | null
          tin: string | null
          tin_valid_from: string | null
          tin_valid_to: string | null
          transport_kobo: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_job_grade_id_fkey"
            columns: ["job_grade_id"]
            isOneToOne: false
            referencedRelation: "job_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_organization: {
        Args: {
          p_company_tin?: string
          p_default_pay_frequency?: string
          p_default_pfa?: string
          p_name: string
          p_rc_number?: string
          p_states_of_operation?: string[]
        }
        Returns: {
          company_tin: string | null
          created_at: string
          default_pay_frequency: string
          default_pfa: string | null
          id: string
          name: string
          rc_number: string | null
          states_of_operation: string[]
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_pay_run: {
        Args: { payload: Json }
        Returns: {
          created_at: string
          created_by: string | null
          employee_count: number
          frequency: string
          gross_kobo: number
          id: string
          net_kobo: number
          org_id: string
          period_end: string
          period_start: string
          rule_version_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "pay_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_org_audit_log: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: {
          action: string
          actor_id: string
          actor_username: string
          actor_via_sso: boolean
          created_at: string
          ip_address: string
          log_type: string
        }[]
      }
      link_employee_account: {
        Args: { p_employee_id: string; p_user_id: string }
        Returns: {
          annual_leave_balance_days: number
          annual_rent_kobo: number
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          basic_kobo: number
          branch_id: string | null
          confirmed: boolean
          contract_end_date: string | null
          created_at: string
          date_of_birth: string | null
          department_id: string | null
          email: string | null
          employment_type: string
          full_name: string
          hire_date: string | null
          housing_kobo: number
          id: string
          job_grade_id: string | null
          linked_at: string | null
          manager_id: string | null
          nationality: string | null
          org_id: string
          pfa: string | null
          probation_end_date: string | null
          salary_masked: boolean
          state_of_residence: string | null
          status: string
          tin: string | null
          tin_valid_from: string | null
          tin_valid_to: string | null
          transport_kobo: number
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "employees"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_pay_run: {
        Args: { p_pay_run_id: string; p_reason: string }
        Returns: {
          created_at: string
          id: string
          org_id: string
          pay_run_id: string
          reason: string
          reversal_journal_entry_id: string
          reversed_by: string
        }
        SetofOptions: {
          from: "*"
          to: "pay_run_reversals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_leave_encashment_request: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days_requested: number
          employee_id: string
          id: string
          org_id: string
          paid_pay_run_id: string | null
          requested_by: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_encashment_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_leave_request: {
        Args: { p_approve: boolean; p_leave_request_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          org_id: string
          paid_pay_run_id: string | null
          reason: string | null
          requested_by: string
          start_date: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
