'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import * as StellarSDK from '@stellar/stellar-sdk';
import { getLiquidityPoolId, getPlatAsset, getNativeAsset } from '@/lib/stellar/liquidity';

const supabase = createClient();

export default function CreatePoolPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    assetBCode: 'XLM',
    assetBIssuer: '',
    initialAssetA: '',
    initialAssetB: '',
    feePercent: '0.3'
  });

  const ISSUER_ADDRESS = process.env.NEXT_PUBLIC_STELLAR_ISSUER_SECRET 
    ? StellarSDK.Keypair.fromSecret(process.env.NEXT_PUBLIC_STELLAR_ISSUER_SECRET).publicKey()
    : '';

  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user?.wallet_address) {
      alert('Please connect your Stellar wallet first');
      return;
    }

    if (!ISSUER_ADDRESS) {
      alert('PLAT token issuer not configured');
      return;
    }

    setLoading(true);

    try {
      console.log('Creating liquidity pool...');

      // Create asset objects
      const platAsset = getPlatAsset(ISSUER_ADDRESS);
      const assetB = formData.assetBCode === 'XLM' 
        ? getNativeAsset()
        : new StellarSDK.Asset(formData.assetBCode, formData.assetBIssuer);

      // Generate pool ID
      const poolId = getLiquidityPoolId(platAsset, assetB, Number(formData.feePercent) * 100);
      
      console.log('Generated Pool ID:', poolId);

      // Create pool record in database
      const { data: poolData, error: poolError } = await supabase
        .from('liquidity_pools')
        .insert({
          pool_id: poolId,
          creator_wallet_address: user.wallet_address,
          asset_a_code: 'PLAT',
          asset_a_issuer: ISSUER_ADDRESS,
          asset_b_code: formData.assetBCode,
          asset_b_issuer: formData.assetBCode === 'XLM' ? null : formData.assetBIssuer,
          total_asset_a: 0,
          total_asset_b: 0,
          total_shares: 0,
          fee_percent: Number(formData.feePercent),
          status: 'active',
          stellar_pool_id: poolId
        })
        .select()
        .single();

      if (poolError) {
        console.error('Pool creation error:', poolError);
        throw poolError;
      }

      console.log('Pool created in database:', poolData);

      alert(`✅ Liquidity Pool Created!\n\nPool ID: ${poolId.substring(0, 16)}...\n\nPair: PLAT/${formData.assetBCode}\nFee: ${formData.feePercent}%\n\nYou can now add liquidity to this pool!`);

      // Redirect to add liquidity page
      router.push(`/liquidity/add/${poolData.id}`);

    } catch (error: any) {
      console.error('Pool creation failed:', error);
      alert('❌ Failed to create pool: ' + error.message);
    } finally {
      setLoading(false);
    }
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
          <p className="text-gray-600 mb-6">Please sign in to create liquidity pools.</p>
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
            You need a Stellar wallet connected to create liquidity pools.
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/liquidity"
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block"
          >
            ← Back to Pools
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create Liquidity Pool</h1>
          <p className="mt-2 text-gray-600">
            Create a new PLAT trading pair and earn fees from trades
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Asset A - PLAT (Fixed) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asset A (Base Token) *
              </label>
              <div className="px-4 py-3 bg-gray-100 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">PLAT</div>
                    <div className="text-xs text-gray-500">Platform Token</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Issuer: {ISSUER_ADDRESS ? `${ISSUER_ADDRESS.substring(0, 10)}...` : 'Not configured'}
                  </div>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                PLAT is always the base token in liquidity pools
              </p>
            </div>

            {/* Asset B Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asset B (Quote Token) *
              </label>
              <select
                value={formData.assetBCode}
                onChange={(e) => handleChange('assetBCode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="XLM">XLM (Stellar Lumens)</option>
                <option value="USDC">USDC (USD Coin)</option>
                <option value="CUSTOM">Custom Token</option>
              </select>
            </div>

            {/* Custom Asset B Issuer */}
            {formData.assetBCode === 'CUSTOM' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Token Code *
                </label>
                <input
                  type="text"
                  value={formData.assetBCode === 'CUSTOM' ? '' : formData.assetBCode}
                  onChange={(e) => handleChange('assetBCode', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                  placeholder="e.g., USDT"
                  maxLength={12}
                  required
                />
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Token Issuer Address *
                </label>
                <input
                  type="text"
                  value={formData.assetBIssuer}
                  onChange={(e) => handleChange('assetBIssuer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="G..."
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the Stellar address that issues this token
                </p>
              </div>
            )}

            {/* Fee Percentage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trading Fee: {formData.feePercent}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={formData.feePercent}
                onChange={(e) => handleChange('feePercent', e.target.value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.1% (Lower fees)</span>
                <span>1.0% (Higher fees)</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                This fee is charged on every trade and distributed to liquidity providers
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                📋 Pool Creation Details
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Pool Pair: PLAT / {formData.assetBCode}</li>
                <li>• Trading Fee: {formData.feePercent}% per trade</li>
                <li>• You will be the first liquidity provider</li>
                <li>• After creation, you can add initial liquidity</li>
                <li>• Pool uses Stellar's native AMM protocol</li>
              </ul>
            </div>

            {/* Warning Box */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">
                ⚠️ Important Notes
              </h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• You must add liquidity immediately after creating the pool</li>
                <li>• Ensure you have both PLAT and {formData.assetBCode} in your wallet</li>
                <li>• Pool creation does not require a transaction fee</li>
                <li>• Adding liquidity will require Stellar network fees (~0.00001 XLM)</li>
              </ul>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <Link
                href="/liquidity"
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating Pool...' : 'Create Pool'}
              </button>
            </div>
          </form>
        </div>

        {/* Additional Info */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            💡 How Liquidity Pools Work
          </h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong>1. Create Pool:</strong> Define the trading pair and fee structure
            </p>
            <p>
              <strong>2. Add Liquidity:</strong> Deposit equal value of both tokens to start the pool
            </p>
            <p>
              <strong>3. Earn Fees:</strong> Receive a portion of trading fees proportional to your share
            </p>
            <p>
              <strong>4. Manage Position:</strong> Add or remove liquidity anytime
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}