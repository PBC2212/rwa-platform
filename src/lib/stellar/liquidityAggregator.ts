// lib/stellar/liquidityAggregator.ts - Multi-source Liquidity Aggregator
import * as StellarSDK from '@stellar/stellar-sdk';
import { 
  getStellarServer, 
  getPoolInfo,
  calculateSwapOutput,
  calculateSpotPrice,
  getLiquidityPoolId,
  getPlatAsset,
  getNativeAsset
} from './liquidity';

export interface LiquiditySource {
  poolId: string;
  source: 'stellar_native' | 'external_dex';
  assetA: StellarSDK.Asset;
  assetB: StellarSDK.Asset;
  reserveA: number;
  reserveB: number;
  totalShares: number;
  fee: number;
  tvl: number;
  price: number;
}

export interface AggregatedRoute {
  sources: {
    poolId: string;
    inputAmount: number;
    outputAmount: number;
    priceImpact: number;
  }[];
  totalInput: number;
  totalOutput: number;
  averagePriceImpact: number;
  effectivePrice: number;
}

export interface BootstrapConfig {
  assetA: StellarSDK.Asset;
  assetB: StellarSDK.Asset;
  targetLiquidityUSD: number;
  maxSlippage: number;
  sources: string[]; // Array of external DEX/pool identifiers
}

// ============================================
// LIQUIDITY DISCOVERY
// ============================================

/**
 * Discover all available liquidity pools for a given asset pair
 */
