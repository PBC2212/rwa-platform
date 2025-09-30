'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export default function PledgePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    assetType: 'real_estate',
    description: '',
    location: '',
    appraisedValue: '',
    loanPercentage: '70'
  });

  const assetTypes = [
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'art', label: 'Art' },
    { value: 'commodities', label: 'Commodities' },
    { value: 'vehicles', label: 'Vehicles' },
    { value: 'equipment', label: 'Equipment' }
  ];

  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  const appraisedValue = parseFloat(formData.appraisedValue) || 0;
  const loanPercentage = parseFloat(formData.loanPercentage) || 70;
  const requestedTokens = Math.floor((appraisedValue * loanPercentage) / 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!user?.id) {
      alert('Please sign in first');
      return;
    }

    if (requestedTokens <= 0) {
      alert('Invalid token amount. Please check your appraised value.');
      return;
    }

    setLoading(true);

    try {
      console.log('Creating pledge directly in database...');

      const { data: pledgeData, error: pledgeError } = await supabase
        .from('pledge_requests')
        .insert({
          user_id: user.id,
          asset_type: formData.assetType,
          description: formData.description,
          location: formData.location || null,
          appraised_value: appraisedValue,
          requested_tokens: requestedTokens,
          wallet_address: user.wallet_address || user.id,
          status: 'pending'
        })
        .select()
        .single();

      if (pledgeError) {
        console.error('Pledge insert error:', pledgeError);
        throw pledgeError;
      }

      console.log('Pledge created successfully:', pledgeData);

      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .insert({
          owner_id: user.id,
          asset_type: formData.assetType,
          description: formData.description,
          location: formData.location || null,
          appraised_value: appraisedValue,
          status: 'pending_pledge',
          tokens_to_mint: requestedTokens
        })
        .select()
        .single();

      if (assetError) {
        console.error('Asset insert error (non-critical):', assetError);
      }

      alert(`✅ Pledge request submitted successfully!\n\nPledge Request ID: ${pledgeData.id}\n\nYou will receive ${requestedTokens.toLocaleString()} PLAT tokens (${loanPercentage}% of $${appraisedValue.toLocaleString()}) once approved.\n\nAn admin will review your request shortly.`);
      
      setFormData({
        assetType: 'real_estate',
        description: '',
        location: '',
        appraisedValue: '',
        loanPercentage: '70'
      });

    } catch (error: any) {
      console.error('Pledge submission error:', error);
      alert('❌ Error submitting pledge: ' + error.message + '\n\nDetails: ' + JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">
            Please sign in to pledge your assets and receive PLAT tokens.
          </p>
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pledge Your Asset</h1>
          <p className="mt-2 text-gray-600">
            Submit your asset for tokenization and receive PLAT tokens (65-70% of asset value)
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asset Type *
              </label>
              <select
                value={formData.assetType}
                onChange={(e) => handleChange('assetType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {assetTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asset Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Provide detailed information about your asset..."
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Include key details such as condition, features, and any relevant history
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="City, State/Country"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appraised Value (USD) *
              </label>
              <input
                type="number"
                value={formData.appraisedValue}
                onChange={(e) => handleChange('appraisedValue', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="100000"
                min="1"
                step="0.01"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Professional appraisal may be required for approval
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Loan-to-Value Ratio: {loanPercentage}%
              </label>
              <input
                type="range"
                min="65"
                max="70"
                step="1"
                value={formData.loanPercentage}
                onChange={(e) => handleChange('loanPercentage', e.target.value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>65% (Conservative)</span>
                <span>70% (Maximum)</span>
              </div>
            </div>

            {appraisedValue > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-green-900 mb-2">
                  💰 You Will Receive:
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-800">Asset Value:</span>
                    <span className="font-semibold text-green-900">
                      ${appraisedValue.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-800">Loan Percentage:</span>
                    <span className="font-semibold text-green-900">{loanPercentage}%</span>
                  </div>
                  <div className="border-t border-green-300 pt-2 flex justify-between">
                    <span className="text-green-900 font-semibold">PLAT Tokens:</span>
                    <span className="font-bold text-green-900 text-lg">
                      {requestedTokens.toLocaleString()} PLAT
                    </span>
                  </div>
                  <p className="text-xs text-green-700 mt-2">
                    * Tokens are 1:1 with USD value. Each PLAT token = $1 USD
                  </p>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                📋 What happens next?
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Your pledge request will be submitted to our platform</li>
                <li>• An admin will review and verify your asset documentation</li>
                <li>• Upon approval, PLAT tokens will be minted on Stellar blockchain</li>
                <li>• Tokens will be automatically sent to your wallet</li>
                <li>• You'll receive a transaction hash as proof of minting</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Link
                href="/dashboard"
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || requestedTokens <= 0}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Submitting...' : `Pledge Asset & Request ${requestedTokens.toLocaleString()} PLAT`}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Required Documentation
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">✓</span>
              Proof of ownership (deed, title, certificate)
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">✓</span>
              Professional appraisal (within last 12 months)
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">✓</span>
              High-quality photographs or documentation
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">✓</span>
              Valid identification and KYC verification
            </li>
          </ul>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            💎 About PLAT Tokens
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              PLAT tokens are issued on the Stellar blockchain network
            </li>
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              Each PLAT token represents $1 USD in asset value
            </li>
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              Tokens are tradeable on our marketplace
            </li>
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              Backed 1:1 by real-world assets
            </li>
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              Can be redeemed for asset ownership
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}