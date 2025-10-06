import * as StellarSdk from '@stellar/stellar-sdk';

const TESTNET_URL = 'https://horizon-testnet.stellar.org';
const MAINNET_URL = 'https://horizon.stellar.org';

export function getStellarServer(network: 'testnet' | 'mainnet' = 'testnet') {
  const url = network === 'mainnet' ? MAINNET_URL : TESTNET_URL;
  return new StellarSdk.Horizon.Server(url);
}

export function getNetworkPassphrase(network: 'testnet' | 'mainnet' = 'testnet') {
  return network === 'mainnet' 
    ? StellarSdk.Networks.PUBLIC 
    : StellarSdk.Networks.TESTNET;
}

export interface PoolParams {
  assetA: StellarSdk.Asset;
  assetB: StellarSdk.Asset;
  fee: number;
}

export interface LiquidityPoolInfo {
  id: string;
  fee_bp: number;
  type: string;
  total_trustlines: string;
  total_shares: string;
  reserves: Array<{
    asset: string;
    amount: string;
  }>;
}

export function getLiquidityPoolId(params: PoolParams): string {
  const liquidityPoolAsset = new StellarSdk.LiquidityPoolAsset(
    params.assetA,
    params.assetB,
    params.fee
  );
  
  return liquidityPoolAsset.getLiquidityPoolId();
}

export async function checkPoolExists(
  poolId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<boolean> {
  try {
    const server = getStellarServer(network);
    await server.liquidityPools().liquidityPoolId(poolId).call();
    return true;
  } catch (error) {
    return false;
  }
}

export async function createLiquidityPool(
  secretKey: string,
  params: PoolParams,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{ success: boolean; poolId: string; txHash?: string; error?: string }> {
  try {
    const server = getStellarServer(network);
    const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

    const liquidityPoolAsset = new StellarSdk.LiquidityPoolAsset(
      params.assetA,
      params.assetB,
      params.fee
    );

    const poolId = liquidityPoolAsset.getLiquidityPoolId();
    console.log('Creating liquidity pool with ID:', poolId);

    const poolExists = await checkPoolExists(poolId, network);
    if (poolExists) {
      console.log('Pool already exists, skipping creation');
      return { success: true, poolId };
    }

    const changeTrustOp = StellarSdk.Operation.changeTrust({
      asset: liquidityPoolAsset,
      limit: '1000000'
    });

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: getNetworkPassphrase(network),
    })
      .addOperation(changeTrustOp)
      .setTimeout(180)
      .build();

    transaction.sign(sourceKeypair);

    const result = await server.submitTransaction(transaction);
    console.log('Pool creation transaction successful:', result.hash);

    return {
      success: true,
      poolId,
      txHash: result.hash
    };

  } catch (error: any) {
    console.error('Error creating liquidity pool:', error);
    return {
      success: false,
      poolId: '',
      error: error.message || 'Unknown error'
    };
  }
}

