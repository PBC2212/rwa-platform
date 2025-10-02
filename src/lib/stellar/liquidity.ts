// lib/stellar/liquidity.ts
import * as StellarSDK from '@stellar/stellar-sdk';

export interface LiquidityPoolParams {
  assetA: StellarSDK.Asset;
  assetB: StellarSDK.Asset;
  fee: number; // basis points (30 = 0.3%)
}

export interface DepositLiquidityParams {
  poolId: string;
  maxAssetAAmount: string;
  maxAssetBAmount: string;
  minPrice: string;
  maxPrice: string;
}

export interface WithdrawLiquidityParams {
  poolId: string;
  shareAmount: string;
  minAssetAAmount: string;
  minAssetBAmount: string;
}

// Get Stellar server
export const getStellarServer = (network: 'testnet' | 'mainnet' = 'testnet') => {
  const horizonUrl = network === 'testnet' 
    ? 'https://horizon-testnet.stellar.org'
    : 'https://horizon.stellar.org';
  
  return new StellarSDK.Horizon.Server(horizonUrl);
};

// Create a liquidity pool ID from two assets
export const getLiquidityPoolId = (
  assetA: StellarSDK.Asset,
  assetB: StellarSDK.Asset,
  fee: number = 30
): string => {
  // Stellar requires assets to be in lexicographic order
  // Compare assets and sort them
  const sortedAssets = [assetA, assetB].sort((a, b) => {
    const aStr = a.isNative() ? 'native' : `${a.getCode()}:${a.getIssuer()}`;
    const bStr = b.isNative() ? 'native' : `${b.getCode()}:${b.getIssuer()}`;
    return aStr.localeCompare(bStr);
  });

  return StellarSDK.getLiquidityPoolId(
    'constant_product',
    {
      assetA: sortedAssets[0],
      assetB: sortedAssets[1],
      fee: fee
    }
  ).toString('hex');
};

