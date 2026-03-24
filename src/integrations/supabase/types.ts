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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_payments: {
        Row: {
          created_at: string
          id: string
          payment_type: string
          sol_amount: number
          tx_signature: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_type?: string
          sol_amount?: number
          tx_signature: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_type?: string
          sol_amount?: number
          tx_signature?: string
          wallet_address?: string
        }
        Relationships: []
      }
      auto_trade_budgets: {
        Row: {
          budget_mode: string
          created_at: string
          currency: string
          deposit_amount: number
          escrow_amount: number
          escrow_tx: string | null
          id: string
          is_active: boolean
          remaining_amount: number
          spending_limit: number | null
          spent_amount: number
          updated_at: string
          wallet_address: string
        }
        Insert: {
          budget_mode?: string
          created_at?: string
          currency?: string
          deposit_amount?: number
          escrow_amount?: number
          escrow_tx?: string | null
          id?: string
          is_active?: boolean
          remaining_amount?: number
          spending_limit?: number | null
          spent_amount?: number
          updated_at?: string
          wallet_address: string
        }
        Update: {
          budget_mode?: string
          created_at?: string
          currency?: string
          deposit_amount?: number
          escrow_amount?: number
          escrow_tx?: string | null
          id?: string
          is_active?: boolean
          remaining_amount?: number
          spending_limit?: number | null
          spent_amount?: number
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      auto_trade_entry_prices: {
        Row: {
          entry_price: number
          id: string
          lowest_price: number | null
          peak_price: number | null
          price_1h_ago: number | null
          recorded_at: string
          token_mint: string
          wallet_address: string
        }
        Insert: {
          entry_price: number
          id?: string
          lowest_price?: number | null
          peak_price?: number | null
          price_1h_ago?: number | null
          recorded_at?: string
          token_mint: string
          wallet_address: string
        }
        Update: {
          entry_price?: number
          id?: string
          lowest_price?: number | null
          peak_price?: number | null
          price_1h_ago?: number | null
          recorded_at?: string
          token_mint?: string
          wallet_address?: string
        }
        Relationships: []
      }
      beach_mode_sessions: {
        Row: {
          ai_autonomy_level: string
          created_at: string
          daily_cap_sol: number
          daily_reset_at: string
          daily_spent_sol: number
          delegation_status: string
          delegation_tx: string | null
          id: string
          is_active: boolean
          last_evaluation_at: string | null
          max_trade_sol: number
          strategies: Json
          total_pnl_sol: number
          total_trades: number
          updated_at: string
          wallet_address: string
        }
        Insert: {
          ai_autonomy_level?: string
          created_at?: string
          daily_cap_sol?: number
          daily_reset_at?: string
          daily_spent_sol?: number
          delegation_status?: string
          delegation_tx?: string | null
          id?: string
          is_active?: boolean
          last_evaluation_at?: string | null
          max_trade_sol?: number
          strategies?: Json
          total_pnl_sol?: number
          total_trades?: number
          updated_at?: string
          wallet_address: string
        }
        Update: {
          ai_autonomy_level?: string
          created_at?: string
          daily_cap_sol?: number
          daily_reset_at?: string
          daily_spent_sol?: number
          delegation_status?: string
          delegation_tx?: string | null
          id?: string
          is_active?: boolean
          last_evaluation_at?: string | null
          max_trade_sol?: number
          strategies?: Json
          total_pnl_sol?: number
          total_trades?: number
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          wallet_address: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          wallet_address: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          wallet_address?: string
        }
        Relationships: []
      }
      copy_trade_configs: {
        Row: {
          auto_sell: boolean
          blacklisted_tokens: string[] | null
          created_at: string
          id: string
          is_active: boolean
          last_checked_tx: string | null
          max_sol_per_trade: number
          target_wallet: string
          updated_at: string
          wallet_address: string
        }
        Insert: {
          auto_sell?: boolean
          blacklisted_tokens?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_checked_tx?: string | null
          max_sol_per_trade?: number
          target_wallet: string
          updated_at?: string
          wallet_address: string
        }
        Update: {
          auto_sell?: boolean
          blacklisted_tokens?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_checked_tx?: string | null
          max_sol_per_trade?: number
          target_wallet?: string
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      copy_trade_events: {
        Row: {
          created_at: string
          id: string
          processed: boolean
          signature: string
          sol_amount: number
          swap_type: string
          target_wallet: string
          timestamp: number | null
          token_mint: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          processed?: boolean
          signature: string
          sol_amount?: number
          swap_type: string
          target_wallet: string
          timestamp?: number | null
          token_mint: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          processed?: boolean
          signature?: string
          sol_amount?: number
          swap_type?: string
          target_wallet?: string
          timestamp?: number | null
          token_mint?: string
          wallet_address?: string
        }
        Relationships: []
      }
      live_trades: {
        Row: {
          bot_type: string | null
          created_at: string
          id: string
          input_amount: number
          input_mint: string
          input_symbol: string | null
          input_usd_value: number | null
          output_amount: number
          output_mint: string
          output_symbol: string | null
          output_usd_value: number | null
          status: string
          trade_type: string
          tx_signature: string
          wallet_address: string
        }
        Insert: {
          bot_type?: string | null
          created_at?: string
          id?: string
          input_amount?: number
          input_mint: string
          input_symbol?: string | null
          input_usd_value?: number | null
          output_amount?: number
          output_mint: string
          output_symbol?: string | null
          output_usd_value?: number | null
          status?: string
          trade_type?: string
          tx_signature: string
          wallet_address: string
        }
        Update: {
          bot_type?: string | null
          created_at?: string
          id?: string
          input_amount?: number
          input_mint?: string
          input_symbol?: string | null
          input_usd_value?: number | null
          output_amount?: number
          output_mint?: string
          output_symbol?: string | null
          output_usd_value?: number | null
          status?: string
          trade_type?: string
          tx_signature?: string
          wallet_address?: string
        }
        Relationships: []
      }
      pending_auto_trades: {
        Row: {
          amount_raw: string
          created_at: string
          current_price: number | null
          decimals: number
          entry_price: number | null
          executed_at: string | null
          id: string
          pnl_percent: number | null
          reason: string | null
          side: string
          status: string
          strategy: string
          token_mint: string
          token_symbol: string | null
          tx_signature: string | null
          wallet_address: string
        }
        Insert: {
          amount_raw: string
          created_at?: string
          current_price?: number | null
          decimals?: number
          entry_price?: number | null
          executed_at?: string | null
          id?: string
          pnl_percent?: number | null
          reason?: string | null
          side?: string
          status?: string
          strategy: string
          token_mint: string
          token_symbol?: string | null
          tx_signature?: string | null
          wallet_address: string
        }
        Update: {
          amount_raw?: string
          created_at?: string
          current_price?: number | null
          decimals?: number
          entry_price?: number | null
          executed_at?: string | null
          id?: string
          pnl_percent?: number | null
          reason?: string | null
          side?: string
          status?: string
          strategy?: string
          token_mint?: string
          token_symbol?: string | null
          tx_signature?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          created_at: string
          current_price_at_creation: number
          direction: string
          id: string
          target_price: number
          token_address: string
          token_name: string
          token_symbol: string
          triggered: boolean
          triggered_at: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string
          current_price_at_creation: number
          direction: string
          id?: string
          target_price: number
          token_address: string
          token_name: string
          token_symbol: string
          triggered?: boolean
          triggered_at?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string
          current_price_at_creation?: number
          direction?: string
          id?: string
          target_price?: number
          token_address?: string
          token_name?: string
          token_symbol?: string
          triggered?: boolean
          triggered_at?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      rpc_request_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          ip_hint: string | null
          latency_ms: number | null
          rpc_method: string
          status_code: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          ip_hint?: string | null
          latency_ms?: number | null
          rpc_method: string
          status_code: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          ip_hint?: string | null
          latency_ms?: number | null
          rpc_method?: string
          status_code?: number
          user_id?: string | null
        }
        Relationships: []
      }
      sim_bot_configs: {
        Row: {
          bot_type: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          wallet_address: string
        }
        Insert: {
          bot_type: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          wallet_address: string
        }
        Update: {
          bot_type?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      sim_holdings: {
        Row: {
          amount: number
          avg_buy_price: number
          created_at: string
          id: string
          token_address: string
          token_symbol: string | null
          total_invested: number
          updated_at: string
          wallet_address: string
        }
        Insert: {
          amount?: number
          avg_buy_price?: number
          created_at?: string
          id?: string
          token_address: string
          token_symbol?: string | null
          total_invested?: number
          updated_at?: string
          wallet_address: string
        }
        Update: {
          amount?: number
          avg_buy_price?: number
          created_at?: string
          id?: string
          token_address?: string
          token_symbol?: string | null
          total_invested?: number
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      sim_orders: {
        Row: {
          bot_type: string
          created_at: string
          current_price: number | null
          id: string
          pnl_percent: number | null
          price_at_execution: number
          side: string
          sol_amount: number
          status: string
          token_address: string
          token_amount: number
          token_symbol: string | null
          wallet_address: string
        }
        Insert: {
          bot_type: string
          created_at?: string
          current_price?: number | null
          id?: string
          pnl_percent?: number | null
          price_at_execution: number
          side: string
          sol_amount: number
          status?: string
          token_address: string
          token_amount: number
          token_symbol?: string | null
          wallet_address: string
        }
        Update: {
          bot_type?: string
          created_at?: string
          current_price?: number | null
          id?: string
          pnl_percent?: number | null
          price_at_execution?: number
          side?: string
          sol_amount?: number
          status?: string
          token_address?: string
          token_amount?: number
          token_symbol?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      sim_wallets: {
        Row: {
          created_at: string
          id: string
          sol_balance: number
          updated_at: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          sol_balance?: number
          updated_at?: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          sol_balance?: number
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          budget_id: string | null
          created_at: string
          currency: string
          id: string
          tx_signature: string
          wallet_address: string
        }
        Insert: {
          amount?: number
          budget_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          tx_signature: string
          wallet_address: string
        }
        Update: {
          amount?: number
          budget_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          tx_signature?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_wallet_address: { Args: never; Returns: string }
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
