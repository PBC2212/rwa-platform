const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config({ path: '.env.local' });

const ISSUER_SECRET = process.env.NEXT_PUBLIC_STELLAR_ISSUER_SECRET;

async function setupRecipientWallet() {
  console.log('🔧 Setting up recipient wallet for PLAT tokens...\n');

  if (!ISSUER_SECRET) {
    console.error('❌ STELLAR_ISSUER_SECRET not found');
    return;
  }

  const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
  const issuerKeypair = StellarSdk.Keypair.fromSecret(ISSUER_SECRET);

  console.log('Step 1: Generate new recipient wallet');
  const recipientKeypair = StellarSdk.Keypair.random();
  
  console.log('\n✅ New Wallet Generated:');
  console.log('Public Key (Address):', recipientKeypair.publicKey());
  console.log('Secret Key:', recipientKeypair.secret());
  console.log('\n⚠️  SAVE THESE KEYS SECURELY!\n');

  try {
    console.log('Step 2: Fund recipient wallet with Friendbot...');
    const friendbotResponse = await fetch(
      `https://friendbot.stellar.org/?addr=${recipientKeypair.publicKey()}`
    );
    const friendbotResult = await friendbotResponse.json();
    
    if (!friendbotResponse.ok) {
      throw new Error('Friendbot funding failed');
    }
    
    console.log('✅ Wallet funded with 10,000 XLM\n');

    console.log('Step 3: Create PLAT trustline...');
    
    const recipientAccount = await server.loadAccount(recipientKeypair.publicKey());
    const platAsset = new StellarSdk.Asset('PLAT', issuerKeypair.publicKey());

    const trustlineTransaction = new StellarSdk.TransactionBuilder(recipientAccount, {
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

    trustlineTransaction.sign(recipientKeypair);

    const trustlineResult = await server.submitTransaction(trustlineTransaction);

    console.log('✅ PLAT trustline created!');
    console.log('Trustline Transaction Hash:', trustlineResult.hash);

    console.log('\n' + '='.repeat(60));
    console.log('✅ RECIPIENT WALLET READY TO RECEIVE PLAT TOKENS!');
    console.log('='.repeat(60));
    console.log('\nRecipient Public Key:');
    console.log(recipientKeypair.publicKey());
    console.log('\n📋 COPY THIS SQL TO UPDATE TEST USER:\n');
    console.log(`UPDATE profiles SET wallet_address = '${recipientKeypair.publicKey()}' WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@example.com');\n`);
    console.log('Run this SQL in Supabase SQL Editor, then sign out and sign in again.\n');

    console.log('🔍 Verify wallet:');
    console.log(`https://horizon-testnet.stellar.org/accounts/${recipientKeypair.publicKey()}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response && error.response.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

setupRecipientWallet();