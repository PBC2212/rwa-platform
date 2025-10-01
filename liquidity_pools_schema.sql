-- Drop existing tables and functions if they exist
DROP FUNCTION IF EXISTS get_pool_details(TEXT);
DROP FUNCTION IF EXISTS get_user_liquidity_positions(TEXT);
DROP FUNCTION IF EXISTS get_user_liquidity_positions(UUID);
DROP FUNCTION IF EXISTS get_active_liquidity_pools();

DROP TABLE IF EXISTS public.liquidity_transactions CASCADE;
DROP TABLE IF EXISTS public.liquidity_positions CASCADE;
DROP TABLE IF EXISTS public.liquidity_pools CASCADE;

-- Liquidity Pools Table
CREATE TABLE public.liquidity_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id TEXT UNIQUE NOT NULL,
    creator_wallet_address TEXT NOT NULL, -- Stellar wallet address (56 chars, starts with G)
    asset_a_code TEXT NOT NULL, -- e.g., 'PLAT'
    asset_a_issuer TEXT NOT NULL, -- Stellar address
    asset_b_code TEXT NOT NULL, -- e.g., 'XLM' or 'USDC'
    asset_b_issuer TEXT, -- NULL for native XLM, Stellar address otherwise
    total_asset_a NUMERIC DEFAULT 0,
    total_asset_b NUMERIC DEFAULT 0,
    total_shares NUMERIC DEFAULT 0,
    fee_percent NUMERIC DEFAULT 0.3, -- 0.3% fee
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
    stellar_pool_id TEXT, -- Stellar's liquidity pool ID if using native pools
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Liquidity Positions Table (tracks individual user positions)
CREATE TABLE public.liquidity_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES public.liquidity_pools(id) ON DELETE CASCADE NOT NULL,
    wallet_address TEXT NOT NULL, -- Stellar wallet address
    shares NUMERIC NOT NULL DEFAULT 0,
    asset_a_deposited NUMERIC NOT NULL DEFAULT 0,
    asset_b_deposited NUMERIC NOT NULL DEFAULT 0,
    earnings_asset_a NUMERIC DEFAULT 0,
    earnings_asset_b NUMERIC DEFAULT 0,
    deposit_tx_hash TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pool_id, wallet_address)
);

-- Liquidity Transactions Table (tracks all pool operations)
CREATE TABLE public.liquidity_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES public.liquidity_pools(id) ON DELETE CASCADE NOT NULL,
    wallet_address TEXT NOT NULL, -- Stellar wallet address
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'swap', 'fee_collection')),
    asset_a_amount NUMERIC,
    asset_b_amount NUMERIC,
    shares_amount NUMERIC,
    tx_hash TEXT, -- Stellar transaction hash
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_liquidity_pools_creator ON public.liquidity_pools(creator_wallet_address);
CREATE INDEX idx_liquidity_pools_status ON public.liquidity_pools(status);
CREATE INDEX idx_liquidity_positions_pool ON public.liquidity_positions(pool_id);
CREATE INDEX idx_liquidity_positions_wallet ON public.liquidity_positions(wallet_address);
CREATE INDEX idx_liquidity_transactions_pool ON public.liquidity_transactions(pool_id);
CREATE INDEX idx_liquidity_transactions_wallet ON public.liquidity_transactions(wallet_address);

-- Enable Row Level Security
ALTER TABLE public.liquidity_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for liquidity_pools (anyone can view, only creators can update their own)
CREATE POLICY "Anyone can view liquidity pools"
    ON public.liquidity_pools FOR SELECT
    USING (true);