export const discoverLiquiditySources = async (
  assetA: StellarSDK.Asset,
  assetB: StellarSDK.Asset,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<LiquiditySource[]> => {
  const sources: LiquiditySource[] = [];
  const server = getStellarServer(network);

  try {
    console.log('🔍 Discovering liquidity sources...');

    // 1. Check Stellar Native Liquidity Pools with different fee tiers
    const feeTiers = [30, 100, 300]; // 0.3%, 1%, 3%
    
    for (const fee of feeTiers) {
      try {
        const poolId = getLiquidityPoolId(assetA, assetB, fee);
        const poolInfo = await getPoolInfo(poolId, network);
        
        if (poolInfo && poolInfo.reserves) {
          const reserveA = parseFloat(poolInfo.reserves[0].amount);
          const reserveB = parseFloat(poolInfo.reserves[1].amount);
          const totalShares = parseFloat(poolInfo.total_shares);
          
          // Calculate TVL (assuming Asset B is the quote asset)
          const tvl = reserveA + reserveB;
          const price = calculateSpotPrice(reserveA, reserveB);
          
          sources.push({
            poolId,
            source: 'stellar_native',
            assetA,
            assetB,
            reserveA,
            reserveB,
            totalShares,
            fee,
            tvl,
            price
          });
          
          console.log(`✅ Found Stellar pool: ${fee}bp fee, TVL: $${tvl.toFixed(2)}`);
        }
      } catch (error) {
        // Pool doesn't exist for this fee tier, continue
        console.log(`ℹ️  No pool found for ${fee}bp fee tier`);
      }
    }

    // 2. Check for external DEX integrations (placeholder for future)
    // This would query other Stellar DEXs like:
    // - StellarX pools
    // - AquariusAG pools
    // - StellarTerm order books
    const externalSources = await discoverExternalDEXs(assetA, assetB, network);
    sources.push(...externalSources);

    console.log(`📊 Total sources discovered: ${sources.length}`);
    return sources;

  } catch (error) {
    console.error('Error discovering liquidity sources:', error);
    return sources;
  }
};

/**
 * Discover external DEX liquidity sources
 */
const discoverExternalDEXs = async (
  assetA: StellarSDK.Asset,
  assetB: StellarSDK.Asset,
  network: 'testnet' | 'mainnet'
): Promise<LiquiditySource[]> => {
  const sources: LiquiditySource[] = [];
  
  // Placeholder for external DEX integrations
  // In production, this would query:
  // - StellarX API
  // - Aquarius API
  // - Other Stellar DEXs
  
  console.log('ℹ️  External DEX discovery not yet implemented');
  
  return sources;
};

/**
 * Find the best liquidity source for a given trade
 */
export const findBestSource = (
  sources: LiquiditySource[],
  inputAmount: number
): LiquiditySource | null => {
  if (sources.length === 0) return null;

  let bestSource: LiquiditySource | null = null;
  let bestOutput = 0;

  for (const source of sources) {
    const { outputAmount } = calculateSwapOutput(
      inputAmount,
      source.reserveA,
      source.reserveB,
      source.fee
    );

    if (outputAmount > bestOutput) {
      bestOutput = outputAmount;
      bestSource = source;
    }
  }

  return bestSource;
};

// ============================================
// SMART ORDER ROUTING
// ============================================

/**
 * Calculate optimal route splitting trade across multiple sources
 */
export const calculateOptimalRoute = (
  sources: LiquiditySource[],
  inputAmount: number,
  maxSplits: number = 3
): AggregatedRoute => {
  if (sources.length === 0) {
    return {
      sources: [],
      totalInput: 0,
      totalOutput: 0,
      averagePriceImpact: 0,
      effectivePrice: 0
    };
  }

  // Sort sources by best price (lowest slippage)
  const sortedSources = [...sources].sort((a, b) => {
    const priceA = calculateSwapOutput(inputAmount, a.reserveA, a.reserveB, a.fee).priceImpact;
    const priceB = calculateSwapOutput(inputAmount, b.reserveA, b.reserveB, b.fee).priceImpact;
    return priceA - priceB;
  });

  const route: AggregatedRoute = {
    sources: [],
    totalInput: 0,
    totalOutput: 0,
    averagePriceImpact: 0,
    effectivePrice: 0
  };

  // Simple splitting algorithm - divide input across best sources
  const splitsToUse = Math.min(maxSplits, sortedSources.length);
  const amountPerSplit = inputAmount / splitsToUse;

  for (let i = 0; i < splitsToUse; i++) {
    const source = sortedSources[i];
    const { outputAmount, priceImpact } = calculateSwapOutput(
      amountPerSplit,
      source.reserveA,
      source.reserveB,
      source.fee
    );

    route.sources.push({
      poolId: source.poolId,
      inputAmount: amountPerSplit,
      outputAmount,
      priceImpact
    });

    route.totalInput += amountPerSplit;
    route.totalOutput += outputAmount;
  }

  // Calculate average metrics
  route.averagePriceImpact = 
    route.sources.reduce((sum, s) => sum + s.priceImpact, 0) / route.sources.length;
  route.effectivePrice = route.totalInput / route.totalOutput;

  return route;
};

// ============================================
// LIQUIDITY BOOTSTRAPPING
// ============================================

/**
 * Bootstrap a new liquidity pool by aggregating from multiple sources
 */
export const bootstrapNewPool = async (
  config: BootstrapConfig,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{
  success: boolean;
  liquidityAdded: { assetA: number; assetB: number };
  sourcesUsed: string[];
  message: string;
}> => {
  try {
    console.log('🚀 Bootstrapping new liquidity pool...');
    console.log(`Target liquidity: $${config.targetLiquidityUSD}`);

    // 1. Discover available liquidity sources
    const sources = await discoverLiquiditySources(config.assetA, config.assetB, network);
    
    if (sources.length === 0) {
      console.log('⚠️  No existing liquidity sources found');
      return {
        success: false,
        liquidityAdded: { assetA: 0, assetB: 0 },
        sourcesUsed: [],
        message: 'No liquidity sources available for bootstrapping'
      };
    }

    // 2. Calculate optimal liquidity to pull from each source
    const totalAvailableLiquidity = sources.reduce((sum, s) => sum + s.tvl, 0);
    console.log(`📊 Total available liquidity: $${totalAvailableLiquidity.toFixed(2)}`);

    if (totalAvailableLiquidity < config.targetLiquidityUSD) {
      console.log('⚠️  Insufficient liquidity available');
      return {
        success: false,
        liquidityAdded: { assetA: 0, assetB: 0 },
        sourcesUsed: [],
        message: `Insufficient liquidity. Available: $${totalAvailableLiquidity.toFixed(2)}, Required: $${config.targetLiquidityUSD}`
      };
    }

    // 3. Distribute target liquidity across sources proportionally
    const liquidityToAdd = { assetA: 0, assetB: 0 };
    const sourcesUsed: string[] = [];

    for (const source of sources) {
      const proportion = Math.min(source.tvl / totalAvailableLiquidity, 1);
      const amountFromSource = config.targetLiquidityUSD * proportion * 0.5; // Use 50% of available

      liquidityToAdd.assetA += amountFromSource / source.price;
      liquidityToAdd.assetB += amountFromSource;
      sourcesUsed.push(source.poolId);

      console.log(`✅ Using ${(proportion * 100).toFixed(2)}% from pool ${source.poolId.substring(0, 8)}...`);
    }

    console.log('✅ Liquidity bootstrapping plan created');
    console.log(`   Asset A: ${liquidityToAdd.assetA.toFixed(7)}`);
    console.log(`   Asset B: ${liquidityToAdd.assetB.toFixed(7)}`);

    return {
      success: true,
      liquidityAdded,
      sourcesUsed,
      message: `Successfully planned bootstrap with $${config.targetLiquidityUSD} liquidity from ${sourcesUsed.length} sources`
    };

  } catch (error: any) {
    console.error('❌ Error bootstrapping pool:', error);
    return {
      success: false,
      liquidityAdded: { assetA: 0, assetB: 0 },
      sourcesUsed: [],
      message: 'Failed to bootstrap pool: ' + error.message
    };
  }
};

/**
 * Trigger initial liquidity provision for a new pool
 */
export const triggerInitialLiquidity = async (
  poolId: string,
  issuerAddress: string,
  assetACode: string,
  assetBCode: string,
  targetLiquidityUSD: number,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    console.log('💧 Triggering initial liquidity provision...');
    console.log(`Pool ID: ${poolId.substring(0, 16)}...`);

    // Create asset objects
    const assetA = assetACode === 'PLAT' 
      ? getPlatAsset(issuerAddress)
      : new StellarSDK.Asset(assetACode, issuerAddress);
    
    const assetB = assetBCode === 'XLM'
      ? getNativeAsset()
      : new StellarSDK.Asset(assetBCode, issuerAddress);

    // Bootstrap configuration
    const config: BootstrapConfig = {
      assetA,
      assetB,
      targetLiquidityUSD,
      maxSlippage: 1.0, // 1% max slippage
      sources: ['stellar_native'] // Can add more sources
    };

    // Execute bootstrap
    const result = await bootstrapNewPool(config, network);

    if (result.success) {
      console.log('✅ Initial liquidity provision successful');
      return {
        success: true,
        message: result.message,
        details: {
          liquidityAdded: result.liquidityAdded,
          sourcesUsed: result.sourcesUsed
        }
      };
    } else {
      console.log('⚠️  Initial liquidity provision skipped');
      return {
        success: false,
        message: result.message
      };
    }

  } catch (error: any) {
    console.error('❌ Error triggering initial liquidity:', error);
    return {
      success: false,
      message: 'Failed to trigger initial liquidity: ' + error.message
    };
  }
};

// ============================================
// PRICE FEED & ORACLE
// ============================================

/**
 * Get aggregated price from multiple sources
 */
export const getAggregatedPrice = async (
  assetA: StellarSDK.Asset,
  assetB: StellarSDK.Asset,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{
  price: number;
  sources: number;
  spread: number;
}> => {
  try {
    const sources = await discoverLiquiditySources(assetA, assetB, network);
    
    if (sources.length === 0) {
      return { price: 0, sources: 0, spread: 0 };
    }

    // Calculate weighted average price based on TVL
    const totalTVL = sources.reduce((sum, s) => sum + s.tvl, 0);
    const weightedPrice = sources.reduce((sum, s) => {
      const weight = s.tvl / totalTVL;
      return sum + (s.price * weight);
    }, 0);

    // Calculate price spread (max - min)
    const prices = sources.map(s => s.price);
    const spread = Math.max(...prices) - Math.min(...prices);

    return {
      price: weightedPrice,
      sources: sources.length,
      spread
    };

  } catch (error) {
    console.error('Error getting aggregated price:', error);
    return { price: 0, sources: 0, spread: 0 };
  }
};

/**
 * Check pool health metrics
 */
export const checkPoolHealth = (source: LiquiditySource): {
  healthy: boolean;
  issues: string[];
  score: number;
} => {
  const issues: string[] = [];
  let score = 100;

  // Check minimum TVL
  if (source.tvl < 1000) {
    issues.push('Low TVL (< $1,000)');
    score -= 30;
  }

  // Check reserve balance
  const ratio = source.reserveA / source.reserveB;
  if (ratio > 10 || ratio < 0.1) {
    issues.push('Imbalanced reserves');
    score -= 20;
  }

  // Check if pool has shares
  if (source.totalShares === 0) {
    issues.push('No liquidity providers');
    score -= 50;
  }

  return {
    healthy: score >= 50,
    issues,
    score: Math.max(0, score)
  };
};

/**
 * Monitor all pools for health
 */
export const monitorPoolsHealth = async (
  assetPairs: Array<{ assetA: StellarSDK.Asset; assetB: StellarSDK.Asset }>,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<Array<{ pair: string; health: any; sources: LiquiditySource[] }>> => {
  const results = [];

  for (const pair of assetPairs) {
    try {
      const sources = await discoverLiquiditySources(pair.assetA, pair.assetB, network);
      const healthChecks = sources.map(s => checkPoolHealth(s));
      
      results.push({
        pair: `${pair.assetA.getCode()}/${pair.assetB.getCode()}`,
        health: healthChecks,
        sources
      });
    } catch (error) {
      console.error(`Error monitoring ${pair.assetA.getCode()}/${pair.assetB.getCode()}:`, error);
    }
  }

  return results;
};

// Export all functions
export default {
  discoverLiquiditySources,
  findBestSource,
  calculateOptimalRoute,
  bootstrapNewPool,
  triggerInitialLiquidity,
  getAggregatedPrice,
  checkPoolHealth,
  monitorPoolsHealth
};