// Check if liquidity pool exists on Stellar
export const checkPoolExists = async (
  poolId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<boolean> => {
  try {
    const server = getStellarServer(network);
    await server.liquidityPools().liquidityPoolId(poolId).call();
    return true;
  } catch (error) {
    return false;
  }
};

// Get liquidity pool details from Stellar
export const getPoolInfo = async (
  poolId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<any> => {
  try {
    const server = getStellarServer(network);
    const pool = await server.liquidityPools().liquidityPoolId(poolId).call();
    return pool;
  } catch (error) {
    console.error('Error fetching pool info:', error);
    throw new Error('Failed to fetch pool information');
  }
};

// Build transaction to deposit liquidity
export const buildDepositLiquidityTransaction = async (
  sourceAddress: string,
  params: DepositLiquidityParams,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<string> => {
  const server = getStellarServer(network);
  const networkPassphrase = network === 'testnet' 
    ? StellarSDK.Networks.TESTNET 
    : StellarSDK.Networks.PUBLIC;

  try {
    const sourceAccount = await server.loadAccount(sourceAddress);

    const transaction = new StellarSDK.TransactionBuilder(sourceAccount, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        StellarSDK.Operation.liquidityPoolDeposit({
          liquidityPoolId: params.poolId,
          maxAmountA: params.maxAssetAAmount,
          maxAmountB: params.maxAssetBAmount,
          minPrice: { n: 1, d: 1 }, // Simplified price ratio
          maxPrice: { n: 1, d: 1 },
        })
      )
      .setTimeout(300)
      .build();

    return transaction.toXDR();
  } catch (error) {
    console.error('Error building deposit transaction:', error);
    throw new Error('Failed to build deposit transaction');
  }
};

// Build transaction to withdraw liquidity
export const buildWithdrawLiquidityTransaction = async (
  sourceAddress: string,
  params: WithdrawLiquidityParams,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<string> => {
  const server = getStellarServer(network);
  const networkPassphrase = network === 'testnet' 
    ? StellarSDK.Networks.TESTNET 
    : StellarSDK.Networks.PUBLIC;

  try {
    const sourceAccount = await server.loadAccount(sourceAddress);

    const transaction = new StellarSDK.TransactionBuilder(sourceAccount, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        StellarSDK.Operation.liquidityPoolWithdraw({
          liquidityPoolId: params.poolId,
          amount: params.shareAmount,
          minAmountA: params.minAssetAAmount,
          minAmountB: params.minAssetBAmount,
        })
      )
      .setTimeout(300)
      .build();

    return transaction.toXDR();
  } catch (error) {
    console.error('Error building withdraw transaction:', error);
    throw new Error('Failed to build withdraw transaction');
  }
};

// Build transaction to change trust (required before depositing to a pool)
export const buildChangeTrustTransaction = async (
  sourceAddress: string,
  poolId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<string> => {
  const server = getStellarServer(network);
  const networkPassphrase = network === 'testnet' 
    ? StellarSDK.Networks.TESTNET 
    : StellarSDK.Networks.PUBLIC;

  try {
    const sourceAccount = await server.loadAccount(sourceAddress);

    const lpAsset = new StellarSDK.LiquidityPoolId(poolId);

    const transaction = new StellarSDK.TransactionBuilder(sourceAccount, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        StellarSDK.Operation.changeTrust({
          asset: lpAsset,
        })
      )
      .setTimeout(300)
      .build();

    return transaction.toXDR();
  } catch (error) {
    console.error('Error building change trust transaction:', error);
    throw new Error('Failed to build change trust transaction');
  }
};

// Submit signed transaction to Stellar
export const submitTransaction = async (
  signedXDR: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<any> => {
  const server = getStellarServer(network);

  try {
    const transaction = StellarSDK.TransactionBuilder.fromXDR(
      signedXDR,
      network === 'testnet' ? StellarSDK.Networks.TESTNET : StellarSDK.Networks.PUBLIC
    );

    const result = await server.submitTransaction(transaction as any);
    return result;
  } catch (error: any) {
    console.error('Transaction submission error:', error);
    throw new Error('Failed to submit transaction: ' + error.message);
  }
};

// Get user's liquidity pool balances
export const getUserPoolBalances = async (
  walletAddress: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<any[]> => {
  const server = getStellarServer(network);

  try {
    const account = await server.loadAccount(walletAddress);
    
    const poolBalances = account.balances.filter(
      (balance: any) => balance.asset_type === 'liquidity_pool_shares'
    );

    return poolBalances;
  } catch (error) {
    console.error('Error fetching pool balances:', error);
    throw new Error('Failed to fetch pool balances');
  }
};

// Calculate pool share percentage
export const calculateSharePercentage = (
  userShares: number,
  totalShares: number
): number => {
  if (totalShares === 0) return 0;
  return (userShares / totalShares) * 100;
};

// Calculate estimated output for deposit
export const calculateDepositOutput = (
  assetAAmount: number,
  assetBAmount: number,
  poolAssetAReserve: number,
  poolAssetBReserve: number,
  totalShares: number
): number => {
  if (totalShares === 0) {
    // First deposit - shares equal to geometric mean
    return Math.sqrt(assetAAmount * assetBAmount);
  }

  // Subsequent deposits - proportional to existing pool
  const shareFromA = (assetAAmount / poolAssetAReserve) * totalShares;
  const shareFromB = (assetBAmount / poolAssetBReserve) * totalShares;
  
  return Math.min(shareFromA, shareFromB);
};

// Calculate estimated output for withdrawal
export const calculateWithdrawOutput = (
  shares: number,
  totalShares: number,
  poolAssetAReserve: number,
  poolAssetBReserve: number
): { assetA: number; assetB: number } => {
  if (totalShares === 0) {
    return { assetA: 0, assetB: 0 };
  }

  const sharePercentage = shares / totalShares;
  
  return {
    assetA: sharePercentage * poolAssetAReserve,
    assetB: sharePercentage * poolAssetBReserve,
  };
};

// Check if user has trustline to pool
export const hasPoolTrustline = async (
  walletAddress: string,
  poolId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<boolean> => {
  const server = getStellarServer(network);

  try {
    const account = await server.loadAccount(walletAddress);
    
    const hasTrustline = account.balances.some(
      (balance: any) => 
        balance.asset_type === 'liquidity_pool_shares' && 
        balance.liquidity_pool_id === poolId
    );

    return hasTrustline;
  } catch (error) {
    console.error('Error checking trustline:', error);
    return false;
  }
};

// Format pool ID for display (first 8 and last 8 characters)
export const formatPoolId = (poolId: string): string => {
  if (poolId.length <= 16) return poolId;
  return `${poolId.substring(0, 8)}...${poolId.substring(poolId.length - 8)}`;
};

// Get PLAT asset object
export const getPlatAsset = (issuerAddress: string): StellarSDK.Asset => {
  return new StellarSDK.Asset('PLAT', issuerAddress);
};

// Get native XLM asset object
export const getNativeAsset = (): StellarSDK.Asset => {
  return StellarSDK.Asset.native();
};