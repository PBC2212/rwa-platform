'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';

const supabase = createClient();

interface MarketplaceItem {
  agreement_id: string;
  asset_type: string;
  description: string;
  original_value: number;
  discounted_value: number;
  tokens_available: number;
  token_price: number;
  status: number;
  created_at: string;
}

export default function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState<number>(0);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string>('');
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadMarketplaceItems();
  }, []);

  async function loadMarketplaceItems() {
    try {
      setLoading(true);
      setError('');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const { data, error } = await supabase.rpc('get_investment_opportunities');
      
      clearTimeout(timeoutId);

      if (error) {
        console.error('Marketplace load error:', error);
        throw error;
      }

      console.log('Loaded marketplace items:', data);
      setItems(data || []);
    } catch (error: any) {
      console.error('Error loading marketplace:', error);
      
      if (error.name === 'AbortError') {
        setError('Request timeout - Unable to load marketplace items');
      } else {
        setError('Failed to load marketplace: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = filter === 'all' 
    ? items 
    : items.filter(item => item.asset_type === filter);

  const assetTypes = [
    { value: 'all', label: 'All Assets' },
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'art', label: 'Art' },
    { value: 'commodities', label: 'Commodities' },
    { value: 'vehicles', label: 'Vehicles' },
    { value: 'equipment', label: 'Equipment' }
  ];

  function handleInvest(item: MarketplaceItem) {
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    setSelectedItem(item);
    setShowModal(true);
  }

  async function confirmInvestment() {
    if (!selectedItem || !user) return;

    try {
      const tokenAmount = investmentAmount / selectedItem.token_price;
      
      const { data, error } = await supabase.rpc('create_investment', {
        _pledge_agreement_id: selectedItem.agreement_id,
        _investor_address: user.wallet_address || user.id,
        _usdt_amount: investmentAmount,
        _token_amount: tokenAmount
      });

      if (error) throw error;

      alert('Investment successful! Tokens are being minted.');
      setShowModal(false);
      setInvestmentAmount(0);
      loadMarketplaceItems();
    } catch (error: any) {
      console.error('Investment error:', error);
      alert('Investment failed: ' + error.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Marketplace</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadMarketplaceItems}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Asset Marketplace</h1>
          <p className="mt-2 text-gray-600">Invest in tokenized real-world assets</p>
        </div>

        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {assetTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setFilter(type.value)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  filter === type.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">No assets available in this category</p>
            <button
              onClick={loadMarketplaceItems}
              className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-700"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => (
              <div key={item.agreement_id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                      {item.asset_type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-green-600 font-semibold">
                      {item.tokens_available.toFixed(0)} tokens
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {item.description.length > 60 
                      ? item.description.substring(0, 60) + '...' 
                      : item.description}
                  </h3>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Original Value:</span>
                      <span className="font-semibold">${item.original_value.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discounted Value:</span>
                      <span className="font-semibold text-green-600">
                        ${item.discounted_value.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Token Price:</span>
                      <span className="font-semibold">${item.token_price.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleInvest(item)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Invest Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">Invest in Asset</h2>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">{selectedItem.description}</p>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Token Price:</span>
                    <span className="font-semibold">${selectedItem.token_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Available Tokens:</span>
                    <span className="font-semibold">{selectedItem.tokens_available.toFixed(0)}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Investment Amount (USDT)
                </label>
                <input
                  type="number"
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                />
                {investmentAmount > 0 && (
                  <p className="mt-2 text-sm text-gray-600">
                    You will receive: <span className="font-semibold">
                      {(investmentAmount / selectedItem.token_price).toFixed(2)} tokens
                    </span>
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setInvestmentAmount(0);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmInvestment}
                  disabled={investmentAmount <= 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm Investment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}