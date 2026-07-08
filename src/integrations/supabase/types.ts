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
      clients: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          id: string
          n8n_enabled: boolean
          n8n_last_delivery_at: string | null
          n8n_last_delivery_error: string | null
          n8n_last_delivery_status: string | null
          n8n_webhook_secret_encrypted: string | null
          n8n_webhook_url: string | null
          name: string
          status: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          n8n_enabled?: boolean
          n8n_last_delivery_at?: string | null
          n8n_last_delivery_error?: string | null
          n8n_last_delivery_status?: string | null
          n8n_webhook_secret_encrypted?: string | null
          n8n_webhook_url?: string | null
          name: string
          status?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          n8n_enabled?: boolean
          n8n_last_delivery_at?: string | null
          n8n_last_delivery_error?: string | null
          n8n_last_delivery_status?: string | null
          n8n_webhook_secret_encrypted?: string | null
          n8n_webhook_url?: string | null
          name?: string
          status?: string
        }
        Relationships: []
      }
      message_send_logs: {
        Row: {
          client_id: string | null
          created_at: string
          error_message: string | null
          http_status: number | null
          id: string
          message_preview: string | null
          meta_message_id: string | null
          phone_number_id: string | null
          raw_response: Json | null
          request_payload: Json | null
          source: string
          status: string
          to: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          message_preview?: string | null
          meta_message_id?: string | null
          phone_number_id?: string | null
          raw_response?: Json | null
          request_payload?: Json | null
          source?: string
          status: string
          to: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          message_preview?: string | null
          meta_message_id?: string | null
          phone_number_id?: string | null
          raw_response?: Json | null
          request_payload?: Json | null
          source?: string
          status?: string
          to?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_send_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_webhook_events: {
        Row: {
          client_id: string | null
          direction: string
          error_code: string | null
          error_details: Json | null
          error_message: string | null
          error_title: string | null
          event_kind: string | null
          field: string | null
          from_wa_id: string | null
          id: string
          message_type: string | null
          phone_number_id: string | null
          processed: boolean
          processing_error: string | null
          raw_headers: Json | null
          raw_payload: Json
          received_at: string
          status: string | null
          text_body: string | null
          to_phone_number: string | null
          wa_message_id: string | null
          whatsapp_account_id: string | null
        }
        Insert: {
          client_id?: string | null
          direction?: string
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          error_title?: string | null
          event_kind?: string | null
          field?: string | null
          from_wa_id?: string | null
          id?: string
          message_type?: string | null
          phone_number_id?: string | null
          processed?: boolean
          processing_error?: string | null
          raw_headers?: Json | null
          raw_payload: Json
          received_at?: string
          status?: string | null
          text_body?: string | null
          to_phone_number?: string | null
          wa_message_id?: string | null
          whatsapp_account_id?: string | null
        }
        Update: {
          client_id?: string | null
          direction?: string
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          error_title?: string | null
          event_kind?: string | null
          field?: string | null
          from_wa_id?: string | null
          id?: string
          message_type?: string | null
          phone_number_id?: string | null
          processed?: boolean
          processing_error?: string | null
          raw_headers?: Json | null
          raw_payload?: Json
          received_at?: string
          status?: string | null
          text_body?: string | null
          to_phone_number?: string | null
          wa_message_id?: string | null
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_webhook_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_webhook_events_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_forward_logs: {
        Row: {
          attempted_at: string
          client_id: string | null
          error_message: string | null
          forward_attempted: boolean
          id: string
          meta_webhook_event_id: string | null
          n8n_enabled_value: boolean | null
          n8n_webhook_url: string | null
          phone_number_id: string | null
          request_headers: Json | null
          request_payload: Json | null
          response_body: string | null
          response_status: number | null
          success: boolean
          whatsapp_account_id: string | null
        }
        Insert: {
          attempted_at?: string
          client_id?: string | null
          error_message?: string | null
          forward_attempted?: boolean
          id?: string
          meta_webhook_event_id?: string | null
          n8n_enabled_value?: boolean | null
          n8n_webhook_url?: string | null
          phone_number_id?: string | null
          request_headers?: Json | null
          request_payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          whatsapp_account_id?: string | null
        }
        Update: {
          attempted_at?: string
          client_id?: string | null
          error_message?: string | null
          forward_attempted?: boolean
          id?: string
          meta_webhook_event_id?: string | null
          n8n_enabled_value?: boolean | null
          n8n_webhook_url?: string | null
          phone_number_id?: string | null
          request_headers?: Json | null
          request_payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "n8n_forward_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "n8n_forward_logs_meta_webhook_event_id_fkey"
            columns: ["meta_webhook_event_id"]
            isOneToOne: false
            referencedRelation: "meta_webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_links: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_meta_webhook_events: {
        Row: {
          body_json: Json | null
          body_raw: string | null
          headers: Json | null
          id: string
          is_meta_test: boolean
          method: string | null
          object_type: string | null
          phone_number_id: string | null
          processed: boolean
          processing_error: string | null
          query_params: Json | null
          received_at: string
          url: string | null
        }
        Insert: {
          body_json?: Json | null
          body_raw?: string | null
          headers?: Json | null
          id?: string
          is_meta_test?: boolean
          method?: string | null
          object_type?: string | null
          phone_number_id?: string | null
          processed?: boolean
          processing_error?: string | null
          query_params?: Json | null
          received_at?: string
          url?: string | null
        }
        Update: {
          body_json?: Json | null
          body_raw?: string | null
          headers?: Json | null
          id?: string
          is_meta_test?: boolean
          method?: string | null
          object_type?: string | null
          phone_number_id?: string | null
          processed?: boolean
          processing_error?: string | null
          query_params?: Json | null
          received_at?: string
          url?: string | null
        }
        Relationships: []
      }
      test_contacts: {
        Row: {
          client_id: string
          created_at: string
          id: string
          label: string
          phone: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          label: string
          phone: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          label?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          event_type: string | null
          id: string
          payload: Json
          processed: boolean
          whatsapp_account_id: string | null
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload: Json
          processed?: boolean
          whatsapp_account_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_accounts: {
        Row: {
          business_id: string | null
          client_id: string
          connected_at: string | null
          created_at: string
          display_phone_number: string | null
          id: string
          phone_number_id: string | null
          status: string
          token_encrypted: string | null
          updated_at: string
          verified_name: string | null
          waba_id: string | null
          webhook_subscribed: boolean
        }
        Insert: {
          business_id?: string | null
          client_id: string
          connected_at?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          phone_number_id?: string | null
          status?: string
          token_encrypted?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id?: string | null
          webhook_subscribed?: boolean
        }
        Update: {
          business_id?: string | null
          client_id?: string
          connected_at?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          phone_number_id?: string | null
          status?: string
          token_encrypted?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id?: string | null
          webhook_subscribed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_send_logs: {
        Row: {
          client_id: string
          created_at: string
          error_code: string | null
          error_message: string | null
          error_subcode: string | null
          error_type: string | null
          fbtrace_id: string | null
          id: string
          message_preview: string | null
          message_type: string | null
          meta_message_id: string | null
          meta_message_status: string | null
          phone_number_id: string | null
          request_payload: Json | null
          response_body: Json | null
          response_status: number | null
          source: string
          success: boolean
          to_wa_id: string | null
          whatsapp_account_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          error_subcode?: string | null
          error_type?: string | null
          fbtrace_id?: string | null
          id?: string
          message_preview?: string | null
          message_type?: string | null
          meta_message_id?: string | null
          meta_message_status?: string | null
          phone_number_id?: string | null
          request_payload?: Json | null
          response_body?: Json | null
          response_status?: number | null
          source?: string
          success?: boolean
          to_wa_id?: string | null
          whatsapp_account_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          error_subcode?: string | null
          error_type?: string | null
          fbtrace_id?: string | null
          id?: string
          message_preview?: string | null
          message_type?: string | null
          meta_message_id?: string | null
          meta_message_status?: string | null
          phone_number_id?: string | null
          request_payload?: Json | null
          response_body?: Json | null
          response_status?: number | null
          source?: string
          success?: boolean
          to_wa_id?: string | null
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_send_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_logs_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
