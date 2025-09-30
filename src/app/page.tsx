'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';

export default function LandingPage() {
  const { user, loading } = useAuth();

  // Don't wait for auth on landing page - show content immediately
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            RWA Tokenization Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Unlock liquidity from your real-world assets. Tokenize property, art, commodities, and more on the Stellar blockchain.
          </p>
          
          <div className="flex gap-4 justify-center">
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg"
                >
                  Get Started
                </Link>
                <Link
                  href="/marketplace"
                  className="px-8 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors shadow-lg"
                >
                  Browse Assets
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl mb-4">🏠</div>
            <h3 className="text-xl font-semibold mb-2">Pledge Assets</h3>
            <p className="text-gray-600">
              Submit your real-world assets for tokenization and receive 65-70% of their value in PLAT tokens instantly.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl mb-4">💎</div>
            <h3 className="text-xl font-semibold mb-2">PLAT Tokens</h3>
            <p className="text-gray-600">
              Each PLAT token represents $1 USD backed by real-world assets on the Stellar blockchain network.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-xl font-semibold mb-2">Invest & Trade</h3>
            <p className="text-gray-600">
              Browse tokenized assets, invest in opportunities, and trade PLAT tokens on our secure marketplace.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-20 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-3xl font-bold text-center mb-10">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h4 className="font-semibold mb-2">Submit Asset</h4>
              <p className="text-sm text-gray-600">Pledge your real-world asset with documentation</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h4 className="font-semibold mb-2">Admin Review</h4>
              <p className="text-sm text-gray-600">Our team verifies and appraises your asset</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h4 className="font-semibold mb-2">Token Minting</h4>
              <p className="text-sm text-gray-600">PLAT tokens are minted on Stellar blockchain</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h4 className="font-semibold mb-2">Receive Tokens</h4>
              <p className="text-sm text-gray-600">Get 65-70% of asset value as tradeable tokens</p>
            </div>
          </div>
        </div>

        {/* Asset Types */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center mb-10">Supported Asset Types</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-3xl mb-2">🏠</div>
              <p className="font-medium">Real Estate</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-3xl mb-2">🎨</div>
              <p className="font-medium">Art</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-3xl mb-2">📦</div>
              <p className="font-medium">Commodities</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-3xl mb-2">🚗</div>
              <p className="font-medium">Vehicles</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-3xl mb-2">⚙️</div>
              <p className="font-medium">Equipment</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 bg-blue-600 rounded-lg shadow-xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join the future of asset-backed finance on the blockchain
          </p>
          <Link
            href="/auth/signin"
            className="inline-block px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors shadow-lg"
          >
            Create Account
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-20 text-center text-gray-600">
          <p className="text-sm">
            Powered by Stellar Blockchain | Secured by Supabase | Built with Next.js
          </p>
        </div>
      </div>
    </div>
  );
}