CREATE POLICY "Users can create liquidity pools"
    ON public.liquidity_pools FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Creators can update their pools"
    ON public.liquidity_pools FOR UPDATE
    USING (
        creator_wallet_address IN (
            SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for liquidity_positions (users can view all, but only manage their own)
CREATE POLICY "Anyone can view liquidity positions"
    ON public.liquidity_positions FOR SELECT
    USING (true);

CREATE POLICY "Users can create their positions"
    ON public.liquidity_positions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their positions"
    ON public.liquidity_positions FOR UPDATE
    USING (
        wallet_address IN (
            SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for liquidity_transactions (users can view all, create their own)
CREATE POLICY "Anyone can view liquidity transactions"
    ON public.liquidity_transactions FOR SELECT
    USING (true);

CREATE POLICY "Users can create their transactions"
    ON public.liquidity_transactions FOR INSERT
    WITH CHECK (true);

-- Function to get all active pools with statistics
CREATE OR REPLACE FUNCTION get_active_liquidity_pools()
RETURNS TABLE (
    pool_id UUID,
    pool_identifier TEXT,
    creator_wallet TEXT,
    asset_a_code TEXT,
    asset_a_issuer TEXT,
    asset_b_code TEXT,
    asset_b_issuer TEXT,
    total_asset_a NUMERIC,
    total_asset_b NUMERIC,
    total_shares NUMERIC,
    fee_percent NUMERIC,
    liquidity_providers_count BIGINT,
    total_volume_24h NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lp.id as pool_id,
        lp.pool_id as pool_identifier,
        lp.creator_wallet_address as creator_wallet,
        lp.asset_a_code,
        lp.asset_a_issuer,
        lp.asset_b_code,
        lp.asset_b_issuer,
        lp.total_asset_a,
        lp.total_asset_b,
        lp.total_shares,
        lp.fee_percent,
        COUNT(DISTINCT lpos.wallet_address) as liquidity_providers_count,
        COALESCE(SUM(CASE 
            WHEN lt.created_at > NOW() - INTERVAL '24 hours' 
            THEN COALESCE(lt.asset_a_amount, 0) + COALESCE(lt.asset_b_amount, 0)
            ELSE 0 
        END), 0) as total_volume_24h,
        lp.created_at
    FROM public.liquidity_pools lp
    LEFT JOIN public.liquidity_positions lpos ON lp.id = lpos.pool_id
    LEFT JOIN public.liquidity_transactions lt ON lp.id = lt.pool_id
    WHERE lp.status = 'active'
    GROUP BY lp.id, lp.pool_id, lp.creator_wallet_address, lp.asset_a_code, lp.asset_a_issuer, 
             lp.asset_b_code, lp.asset_b_issuer, lp.total_asset_a, 
             lp.total_asset_b, lp.total_shares, lp.fee_percent, lp.created_at
    ORDER BY lp.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's liquidity positions by wallet address
CREATE OR REPLACE FUNCTION get_user_liquidity_positions(_wallet_address TEXT)
RETURNS TABLE (
    position_id UUID,
    pool_id UUID,
    pool_identifier TEXT,
    asset_a_code TEXT,
    asset_b_code TEXT,
    shares NUMERIC,
    asset_a_deposited NUMERIC,
    asset_b_deposited NUMERIC,
    current_asset_a_value NUMERIC,
    current_asset_b_value NUMERIC,
    earnings_asset_a NUMERIC,
    earnings_asset_b NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lpos.id as position_id,
        lp.id as pool_id,
        lp.pool_id as pool_identifier,
        lp.asset_a_code,
        lp.asset_b_code,
        lpos.shares,
        lpos.asset_a_deposited,
        lpos.asset_b_deposited,
        -- Calculate current value based on share of pool
        CASE 
            WHEN lp.total_shares > 0 
            THEN (lpos.shares / lp.total_shares) * lp.total_asset_a 
            ELSE 0 
        END as current_asset_a_value,
        CASE 
            WHEN lp.total_shares > 0 
            THEN (lpos.shares / lp.total_shares) * lp.total_asset_b 
            ELSE 0 
        END as current_asset_b_value,
        lpos.earnings_asset_a,
        lpos.earnings_asset_b,
        lpos.created_at
    FROM public.liquidity_positions lpos
    JOIN public.liquidity_pools lp ON lpos.pool_id = lp.id
    WHERE lpos.wallet_address = _wallet_address
    AND lpos.shares > 0
    ORDER BY lpos.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pool details by pool_id
CREATE OR REPLACE FUNCTION get_pool_details(_pool_identifier TEXT)
RETURNS TABLE (
    pool_id UUID,
    pool_identifier TEXT,
    creator_wallet TEXT,
    asset_a_code TEXT,
    asset_a_issuer TEXT,
    asset_b_code TEXT,
    asset_b_issuer TEXT,
    total_asset_a NUMERIC,
    total_asset_b NUMERIC,
    total_shares NUMERIC,
    fee_percent NUMERIC,
    status TEXT,
    stellar_pool_id TEXT,
    liquidity_providers_count BIGINT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lp.id as pool_id,
        lp.pool_id as pool_identifier,
        lp.creator_wallet_address as creator_wallet,
        lp.asset_a_code,
        lp.asset_a_issuer,
        lp.asset_b_code,
        lp.asset_b_issuer,
        lp.total_asset_a,
        lp.total_asset_b,
        lp.total_shares,
        lp.fee_percent,
        lp.status,
        lp.stellar_pool_id,
        COUNT(DISTINCT lpos.wallet_address) as liquidity_providers_count,
        lp.created_at
    FROM public.liquidity_pools lp
    LEFT JOIN public.liquidity_positions lpos ON lp.id = lpos.pool_id
    WHERE lp.pool_id = _pool_identifier
    GROUP BY lp.id, lp.pool_id, lp.creator_wallet_address, lp.asset_a_code, lp.asset_a_issuer, 
             lp.asset_b_code, lp.asset_b_issuer, lp.total_asset_a, 
             lp.total_asset_b, lp.total_shares, lp.fee_percent, lp.status, 
             lp.stellar_pool_id, lp.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.liquidity_pools IS 'Stores liquidity pool information for PLAT token trading pairs - uses Stellar wallet addresses';
COMMENT ON TABLE public.liquidity_positions IS 'Tracks individual wallet positions in liquidity pools';
COMMENT ON TABLE public.liquidity_transactions IS 'Records all liquidity pool transactions by wallet address';
COMMENT ON COLUMN public.liquidity_pools.creator_wallet_address IS 'Stellar wallet address (56 chars, starts with G)';
COMMENT ON COLUMN public.liquidity_positions.wallet_address IS 'Stellar wallet address of liquidity provider';
COMMENT ON COLUMN public.liquidity_transactions.wallet_address IS 'Stellar wallet address of transaction initiator';