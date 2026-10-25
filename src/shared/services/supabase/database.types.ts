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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: number
          metadata?: Json
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: number
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      amenities: {
        Row: {
          category: string | null
          code: string
          created_at: string
          id: number
          is_active: boolean
          name: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          id?: number
          is_active?: boolean
          name: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          id?: number
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          landlord_id: string
          last_message_at: string | null
          listing_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          landlord_id: string
          last_message_at?: string | null
          listing_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          landlord_id?: string
          last_message_at?: string | null
          listing_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_views: {
        Row: {
          id: number
          listing_id: string
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          id?: number
          listing_id: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          id?: number
          listing_id?: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_views_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          advance_rent_months: number
          archived_at: string | null
          asking_rent_monthly: number
          available_from: string | null
          completeness_score: number
          created_at: string
          description: string
          house_rules: string | null
          id: string
          landlord_id: string
          minimum_stay_months: number | null
          paused_at: string | null
          property_id: string
          published_at: string | null
          removal_reason: string | null
          removed_at: string | null
          rental_term: Database["public"]["Enums"]["rental_term_type"]
          security_deposit_months: number
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
        }
        Insert: {
          advance_rent_months?: number
          archived_at?: string | null
          asking_rent_monthly: number
          available_from?: string | null
          completeness_score?: number
          created_at?: string
          description: string
          house_rules?: string | null
          id?: string
          landlord_id: string
          minimum_stay_months?: number | null
          paused_at?: string | null
          property_id: string
          published_at?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          rental_term?: Database["public"]["Enums"]["rental_term_type"]
          security_deposit_months?: number
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
        }
        Update: {
          advance_rent_months?: number
          archived_at?: string | null
          asking_rent_monthly?: number
          available_from?: string | null
          completeness_score?: number
          created_at?: string
          description?: string
          house_rules?: string | null
          id?: string
          landlord_id?: string
          minimum_stay_months?: number | null
          paused_at?: string | null
          property_id?: string
          published_at?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          rental_term?: Database["public"]["Enums"]["rental_term_type"]
          security_deposit_months?: number
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          maintenance_request_id: string
          mime_type: string | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          maintenance_request_id: string
          mime_type?: string | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          maintenance_request_id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_attachments_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          created_at: string
          description: string
          id: string
          landlord_response: string | null
          last_updated_by: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          rejected_reason: string | null
          requested_by: string
          resolved_at: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          tenancy_id: string
          tenant_confirmed_resolved_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          landlord_response?: string | null
          last_updated_by?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          rejected_reason?: string | null
          requested_by: string
          resolved_at?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          tenancy_id: string
          tenant_confirmed_resolved_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          landlord_response?: string | null
          last_updated_by?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          rejected_reason?: string | null
          requested_by?: string
          resolved_at?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          tenancy_id?: string
          tenant_confirmed_resolved_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_updates: {
        Row: {
          actor_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["maintenance_status"] | null
          id: string
          maintenance_request_id: string
          note: string | null
          to_status: Database["public"]["Enums"]["maintenance_status"]
        }
        Insert: {
          actor_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["maintenance_status"] | null
          id?: string
          maintenance_request_id: string
          note?: string | null
          to_status: Database["public"]["Enums"]["maintenance_status"]
        }
        Update: {
          actor_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["maintenance_status"] | null
          id?: string
          maintenance_request_id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["maintenance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_updates_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_updates_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_updates_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_path: string | null
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          message_type: Database["public"]["Enums"]["message_type"]
          read_at: string | null
          reply_to_message_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_path?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_path?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string
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
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_model_versions: {
        Row: {
          created_at: string
          deployed_at: string | null
          feature_schema: Json
          id: string
          metrics: Json
          model_name: string
          retired_at: string | null
          status: Database["public"]["Enums"]["model_status"]
          trained_at: string | null
          training_dataset_label: string | null
          version: string
        }
        Insert: {
          created_at?: string
          deployed_at?: string | null
          feature_schema?: Json
          id?: string
          metrics?: Json
          model_name: string
          retired_at?: string | null
          status?: Database["public"]["Enums"]["model_status"]
          trained_at?: string | null
          training_dataset_label?: string | null
          version: string
        }
        Update: {
          created_at?: string
          deployed_at?: string | null
          feature_schema?: Json
          id?: string
          metrics?: Json
          model_name?: string
          retired_at?: string | null
          status?: Database["public"]["Enums"]["model_status"]
          trained_at?: string | null
          training_dataset_label?: string | null
          version?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          admin_id: string
          created_at: string
          ends_at: string | null
          id: string
          reason: string
          report_id: string | null
          starts_at: string
          target_listing_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          admin_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          reason: string
          report_id?: string | null
          starts_at?: string
          target_listing_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["moderation_action_type"]
          admin_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          reason?: string
          report_id?: string | null
          starts_at?: string
          target_listing_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_target_listing_id_fkey"
            columns: ["target_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      preference_amenities: {
        Row: {
          amenity_id: number
          importance: number
          is_required: boolean
          preference_id: string
        }
        Insert: {
          amenity_id: number
          importance?: number
          is_required?: boolean
          preference_id: string
        }
        Update: {
          amenity_id?: number
          importance?: number
          is_required?: boolean
          preference_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preference_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preference_amenities_preference_id_fkey"
            columns: ["preference_id"]
            isOneToOne: false
            referencedRelation: "tenant_preferences"
            referencedColumns: ["id"]
          },
        ]
      }
      preference_property_types: {
        Row: {
          preference_id: string
          property_type: Database["public"]["Enums"]["property_type"]
        }
        Insert: {
          preference_id: string
          property_type: Database["public"]["Enums"]["property_type"]
        }
        Update: {
          preference_id?: string
          property_type?: Database["public"]["Enums"]["property_type"]
        }
        Relationships: [
          {
            foreignKeyName: "preference_property_types_preference_id_fkey"
            columns: ["preference_id"]
            isOneToOne: false
            referencedRelation: "tenant_preferences"
            referencedColumns: ["id"]
          },
        ]
      }
      price_estimates: {
        Row: {
          context: Database["public"]["Enums"]["price_estimate_context"]
          created_at: string
          estimated_rent_monthly: number
          id: string
          input_features: Json
          is_public_on_listing: boolean
          listing_id: string | null
          model_version_id: string | null
          property_id: string | null
          requester_id: string
          response_time_ms: number | null
          safe_max: number | null
          safe_min: number | null
          typical_max: number | null
          typical_min: number | null
        }
        Insert: {
          context: Database["public"]["Enums"]["price_estimate_context"]
          created_at?: string
          estimated_rent_monthly: number
          id?: string
          input_features: Json
          is_public_on_listing?: boolean
          listing_id?: string | null
          model_version_id?: string | null
          property_id?: string | null
          requester_id: string
          response_time_ms?: number | null
          safe_max?: number | null
          safe_min?: number | null
          typical_max?: number | null
          typical_min?: number | null
        }
        Update: {
          context?: Database["public"]["Enums"]["price_estimate_context"]
          created_at?: string
          estimated_rent_monthly?: number
          id?: string
          input_features?: Json
          is_public_on_listing?: boolean
          listing_id?: string | null
          model_version_id?: string | null
          property_id?: string | null
          requester_id?: string
          response_time_ms?: number | null
          safe_max?: number | null
          safe_min?: number | null
          typical_max?: number | null
          typical_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_estimates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_estimates_model_version_id_fkey"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "ml_model_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_estimates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_estimates_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_estimates_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          suspended_until: string | null
          suspension_reason: string | null
          tier1_verified_at: string | null
          tier2_verified_at: string | null
          tier3_verified_at: string | null
          trust_score: number | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id: string
          suspended_until?: string | null
          suspension_reason?: string | null
          tier1_verified_at?: string | null
          tier2_verified_at?: string | null
          tier3_verified_at?: string | null
          trust_score?: number | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          suspended_until?: string | null
          suspension_reason?: string | null
          tier1_verified_at?: string | null
          tier2_verified_at?: string | null
          tier3_verified_at?: string | null
          trust_score?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          barangay: string
          bathrooms: number
          bedrooms: number
          city: Database["public"]["Enums"]["cavite_city"]
          created_at: string
          floor_area_sqm: number | null
          floor_number: number | null
          furnishing_status: Database["public"]["Enums"]["furnishing_status"]
          id: string
          is_active: boolean
          landlord_id: string
          max_occupants: number | null
          property_type: Database["public"]["Enums"]["property_type"]
          public_location: unknown
          safety_rating: number | null
          total_floors: number | null
          updated_at: string
        }
        Insert: {
          barangay: string
          bathrooms?: number
          bedrooms?: number
          city: Database["public"]["Enums"]["cavite_city"]
          created_at?: string
          floor_area_sqm?: number | null
          floor_number?: number | null
          furnishing_status?: Database["public"]["Enums"]["furnishing_status"]
          id?: string
          is_active?: boolean
          landlord_id: string
          max_occupants?: number | null
          property_type: Database["public"]["Enums"]["property_type"]
          public_location: unknown
          safety_rating?: number | null
          total_floors?: number | null
          updated_at?: string
        }
        Update: {
          barangay?: string
          bathrooms?: number
          bedrooms?: number
          city?: Database["public"]["Enums"]["cavite_city"]
          created_at?: string
          floor_area_sqm?: number | null
          floor_number?: number | null
          furnishing_status?: Database["public"]["Enums"]["furnishing_status"]
          id?: string
          is_active?: boolean
          landlord_id?: string
          max_occupants?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          public_location?: unknown
          safety_rating?: number | null
          total_floors?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_amenities: {
        Row: {
          amenity_id: number
          details: string | null
          property_id: string
        }
        Insert: {
          amenity_id: number
          details?: string | null
          property_id: string
        }
        Update: {
          amenity_id?: number
          details?: string | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_amenities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_nearby_places: {
        Row: {
          category: string
          distance_meters: number | null
          external_id: string | null
          fetched_at: string
          id: string
          location: unknown
          name: string
          property_id: string
          source: string
        }
        Insert: {
          category: string
          distance_meters?: number | null
          external_id?: string | null
          fetched_at?: string
          id?: string
          location?: unknown
          name: string
          property_id: string
          source?: string
        }
        Update: {
          category?: string
          distance_meters?: number | null
          external_id?: string | null
          fetched_at?: string
          id?: string
          location?: unknown
          name?: string
          property_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_nearby_places_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_cover: boolean
          property_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          property_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          property_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_private_locations: {
        Row: {
          access_instructions: string | null
          address_line_1: string
          address_line_2: string | null
          exact_location: unknown
          postal_code: string | null
          property_id: string
          updated_at: string
        }
        Insert: {
          access_instructions?: string | null
          address_line_1: string
          address_line_2?: string | null
          exact_location: unknown
          postal_code?: string | null
          property_id: string
          updated_at?: string
        }
        Update: {
          access_instructions?: string | null
          address_line_1?: string
          address_line_2?: string | null
          exact_location?: unknown
          postal_code?: string | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_private_locations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_results: {
        Row: {
          amenity_score: number | null
          budget_score: number | null
          final_score: number
          listing_id: string
          location_score: number | null
          rank: number
          run_id: string
          unit_spec_score: number | null
        }
        Insert: {
          amenity_score?: number | null
          budget_score?: number | null
          final_score: number
          listing_id: string
          location_score?: number | null
          rank: number
          run_id: string
          unit_spec_score?: number | null
        }
        Update: {
          amenity_score?: number | null
          budget_score?: number | null
          final_score?: number
          listing_id?: string
          location_score?: number | null
          rank?: number
          run_id?: string
          unit_spec_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_results_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "recommendation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_runs: {
        Row: {
          algorithm_version: string | null
          candidate_count: number
          created_at: string
          id: string
          preference_id: string | null
          returned_count: number
          tenant_id: string
        }
        Insert: {
          algorithm_version?: string | null
          candidate_count?: number
          created_at?: string
          id?: string
          preference_id?: string | null
          returned_count?: number
          tenant_id: string
        }
        Update: {
          algorithm_version?: string | null
          candidate_count?: number
          created_at?: string
          id?: string
          preference_id?: string | null
          returned_count?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_runs_preference_id_fkey"
            columns: ["preference_id"]
            isOneToOne: false
            referencedRelation: "tenant_preferences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_obligations: {
        Row: {
          amount_due: number
          created_at: string
          due_date: string
          id: string
          landlord_acknowledged_at: string | null
          note: string | null
          overdue_notified_at: string | null
          reminder_sent_at: string | null
          status: Database["public"]["Enums"]["rent_obligation_status"]
          tenancy_id: string
          tenant_marked_paid_at: string | null
          updated_at: string
        }
        Insert: {
          amount_due: number
          created_at?: string
          due_date: string
          id?: string
          landlord_acknowledged_at?: string | null
          note?: string | null
          overdue_notified_at?: string | null
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["rent_obligation_status"]
          tenancy_id: string
          tenant_marked_paid_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_due?: number
          created_at?: string
          due_date?: string
          id?: string
          landlord_acknowledged_at?: string | null
          note?: string | null
          overdue_notified_at?: string | null
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["rent_obligation_status"]
          tenancy_id?: string
          tenant_marked_paid_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_obligations_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      report_evidence: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          mime_type: string | null
          report_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          report_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          report_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_evidence_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_summary: string | null
          assigned_admin_id: string | null
          details: string
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_listing_id: string | null
          reported_message_id: string | null
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          submitted_at: string
          updated_at: string
        }
        Insert: {
          admin_summary?: string | null
          assigned_admin_id?: string | null
          details: string
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_listing_id?: string | null
          reported_message_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          admin_summary?: string | null
          assigned_admin_id?: string | null
          details?: string
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_listing_id?: string | null
          reported_message_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_listing_id_fkey"
            columns: ["reported_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_message_id_fkey"
            columns: ["reported_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          tenancy_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          tenancy_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          tenancy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
        Row: {
          created_at: string
          listing_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancies: {
        Row: {
          activated_at: string | null
          actual_end_date: string | null
          agreed_monthly_rent: number
          conversation_id: string | null
          created_at: string
          created_by: string
          end_reason: string | null
          ended_at: string | null
          expected_end_date: string | null
          id: string
          landlord_confirmed_at: string | null
          landlord_id: string
          listing_id: string
          property_id: string
          rent_due_day: number
          start_date: string
          status: Database["public"]["Enums"]["tenancy_status"]
          tenant_confirmed_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          actual_end_date?: string | null
          agreed_monthly_rent: number
          conversation_id?: string | null
          created_at?: string
          created_by: string
          end_reason?: string | null
          ended_at?: string | null
          expected_end_date?: string | null
          id?: string
          landlord_confirmed_at?: string | null
          landlord_id: string
          listing_id: string
          property_id: string
          rent_due_day: number
          start_date: string
          status?: Database["public"]["Enums"]["tenancy_status"]
          tenant_confirmed_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          actual_end_date?: string | null
          agreed_monthly_rent?: number
          conversation_id?: string | null
          created_at?: string
          created_by?: string
          end_reason?: string | null
          ended_at?: string | null
          expected_end_date?: string | null
          id?: string
          landlord_confirmed_at?: string | null
          landlord_id?: string
          listing_id?: string
          property_id?: string
          rent_due_day?: number
          start_date?: string
          status?: Database["public"]["Enums"]["tenancy_status"]
          tenant_confirmed_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_preferences: {
        Row: {
          budget_max: number
          budget_min: number | null
          city: Database["public"]["Enums"]["cavite_city"]
          created_at: string
          furnishing_statuses:
            | Database["public"]["Enums"]["furnishing_status"][]
            | null
          id: string
          is_default: boolean
          min_bathrooms: number
          min_bedrooms: number
          min_floor_area_sqm: number | null
          minimum_safety_rating: number | null
          name: string
          radius_km: number | null
          search_origin: unknown
          tenant_id: string
          updated_at: string
          use_current_location: boolean
          weight_amenities: number
          weight_budget: number
          weight_location: number
          weight_unit_specs: number
        }
        Insert: {
          budget_max: number
          budget_min?: number | null
          city: Database["public"]["Enums"]["cavite_city"]
          created_at?: string
          furnishing_statuses?:
            | Database["public"]["Enums"]["furnishing_status"][]
            | null
          id?: string
          is_default?: boolean
          min_bathrooms?: number
          min_bedrooms?: number
          min_floor_area_sqm?: number | null
          minimum_safety_rating?: number | null
          name?: string
          radius_km?: number | null
          search_origin?: unknown
          tenant_id: string
          updated_at?: string
          use_current_location?: boolean
          weight_amenities?: number
          weight_budget?: number
          weight_location?: number
          weight_unit_specs?: number
        }
        Update: {
          budget_max?: number
          budget_min?: number | null
          city?: Database["public"]["Enums"]["cavite_city"]
          created_at?: string
          furnishing_statuses?:
            | Database["public"]["Enums"]["furnishing_status"][]
            | null
          id?: string
          is_default?: boolean
          min_bathrooms?: number
          min_bedrooms?: number
          min_floor_area_sqm?: number | null
          minimum_safety_rating?: number | null
          name?: string
          radius_km?: number | null
          search_origin?: unknown
          tenant_id?: string
          updated_at?: string
          use_current_location?: boolean
          weight_amenities?: number
          weight_budget?: number
          weight_location?: number
          weight_unit_specs?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string
          device_label: string | null
          expo_push_token: string
          id: string
          is_active: boolean
          last_seen_at: string
          platform: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          expo_push_token: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          expo_push_token?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_documents: {
        Row: {
          created_at: string
          document_type: Database["public"]["Enums"]["verification_document_type"]
          file_name: string | null
          id: string
          mime_type: string | null
          storage_path: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          document_type: Database["public"]["Enums"]["verification_document_type"]
          file_name?: string | null
          id?: string
          mime_type?: string | null
          storage_path: string
          submission_id: string
        }
        Update: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["verification_document_type"]
          file_name?: string | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "verification_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_submissions: {
        Row: {
          id: string
          property_id: string | null
          rejection_reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string
          submitted_note: string | null
          tier: Database["public"]["Enums"]["verification_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          property_id?: string | null
          rejection_reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string
          submitted_note?: string | null
          tier: Database["public"]["Enums"]["verification_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          property_id?: string | null
          rejection_reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string
          submitted_note?: string | null
          tier?: Database["public"]["Enums"]["verification_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_property_fk"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      viewing_schedules: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          conversation_id: string
          created_at: string
          ends_at: string
          id: string
          landlord_id: string
          listing_id: string
          proposed_by: string
          responded_at: string | null
          responded_by: string | null
          response_note: string | null
          starts_at: string
          status: Database["public"]["Enums"]["viewing_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          conversation_id: string
          created_at?: string
          ends_at: string
          id?: string
          landlord_id: string
          listing_id: string
          proposed_by: string
          responded_at?: string | null
          responded_by?: string | null
          response_note?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["viewing_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          conversation_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          landlord_id?: string
          listing_id?: string
          proposed_by?: string
          responded_at?: string | null
          responded_by?: string | null
          response_note?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["viewing_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewing_schedules_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_schedules_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_schedules_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_schedules_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_schedules_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_schedules_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_schedules_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_schedules_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_schedules_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_schedules_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profile_rating_summary: {
        Row: {
          average_rating: number | null
          review_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"] | null
          avatar_path: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          trust_badge: string | null
          trust_score: number | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"] | null
          avatar_path?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          trust_badge?: never
          trust_score?: number | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"] | null
          avatar_path?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          trust_badge?: never
          trust_score?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      begin_tier2_verification_resubmission: {
        Args: never
        Returns: {
          id: string
          property_id: string | null
          rejection_reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string
          submitted_note: string | null
          tier: Database["public"]["Enums"]["verification_tier"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "verification_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_conversation: {
        Args: { conversation_uuid: string; requested_user?: string }
        Returns: boolean
      }
      can_access_tenancy: {
        Args: { requested_user?: string; tenancy_uuid: string }
        Returns: boolean
      }
      can_manage_property: {
        Args: { property_uuid: string; requested_user?: string }
        Returns: boolean
      }
      can_read_property_private_location: {
        Args: { p_property_id: string }
        Returns: boolean
      }
      can_view_property: {
        Args: { property_uuid: string; requested_user?: string }
        Returns: boolean
      }
      create_property_setup: {
        Args: {
          p_access_instructions?: string
          p_address_line_1: string
          p_address_line_2?: string
          p_amenity_ids?: number[]
          p_barangay: string
          p_bathrooms?: number
          p_bedrooms?: number
          p_city: Database["public"]["Enums"]["cavite_city"]
          p_exact_lat: number
          p_exact_lng: number
          p_floor_area_sqm?: number
          p_floor_number?: number
          p_furnishing_status?: Database["public"]["Enums"]["furnishing_status"]
          p_max_occupants?: number
          p_postal_code?: string
          p_property_type: Database["public"]["Enums"]["property_type"]
          p_public_lat: number
          p_public_lng: number
          p_total_floors?: number
        }
        Returns: Json
      }
      get_admin_verification_queue: {
        Args: never
        Returns: {
          display_name: string
          document_count: number
          document_created_at: string
          document_id: string
          document_type: Database["public"]["Enums"]["verification_document_type"]
          file_name: string
          mime_type: string
          property_id: string
          status: Database["public"]["Enums"]["verification_status"]
          storage_path: string
          submission_id: string
          submitted_at: string
          submitted_note: string
          tier: Database["public"]["Enums"]["verification_tier"]
          tier1_verified_at: string
          tier2_verified_at: string
          tier3_verified_at: string
          trust_score: number
          updated_at: string
          user_id: string
        }[]
      }
      has_app_role: {
        Args: {
          requested_role: Database["public"]["Enums"]["app_role"]
          requested_user?: string
        }
        Returns: boolean
      }
      is_admin: { Args: { requested_user?: string }; Returns: boolean }
      is_tier1_verified: { Args: { requested_user?: string }; Returns: boolean }
      refresh_my_tier1_verification: { Args: never; Returns: boolean }
      review_verification_submission: {
        Args: {
          requested_rejection_reason?: string
          requested_review_note?: string
          requested_status: Database["public"]["Enums"]["verification_status"]
          requested_submission_id: string
        }
        Returns: {
          id: string
          property_id: string | null
          rejection_reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string
          submitted_note: string | null
          tier: Database["public"]["Enums"]["verification_tier"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "verification_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_listing: {
        Args: { p_listing_id: string }
        Returns: {
          listing_id: string
          listing_status: Database["public"]["Enums"]["listing_status"]
          completeness_score: number
          published_at: string | null
          paused_at: string | null
          archived_at: string | null
          updated_at: string
        }[]
      }
      pause_listing: {
        Args: { p_listing_id: string }
        Returns: {
          listing_id: string
          listing_status: Database["public"]["Enums"]["listing_status"]
          completeness_score: number
          published_at: string | null
          paused_at: string | null
          archived_at: string | null
          updated_at: string
        }[]
      }
      reactivate_listing: {
        Args: { p_listing_id: string }
        Returns: {
          listing_id: string
          listing_status: Database["public"]["Enums"]["listing_status"]
          completeness_score: number
          published_at: string | null
          paused_at: string | null
          archived_at: string | null
          updated_at: string
        }[]
      }
      publish_listing: {
        Args: {
          p_listing_id: string
        }
        Returns: {
          completeness_score: number
          listing_id: string
          listing_status: Database["public"]["Enums"]["listing_status"]
          published_at: string
          updated_at: string
        }[]
      }
      save_listing_draft: {
        Args: {
          p_advance_rent_months?: number
          p_asking_rent_monthly: number
          p_available_from?: string
          p_description: string
          p_house_rules?: string
          p_minimum_stay_months?: number
          p_property_id: string
          p_rental_term?: Database["public"]["Enums"]["rental_term_type"]
          p_security_deposit_months?: number
          p_title: string
        }
        Returns: {
          completeness_score: number
          created_at: string
          listing_id: string
          listing_status: Database["public"]["Enums"]["listing_status"]
          updated_at: string
        }[]
      }
      set_property_cover_photo: {
        Args: { p_photo_id: string }
        Returns: undefined
      }
      set_user_roles: {
        Args: { requested_roles: string[] }
        Returns: {
          role: string
        }[]
      }
      update_my_profile: {
        Args: {
          new_avatar_path?: string
          new_bio?: string
          new_display_name: string
        }
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          suspended_until: string | null
          suspension_reason: string | null
          tier1_verified_at: string | null
          tier2_verified_at: string | null
          tier3_verified_at: string | null
          trust_score: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_status: "active" | "restricted" | "suspended" | "deleted"
      app_role: "tenant" | "landlord" | "admin"
      cavite_city: "imus" | "dasmarinas" | "tagaytay"
      conversation_status: "open" | "closed" | "blocked"
      furnishing_status: "unfurnished" | "semi_furnished" | "furnished"
      listing_status:
        | "draft"
        | "active"
        | "paused"
        | "rented"
        | "archived"
        | "removed"
      maintenance_priority: "low" | "normal" | "high" | "urgent"
      maintenance_status:
        | "submitted"
        | "acknowledged"
        | "needs_information"
        | "scheduled"
        | "in_progress"
        | "resolved"
        | "reopened"
        | "rejected"
        | "cancelled"
      message_type: "text" | "image" | "file" | "system"
      model_status:
        | "development"
        | "candidate"
        | "active"
        | "retired"
        | "failed"
      moderation_action_type:
        | "warning"
        | "restrict_account"
        | "suspend_account"
        | "restore_account"
        | "pause_listing"
        | "remove_listing"
        | "dismiss_report"
      notification_type:
        | "verification_update"
        | "new_message"
        | "viewing_update"
        | "tenancy_update"
        | "rent_due"
        | "rent_overdue"
        | "maintenance_update"
        | "review_request"
        | "report_update"
        | "moderation_notice"
        | "system"
      price_estimate_context:
        | "listing_creation"
        | "listing_fairness_check"
        | "admin_test"
      property_type:
        | "apartment"
        | "boarding_house"
        | "bedspace"
        | "room"
        | "studio"
        | "condominium"
        | "house"
        | "dormitory"
        | "other"
      rent_obligation_status:
        | "upcoming"
        | "due"
        | "overdue"
        | "tenant_marked_paid"
        | "landlord_acknowledged"
        | "waived"
        | "disputed"
      rental_term_type: "short_term" | "long_term" | "either"
      report_reason:
        | "fraudulent_listing"
        | "misleading_information"
        | "harassment"
        | "impersonation"
        | "unsafe_property"
        | "spam"
        | "policy_violation"
        | "other"
      report_status:
        | "submitted"
        | "under_review"
        | "needs_information"
        | "upheld"
        | "dismissed"
        | "closed"
      tenancy_status:
        | "proposed"
        | "pending_confirmation"
        | "active"
        | "ended"
        | "cancelled"
      verification_document_type:
        | "passport"
        | "drivers_license"
        | "umid"
        | "philsys_id"
        | "land_title"
        | "tax_declaration"
        | "hoa_document"
        | "authorization_to_lease"
        | "other"
      verification_status:
        | "pending"
        | "under_review"
        | "approved"
        | "rejected"
        | "cancelled"
        | "revoked"
      verification_tier: "tier_2_identity" | "tier_3_property"
      viewing_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "reschedule_requested"
        | "cancelled"
        | "completed"
        | "no_show"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_status: ["active", "restricted", "suspended", "deleted"],
      app_role: ["tenant", "landlord", "admin"],
      cavite_city: ["imus", "dasmarinas", "tagaytay"],
      conversation_status: ["open", "closed", "blocked"],
      furnishing_status: ["unfurnished", "semi_furnished", "furnished"],
      listing_status: [
        "draft",
        "active",
        "paused",
        "rented",
        "archived",
        "removed",
      ],
      maintenance_priority: ["low", "normal", "high", "urgent"],
      maintenance_status: [
        "submitted",
        "acknowledged",
        "needs_information",
        "scheduled",
        "in_progress",
        "resolved",
        "reopened",
        "rejected",
        "cancelled",
      ],
      message_type: ["text", "image", "file", "system"],
      model_status: ["development", "candidate", "active", "retired", "failed"],
      moderation_action_type: [
        "warning",
        "restrict_account",
        "suspend_account",
        "restore_account",
        "pause_listing",
        "remove_listing",
        "dismiss_report",
      ],
      notification_type: [
        "verification_update",
        "new_message",
        "viewing_update",
        "tenancy_update",
        "rent_due",
        "rent_overdue",
        "maintenance_update",
        "review_request",
        "report_update",
        "moderation_notice",
        "system",
      ],
      price_estimate_context: [
        "listing_creation",
        "listing_fairness_check",
        "admin_test",
      ],
      property_type: [
        "apartment",
        "boarding_house",
        "bedspace",
        "room",
        "studio",
        "condominium",
        "house",
        "dormitory",
        "other",
      ],
      rent_obligation_status: [
        "upcoming",
        "due",
        "overdue",
        "tenant_marked_paid",
        "landlord_acknowledged",
        "waived",
        "disputed",
      ],
      rental_term_type: ["short_term", "long_term", "either"],
      report_reason: [
        "fraudulent_listing",
        "misleading_information",
        "harassment",
        "impersonation",
        "unsafe_property",
        "spam",
        "policy_violation",
        "other",
      ],
      report_status: [
        "submitted",
        "under_review",
        "needs_information",
        "upheld",
        "dismissed",
        "closed",
      ],
      tenancy_status: [
        "proposed",
        "pending_confirmation",
        "active",
        "ended",
        "cancelled",
      ],
      verification_document_type: [
        "passport",
        "drivers_license",
        "umid",
        "philsys_id",
        "land_title",
        "tax_declaration",
        "hoa_document",
        "authorization_to_lease",
        "other",
      ],
      verification_status: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "cancelled",
        "revoked",
      ],
      verification_tier: ["tier_2_identity", "tier_3_property"],
      viewing_status: [
        "pending",
        "confirmed",
        "declined",
        "reschedule_requested",
        "cancelled",
        "completed",
        "no_show",
      ],
    },
  },
} as const