export async function depositLiquidity(
  secretKey: string,
  poolId: string,
  maxAmountA: string,
  maxAmountB: string,
  minPrice: string,
  maxPrice: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const server = getStellarServer(network);
    const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

    const depositOp = StellarSdk.Operation.liquidityPoolDeposit({
      liquidityPoolId: poolId,
      maxAmountA,
      maxAmountB,
      minPrice: { n: parseInt(minPrice), d: 1 },
      maxPrice: { n: parseInt(maxPrice), d: 1 }
    });

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: getNetworkPassphrase(network),
    })
      .addOperation(depositOp)
      .setTimeout(180)
      .build();

    transaction.sign(sourceKeypair);

    const result = await server.submitTransaction(transaction);
    console.log('Liquidity deposit successful:', result.hash);

    return {
      success: true,
      txHash: result.hash
    };

  } catch (error: any) {
    console.error('Error depositing liquidity:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

export async function withdrawLiquidity(
  secretKey: string,
  poolId: string,
  amount: string,
  minAmountA: string,
  minAmountB: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const server = getStellarServer(network);
    const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

    const withdrawOp = StellarSdk.Operation.liquidityPoolWithdraw({
      liquidityPoolId: poolId,
      amount,
      minAmountA,
      minAmountB
    });

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: getNetworkPassphrase(network),
    })
      .addOperation(withdrawOp)
      .setTimeout(180)
      .build();

    transaction.sign(sourceKeypair);

    const result = await server.submitTransaction(transaction);
    console.log('Liquidity withdrawal successful:', result.hash);

    return {
      success: true,
      txHash: result.hash
    };

  } catch (error: any) {
    console.error('Error withdrawing liquidity:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

export async function getUserLiquidityPositions(
  publicKey: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<any[]> {
  try {
    const server = getStellarServer(network);
    const account = await server.loadAccount(publicKey);
    
    const liquidityPoolBalances = account.balances.filter(
      (balance: any) => balance.asset_type === 'liquidity_pool_shares'
    );

    const positions = [];
    
    for (const balance of liquidityPoolBalances) {
      try {
        const poolInfo = await server
          .liquidityPools()
          .liquidityPoolId(balance.liquidity_pool_id)
          .call();
        
        positions.push({
          poolId: balance.liquidity_pool_id,
          shares: balance.balance,
          poolInfo
        });
      } catch (error) {
        console.error('Error fetching pool info:', error);
      }
    }

    return positions;
  } catch (error: any) {
    console.error('Error fetching user liquidity positions:', error);
    return [];
  }
}

export async function getPoolInfo(poolId: string, network: 'testnet' | 'mainnet' = 'testnet') {
  try {
    const server = getStellarServer(network);
    const pool = await server.liquidityPools().liquidityPoolId(poolId).call();
    return pool;
  } catch (error: any) {
    if (error?.response?.status === 404 || error?.name === 'NotFoundError') {
      console.log('Pool not found (may not exist yet):', poolId);
      return null;
    }
    console.error('Error fetching pool info:', error);
    throw error;
  }
}

export async function getAllLiquidityPools(
  network: 'testnet' | 'mainnet' = 'testnet',
  limit: number = 200
): Promise<any[]> {
  try {
    const server = getStellarServer(network);
    const response = await server
      .liquidityPools()
      .limit(limit)
      .order('desc')
      .call();
    
    return response.records;
  } catch (error: any) {
    console.error('Error fetching all liquidity pools:', error);
    return [];
  }
}

export async function swapAssets(
  secretKey: string,
  sendAsset: StellarSdk.Asset,
  sendAmount: string,
  destAsset: StellarSdk.Asset,
  destMin: string,
  path: StellarSdk.Asset[] = [],
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const server = getStellarServer(network);
    const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

    const pathPaymentOp = StellarSdk.Operation.pathPaymentStrictSend({
      sendAsset,
      sendAmount,
      destination: sourceKeypair.publicKey(),
      destAsset,
      destMin,
      path
    });

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: getNetworkPassphrase(network),
    })
      .addOperation(pathPaymentOp)
      .setTimeout(180)
      .build();

    transaction.sign(sourceKeypair);

    const result = await server.submitTransaction(transaction);
    console.log('Swap successful:', result.hash);

    return {
      success: true,
      txHash: result.hash
    };

  } catch (error: any) {
    console.error('Error performing swap:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

export async function findBestSwapPath(
  sourceAsset: StellarSdk.Asset,
  destAsset: StellarSdk.Asset,
  amount: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<any> {
  try {
    const server = getStellarServer(network);
    
    const paths = await server
      .strictSendPaths(sourceAsset, amount, [destAsset])
      .call();

    if (paths.records.length === 0) {
      return null;
    }

    const bestPath = paths.records.reduce((best: any, current: any) => {
      const bestAmount = parseFloat(best.destination_amount);
      const currentAmount = parseFloat(current.destination_amount);
      return currentAmount > bestAmount ? current : best;
    });

    return bestPath;
  } catch (error: any) {
    console.error('Error finding swap path:', error);
    return null;
  }
}

export function calculatePoolPrice(reserve0: string, reserve1: string): number {
  const r0 = parseFloat(reserve0);
  const r1 = parseFloat(reserve1);
  
  if (r0 === 0) return 0;
  return r1 / r0;
}

export function calculateLiquidityValue(
  shares: string,
  totalShares: string,
  reserves: Array<{ amount: string }>
): { value0: number; value1: number } {
  const userShares = parseFloat(shares);
  const total = parseFloat(totalShares);
  
  if (total === 0) return { value0: 0, value1: 0 };
  
  const share = userShares / total;
  
  return {
    value0: parseFloat(reserves[0].amount) * share,
    value1: parseFloat(reserves[1].amount) * share
  };
}

export async function getAssetPrice(
  asset: StellarSdk.Asset,
  baseAsset: StellarSdk.Asset,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<number | null> {
  try {
    const server = getStellarServer(network);
    
    const orderbook = await server
      .orderbook(asset, baseAsset)
      .call();

    if (orderbook.bids.length === 0) return null;
    
    const topBid = orderbook.bids[0];
    return parseFloat(topBid.price);
  } catch (error: any) {
    console.error('Error fetching asset price:', error);
    return null;
  }
}

export function calculateSwapOutput(
  inputAmount: number,
  inputReserve: number,
  outputReserve: number,
  feeBps: number = 30
): number {
  const feeMultiplier = (10000 - feeBps) / 10000;
  const inputWithFee = inputAmount * feeMultiplier;
  const numerator = inputWithFee * outputReserve;
  const denominator = inputReserve + inputWithFee;
  return numerator / denominator;
}

export function calculateSpotPrice(reserve0: string, reserve1: string): number {
  return calculatePoolPrice(reserve0, reserve1);
}

export function getPlatAsset(issuerPublicKey: string): StellarSdk.Asset {
  return new StellarSdk.Asset('PLAT', issuerPublicKey);
}

export function getNativeAsset(): StellarSdk.Asset {
  return StellarSdk.Asset.native();
}

export { StellarSdk };