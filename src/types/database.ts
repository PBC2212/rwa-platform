// types/database.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string | null;
          wallet_address: string | null;
          kyc_status: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      assets: {
        Row: {
          id: string;
          owner_id: string;
          asset_type: string;
          description: string | null;
          location: string | null;
          appraised_value: number | null;
          status: string;
          tokens_to_mint: number;
          pledge_agreement_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['assets']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['assets']['Insert']>;
      };
      tokens: {
        Row: {
          id: string;
          asset_id: string;
          token_code: string;
          token_amount: number;
          issuer_address: string;
          distributor_address: string;
          tx_hash: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tokens']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['tokens']['Insert']>;
      };
      pledge_agreements: {
        Row: {
          id: string;
          agreement_id: string;
          asset_type: string;
          asset_id: string;
          client_address: string;
          description: string;
          original_value: number;
          discounted_value: number;
          client_payment: number;
          tokens_issued: number;
          status: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['pledge_agreements']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['pledge_agreements']['Insert']>;
      };
      pledge_requests: {
        Row: {
          id: string;
          user_id: string;
          asset_type: string;
          description: string;
          location: string | null;
          appraised_value: number;
          requested_tokens: number;
          status: string;
          wallet_address: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['pledge_requests']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['pledge_requests']['Insert']>;
      };
      investor_purchases: {
        Row: {
          id: string;
          purchase_id: string;
          agreement_id: string;
          investor_address: string;
          token_amount: number;
          usdt_paid: number;
          transaction_hash: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['investor_purchases']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['investor_purchases']['Insert']>;
      };
      client_payments: {
        Row: {
          id: string;
          agreement_id: string;
          client_address: string;
          amount: number;
          transaction_hash: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['client_payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['client_payments']['Insert']>;
      };
      plat_orders: {
        Row: {
          id: string;
          seller_address: string;
          buyer_address: string | null;
          amount: number;
          price_per_token: number;
          order_type: 'buy' | 'sell';
          status: 'open' | 'filled' | 'cancelled';
          tx_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['plat_orders']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['plat_orders']['Insert']>;
      };
      plat_staking: {
        Row: {
          id: string;
          staker_address: string;
          amount: number;
          start_date: string;
          end_date: string | null;
          reward_rate: number;
          status: 'active' | 'unstaked';
          tx_hash: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['plat_staking']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['plat_staking']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          tx_type: string;
          amount: number;
          asset_id: string | null;
          tx_hash: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      transaction_log: {
        Row: {
          id: string;
          transaction_hash: string;
          transaction_type: string;
          from_address: string | null;
          to_address: string | null;
          status: string;
          block_number: number | null;
          parameters: Json | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['transaction_log']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['transaction_log']['Insert']>;
      };
      platform_analytics: {
        Row: {
          date: string;
          total_pledges_created: number;
          active_pledges: number;
          total_value_pledged: number;
          unique_clients: number;
          unique_investors: number;
          total_clients_paid: number;
          total_usdt_invested: number;
          total_tokens_purchased: number;
          platform_revenue: number;
        };
        Insert: Database['public']['Tables']['platform_analytics']['Row'];
        Update: Partial<Database['public']['Tables']['platform_analytics']['Insert']>;
      };
      wallet_sessions: {
        Row: {
          id: string;
          wallet_address: string;
          jwt_token: string;
          expires_at: string;
          last_authenticated: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['wallet_sessions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['wallet_sessions']['Insert']>;
      };
      user_pii: {
        Row: {
          id: string;
          user_id: string;
          email: string | null;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_pii']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_pii']['Insert']>;
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: 'admin' | 'moderator' | 'user';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_roles']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>;
      };
      swaps: {
        Row: {
          id: string;
          user_id: string;
          from_asset: string;
          to_asset: string;
          from_amount: number;
          to_amount: number;
          tx_hash: string | null;
          status: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['swaps']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['swaps']['Insert']>;
      };
    };
    Functions: {
      get_investment_opportunities: {
        Args: Record<string, never>;
        Returns: {
          agreement_id: string;
          asset_type: string;
          description: string;
          original_value: number;
          discounted_value: number;
          tokens_available: number;
          token_price: number;
          status: number;
          created_at: string;
        }[];
      };
      create_investment: {
        Args: {
          _pledge_agreement_id: string;
          _investor_address: string;
          _usdt_amount: number;
          _token_amount: number;
          _transaction_hash?: string;
        };
        Returns: {
          success: boolean;
          purchase_id: string;
          message: string;
        }[];
      };
      is_admin: {
        Args: { _user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: { _user_id: string; _role: string };
        Returns: boolean;
      };
      get_marketplace_pledges: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          agreement_id: string;
          asset_type: string;
          description: string;
          value_range: string;
          availability: string;
          status: number;
          created_at: string;
        }[];
      };
    };
  };
}

// Helper types for easier use throughout the app
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Asset = Database['public']['Tables']['assets']['Row'];
export type Token = Database['public']['Tables']['tokens']['Row'];
export type PledgeAgreement = Database['public']['Tables']['pledge_agreements']['Row'];
export type PledgeRequest = Database['public']['Tables']['pledge_requests']['Row'];
export type InvestorPurchase = Database['public']['Tables']['investor_purchases']['Row'];
export type ClientPayment = Database['public']['Tables']['client_payments']['Row'];
export type PlatOrder = Database['public']['Tables']['plat_orders']['Row'];
export type PlatStaking = Database['public']['Tables']['plat_staking']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type TransactionLog = Database['public']['Tables']['transaction_log']['Row'];
export type PlatformAnalytics = Database['public']['Tables']['platform_analytics']['Row'];
export type WalletSession = Database['public']['Tables']['wallet_sessions']['Row'];
export type UserPII = Database['public']['Tables']['user_pii']['Row'];
export type UserRole = Database['public']['Tables']['user_roles']['Row'];
export type Swap = Database['public']['Tables']['swaps']['Row'];
export type InvestmentOpportunity = Database['public']['Functions']['get_investment_opportunities']['Returns'][0];