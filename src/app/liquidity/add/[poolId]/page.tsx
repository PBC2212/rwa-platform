'use client';

import { use, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import * as StellarSDK from '@stellar/stellar-sdk';
import { 
  buildChangeTrustTransaction, 
  buildDepositLiquidityTransaction,
  hasPoolTrustline,
  calculateDepositOutput,
  submitTransaction
} from '@/lib/stellar/liquidity';

const supabase = createClient();

interface PoolData {
  id: string;
  pool_id: string;
  creator_wallet_address: string;
  asset_a_code: string;
  asset_a_issuer: string;
  asset_b_code: string;
  asset_b_issuer: string | null;
  total_asset_a: number;
  total_asset_b: number;
  total_shares: number;
  fee_percent: number;
  status: string;
}

export default function AddLiquidityPage({ params }: { params: Promise<{ poolId: string }> }) {
  const resolvedParams = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pool, setPool] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [hasTrustline, setHasTrustline] = useState(false);
  const [walletType, setWalletType] = useState<'freighter' | 'none'>('none');
  const [formData, setFormData] = useState({
    assetAAmount: '',
    assetBAmount: ''
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && 'freighter' in window) {
      setWalletType('freighter');
    }
  }, []);

  useEffect(() => {
    if (!authLoading && resolvedParams.poolId) {
      loadPoolData();
    }
  }, [authLoading, resolvedParams.poolId]);

  useEffect(() => {
    if (pool && user?.wallet_address) {
      checkTrustline();
    }
  }, [pool, user]);

  async function loadPoolData() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('liquidity_pools')
        .select('*')
        .eq('id', resolvedParams.poolId)
        .single();
      if (error) throw error;
      setPool(data);
    } catch (error: any) {
      alert('Failed to load pool');
      router.push('/liquidity');
    } finally {
      setLoading(false);
    }
  }

  async function checkTrustline() {
    if (!pool || !user?.wallet_address) return;
    try {
      const exists = await hasPoolTrustline(user.wallet_address, pool.pool_id, 'testnet');
      setHasTrustline(exists);
    } catch (error) {
      console.error(error);
    }
  }

  function handleAmountChange(field: 'assetAAmount' | 'assetBAmount', value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (pool && pool.total_shares > 0) {
      const amount = parseFloat(value) || 0;
      if (field === 'assetAAmount' && amount > 0) {
        const ratio = pool.total_asset_b / pool.total_asset_a;
        setFormData(prev => ({ ...prev, assetBAmount: (amount * ratio).toFixed(7) }));
      } else if (field === 'assetBAmount' && amount > 0) {
        const ratio = pool.total_asset_a / pool.total_asset_b;
        setFormData(prev => ({ ...prev, assetAAmount: (amount * ratio).toFixed(7) }));
      }
    }
  }

  async function handleEstablishTrustline() {
    if (!pool || !user?.wallet_address || walletType === 'none') return;
    setProcessing(true);
    try {
      const assetA = new StellarSDK.Asset(pool.asset_a_code, pool.asset_a_issuer);
      const assetB = pool.asset_b_code === 'XLM' 
        ? StellarSDK.Asset.native()
        : new StellarSDK.Asset(pool.asset_b_code, pool.asset_b_issuer!);
      const xdr = await buildChangeTrustTransaction(user.wallet_address, assetA, assetB, pool.fee_percent * 100, 'testnet');
      const signedXDR = await (window as any).freighter.signTransaction(xdr, { network: StellarSDK.Networks.TESTNET });
      const result = await submitTransaction(signedXDR, 'testnet');
      await supabase.from('liquidity_transactions').insert({
        pool_id: pool.id,
        wallet_address: user.wallet_address,
        transaction_type: 'deposit',
        tx_hash: result.hash,
        status: 'completed'
      });
      setHasTrustline(true);
      alert('Trustline established! TX: ' + result.hash);
    } catch (error: any) {
      alert('Failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleAddLiquidity() {
    if (!pool || !user?.wallet_address || !hasTrustline || walletType === 'none') return;
    const assetA = parseFloat(formData.assetAAmount);
    const assetB = parseFloat(formData.assetBAmount);
    if (!assetA || !assetB || assetA <= 0 || assetB <= 0) {
      alert('Please enter valid amounts');
      return;
    }
    setProcessing(true);
    try {
      const xdr = await buildDepositLiquidityTransaction(user.wallet_address, {
        poolId: pool.pool_id,
        maxAssetAAmount: assetA.toString(),
        maxAssetBAmount: assetB.toString(),
        minPrice: '1',
        maxPrice: '1'
      }, 'testnet');
      const signedXDR = await (window as any).freighter.signTransaction(xdr, { network: StellarSDK.Networks.TESTNET });
      const result = await submitTransaction(signedXDR, 'testnet');
      const estimatedShares = calculateDepositOutput(assetA, assetB, pool.total_asset_a || 1, pool.total_asset_b || 1, pool.total_shares || 0);
      await supabase.from('liquidity_pools').update({
        total_asset_a: pool.total_asset_a + assetA,
        total_asset_b: pool.total_asset_b + assetB,
        total_shares: pool.total_shares + estimatedShares,
        updated_at: new Date().toISOString()
      }).eq('id', pool.id);
      const { data: existingPosition } = await supabase.from('liquidity_positions').select('*').eq('pool_id', pool.id).eq('wallet_address', user.wallet_address).single();
      if (existingPosition) {
        await supabase.from('liquidity_positions').update({
          shares: existingPosition.shares + estimatedShares,
          asset_a_deposited: existingPosition.asset_a_deposited + assetA,
          asset_b_deposited: existingPosition.asset_b_deposited + assetB,
          last_updated: new Date().toISOString()
        }).eq('id', existingPosition.id);
      } else {
        await supabase.from('liquidity_positions').insert({
          pool_id: pool.id,
          wallet_address: user.wallet_address,
          shares: estimatedShares,
          asset_a_deposited: assetA,
          asset_b_deposited: assetB,
          deposit_tx_hash: result.hash
        });
      }
      await supabase.from('liquidity_transactions').insert({
        pool_id: pool.id,
        wallet_address: user.wallet_address,
        transaction_type: 'deposit',
        asset_a_amount: assetA,
        asset_b_amount: assetB,
        shares_amount: estimatedShares,
        tx_hash: result.hash,
        status: 'completed'
      });
      alert('Liquidity added! TX: ' + result.hash);
      router.push('/liquidity/positions');
    } catch (error: any) {
      alert('Failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !pool) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Pool Not Found</h2>
          <Link href="/liquidity" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Back to Pools
          </Link>
        </div>
      </div>
    );
  }

  const estimatedShares = formData.assetAAmount && formData.assetBAmount
    ? calculateDepositOutput(parseFloat(formData.assetAAmount) || 0, parseFloat(formData.assetBAmount) || 0, pool.total_asset_a || 1, pool.total_asset_b || 1, pool.total_shares || 0)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/liquidity" className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block">Back to Pools</Link>
          <h1 className="text-3xl font-bold text-gray-900">Add Liquidity</h1>
          <p className="mt-2 text-gray-600">{pool.asset_a_code} / {pool.asset_b_code} Pool</p>
        </div>

        {walletType === 'none' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Wallet Extension Required</h3>
            <p className="text-sm text-red-800 mb-4">Install Freighter wallet extension</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pool Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><div className="text-sm text-gray-600">Total {pool.asset_a_code}</div><div className="font-semibold">{pool.total_asset_a.toLocaleString()}</div></div>
            <div><div className="text-sm text-gray-600">Total {pool.asset_b_code}</div><div className="font-semibold">{pool.total_asset_b.toLocaleString()}</div></div>
            <div><div className="text-sm text-gray-600">Total Shares</div><div className="font-semibold">{pool.total_shares.toFixed(7)}</div></div>
            <div><div className="text-sm text-gray-600">Fee</div><div className="font-semibold">{pool.fee_percent}%</div></div>
          </div>
        </div>

        {!hasTrustline && walletType !== 'none' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">Trustline Required</h3>
            <p className="text-sm text-yellow-800 mb-4">Establish trustline before adding liquidity</p>
            <button onClick={handleEstablishTrustline} disabled={processing} className="px-6 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 disabled:bg-gray-400">
              {processing ? 'Processing...' : 'Establish Trustline'}
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Deposit Amounts</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{pool.asset_a_code} Amount</label>
              <input type="number" value={formData.assetAAmount} onChange={(e) => handleAmountChange('assetAAmount', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg" placeholder="0.00" step="0.0000001" min="0" disabled={!hasTrustline || walletType === 'none'} />
            </div>
            <div className="text-center text-gray-400 text-2xl">+</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{pool.asset_b_code} Amount</label>
              <input type="number" value={formData.assetBAmount} onChange={(e) => handleAmountChange('assetBAmount', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg" placeholder="0.00" step="0.0000001" min="0" disabled={!hasTrustline || walletType === 'none'} />
            </div>
          </div>
          {estimatedShares > 0 && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800 mb-1">You will receive:</div>
              <div className="text-2xl font-bold text-green-900">{estimatedShares.toFixed(7)} LP Shares</div>
            </div>
          )}
          <button onClick={handleAddLiquidity} disabled={processing || !hasTrustline || !formData.assetAAmount || !formData.assetBAmount || walletType === 'none'} className="w-full mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400">
            {processing ? 'Processing...' : 'Add Liquidity'}
          </button>
        </div>
      </div>
    </div>
  );
}