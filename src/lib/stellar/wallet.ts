// lib/stellar/wallet.ts
import * as StellarSDK from '@stellar/stellar-sdk';

export interface WalletConnection {
  publicKey: string;
  isConnected: boolean;
  walletType: 'freighter' | 'albedo' | 'rabet';
}

export type WalletType = 'freighter' | 'albedo' | 'rabet';

// Check if Freighter is available
export const isFreighterAvailable = (): boolean => {
  return typeof window !== 'undefined' && 'freighter' in window;
};

// Check if Rabet is available
export const isRabetAvailable = (): boolean => {
  return typeof window !== 'undefined' && 'rabet' in window;
};

// Load Albedo dynamically
const loadAlbedo = async () => {
  if (typeof window === 'undefined') {
    throw new Error('Albedo can only be used in browser');
  }

  // Check if already loaded
  if ((window as any).albedo) {
    return (window as any).albedo;
  }

  // Load from CDN
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@albedo-link/intent@0.9.14/dist/albedo.intent.js';
    script.onload = () => {
      if ((window as any).albedo) {
        resolve((window as any).albedo);
      } else {
        reject(new Error('Albedo failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Albedo script'));
    document.head.appendChild(script);
  });
};

// Connect to Freighter wallet
export const connectFreighter = async (): Promise<WalletConnection> => {
  if (!isFreighterAvailable()) {
    throw new Error('Freighter wallet is not installed');
  }

  try {
    const publicKey = await (window as any).freighter.getPublicKey();
    
    if (!publicKey) {
      throw new Error('Failed to get public key from Freighter');
    }

    return {
      publicKey,
      isConnected: true,
      walletType: 'freighter',
    };
  } catch (error) {
    console.error('Freighter connection error:', error);
    throw new Error('Failed to connect to Freighter. Make sure it is unlocked.');
  }
};

// Connect to Albedo wallet
export const connectAlbedo = async (): Promise<WalletConnection> => {
  try {
    const albedo = await loadAlbedo();
    
    const result = await albedo.publicKey({
      token: 'rwa-platform',
    });
    
    if (!result.pubkey) {
      throw new Error('Failed to get public key from Albedo');
    }

    return {
      publicKey: result.pubkey,
      isConnected: true,
      walletType: 'albedo',
    };
  } catch (error) {
    console.error('Albedo connection error:', error);
    throw new Error('Failed to connect to Albedo wallet');
  }
};

// Connect to Rabet wallet
export const connectRabet = async (): Promise<WalletConnection> => {
  if (!isRabetAvailable()) {
    throw new Error('Rabet wallet is not installed');
  }

  try {
    const result = await (window as any).rabet.connect();
    
    if (!result.publicKey) {
      throw new Error('Failed to get public key from Rabet');
    }

    return {
      publicKey: result.publicKey,
      isConnected: true,
      walletType: 'rabet',
    };
  } catch (error) {
    console.error('Rabet connection error:', error);
    throw new Error('Failed to connect to Rabet. Make sure it is unlocked.');
  }
};

// Universal connect function
export const connectWallet = async (walletType: WalletType): Promise<WalletConnection> => {
  switch (walletType) {
    case 'freighter':
      return await connectFreighter();
    case 'albedo':
      return await connectAlbedo();
    case 'rabet':
      return await connectRabet();
    default:
      throw new Error('Unsupported wallet type');
  }
};

// Sign transaction with any wallet
export const signTransaction = async (
  xdr: string,
  walletType: WalletType,
  network: string = 'TESTNET'
): Promise<string> => {
  const networkPassphrase = network === 'TESTNET' 
    ? StellarSDK.Networks.TESTNET 
    : StellarSDK.Networks.PUBLIC;

  try {
    switch (walletType) {
      case 'freighter':
        return await (window as any).freighter.signTransaction(xdr, {
          network: networkPassphrase,
        });
      
      case 'albedo':
        const albedo = await loadAlbedo();
        const result = await albedo.tx({
          xdr,
          network: network === 'TESTNET' ? 'testnet' : 'public',
        });
        return result.signed_envelope_xdr;
      
      case 'rabet':
        const rabetResult = await (window as any).rabet.sign(xdr, networkPassphrase);
        return rabetResult.xdr;
      
      default:
        throw new Error('Unsupported wallet type');
    }
  } catch (error) {
    console.error('Transaction signing error:', error);
    throw new Error('Failed to sign transaction');
  }
};

// Get account balance
export const getAccountBalance = async (
  publicKey: string,
  horizonUrl: string = 'https://horizon-testnet.stellar.org'
): Promise<{ balance: string; asset: string }[]> => {
  try {
    const server = new StellarSDK.Horizon.Server(horizonUrl);
    const account = await server.loadAccount(publicKey);

    return account.balances.map((balance: any) => ({
      balance: balance.balance,
      asset: balance.asset_type === 'native' ? 'XLM' : balance.asset_code || 'Unknown',
    }));
  } catch (error) {
    console.error('Error fetching balance:', error);
    throw new Error('Failed to fetch account balance');
  }
};