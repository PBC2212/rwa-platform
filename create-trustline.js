const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config({ path: '.env.local' });

const ISSUER_SECRET = process.env.NEXT_PUBLIC_STELLAR_ISSUER_SECRET;
const RECIPIENT_ADDRESS = 'GAXVSETFOPYKPDCPSQWOQHDJWHV2LPEJXNBQOUMQZJNPNSXZ6NEEU5VT';

async function createTrustline() {
  console.log('🔧 Creating PLAT trustline for recipient wallet...\n');

  if (!ISSUER_SECRET) {
    console.error('❌ STELLAR_ISSUER_SECRET not found');
    return;
  }

  const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
  const issuerKeypair = StellarSdk.Keypair.fromSecret(ISSUER_SECRET);
  const recipientKeypair = issuerKeypair; // Same wallet for testing

  console.log('Issuer:', issuerKeypair.publicKey());
  console.log('Recipient:', RECIPIENT_ADDRESS);

  try {
    // Check if account exists
    const account = await server.loadAccount(recipientKeypair.publicKey());
    console.log('✅ Account exists\n');

    // Check if trustline already exists
    const hasTrustline = account.balances.some(
      balance => balance.asset_code === 'PLAT' && balance.asset_issuer === issuerKeypair.publicKey()
    );

    if (hasTrustline) {
      console.log('✅ PLAT trustline already exists!');
      console.log('Current PLAT balance:', account.balances.find(b => b.asset_code === 'PLAT').balance);
      return;
    }

    console.log('⚠️ No PLAT trustline found. Creating trustline...\n');

    // Create PLAT asset
    const platAsset = new StellarSdk.Asset('PLAT', issuerKeypair.publicKey());

    // Build trustline transaction
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: platAsset,
        })
      )
      .setTimeout(300)
      .build();

    // Sign with recipient's key (same as issuer in this case)
    transaction.sign(recipientKeypair);

    // Submit transaction
    const result = await server.submitTransaction(transaction);

    console.log('✅ Trustline created successfully!');
    console.log('Transaction Hash:', result.hash);
    console.log('\nThe recipient can now receive PLAT tokens!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Details:', error.response.data);
    }
  }
}

createTrustline();