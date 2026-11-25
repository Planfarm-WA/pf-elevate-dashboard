
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "blueprints": {
                  Row: {
                    "business_id": string,"created_at": string,"purpose": string,"ten_year": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"purpose"?: string,"ten_year"?: string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"purpose"?: string,"ten_year"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blueprints_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"clients": {
                  Row: {
                    "business_id": string,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"coaching_sessions": {
                  Row: {
                    "business_id": string,"created_at": string,"done": boolean,"focus": string,"format": string,"id": string,"notes": string,"session_date": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"done"?: boolean,"focus": string,"format"?: string,"id"?: string,"notes"?: string,"session_date": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"done"?: boolean,"focus"?: string,"format"?: string,"id"?: string,"notes"?: string,"session_date"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coaching_sessions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"core_values": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"sort_order": number,"text": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"sort_order"?: number,"text": string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"sort_order"?: number,"text"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "core_values_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "blueprints"
      referencedColumns: ["business_id"]
    }
                  ]
                },"issues": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["issue_kind"],"sort_order": number,"text": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["issue_kind"],"sort_order"?: number,"text": string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["issue_kind"],"sort_order"?: number,"text"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "issues_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"one_year_targets": {
                  Row: {
                    "business_id": string,"created_at": string,"done": boolean,"id": string,"sort_order": number,"text": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"done"?: boolean,"id"?: string,"sort_order"?: number,"text": string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"done"?: boolean,"id"?: string,"sort_order"?: number,"text"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "one_year_targets_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "blueprints"
      referencedColumns: ["business_id"]
    }
                  ]
                },"pending_priorities_120": {
                  Row: {
                    "business_id": string,"by_when": string,"created_at": string,"from_period": string,"id": string,"what": string,"who": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"by_when"?: string,"created_at"?: string,"from_period"?: string,"id"?: string,"what": string,"who"?: string
                  }
                  Update: {
                    "business_id"?: string,"by_when"?: string,"created_at"?: string,"from_period"?: string,"id"?: string,"what"?: string,"who"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pending_priorities_120_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"pending_tasks_30": {
                  Row: {
                    "business_id": string,"by_when": string,"created_at": string,"from_round": string,"id": string,"what": string,"who": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"by_when"?: string,"created_at"?: string,"from_round"?: string,"id"?: string,"what": string,"who"?: string
                  }
                  Update: {
                    "business_id"?: string,"by_when"?: string,"created_at"?: string,"from_round"?: string,"id"?: string,"what"?: string,"who"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pending_tasks_30_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"periods_120": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"is_current": boolean,"label": string,"one_year_targets": (string)[],"period": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"is_current"?: boolean,"label": string,"one_year_targets"?: (string)[],"period"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"is_current"?: boolean,"label"?: string,"one_year_targets"?: (string)[],"period"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "periods_120_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"priorities_120": {
                  Row: {
                    "by_when": string,"carried_from": string | null,"created_at": string,"id": string,"period_id": string,"pushed": boolean,"sort_order": number,"status": Database["public"]['Enums']["item_status"],"updated_at": string,"what": string,"who": string
                  }
                  ComputedFields: never
                  Insert: {
                    "by_when"?: string,"carried_from"?: string | null,"created_at"?: string,"id"?: string,"period_id": string,"pushed"?: boolean,"sort_order"?: number,"status"?: Database["public"]['Enums']["item_status"],"updated_at"?: string,"what": string,"who"?: string
                  }
                  Update: {
                    "by_when"?: string,"carried_from"?: string | null,"created_at"?: string,"id"?: string,"period_id"?: string,"pushed"?: boolean,"sort_order"?: number,"status"?: Database["public"]['Enums']["item_status"],"updated_at"?: string,"what"?: string,"who"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "priorities_120_period_id_fkey"
      columns: ["period_id"]
isOneToOne: false
      referencedRelation: "periods_120"
      referencedColumns: ["id"]
    }
                  ]
                },"rounds_30": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"is_current": boolean,"label": string,"notes": string,"period": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"is_current"?: boolean,"label": string,"notes"?: string,"period"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"is_current"?: boolean,"label"?: string,"notes"?: string,"period"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rounds_30_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"staff": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tasks_30": {
                  Row: {
                    "by_when": string,"carried_from": string | null,"created_at": string,"id": string,"pushed": boolean,"round_id": string,"sort_order": number,"status": Database["public"]['Enums']["item_status"],"updated_at": string,"what": string,"who": string
                  }
                  ComputedFields: never
                  Insert: {
                    "by_when"?: string,"carried_from"?: string | null,"created_at"?: string,"id"?: string,"pushed"?: boolean,"round_id": string,"sort_order"?: number,"status"?: Database["public"]['Enums']["item_status"],"updated_at"?: string,"what": string,"who"?: string
                  }
                  Update: {
                    "by_when"?: string,"carried_from"?: string | null,"created_at"?: string,"id"?: string,"pushed"?: boolean,"round_id"?: string,"sort_order"?: number,"status"?: Database["public"]['Enums']["item_status"],"updated_at"?: string,"what"?: string,"who"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_30_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "rounds_30"
      referencedColumns: ["id"]
    }
                  ]
                },"three_year_items": {
                  Row: {
                    "business_id": string,"created_at": string,"done": boolean,"id": string,"sort_order": number,"text": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"done"?: boolean,"id"?: string,"sort_order"?: number,"text": string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"done"?: boolean,"id"?: string,"sort_order"?: number,"text"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "three_year_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "blueprints"
      referencedColumns: ["business_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_access_business":
{ Args: { "p_business_id": string }; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            "issue_kind": "issue"|"opportunity","item_status": "none"|"on-track"|"off-track"|"complete"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "issue_kind": ["issue", "opportunity"],"item_status": ["none", "on-track", "off-track", "complete"]
          }
        }
} as const
