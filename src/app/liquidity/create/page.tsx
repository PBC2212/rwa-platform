'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import * as StellarSDK from '@stellar/stellar-sdk';
import { getLiquidityPoolId, getPlatAsset, getNativeAsset } from '@/lib/stellar/liquidity';
import { 
  triggerInitialLiquidity, 
  discoverLiquiditySources,
  getAggregatedPrice 
} from '@/lib/stellar/liquidityAggregator';

const supabase = createClient();

export default function CreatePoolPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [aggregatorStatus, setAggregatorStatus] = useState<string>('');
  const [discoveredSources, setDiscoveredSources] = useState<number>(0);
  const [showAggregatorDetails, setShowAggregatorDetails] = useState(false);
  const [formData, setFormData] = useState({
    assetBCode: 'XLM',
    assetBIssuer: '',
    initialAssetA: '',
    initialAssetB: '',
    feePercent: '0.3',
    enableBootstrap: true,
    bootstrapAmount: '1000' // Target liquidity in USD
  });

  const ISSUER_ADDRESS = process.env.NEXT_PUBLIC_STELLAR_ISSUER_SECRET 
    ? StellarSDK.Keypair.fromSecret(process.env.NEXT_PUBLIC_STELLAR_ISSUER_SECRET).publicKey()
    : '';

  function handleChange(field: string, value: string | boolean) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  async function checkExistingLiquidity() {
    if (!ISSUER_ADDRESS) return;

    setAggregatorStatus('🔍 Discovering existing liquidity sources...');
    
    try {
      const platAsset = getPlatAsset(ISSUER_ADDRESS);
      const assetB = formData.assetBCode === 'XLM' 
        ? getNativeAsset()
        : new StellarSDK.Asset(formData.assetBCode, formData.assetBIssuer);

      const sources = await discoverLiquiditySources(platAsset, assetB, 'testnet');
      setDiscoveredSources(sources.length);
      
      if (sources.length > 0) {
        const totalTVL = sources.reduce((sum, s) => sum + s.tvl, 0);
        setAggregatorStatus(`✅ Found ${sources.length} liquidity source(s) with total TVL: $${totalTVL.toFixed(2)}`);
        
        // Get aggregated price
        const priceData = await getAggregatedPrice(platAsset, assetB, 'testnet');
        if (priceData.price > 0) {
          setAggregatorStatus(prev => 
            `${prev}\n💰 Aggregated Price: ${priceData.price.toFixed(6)} ${formData.assetBCode} per PLAT`
          );
        }
      } else {
        setAggregatorStatus('ℹ️  No existing liquidity sources found. This will be the first pool!');
      }
    } catch (error) {
      console.error('Error checking liquidity:', error);
      setAggregatorStatus('⚠️  Could not check existing liquidity');
    }
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
    setAggregatorStatus('');

    try {
      console.log('🚀 Creating liquidity pool...');

      // Create asset objects
      const platAsset = getPlatAsset(ISSUER_ADDRESS);
      const assetB = formData.assetBCode === 'XLM' 
        ? getNativeAsset()
        : new StellarSDK.Asset(formData.assetBCode, formData.assetBIssuer);

      // Generate pool ID
      const poolId = getLiquidityPoolId(platAsset, assetB, Number(formData.feePercent) * 100);
      
      console.log('📝 Generated Pool ID:', poolId);

      // Step 1: Create pool record in database
      setAggregatorStatus('📝 Creating pool record in database...');
      
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

      console.log('✅ Pool created in database:', poolData);
      setAggregatorStatus('✅ Pool record created successfully');

      // Step 2: Bootstrap liquidity if enabled
      if (formData.enableBootstrap && parseFloat(formData.bootstrapAmount) > 0) {
        setAggregatorStatus('🔍 Discovering liquidity sources for bootstrapping...');
        setShowAggregatorDetails(true);
        
        const targetLiquidity = parseFloat(formData.bootstrapAmount);
        
        try {
          const bootstrapResult = await triggerInitialLiquidity(
            poolId,
            ISSUER_ADDRESS,
            'PLAT',
            formData.assetBCode,
            targetLiquidity,
            'testnet'
          );

          if (bootstrapResult.success) {
            setAggregatorStatus(`✅ ${bootstrapResult.message}`);
            
            if (bootstrapResult.details) {
              const details = bootstrapResult.details;
              setAggregatorStatus(prev => 
                `${prev}\n\n💧 Liquidity Plan:\n` +
                `   PLAT: ${details.liquidityAdded.assetA.toFixed(7)}\n` +
                `   ${formData.assetBCode}: ${details.liquidityAdded.assetB.toFixed(7)}\n` +
                `   Sources: ${details.sourcesUsed.length}`
              );
            }
          } else {
            setAggregatorStatus(`ℹ️  ${bootstrapResult.message}\n\nPool created successfully without bootstrapping.`);
          }
        } catch (bootstrapError: any) {
          console.error('Bootstrap error:', bootstrapError);
          setAggregatorStatus(`⚠️  Bootstrapping failed: ${bootstrapError.message}\n\nPool created successfully. You can add liquidity manually.`);
        }
      }

      // Success message
      const finalMessage = `✅ Liquidity Pool Created Successfully!\n\n` +
        `Pool ID: ${poolId.substring(0, 16)}...\n` +
        `Pair: PLAT/${formData.assetBCode}\n` +
        `Fee: ${formData.feePercent}%\n\n` +
        (formData.enableBootstrap 
          ? `Liquidity aggregator was triggered. Check the details above.\n\n`
          : '') +
        `You can now add liquidity to this pool!`;

      alert(finalMessage);

      // Wait a moment to show aggregator status
      setTimeout(() => {
        router.push(`/liquidity/add/${poolData.id}`);
      }, 2000);

    } catch (error: any) {
      console.error('❌ Pool creation failed:', error);
      alert('❌ Failed to create pool: ' + error.message);
      setAggregatorStatus('❌ Pool creation failed');
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
            Create a new PLAT trading pair with automatic liquidity aggregation
          </p>
        </div>

        {/* Liquidity Aggregator Status */}
        {showAggregatorDetails && aggregatorStatus && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              🤖 Liquidity Aggregator Status
            </h3>
            <pre className="text-sm text-blue-800 whitespace-pre-wrap font-mono">
              {aggregatorStatus}
            </pre>
          </div>
        )}

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

            {/* Liquidity Aggregator Settings */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">🤖 Liquidity Aggregator</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Automatically bootstrap liquidity from existing sources
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enableBootstrap}
                    onChange={(e) => handleChange('enableBootstrap', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {formData.enableBootstrap && (
                <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Initial Liquidity (USD)
                    </label>
                    <input
                      type="number"
                      value={formData.bootstrapAmount}
                      onChange={(e) => handleChange('bootstrapAmount', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="1000"
                      min="100"
                      step="100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Minimum recommended: $1,000 for healthy pool operation
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={checkExistingLiquidity}
                    className="w-full px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                  >
                    🔍 Check Existing Liquidity Sources
                  </button>

                  {discoveredSources > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800">
                        ✅ Found {discoveredSources} existing liquidity source(s) that can be used for bootstrapping
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                📋 Pool Creation Process
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Pool Pair: PLAT / {formData.assetBCode}</li>
                <li>• Trading Fee: {formData.feePercent}% per trade</li>
                <li>• You will be the pool creator</li>
                {formData.enableBootstrap && (
                  <li>• 🤖 Liquidity aggregator will attempt to bootstrap with ${formData.bootstrapAmount}</li>
                )}
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
                <li>• Pool creation is instant but requires network fees (~0.00001 XLM)</li>
                <li>• Liquidity aggregator runs automatically if enabled</li>
                <li>• You can manually add liquidity after pool creation</li>
                <li>• Ensure you have both PLAT and {formData.assetBCode} in your wallet</li>
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
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating Pool...
                  </span>
                ) : (
                  '🚀 Create Pool'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}