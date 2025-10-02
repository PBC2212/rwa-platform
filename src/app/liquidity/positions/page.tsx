'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const supabase = createClient();

interface Position {
  position_id: string;
  pool_id: string;
  pool_identifier: string;
  asset_a_code: string;
  asset_b_code: string;
  shares: number;
  asset_a_deposited: number;
  asset_b_deposited: number;
  current_asset_a_value: number;
  current_asset_b_value: number;
  earnings_asset_a: number;
  earnings_asset_b: number;
  created_at: string;
}

export default function LiquidityPositionsPage() {
  const { user, loading: authLoading } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!authLoading && user?.wallet_address) {
      loadPositions();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user]);

  async function loadPositions() {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase.rpc('get_user_liquidity_positions', {
        _wallet_address: user!.wallet_address!
      });

      if (error) {
        console.error('Error loading positions:', error);
        throw error;
      }

      console.log('Loaded positions:', data);
      setPositions(data || []);
    } catch (error: any) {
      console.error('Failed to load positions:', error);
      setError('Failed to load positions: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function calculatePnL(position: Position): { amount: number; percentage: number } {
    const deposited = position.asset_a_deposited + position.asset_b_deposited;
    const current = position.current_asset_a_value + position.current_asset_b_value;
    const earnings = position.earnings_asset_a + position.earnings_asset_b;
    
    const totalCurrent = current + earnings;
    const pnlAmount = totalCurrent - deposited;
    const pnlPercentage = deposited > 0 ? (pnlAmount / deposited) * 100 : 0;

    return { amount: pnlAmount, percentage: pnlPercentage };
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
          <p className="text-gray-600 mb-6">Please sign in to view your positions.</p>
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

  if (!user.wallet_address) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Wallet Required</h2>
          <p className="text-gray-600 mb-6">
            You need a Stellar wallet to view liquidity positions.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
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
              <Link
                href="/liquidity"
                className="text-blue-600 hover:text-blue-700 font-medium mb-2 inline-block"
              >
                ← Back to Pools
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">My Liquidity Positions</h1>
              <p className="mt-2 text-gray-600">
                View and manage your liquidity pool positions
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Positions</h3>
            <p className="text-3xl font-bold text-gray-900">{positions.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Value Locked</h3>
            <p className="text-3xl font-bold text-gray-900">
              ${positions.reduce((sum, pos) => sum + pos.current_asset_a_value + pos.current_asset_b_value, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Earnings</h3>
            <p className="text-3xl font-bold text-green-600">
              ${positions.reduce((sum, pos) => sum + pos.earnings_asset_a + pos.earnings_asset_b, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Positions List */}
        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading positions...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadPositions}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : positions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">💧</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Positions Yet</h3>
            <p className="text-gray-600 mb-6">
              You haven't added liquidity to any pools yet. Start earning fees by providing liquidity!
            </p>
            <Link
              href="/liquidity"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Browse Pools
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {positions.map((position) => {
              const pnl = calculatePnL(position);
              const isProfitable = pnl.amount >= 0;

              return (
                <div
                  key={position.position_id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-1">
                        {position.asset_a_code} / {position.asset_b_code}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Position opened: {new Date(position.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Your Shares</div>
                      <div className="text-lg font-semibold text-blue-600">
                        {position.shares.toFixed(7)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Deposited</div>
                      <div className="font-medium">
                        {position.asset_a_deposited.toFixed(2)} {position.asset_a_code}
                      </div>
                      <div className="font-medium">
                        {position.asset_b_deposited.toFixed(2)} {position.asset_b_code}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Current Value</div>
                      <div className="font-medium">
                        {position.current_asset_a_value.toFixed(2)} {position.asset_a_code}
                      </div>
                      <div className="font-medium">
                        {position.current_asset_b_value.toFixed(2)} {position.asset_b_code}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Earned Fees</div>
                      <div className="font-medium text-green-600">
                        {position.earnings_asset_a.toFixed(4)} {position.asset_a_code}
                      </div>
                      <div className="font-medium text-green-600">
                        {position.earnings_asset_b.toFixed(4)} {position.asset_b_code}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Total P&L</div>
                      <div className={`font-semibold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfitable ? '+' : ''}{pnl.amount.toFixed(2)} USD
                      </div>
                      <div className={`text-sm ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfitable ? '+' : ''}{pnl.percentage.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Link
                      href={`/liquidity/add/${position.pool_id}`}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                    >
                      Add More
                    </Link>
                    <Link
                      href={`/liquidity/withdraw/${position.pool_id}`}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
                    >
                      Withdraw
                    </Link>
                    <Link
                      href={`/liquidity/pool/${position.pool_id}`}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Section */}
        {positions.length > 0 && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              💡 Managing Your Positions
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Earnings are automatically added to your position and compound over time</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>You can add more liquidity to increase your share of trading fees</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Withdraw anytime to receive your share of the pool plus earned fees</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>P&L includes both price changes (impermanent loss/gain) and earned fees</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}