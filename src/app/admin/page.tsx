'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const supabase = createClient();

interface PledgeRequest {
  id: string;
  user_id: string;
  asset_type: string;
  description: string;
  location: string;
  appraised_value: number;
  requested_tokens: number;
  status: string;
  wallet_address: string;
  created_at: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [pledges, setPledges] = useState<PledgeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminCheckError, setAdminCheckError] = useState<string>('');

  useEffect(() => {
    if (!authLoading && user) {
      checkAdminStatus();
      loadPledgeRequests();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading]);

  async function checkAdminStatus() {
    try {
      console.log('Checking admin status for user:', user!.id);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const { data, error } = await supabase.rpc('is_admin', {
        _user_id: user!.id
      } as any);

      clearTimeout(timeoutId);

      if (error) {
        console.error('Admin check error:', error);
        setAdminCheckError(error.message);
        setIsAdmin(false);
        return;
      }

      console.log('Admin check result:', data);
      setIsAdmin(data || false);
      
    } catch (error: any) {
      console.error('Admin check failed:', error);
      setAdminCheckError(error.message || 'Failed to verify admin status');
      
      console.warn('⚠️ DEV MODE: Granting admin access due to check failure');
      setIsAdmin(true);
    }
  }

  async function loadPledgeRequests() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('pledge_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading pledges:', error);
        throw error;
      }

      console.log('Loaded pledge requests:', data);
      setPledges(data || []);
      
    } catch (error: any) {
      console.error('Error loading pledge requests:', error);
      alert('Failed to load pledge requests: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(pledgeRequest: PledgeRequest) {
    if (!confirm(`Approve pledge request for ${pledgeRequest.requested_tokens.toLocaleString()} PLAT tokens?\n\nThis will mint tokens on Stellar blockchain.`)) {
      return;
    }

    setProcessing(pledgeRequest.id);

    try {
      console.log('Starting approval process for:', pledgeRequest.id);

      // @ts-ignore - Supabase type inference issue
      const { error: updateError } = await supabase
        .from('pledge_requests')
        .update({ status: 'approved' })
        .eq('id', pledgeRequest.id);

      if (updateError) {
        console.error('Failed to update pledge status:', updateError);
        throw new Error('Failed to update pledge status: ' + updateError.message);
      }

      console.log('✅ Pledge status updated to approved');

      console.log('🚀 Minting tokens on Stellar...');

      const StellarSdk = await import('@stellar/stellar-sdk');
      const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

      const ISSUER_SECRET = process.env.NEXT_PUBLIC_STELLAR_ISSUER_SECRET || process.env.STELLAR_ISSUER_SECRET;
      
      if (!ISSUER_SECRET) {
        throw new Error('Stellar issuer secret not configured');
      }

      const issuerKeypair = StellarSdk.Keypair.fromSecret(ISSUER_SECRET);
      const platAsset = new StellarSdk.Asset('PLAT', issuerKeypair.publicKey());

      console.log('Issuer public key:', issuerKeypair.publicKey());
      console.log('Recipient wallet:', pledgeRequest.wallet_address);
      console.log('Amount to mint:', pledgeRequest.requested_tokens);

      const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

      const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: pledgeRequest.wallet_address,
            asset: platAsset,
            amount: pledgeRequest.requested_tokens.toString(),
          })
        )
        .addMemo(StellarSdk.Memo.text(`PLAT:${pledgeRequest.id.substring(0, 10)}`))
        .setTimeout(300)
        .build();

      transaction.sign(issuerKeypair);

      console.log('Transaction built and signed, submitting to Stellar...');

      const result = await server.submitTransaction(transaction);

      console.log('✅ Stellar transaction successful!');
      console.log('Transaction hash:', result.hash);
      console.log('Ledger:', result.ledger);

      await supabase
        .from('transaction_log')
        .insert({
          transaction_hash: result.hash,
          transaction_type: 'plat_mint',
          from_address: issuerKeypair.publicKey(),
          to_address: pledgeRequest.wallet_address,
          status: 'completed',
          parameters: {
            pledge_request_id: pledgeRequest.id,
            amount: pledgeRequest.requested_tokens,
            asset_type: pledgeRequest.asset_type
          }
        });

      await supabase
        .from('assets')
        .upsert({
          owner_id: pledgeRequest.user_id,
          asset_type: pledgeRequest.asset_type,
          description: pledgeRequest.description,
          location: pledgeRequest.location,
          appraised_value: pledgeRequest.appraised_value,
          status: 'pledged',
          tokens_to_mint: pledgeRequest.requested_tokens,
          pledge_agreement_id: pledgeRequest.id
        });

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', pledgeRequest.user_id)
        .single();

      if (userProfile) {
        await supabase
          .from('transactions')
          .insert({
            user_id: userProfile.id,
            tx_type: 'plat_received',
            amount: pledgeRequest.requested_tokens,
            tx_hash: result.hash,
            created_at: new Date().toISOString()
          });
      }

      alert(`✅ Pledge Approved!\n\n${pledgeRequest.requested_tokens.toLocaleString()} PLAT tokens have been minted on Stellar blockchain.\n\nTransaction Hash: ${result.hash}\n\nTokens sent to: ${pledgeRequest.wallet_address}\n\nVerify on Stellar: https://horizon-testnet.stellar.org/transactions/${result.hash}`);

      await loadPledgeRequests();

    } catch (error: any) {
      console.error('❌ Approval error:', error);
      alert('❌ Failed to approve pledge: ' + error.message);
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(pledgeRequest: PledgeRequest) {
    if (!confirm(`Reject pledge request?\n\nAsset: ${pledgeRequest.description.substring(0, 50)}...`)) {
      return;
    }

    setProcessing(pledgeRequest.id);

    try {
      // @ts-ignore - Supabase type inference issue
      const { error } = await supabase
        .from('pledge_requests')
        .update({ status: 'rejected' })
        .eq('id', pledgeRequest.id);

      if (error) throw error;

      alert('Pledge request rejected');
      await loadPledgeRequests();

    } catch (error: any) {
      console.error('Rejection error:', error);
      alert('Failed to reject pledge: ' + error.message);
    } finally {
      setProcessing(null);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to access the admin panel.</p>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pledge requests...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">You do not have admin privileges to access this page.</p>
          {adminCheckError && (
            <p className="text-sm text-red-600 mb-4">Error: {adminCheckError}</p>
          )}
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

  const pendingPledges = pledges.filter(p => p.status === 'pending');
  const approvedPledges = pledges.filter(p => p.status === 'approved');
  const rejectedPledges = pledges.filter(p => p.status === 'rejected');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-2 text-gray-600">Manage pledge requests and mint PLAT tokens</p>
          {adminCheckError && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                ⚠️ Running in DEV mode - Admin check failed: {adminCheckError}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Pending Requests</h3>
            <p className="text-3xl font-bold text-yellow-600">{pendingPledges.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Approved</h3>
            <p className="text-3xl font-bold text-green-600">{approvedPledges.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Rejected</h3>
            <p className="text-3xl font-bold text-red-600">{rejectedPledges.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Pending Pledge Requests ({pendingPledges.length})
          </h2>

          {pendingPledges.length === 0 ? (
            <p className="text-gray-600">No pending requests</p>
          ) : (
            <div className="space-y-4">
              {pendingPledges.map((pledge) => (
                <div key={pledge.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                          PENDING
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          {pledge.asset_type.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">{pledge.description}</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Appraised Value:</span>
                          <span className="ml-2 font-semibold">${pledge.appraised_value.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Requested Tokens:</span>
                          <span className="ml-2 font-semibold text-green-600">
                            {pledge.requested_tokens.toLocaleString()} PLAT
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Location:</span>
                          <span className="ml-2">{pledge.location || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Submitted:</span>
                          <span className="ml-2">{new Date(pledge.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        <span>Wallet: {pledge.wallet_address.substring(0, 20)}...</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => handleApprove(pledge)}
                      disabled={processing === pledge.id}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {processing === pledge.id ? 'Minting on Stellar...' : '✓ Approve & Mint Tokens'}
                    </button>
                    <button
                      onClick={() => handleReject(pledge)}
                      disabled={processing === pledge.id}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {processing === pledge.id ? 'Processing...' : '✗ Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recently Approved ({approvedPledges.length})
          </h2>

          {approvedPledges.length === 0 ? (
            <p className="text-gray-600">No approved pledges yet</p>
          ) : (
            <div className="space-y-3">
              {approvedPledges.slice(0, 5).map((pledge) => (
                <div key={pledge.id} className="border border-green-200 bg-green-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="px-2 py-1 bg-green-200 text-green-800 text-xs font-medium rounded-full mr-2">
                        APPROVED
                      </span>
                      <span className="text-sm font-medium">{pledge.description.substring(0, 50)}...</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-700">
                        {pledge.requested_tokens.toLocaleString()} PLAT
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(pledge.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}