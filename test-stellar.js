// Test Stellar Configuration
const StellarSdk = require('stellar-sdk');
require('dotenv').config({ path: '.env.local' });

const ISSUER_SECRET = process.env.STELLAR_ISSUER_SECRET;

async function testStellar() {
  console.log('🔍 Testing Stellar Configuration...\n');

  // Check if secret exists
  if (!ISSUER_SECRET) {
    console.error('❌ STELLAR_ISSUER_SECRET not found in .env.local');
    return;
  }

  console.log('✅ STELLAR_ISSUER_SECRET found');
  console.log('   Length:', ISSUER_SECRET.length, 'characters');
  console.log('   Starts with:', ISSUER_SECRET.substring(0, 1));

  // Try to create keypair
  let issuerKeypair;
  try {
    issuerKeypair = StellarSdk.Keypair.fromSecret(ISSUER_SECRET);
    console.log('✅ Valid Stellar secret key\n');
    console.log('📍 Issuer Public Key:', issuerKeypair.publicKey());
  } catch (error) {
    console.error('❌ Invalid Stellar secret key:', error.message);
    return;
  }

  // Check account on testnet
  const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
  
  try {
    console.log('\n🔍 Checking account on Stellar Testnet...');
    const account = await server.loadAccount(issuerKeypair.publicKey());
    
    console.log('✅ Account exists on testnet\n');
    console.log('📊 Account Balances:');
    account.balances.forEach((balance) => {
      if (balance.asset_type === 'native') {
        console.log(`   XLM: ${balance.balance}`);
      } else {
        console.log(`   ${balance.asset_code}: ${balance.balance}`);
      }
    });
    
    // Check if account has enough XLM for fees
    const xlmBalance = parseFloat(account.balances.find(b => b.asset_type === 'native').balance);
    if (xlmBalance < 10) {
      console.warn('\n⚠️  WARNING: Low XLM balance. Need at least 10 XLM for transactions.');
      console.log('   Fund account at: https://friendbot.stellar.org/?addr=' + issuerKeypair.publicKey());
    } else {
      console.log('\n✅ Sufficient XLM balance for transactions');
    }

  } catch (error) {
    console.error('\n❌ Account not found on testnet');
    console.error('   Error:', error.message);
    console.log('\n💡 Create and fund account at:');
    console.log('   https://friendbot.stellar.org/?addr=' + issuerKeypair.publicKey());
    return;
  }

  // Try a test transaction
  console.log('\n🧪 Testing token minting capability...');
  
  const testRecipient = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR'; // Test account
  
  try {
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
    const platAsset = new StellarSdk.Asset('PLAT', issuerKeypair.publicKey());
    
    const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: testRecipient,
          asset: platAsset,
          amount: '1',
        })
      )
      .addMemo(StellarSdk.Memo.text('TEST'))
      .setTimeout(30)
      .build();
    
    transaction.sign(issuerKeypair);
    
    console.log('✅ Transaction built and signed successfully');
    console.log('   Transaction XDR created (not submitted)');
    console.log('\n✅ ALL CHECKS PASSED - Stellar configuration is correct!\n');
    
  } catch (error) {
    console.error('❌ Failed to build test transaction:', error.message);
  }
}

testStellar().catch(console.error);