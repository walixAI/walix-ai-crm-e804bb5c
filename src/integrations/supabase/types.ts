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
      activities: {
        Row: {
          agent_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string
          id: string
          occurred_at: string
          tenant_id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          agent_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description: string
          id?: string
          occurred_at?: string
          tenant_id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          agent_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string
          id?: string
          occurred_at?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          answer: string
          comment: string | null
          created_at: string
          id: string
          prompt: string
          rating: number
          surface: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          answer: string
          comment?: string | null
          created_at?: string
          id?: string
          prompt: string
          rating: number
          surface?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          answer?: string
          comment?: string | null
          created_at?: string
          id?: string
          prompt?: string
          rating?: number
          surface?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_suggestions: {
        Row: {
          contact_id: string | null
          created_at: string
          cta: string | null
          deal_id: string | null
          dismissed: boolean
          id: string
          kind: string | null
          tenant_id: string
          text: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          cta?: string | null
          deal_id?: string | null
          dismissed?: boolean
          id?: string
          kind?: string | null
          tenant_id: string
          text: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          cta?: string | null
          deal_id?: string | null
          dismissed?: boolean
          id?: string
          kind?: string | null
          tenant_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          automation_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          mode: string
          payload: Json | null
          status: string
          tenant_id: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          mode?: string
          payload?: Json | null
          status: string
          tenant_id: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          mode?: string
          payload?: Json | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          error_count: number
          icon: string
          id: string
          is_draft: boolean
          last_error: string | null
          last_run_at: string | null
          name: string
          run_count: number
          tenant_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          error_count?: number
          icon?: string
          id?: string
          is_draft?: boolean
          last_error?: string | null
          last_run_at?: string | null
          name: string
          run_count?: number
          tenant_id: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          error_count?: number
          icon?: string
          id?: string
          is_draft?: boolean
          last_error?: string | null
          last_run_at?: string | null
          name?: string
          run_count?: number
          tenant_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_tags: {
        Row: {
          created_at: string
          family: Database["public"]["Enums"]["tag_family"]
          icon: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          family?: Database["public"]["Enums"]["tag_family"]
          icon?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          family?: Database["public"]["Enums"]["tag_family"]
          icon?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          avatar_color: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          last_activity_at: string | null
          last_name: string | null
          name: string
          owner_id: string | null
          phone: string
          position: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avatar_color?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_activity_at?: string | null
          last_name?: string | null
          name: string
          owner_id?: string | null
          phone: string
          position?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avatar_color?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_activity_at?: string | null
          last_name?: string | null
          name?: string
          owner_id?: string | null
          phone?: string
          position?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assignee_id: string | null
          contact_id: string
          created_at: string
          deal_id: string | null
          id: string
          internal_notes: string | null
          last_message_at: string | null
          preview: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          contact_id: string
          created_at?: string
          deal_id?: string | null
          id?: string
          internal_notes?: string | null
          last_message_at?: string | null
          preview?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          contact_id?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          internal_notes?: string | null
          last_message_at?: string | null
          preview?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          deal_id: string
          from_stage_id: string | null
          from_stage_name: string | null
          id: string
          tenant_id: string
          to_stage_id: string | null
          to_stage_name: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          deal_id: string
          from_stage_id?: string | null
          from_stage_name?: string | null
          id?: string
          tenant_id: string
          to_stage_id?: string | null
          to_stage_name?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          deal_id?: string
          from_stage_id?: string | null
          from_stage_name?: string | null
          id?: string
          tenant_id?: string
          to_stage_id?: string | null
          to_stage_name?: string | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          amount: number
          contact_id: string | null
          created_at: string
          expected_close_date: string | null
          id: string
          is_lost: boolean
          is_won: boolean
          lost_comment: string | null
          lost_reason: string | null
          name: string
          notes: string | null
          owner_id: string | null
          probability: number
          source: Database["public"]["Enums"]["lead_source"]
          stage_id: string | null
          stage_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          contact_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          is_lost?: boolean
          is_won?: boolean
          lost_comment?: string | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          probability?: number
          source?: Database["public"]["Enums"]["lead_source"]
          stage_id?: string | null
          stage_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contact_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          is_lost?: boolean
          is_won?: boolean
          lost_comment?: string | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          probability?: number
          source?: Database["public"]["Enums"]["lead_source"]
          stage_id?: string | null
          stage_name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          is_internal_note: boolean
          media_url: string | null
          metadata: Json | null
          read_at: string | null
          sent_at: string
          tenant_id: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          is_internal_note?: boolean
          media_url?: string | null
          metadata?: Json | null
          read_at?: string | null
          sent_at?: string
          tenant_id: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          is_internal_note?: boolean
          media_url?: string | null
          metadata?: Json | null
          read_at?: string | null
          sent_at?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          data: Json
          icon: string | null
          id: string
          link: string | null
          read_at: string | null
          severity: Database["public"]["Enums"]["notification_severity"]
          tenant_id: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          data?: Json
          icon?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"]
          tenant_id: string
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          data?: Json
          icon?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"]
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      org_plan_limits: {
        Row: {
          max_tenants: number
          monthly_price: number
          plan: string
        }
        Insert: {
          max_tenants: number
          monthly_price?: number
          plan: string
        }
        Update: {
          max_tenants?: number
          monthly_price?: number
          plan?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          plan: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          plan?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          plan?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          pipeline_id: string | null
          position: number
          tenant_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          pipeline_id?: string | null
          position?: number
          tenant_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          pipeline_id?: string | null
          position?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          position: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          position?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          position?: number
          tenant_id?: string
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          max_active_automations: number
          max_pipelines: number
          max_users: number
          monthly_price: number
          plan: string
        }
        Insert: {
          max_active_automations: number
          max_pipelines: number
          max_users: number
          monthly_price?: number
          plan: string
        }
        Update: {
          max_active_automations?: number
          max_pipelines?: number
          max_users?: number
          monthly_price?: number
          plan?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_tenant_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          onboarded: boolean
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          last_seen_at?: string | null
          onboarded?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          onboarded?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed: boolean
          contact_id: string | null
          created_at: string
          deal_id: string | null
          due_at: string | null
          id: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_at?: string | null
          id?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_at?: string | null
          id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          activated_at: string
          activated_by: string | null
          created_at: string
          id: string
          module_id: string
          monthly_price_mxn: number
          pricing_model: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string
          activated_by?: string | null
          created_at?: string
          id?: string
          module_id: string
          monthly_price_mxn?: number
          pricing_model: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          created_at?: string
          id?: string
          module_id?: string
          monthly_price_mxn?: number
          pricing_model?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          brand_name: string | null
          brand_primary: string | null
          created_at: string
          currency: string
          id: string
          locale: string
          logo_url: string | null
          mrr: number
          name: string
          nps: number | null
          organization_id: string
          plan: string
          status: string
          timezone: string
          trial_ends_at: string | null
        }
        Insert: {
          brand_name?: string | null
          brand_primary?: string | null
          created_at?: string
          currency?: string
          id?: string
          locale?: string
          logo_url?: string | null
          mrr?: number
          name: string
          nps?: number | null
          organization_id: string
          plan?: string
          status?: string
          timezone?: string
          trial_ends_at?: string | null
        }
        Update: {
          brand_name?: string | null
          brand_primary?: string | null
          created_at?: string
          currency?: string
          id?: string
          locale?: string
          logo_url?: string | null
          mrr?: number
          name?: string
          nps?: number | null
          organization_id?: string
          plan?: string
          status?: string
          timezone?: string
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_platform_owner: { Args: { _email: string }; Returns: undefined }
      downgrade_expired_trials: { Args: never; Returns: number }
      get_user_tenant: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform: { Args: { _user_id: string }; Returns: boolean }
      org_tenant_count: { Args: { _org_id: string }; Returns: number }
      tenant_active_users: { Args: { _tenant_id: string }; Returns: number }
      trial_days_left: { Args: { _tenant_id: string }; Returns: number }
    }
    Enums: {
      activity_type: "wa_sent" | "wa_received" | "note" | "deal" | "task"
      app_role:
        | "super_admin"
        | "tenant_admin"
        | "sales_manager"
        | "sales_rep"
        | "platform_owner"
        | "platform_staff"
        | "org_owner"
        | "org_member"
        | "tenant_owner"
      conversation_status: "Nuevo" | "En atención" | "Esperando" | "Resuelto"
      lead_source: "WhatsApp" | "Formulario web" | "Referido" | "Manual"
      lead_status:
        | "Nuevo"
        | "Contactado"
        | "Calificado"
        | "En negociación"
        | "Cliente"
        | "Inactivo"
      message_direction: "inbound" | "outbound"
      message_type: "text" | "image" | "document" | "audio" | "location"
      notification_category: "operational" | "ai" | "system"
      notification_severity: "info" | "success" | "warning" | "danger"
      tag_family: "temperature" | "cycle" | "special"
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
      activity_type: ["wa_sent", "wa_received", "note", "deal", "task"],
      app_role: [
        "super_admin",
        "tenant_admin",
        "sales_manager",
        "sales_rep",
        "platform_owner",
        "platform_staff",
        "org_owner",
        "org_member",
        "tenant_owner",
      ],
      conversation_status: ["Nuevo", "En atención", "Esperando", "Resuelto"],
      lead_source: ["WhatsApp", "Formulario web", "Referido", "Manual"],
      lead_status: [
        "Nuevo",
        "Contactado",
        "Calificado",
        "En negociación",
        "Cliente",
        "Inactivo",
      ],
      message_direction: ["inbound", "outbound"],
      message_type: ["text", "image", "document", "audio", "location"],
      notification_category: ["operational", "ai", "system"],
      notification_severity: ["info", "success", "warning", "danger"],
      tag_family: ["temperature", "cycle", "special"],
    },
  },
} as const
