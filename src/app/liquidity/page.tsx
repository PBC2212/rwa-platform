'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const supabase = createClient();

interface LiquidityPool {
  pool_id: string;
  pool_identifier: string;
  creator_wallet: string;
  asset_a_code: string;
  asset_a_issuer: string;
  asset_b_code: string;
  asset_b_issuer: string | null;
  total_asset_a: number;
  total_asset_b: number;
  total_shares: number;
  fee_percent: number;
  liquidity_providers_count: number;
  total_volume_24h: number;
  created_at: string;
}

export default function LiquidityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!authLoading) {
      loadLiquidityPools();
    }
  }, [authLoading]);

  async function loadLiquidityPools() {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase.rpc('get_active_liquidity_pools');

      if (error) {
        console.error('Error loading pools:', error);
        throw error;
      }

      console.log('Loaded liquidity pools:', data);
      setPools(data || []);
    } catch (error: any) {
      console.error('Failed to load liquidity pools:', error);
      setError('Failed to load liquidity pools: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function calculateTVL(pool: LiquidityPool): number {
    // For simplicity, assuming PLAT = $1 USD
    // TVL = total_asset_a (PLAT) + total_asset_b (XLM/USDC converted to USD)
    return pool.total_asset_a + pool.total_asset_b;
  }

  function calculateAPY(pool: LiquidityPool): number {
    // Simplified APY calculation based on 24h volume and fees
    const dailyFees = (pool.total_volume_24h * pool.fee_percent) / 100;
    const tvl = calculateTVL(pool);
    
    if (tvl === 0) return 0;
    
    const dailyReturn = (dailyFees / tvl) * 100;
    const annualizedAPY = dailyReturn * 365;
    
    return Math.min(annualizedAPY, 999); // Cap at 999%
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to access liquidity pools.</p>
          <Link
            href="/auth/signin"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Liquidity Pools</h1>
              <p className="mt-2 text-gray-600">
                Provide liquidity to earn trading fees on PLAT token pairs
              </p>
            </div>
            <Link
              href="/liquidity/create"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              + Create Pool
            </Link>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Pools</h3>
            <p className="text-3xl font-bold text-gray-900">{pools.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Value Locked</h3>
            <p className="text-3xl font-bold text-gray-900">
              ${pools.reduce((sum, pool) => sum + calculateTVL(pool), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">24h Volume</h3>
            <p className="text-3xl font-bold text-gray-900">
              ${pools.reduce((sum, pool) => sum + pool.total_volume_24h, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* My Positions Link */}
        {user.wallet_address && (
          <div className="mb-6">
            <Link
              href="/liquidity/positions"
              className="inline-flex items-center px-4 py-2 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors"
            >
              <span className="mr-2">💼</span>
              View My Positions
            </Link>
          </div>
        )}

        {/* Pools List */}
        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading pools...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadLiquidityPools}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : pools.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">💧</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Liquidity Pools Yet</h3>
            <p className="text-gray-600 mb-6">
              Be the first to create a liquidity pool and start earning fees!
            </p>
            <Link
              href="/liquidity/create"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Create First Pool
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {pools.map((pool) => (
              <div
                key={pool.pool_id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      {pool.asset_a_code} / {pool.asset_b_code}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Pool ID: {pool.pool_identifier.substring(0, 10)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Fee</div>
                    <div className="text-lg font-semibold text-blue-600">{pool.fee_percent}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Total Value Locked</div>
                    <div className="font-semibold">
                      ${calculateTVL(pool).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">24h Volume</div>
                    <div className="font-semibold">
                      ${pool.total_volume_24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">APY</div>
                    <div className="font-semibold text-green-600">
                      {calculateAPY(pool).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Providers</div>
                    <div className="font-semibold">{pool.liquidity_providers_count}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">{pool.asset_a_code} Reserve</div>
                    <div className="font-medium">
                      {pool.total_asset_a.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">{pool.asset_b_code} Reserve</div>
                    <div className="font-medium">
                      {pool.total_asset_b.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link
                    href={`/liquidity/add/${pool.pool_id}`}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                  >
                    Add Liquidity
                  </Link>
                  <Link
                    href={`/liquidity/pool/${pool.pool_id}`}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            💡 How Liquidity Pools Work
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Provide equal value of two assets (e.g., PLAT and XLM) to a pool</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Earn a share of trading fees (typically 0.3%) from all trades in the pool</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Your share is represented by LP tokens that you can redeem anytime</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Pool uses Stellar's native liquidity pool protocol for security</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Impermanent loss may occur if token prices diverge significantly</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}