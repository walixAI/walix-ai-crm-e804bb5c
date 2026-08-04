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
          metadata: Json
          occurred_at: string
          tenant_id: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description: string
          id?: string
          metadata?: Json
          occurred_at?: string
          tenant_id: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
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
      activity_outcomes: {
        Row: {
          activity_kind: string | null
          created_at: string
          id: string
          is_active: boolean
          is_lost: boolean
          is_won: boolean
          label: string
          moves_to_stage_id: string | null
          pipeline_id: string | null
          position: number
          requires_next_action: boolean
          stage_behavior: string
          stage_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activity_kind?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          label: string
          moves_to_stage_id?: string | null
          pipeline_id?: string | null
          position?: number
          requires_next_action?: boolean
          stage_behavior?: string
          stage_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activity_kind?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          label?: string
          moves_to_stage_id?: string | null
          pipeline_id?: string | null
          position?: number
          requires_next_action?: boolean
          stage_behavior?: string
          stage_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_outcomes_moves_to_stage_id_fkey"
            columns: ["moves_to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_outcomes_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_outcomes_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_runs: {
        Row: {
          actions_taken: number
          agent_id: string
          completed_at: string | null
          entities_processed: number
          error_message: string | null
          id: string
          run_log: Json
          started_at: string
          status: string
          suggestions_created: number
          tenant_id: string
        }
        Insert: {
          actions_taken?: number
          agent_id: string
          completed_at?: string | null
          entities_processed?: number
          error_message?: string | null
          id?: string
          run_log?: Json
          started_at?: string
          status?: string
          suggestions_created?: number
          tenant_id: string
        }
        Update: {
          actions_taken?: number
          agent_id?: string
          completed_at?: string | null
          entities_processed?: number
          error_message?: string | null
          id?: string
          run_log?: Json
          started_at?: string
          status?: string
          suggestions_created?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          actions_taken_today: number
          agent_type: string
          allowed_tools: string[]
          config: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_run_at: string | null
          last_run_status: string | null
          max_actions_per_run: number
          model: string
          name: string
          next_run_at: string | null
          schedule: string
          system_prompt: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actions_taken_today?: number
          agent_type: string
          allowed_tools?: string[]
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_status?: string | null
          max_actions_per_run?: number
          model?: string
          name: string
          next_run_at?: string | null
          schedule: string
          system_prompt: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actions_taken_today?: number
          agent_type?: string
          allowed_tools?: string[]
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_status?: string | null
          max_actions_per_run?: number
          model?: string
          name?: string
          next_run_at?: string | null
          schedule?: string
          system_prompt?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_conversation_history: {
        Row: {
          content: string
          context_snapshot: Json
          created_at: string
          id: string
          role: string
          session_id: string
          tenant_id: string
          tool_calls: Json
          user_id: string
        }
        Insert: {
          content: string
          context_snapshot?: Json
          created_at?: string
          id?: string
          role: string
          session_id: string
          tenant_id: string
          tool_calls?: Json
          user_id: string
        }
        Update: {
          content?: string
          context_snapshot?: Json
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          tenant_id?: string
          tool_calls?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_draft_edits: {
        Row: {
          char_delta: number
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          edited: string
          id: string
          message_id: string | null
          original: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          char_delta?: number
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          edited: string
          id?: string
          message_id?: string | null
          original: string
          tenant_id: string
          user_id: string
        }
        Update: {
          char_delta?: number
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          edited?: string
          id?: string
          message_id?: string | null
          original?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_entity_context: {
        Row: {
          context_summary: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          key_facts: Json
          last_interaction: string | null
          sentiment: string
          tenant_id: string
          updated_at: string
          urgency_score: number
        }
        Insert: {
          context_summary?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          key_facts?: Json
          last_interaction?: string | null
          sentiment?: string
          tenant_id: string
          updated_at?: string
          urgency_score?: number
        }
        Update: {
          context_summary?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          key_facts?: Json
          last_interaction?: string | null
          sentiment?: string
          tenant_id?: string
          updated_at?: string
          urgency_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_entity_context_tenant_id_fkey"
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
      ai_memory_events: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_data: Json
          event_type: string
          id: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_data?: Json
          event_type: string
          id?: string
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_data?: Json
          event_type?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_outcome_feedback: {
        Row: {
          action_taken: string
          context_at_action: Json
          created_at: string
          days_to_outcome: number | null
          entity_id: string
          entity_type: string
          id: string
          outcome: string | null
          outcome_value: number
          suggestion_id: string | null
          tenant_id: string
        }
        Insert: {
          action_taken: string
          context_at_action?: Json
          created_at?: string
          days_to_outcome?: number | null
          entity_id: string
          entity_type: string
          id?: string
          outcome?: string | null
          outcome_value?: number
          suggestion_id?: string | null
          tenant_id: string
        }
        Update: {
          action_taken?: string
          context_at_action?: Json
          created_at?: string
          days_to_outcome?: number | null
          entity_id?: string
          entity_type?: string
          id?: string
          outcome?: string | null
          outcome_value?: number
          suggestion_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_outcome_feedback_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "ai_proactive_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_proactive_suggestions: {
        Row: {
          acted_on: boolean
          action_payload: Json
          action_type: string | null
          created_at: string
          dismissed: boolean
          entity_id: string | null
          entity_type: string | null
          expires_at: string
          id: string
          priority: number
          shown_at: string | null
          suggestion_text: string
          target_user_id: string | null
          tenant_id: string
        }
        Insert: {
          acted_on?: boolean
          action_payload?: Json
          action_type?: string | null
          created_at?: string
          dismissed?: boolean
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string
          id?: string
          priority?: number
          shown_at?: string | null
          suggestion_text: string
          target_user_id?: string | null
          tenant_id: string
        }
        Update: {
          acted_on?: boolean
          action_payload?: Json
          action_type?: string | null
          created_at?: string
          dismissed?: boolean
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string
          id?: string
          priority?: number
          shown_at?: string | null
          suggestion_text?: string
          target_user_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_proactive_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      ai_tenant_patterns: {
        Row: {
          confidence_score: number
          created_at: string
          id: string
          pattern_data: Json
          pattern_type: string
          sample_size: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          id?: string
          pattern_data?: Json
          pattern_type: string
          sample_size?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          id?: string
          pattern_data?: Json
          pattern_type?: string
          sample_size?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          input_tokens: number
          iterations: number
          model: string
          output_tokens: number
          surface: string
          tenant_id: string
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id?: string
          input_tokens?: number
          iterations?: number
          model: string
          output_tokens?: number
          surface: string
          tenant_id: string
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          input_tokens?: number
          iterations?: number
          model?: string
          output_tokens?: number
          surface?: string
          tenant_id?: string
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      ai_user_profile: {
        Row: {
          allow_auto_tasks: boolean
          avg_response_time_hours: number | null
          best_close_day: string | null
          best_close_hour: number | null
          close_rate: number
          communication_style: string
          created_at: string
          custom_instructions: string
          improvement_areas: string[]
          notify_digest_9am: boolean
          notify_only_work_hours: boolean
          preferred_message_length: string
          strengths: string[]
          tenant_id: string
          top_performing_stage: string | null
          total_deals_closed: number
          total_deals_lost: number
          updated_at: string
          user_id: string
          weekly_coaching_report: boolean
        }
        Insert: {
          allow_auto_tasks?: boolean
          avg_response_time_hours?: number | null
          best_close_day?: string | null
          best_close_hour?: number | null
          close_rate?: number
          communication_style?: string
          created_at?: string
          custom_instructions?: string
          improvement_areas?: string[]
          notify_digest_9am?: boolean
          notify_only_work_hours?: boolean
          preferred_message_length?: string
          strengths?: string[]
          tenant_id: string
          top_performing_stage?: string | null
          total_deals_closed?: number
          total_deals_lost?: number
          updated_at?: string
          user_id: string
          weekly_coaching_report?: boolean
        }
        Update: {
          allow_auto_tasks?: boolean
          avg_response_time_hours?: number | null
          best_close_day?: string | null
          best_close_hour?: number | null
          close_rate?: number
          communication_style?: string
          created_at?: string
          custom_instructions?: string
          improvement_areas?: string[]
          notify_digest_9am?: boolean
          notify_only_work_hours?: boolean
          preferred_message_length?: string
          strengths?: string[]
          tenant_id?: string
          top_performing_stage?: string | null
          total_deals_closed?: number
          total_deals_lost?: number
          updated_at?: string
          user_id?: string
          weekly_coaching_report?: boolean
        }
        Relationships: []
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
      companies: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          size: string | null
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          size?: string | null
          tenant_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          size?: string | null
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contact_custom_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          is_active: boolean
          key: string
          label: string
          placeholder: string | null
          position: number
          show_in_list: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          placeholder?: string | null
          position?: number
          show_in_list?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          placeholder?: string | null
          position?: number
          show_in_list?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_custom_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_sources: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          position: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          position?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          position?: number
          tenant_id?: string
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
          address: string | null
          avatar_color: string | null
          company: string | null
          company_id: string | null
          created_at: string
          custom_fields: Json
          email: string | null
          id: string
          last_activity_at: string | null
          last_name: string | null
          name: string
          owner_id: string | null
          phone: string | null
          phone_alt: string | null
          position: string | null
          source: string
          source_id: string | null
          status: Database["public"]["Enums"]["contact_lifecycle"]
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_color?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          last_activity_at?: string | null
          last_name?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          phone_alt?: string | null
          position?: string | null
          source?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["contact_lifecycle"]
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_color?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          last_activity_at?: string | null
          last_name?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          phone_alt?: string | null
          position?: string | null
          source?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["contact_lifecycle"]
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
      copilot_action_log: {
        Row: {
          capability_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input: Json | null
          output: Json | null
          status: string
          step_index: number | null
          step_name: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          capability_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          status?: string
          step_index?: number | null
          step_name?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          capability_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          status?: string
          step_index?: number | null
          step_name?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "copilot_action_log_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "copilot_capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_action_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_capabilities: {
        Row: {
          channels: string[]
          created_at: string
          created_by: string | null
          daily_limit: number | null
          description: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          recipe_json: Json
          require_confirmation: boolean
          scope_roles: string[]
          scope_type: string
          scope_user_ids: string[]
          tenant_id: string
          trigger_phrases: string[]
          updated_at: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          created_by?: string | null
          daily_limit?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          recipe_json?: Json
          require_confirmation?: boolean
          scope_roles?: string[]
          scope_type?: string
          scope_user_ids?: string[]
          tenant_id: string
          trigger_phrases?: string[]
          updated_at?: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          created_by?: string | null
          daily_limit?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          recipe_json?: Json
          require_confirmation?: boolean
          scope_roles?: string[]
          scope_type?: string
          scope_user_ids?: string[]
          tenant_id?: string
          trigger_phrases?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_capabilities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_layouts: {
        Row: {
          created_at: string
          id: string
          items: Json
          scope: string
          surface: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          scope: string
          surface: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          scope?: string
          surface?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_layouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          default_position: number
          description: string | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          key: string
          kind: string
          min_role: string
          name: string
          native_key: string | null
          surface: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          default_position?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          key: string
          kind: string
          min_role?: string
          name: string
          native_key?: string | null
          surface: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          default_position?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          key?: string
          kind?: string
          min_role?: string
          name?: string
          native_key?: string | null
          surface?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_blockers: {
        Row: {
          created_at: string
          default_resolution_days: number
          description: string | null
          id: string
          is_active: boolean
          label: string
          position: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_resolution_days?: number
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          position?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_resolution_days?: number
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          position?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_blockers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_loss_reasons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          position: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          position?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          position?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_loss_reasons_tenant_id_fkey"
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
          metadata: Json | null
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
          metadata?: Json | null
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
          metadata?: Json | null
          tenant_id?: string
          to_stage_id?: string | null
          to_stage_name?: string | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          amount: number
          amount_paid: number | null
          blocker_expected_at: string | null
          blocker_note: string | null
          blocker_set_at: string | null
          contact_id: string | null
          cost_amount: number | null
          created_at: string
          current_blocker_id: string | null
          deal_type: string | null
          equipment_brand: string | null
          equipment_model: string | null
          expected_close_date: string | null
          id: string
          is_lost: boolean
          is_won: boolean
          last_inbound_at: string | null
          last_known_blocker_id: string | null
          loss_reason_id: string | null
          lost_comment: string | null
          lost_reason: string | null
          name: string
          no_response_since: string | null
          notes: string | null
          owner_id: string | null
          payment_status: string | null
          probability: number
          product_category_id: string | null
          scheduled_at: string | null
          service_type: string | null
          source: string
          stage_id: string | null
          stage_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          amount_paid?: number | null
          blocker_expected_at?: string | null
          blocker_note?: string | null
          blocker_set_at?: string | null
          contact_id?: string | null
          cost_amount?: number | null
          created_at?: string
          current_blocker_id?: string | null
          deal_type?: string | null
          equipment_brand?: string | null
          equipment_model?: string | null
          expected_close_date?: string | null
          id?: string
          is_lost?: boolean
          is_won?: boolean
          last_inbound_at?: string | null
          last_known_blocker_id?: string | null
          loss_reason_id?: string | null
          lost_comment?: string | null
          lost_reason?: string | null
          name: string
          no_response_since?: string | null
          notes?: string | null
          owner_id?: string | null
          payment_status?: string | null
          probability?: number
          product_category_id?: string | null
          scheduled_at?: string | null
          service_type?: string | null
          source?: string
          stage_id?: string | null
          stage_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number | null
          blocker_expected_at?: string | null
          blocker_note?: string | null
          blocker_set_at?: string | null
          contact_id?: string | null
          cost_amount?: number | null
          created_at?: string
          current_blocker_id?: string | null
          deal_type?: string | null
          equipment_brand?: string | null
          equipment_model?: string | null
          expected_close_date?: string | null
          id?: string
          is_lost?: boolean
          is_won?: boolean
          last_inbound_at?: string | null
          last_known_blocker_id?: string | null
          loss_reason_id?: string | null
          lost_comment?: string | null
          lost_reason?: string | null
          name?: string
          no_response_since?: string | null
          notes?: string | null
          owner_id?: string | null
          payment_status?: string | null
          probability?: number
          product_category_id?: string | null
          scheduled_at?: string | null
          service_type?: string | null
          source?: string
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
            foreignKeyName: "deals_current_blocker_id_fkey"
            columns: ["current_blocker_id"]
            isOneToOne: false
            referencedRelation: "deal_blockers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_last_known_blocker_id_fkey"
            columns: ["last_known_blocker_id"]
            isOneToOne: false
            referencedRelation: "deal_blockers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_loss_reason_id_fkey"
            columns: ["loss_reason_id"]
            isOneToOne: false
            referencedRelation: "deal_loss_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          kind: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_rules: {
        Row: {
          auto_confirm: boolean
          category_id: string | null
          created_at: string
          deal_type_filter: string | null
          id: string
          is_active: boolean
          name: string
          rule_type: string
          tenant_id: string
          updated_at: string
          value: number
        }
        Insert: {
          auto_confirm?: boolean
          category_id?: string | null
          created_at?: string
          deal_type_filter?: string | null
          id?: string
          is_active?: boolean
          name: string
          rule_type: string
          tenant_id: string
          updated_at?: string
          value: number
        }
        Update: {
          auto_confirm?: boolean
          category_id?: string | null
          created_at?: string
          deal_type_filter?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rule_type?: string
          tenant_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          deal_id: string | null
          description: string | null
          id: string
          incurred_at: string
          kind: string
          owner_id: string | null
          receipt_url: string | null
          recurring_id: string | null
          rule_id: string | null
          source: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          id?: string
          incurred_at?: string
          kind: string
          owner_id?: string | null
          receipt_url?: string | null
          recurring_id?: string | null
          rule_id?: string | null
          source?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          id?: string
          incurred_at?: string
          kind?: string
          owner_id?: string | null
          receipt_url?: string | null
          recurring_id?: string | null
          rule_id?: string | null
          source?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "expense_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          error_rows: number | null
          file_name: string | null
          file_size: number | null
          id: string
          imported_rows: number | null
          kind: string
          reverted_at: string | null
          reverted_by: string | null
          skipped_rows: number | null
          status: string
          tenant_id: string
          total_rows: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_rows?: number | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          imported_rows?: number | null
          kind: string
          reverted_at?: string | null
          reverted_by?: string | null
          skipped_rows?: number | null
          status?: string
          tenant_id: string
          total_rows?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_rows?: number | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          imported_rows?: number | null
          kind?: string
          reverted_at?: string | null
          reverted_by?: string | null
          skipped_rows?: number | null
          status?: string
          tenant_id?: string
          total_rows?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          batch_id: string
          created_at: string
          error_message: string | null
          id: string
          mapped_data: Json
          raw_data: Json
          row_index: number
          status: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          mapped_data?: Json
          raw_data?: Json
          row_index: number
          status?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          mapped_data?: Json
          raw_data?: Json
          row_index?: number
          status?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id?: string
          token?: string
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
          channel_id: string | null
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
          channel_id?: string | null
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
          channel_id?: string | null
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
      monthly_goal_assignments: {
        Row: {
          amount: number
          created_at: string
          goal_id: string
          id: string
          share_percent: number
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          goal_id: string
          id?: string
          share_percent?: number
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          goal_id?: string
          id?: string
          share_percent?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goal_assignments_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "monthly_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_goal_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_goal_history: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          changed_by: string | null
          created_at: string
          goal_id: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          tenant_id: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      monthly_goals: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          dimension: string
          dimension_value_text: string | null
          dimension_value_uuid: string | null
          id: string
          is_draft: boolean
          notes: string | null
          period_month: number
          period_year: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          dimension: string
          dimension_value_text?: string | null
          dimension_value_uuid?: string | null
          id?: string
          is_draft?: boolean
          notes?: string | null
          period_month: number
          period_year: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          dimension?: string
          dimension_value_text?: string | null
          dimension_value_uuid?: string | null
          id?: string
          is_draft?: boolean
          notes?: string | null
          period_month?: number
          period_year?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_tenant_id_fkey"
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
      notifications_queue: {
        Row: {
          created_at: string
          deliver_after: string
          delivered_at: string | null
          id: string
          payload: Json
          reason: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deliver_after?: string
          delivered_at?: string | null
          id?: string
          payload?: Json
          reason?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deliver_after?: string
          delivered_at?: string | null
          id?: string
          payload?: Json
          reason?: string
          tenant_id?: string
          user_id?: string
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
      pipeline_stage_rules: {
        Row: {
          created_at: string
          from_stage_id: string
          id: string
          is_active: boolean
          pipeline_id: string
          tenant_id: string
          to_stage_id: string
          trigger_event: Database["public"]["Enums"]["pipeline_stage_trigger_event"]
          trigger_filters: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_stage_id: string
          id?: string
          is_active?: boolean
          pipeline_id: string
          tenant_id: string
          to_stage_id: string
          trigger_event: Database["public"]["Enums"]["pipeline_stage_trigger_event"]
          trigger_filters?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_stage_id?: string
          id?: string
          is_active?: boolean
          pipeline_id?: string
          tenant_id?: string
          to_stage_id?: string
          trigger_event?: Database["public"]["Enums"]["pipeline_stage_trigger_event"]
          trigger_filters?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stage_rules_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_rules_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_rules_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
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
      product_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number | null
          sku: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
          sku?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
          sku?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          job_title: string | null
          last_seen_at: string | null
          locale: string
          notification_prefs: Json
          onboarded: boolean
          phone: string | null
          reminder_hour: number
          signature: string | null
          tenant_id: string | null
          timezone: string
          ui_prefs: Json | null
          updated_at: string
          wa_greeting: string | null
        }
        Insert: {
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          last_seen_at?: string | null
          locale?: string
          notification_prefs?: Json
          onboarded?: boolean
          phone?: string | null
          reminder_hour?: number
          signature?: string | null
          tenant_id?: string | null
          timezone?: string
          ui_prefs?: Json | null
          updated_at?: string
          wa_greeting?: string | null
        }
        Update: {
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_seen_at?: string | null
          locale?: string
          notification_prefs?: Json
          onboarded?: boolean
          phone?: string | null
          reminder_hour?: number
          signature?: string | null
          tenant_id?: string | null
          timezone?: string
          ui_prefs?: Json | null
          updated_at?: string
          wa_greeting?: string | null
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
      recurrence_definitions: {
        Row: {
          actions: Json
          anticipation_days: number
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          id: string
          kind: string
          name: string
          period_months: number | null
          substitution_rule: Json
          target_pipeline_id: string | null
          target_stage_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          anticipation_days?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          kind?: string
          name: string
          period_months?: number | null
          substitution_rule?: Json
          target_pipeline_id?: string | null
          target_stage_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          anticipation_days?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          kind?: string
          name?: string
          period_months?: number | null
          substitution_rule?: Json
          target_pipeline_id?: string | null
          target_stage_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_definitions_target_pipeline_id_fkey"
            columns: ["target_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_definitions_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrence_occurrences: {
        Row: {
          created_at: string
          due_date: string
          generated_deal_id: string | null
          generated_task_id: string | null
          id: string
          recurrence_id: string
          status: string
          subscription_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date: string
          generated_deal_id?: string | null
          generated_task_id?: string | null
          id?: string
          recurrence_id: string
          status?: string
          subscription_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string
          generated_deal_id?: string | null
          generated_task_id?: string | null
          id?: string
          recurrence_id?: string
          status?: string
          subscription_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_occurrences_generated_deal_id_fkey"
            columns: ["generated_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_occurrences_generated_task_id_fkey"
            columns: ["generated_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_occurrences_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrence_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_occurrences_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "recurrence_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_occurrences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrence_subscriptions: {
        Row: {
          contact_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          last_executed_date: string | null
          metadata: Json
          next_due_date: string | null
          recurrence_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          entity_id: string
          entity_type?: string
          id?: string
          last_executed_date?: string | null
          metadata?: Json
          next_due_date?: string | null
          recurrence_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          last_executed_date?: string | null
          metadata?: Json
          next_due_date?: string | null
          recurrence_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_subscriptions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_subscriptions_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrence_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          day_of_month: number
          description: string | null
          id: string
          is_active: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          description?: string | null
          id?: string
          is_active?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          description?: string | null
          id?: string
          is_active?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          closed_at: string | null
          closed_note: string | null
          closed_via: string | null
          completed: boolean
          contact_id: string | null
          created_at: string
          deal_id: string | null
          due_at: string | null
          id: string
          task_kind: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          closed_at?: string | null
          closed_note?: string | null
          closed_via?: string | null
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_at?: string | null
          id?: string
          task_kind?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          closed_at?: string | null
          closed_note?: string | null
          closed_via?: string | null
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_at?: string | null
          id?: string
          task_kind?: string | null
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
      tenant_monthly_goals: {
        Row: {
          count_business_days: boolean
          created_at: string
          created_by: string | null
          id: string
          monthly_goal_by_type: Json
          monthly_goal_total: number
          note: string | null
          period_month: number
          period_year: number
          tenant_id: string
        }
        Insert: {
          count_business_days?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          monthly_goal_by_type?: Json
          monthly_goal_total?: number
          note?: string | null
          period_month: number
          period_year: number
          tenant_id: string
        }
        Update: {
          count_business_days?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          monthly_goal_by_type?: Json
          monthly_goal_total?: number
          note?: string | null
          period_month?: number
          period_year?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_monthly_goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          brand_name: string | null
          brand_primary: string | null
          contact_inactivity_days: number | null
          count_business_days: boolean
          created_at: string
          currency: string
          customer_inactivity_months: number | null
          id: string
          industry: string | null
          locale: string
          logo_url: string | null
          monthly_goal_by_type: Json
          monthly_goal_total: number
          mrr: number
          name: string
          no_response_days: number
          nps: number | null
          organization_id: string
          plan: string
          profit_thresholds: Json
          sales_channel: string | null
          status: string
          team_size: string | null
          timezone: string
          trial_ends_at: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          brand_name?: string | null
          brand_primary?: string | null
          contact_inactivity_days?: number | null
          count_business_days?: boolean
          created_at?: string
          currency?: string
          customer_inactivity_months?: number | null
          id?: string
          industry?: string | null
          locale?: string
          logo_url?: string | null
          monthly_goal_by_type?: Json
          monthly_goal_total?: number
          mrr?: number
          name: string
          no_response_days?: number
          nps?: number | null
          organization_id: string
          plan?: string
          profit_thresholds?: Json
          sales_channel?: string | null
          status?: string
          team_size?: string | null
          timezone?: string
          trial_ends_at?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          brand_name?: string | null
          brand_primary?: string | null
          contact_inactivity_days?: number | null
          count_business_days?: boolean
          created_at?: string
          currency?: string
          customer_inactivity_months?: number | null
          id?: string
          industry?: string | null
          locale?: string
          logo_url?: string | null
          monthly_goal_by_type?: Json
          monthly_goal_total?: number
          mrr?: number
          name?: string
          no_response_days?: number
          nps?: number | null
          organization_id?: string
          plan?: string
          profit_thresholds?: Json
          sales_channel?: string | null
          status?: string
          team_size?: string | null
          timezone?: string
          trial_ends_at?: string | null
          whatsapp_phone?: string | null
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
      whatsapp_channels: {
        Row: {
          access_token: string | null
          access_token_secret_name: string | null
          business_account_id: string | null
          connected_at: string | null
          created_at: string
          display_name: string | null
          id: string
          kind: Database["public"]["Enums"]["whatsapp_channel_kind"]
          last_error: string | null
          last_inbound_at: string | null
          last_inbound_from: string | null
          last_webhook_at: string | null
          last_webhook_payload: Json | null
          phone_number: string | null
          phone_number_id: string | null
          provider: string
          status: Database["public"]["Enums"]["whatsapp_channel_status"]
          tenant_id: string
          updated_at: string
          verify_token: string
        }
        Insert: {
          access_token?: string | null
          access_token_secret_name?: string | null
          business_account_id?: string | null
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          kind: Database["public"]["Enums"]["whatsapp_channel_kind"]
          last_error?: string | null
          last_inbound_at?: string | null
          last_inbound_from?: string | null
          last_webhook_at?: string | null
          last_webhook_payload?: Json | null
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["whatsapp_channel_status"]
          tenant_id: string
          updated_at?: string
          verify_token: string
        }
        Update: {
          access_token?: string | null
          access_token_secret_name?: string | null
          business_account_id?: string | null
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["whatsapp_channel_kind"]
          last_error?: string | null
          last_inbound_at?: string | null
          last_inbound_from?: string | null
          last_webhook_at?: string | null
          last_webhook_payload?: Json | null
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["whatsapp_channel_status"]
          tenant_id?: string
          updated_at?: string
          verify_token?: string
        }
        Relationships: []
      }
      whatsapp_command_log: {
        Row: {
          action_payload: Json | null
          channel_id: string | null
          confirmation_token: string | null
          created_at: string
          error_message: string | null
          executed_at: string | null
          from_phone: string
          id: string
          intent: string | null
          prompt: string
          status: Database["public"]["Enums"]["whatsapp_command_status"]
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action_payload?: Json | null
          channel_id?: string | null
          confirmation_token?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          from_phone: string
          id?: string
          intent?: string | null
          prompt: string
          status?: Database["public"]["Enums"]["whatsapp_command_status"]
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action_payload?: Json | null
          channel_id?: string | null
          confirmation_token?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          from_phone?: string
          id?: string
          intent?: string | null
          prompt?: string
          status?: Database["public"]["Enums"]["whatsapp_command_status"]
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_user_access: {
        Row: {
          created_at: string
          display_name: string | null
          enabled: boolean
          id: string
          permission_level: Database["public"]["Enums"]["whatsapp_permission_level"]
          phone_e164: string
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          enabled?: boolean
          id?: string
          permission_level?: Database["public"]["Enums"]["whatsapp_permission_level"]
          phone_e164: string
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          enabled?: boolean
          id?: string
          permission_level?: Database["public"]["Enums"]["whatsapp_permission_level"]
          phone_e164?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_webhook_log: {
        Row: {
          id: string
          kind: string
          matched_channel_id: string | null
          note: string | null
          payload: Json | null
          phone_number_id: string | null
          received_at: string
          tenant_id: string | null
        }
        Insert: {
          id?: string
          kind: string
          matched_channel_id?: string | null
          note?: string | null
          payload?: Json | null
          phone_number_id?: string | null
          received_at?: string
          tenant_id?: string | null
        }
        Update: {
          id?: string
          kind?: string
          matched_channel_id?: string | null
          note?: string | null
          payload?: Json | null
          phone_number_id?: string | null
          received_at?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_ai_draft_ab: {
        Row: {
          abs_char_delta: number | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          got_reply: boolean | null
          id: string | null
          message_id: string | null
          reply_within_hours: number | null
          tenant_id: string | null
          user_id: string | null
          was_edited: boolean | null
        }
        Insert: {
          abs_char_delta?: never
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          got_reply?: never
          id?: string | null
          message_id?: string | null
          reply_within_hours?: never
          tenant_id?: string | null
          user_id?: string | null
          was_edited?: never
        }
        Update: {
          abs_char_delta?: never
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          got_reply?: never
          id?: string | null
          message_id?: string | null
          reply_within_hours?: never
          tenant_id?: string | null
          user_id?: string | null
          was_edited?: never
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: Json }
      ai_cleanup_old_data: { Args: never; Returns: undefined }
      ai_recompute_next_run: { Args: { p_agent_id: string }; Returns: string }
      ai_run_due_agents: { Args: never; Returns: number }
      apply_pipeline_stage_rules: {
        Args: {
          p_deal_id: string
          p_event_filters?: Json
          p_event_type: Database["public"]["Enums"]["pipeline_stage_trigger_event"]
        }
        Returns: boolean
      }
      bootstrap_platform_owner: { Args: { _email: string }; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_pipeline_stage: {
        Args: {
          _outcome_action?: string
          _stage_id: string
          _target_stage_id?: string
        }
        Returns: Json
      }
      downgrade_expired_trials: { Args: never; Returns: number }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_recurring_expenses: { Args: never; Returns: number }
      get_user_profitability: {
        Args: {
          _month: number
          _tenant_id: string
          _user_id: string
          _year: number
        }
        Returns: {
          expenses: number
          margin_amount: number
          margin_pct: number
          revenue: number
        }[]
      }
      get_user_run_rate: {
        Args: {
          _month: number
          _tenant_id: string
          _user_id: string
          _year: number
        }
        Returns: {
          assigned_goal: number
          forecast_pct: number
          open_amount: number
          run_rate_pct: number
          won_amount: number
        }[]
      }
      get_user_tenant: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
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
      mark_silent_deals: { Args: never; Returns: number }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      org_tenant_count: { Args: { _org_id: string }; Returns: number }
      pipeline_stage_impact: {
        Args: { _stage_id: string }
        Returns: {
          deals_count: number
          outcomes_count: number
          outcomes_targeting_count: number
          rules_count: number
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recent_acted_suggestion: {
        Args: { _entity_id: string; _entity_type: string; _tenant_id: string }
        Returns: string
      }
      seed_default_activity_outcomes: {
        Args: { _pipeline_id: string; _tenant_id: string }
        Returns: number
      }
      seed_default_ai_agents: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      seed_default_deal_diagnostics: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      seed_pipeline_template: {
        Args: {
          p_pipeline_id: string
          p_template_name: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      suggest_goal_split: {
        Args: {
          _dimension: string
          _dimension_value_text: string
          _dimension_value_uuid: string
          _tenant_id: string
          _user_ids: string[]
        }
        Returns: {
          share_percent: number
          user_id: string
        }[]
      }
      tenant_active_users: { Args: { _tenant_id: string }; Returns: number }
      trial_days_left: { Args: { _tenant_id: string }; Returns: number }
    }
    Enums: {
      activity_type:
        | "wa_sent"
        | "wa_received"
        | "note"
        | "deal"
        | "task"
        | "call"
        | "meeting"
        | "email"
        | "manual"
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
      contact_lifecycle:
        | "prospecto"
        | "cliente"
        | "cliente_inactivo"
        | "inactivo"
      conversation_status: "Nuevo" | "En atención" | "Esperando" | "Resuelto"
      lead_source: "WhatsApp" | "Formulario web" | "Referido" | "Manual"
      message_direction: "inbound" | "outbound"
      message_type: "text" | "image" | "document" | "audio" | "location"
      notification_category: "operational" | "ai" | "system"
      notification_severity: "info" | "success" | "warning" | "danger"
      pipeline_stage_trigger_event:
        | "message_received"
        | "payment_received"
        | "activity_completed"
        | "task_completed"
      tag_family: "temperature" | "cycle" | "special"
      whatsapp_channel_kind: "clients" | "team"
      whatsapp_channel_status: "pending" | "connected" | "error" | "disabled"
      whatsapp_command_status:
        | "pending_confirmation"
        | "executed"
        | "rejected"
        | "failed"
      whatsapp_permission_level: "read" | "write_light" | "write_strong"
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
      activity_type: [
        "wa_sent",
        "wa_received",
        "note",
        "deal",
        "task",
        "call",
        "meeting",
        "email",
        "manual",
      ],
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
      contact_lifecycle: [
        "prospecto",
        "cliente",
        "cliente_inactivo",
        "inactivo",
      ],
      conversation_status: ["Nuevo", "En atención", "Esperando", "Resuelto"],
      lead_source: ["WhatsApp", "Formulario web", "Referido", "Manual"],
      message_direction: ["inbound", "outbound"],
      message_type: ["text", "image", "document", "audio", "location"],
      notification_category: ["operational", "ai", "system"],
      notification_severity: ["info", "success", "warning", "danger"],
      pipeline_stage_trigger_event: [
        "message_received",
        "payment_received",
        "activity_completed",
        "task_completed",
      ],
      tag_family: ["temperature", "cycle", "special"],
      whatsapp_channel_kind: ["clients", "team"],
      whatsapp_channel_status: ["pending", "connected", "error", "disabled"],
      whatsapp_command_status: [
        "pending_confirmation",
        "executed",
        "rejected",
        "failed",
      ],
      whatsapp_permission_level: ["read", "write_light", "write_strong"],
    },
  },
} as const
