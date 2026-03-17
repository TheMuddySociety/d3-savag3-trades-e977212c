
import { Connection } from '@solana/web3.js';

async function testRpc() {
  const RPC_URL = "https://api.mainnet-beta.solana.com";
  console.log(`Testing RPC: ${RPC_URL}`);
  const connection = new Connection(RPC_URL);
  try {
    const { blockhash } = await connection.getLatestBlockhash();
    console.log(`Success! Blockhash: ${blockhash}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    if (e.response) {
      console.error(`Response: ${JSON.stringify(e.response)}`);
    }
  }
}

testRpc();
