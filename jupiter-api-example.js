
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import fetch from 'cross-fetch';
import { Wallet } from '@project-serum/anchor';
import bs58 from 'bs58';

// It is recommended that you use your own RPC endpoint.
const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=REPLACE_WITH_YOUR_KEY');

// Create a Solana wallet from a private key (for demo purposes)
// In production, you'd use a real wallet adapter
const createKeypairFromPrivateKey = (privateKey) => {
  return Keypair.fromSecretKey(bs58.decode(privateKey));
};

// WARNING: Never hardcode private keys in production code or share them!
// This is only for demonstration purposes. Use environment variables for safety.
const DEMO_WALLET = {
  privateKey: "REPLACE_WITH_YOUR_PRIVATE_KEY",
};

// Jupiter API routes
const JUPITER_QUOTE_API = "https://public.jupiterapi.com/quote";
const JUPITER_SWAP_API = "https://public.jupiterapi.com/swap";

/**
 * Get a swap quote from Jupiter
 */
async function getJupiterQuote(inputMint, outputMint, amount, slippageBps = 100) {
  try {
    const quoteUrl = `${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;

    console.log(`Getting Jupiter quote...`);
    const response = await fetch(quoteUrl);

    if (!response.ok) {
      throw new Error(`Error fetching Jupiter quote: ${response.status} ${response.statusText}`);
    }

    const quoteResponse = await response.json();
    console.log(`Quote received! Output amount: ${quoteResponse.outAmount}`);
    return quoteResponse;
  } catch (error) {
    console.log('Error getting Jupiter quote:', error.message || error);
    if (error.code) console.log('Error code:', error.code);
    return null;
  }
}

/**
 * Prepare a swap transaction with Jupiter
 */
async function prepareJupiterTransaction(quoteResponse, userPublicKey) {
  try {
    const swapRequestBody = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
    };

    console.log('Preparing Jupiter swap transaction...');
    const response = await fetch(JUPITER_SWAP_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(swapRequestBody)
    });

    if (!response.ok) {
      throw new Error(`Error preparing swap transaction: ${response.status} ${response.statusText}`);
    }

    const swapResponse = await response.json();
    const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    console.log('Transaction prepared successfully!');
    return transaction;
  } catch (error) {
    console.log('Error preparing Jupiter swap transaction:', error.message || error);
    return null;
  }
}

/**
 * Execute a swap using Jupiter
 */
async function executeJupiterSwap(inputMint, outputMint, amount, slippageBps = 100) {
  try {
    if (!DEMO_WALLET.privateKey) {
      console.log('No private key provided. This is a simulation only.');
      console.log('For actual swaps, you would need to add your private key to the DEMO_WALLET object.');

      // Let's simulate a quote without actually executing
      const quoteResponse = await getJupiterQuote(inputMint, outputMint, amount, slippageBps);

      if (quoteResponse) {
        console.log('=== SWAP SIMULATION ===');
        console.log(`Input: ${amount} (${inputMint})`);
        console.log(`Output: ${quoteResponse.outAmount} (${outputMint})`);
        console.log(`Price impact: ${quoteResponse.priceImpactPct || 'Unknown'}%`);
        console.log(`Route length: ${quoteResponse.routePlan?.length || 'Unknown'}`);
        console.log('========================');
      }

      return 'simulation-only';
    }

    // 1. Get keypair from private key
    const keypair = createKeypairFromPrivateKey(DEMO_WALLET.privateKey);
    const wallet = new Wallet(keypair);

    // 2. Get quote from Jupiter
    const quoteResponse = await getJupiterQuote(inputMint, outputMint, amount, slippageBps);
    if (!quoteResponse) {
      throw new Error('Failed to get quote from Jupiter');
    }

    // 3. Prepare transaction
    const transaction = await prepareJupiterTransaction(quoteResponse, wallet.publicKey.toString());
    if (!transaction) {
      throw new Error('Failed to prepare transaction');
    }

    // 4. Sign the transaction
    transaction.sign([keypair]);

    // 5. Send and confirm transaction
    console.log('Sending transaction...');
    const txid = await connection.sendTransaction(transaction, { skipPreflight: true });
    console.log(`Transaction sent! TxID: ${txid}`);

    console.log('Confirming transaction...');
    const confirmation = await connection.confirmTransaction(txid);
    console.log('Transaction confirmed!', confirmation);

    return txid;
  } catch (error) {
    console.log('Error executing Jupiter swap:', error.message || error);
    if (error.stack) console.log(error.stack);
    return null;
  }
}

// Example usage
async function runExample() {
  console.log('=== Jupiter API Example ===');

  // Define token parameters
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  // Swap 0.1 SOL to USDC with 0.5% slippage
  const inputMint = SOL_MINT;
  const outputMint = USDC_MINT;
  const amount = 5000000; // 0.005 SOL in lamports (SOL has 9 decimals)
  const slippageBps = 50; // 0.5%

  const result = await executeJupiterSwap(inputMint, outputMint, amount, slippageBps);

  if (result) {
    console.log('Example completed successfully!');
    if (result === 'simulation-only') {
      console.log('Note: This was only a simulation. Add a private key to perform actual swaps.');
    } else {
      console.log(`Transaction ID: ${result}`);
    }
  } else {
    console.log('Example failed. See error logs above.');
  }
}

// Run the example
runExample().then(() => {
  console.log('Script execution completed');
}).catch(error => {
  console.error('Unhandled error in script:', error);
});
