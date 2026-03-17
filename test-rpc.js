import { Connection } from '@solana/web3.js';

async function testRPC() {
  const rpc = 'https://beta.helius-rpc.com/?api-key=251ce93e-be5b-4d6e-9c96-a9805fae66de';
  const connection = new Connection(rpc);
  
  try {
    console.log(`Testing RPC: ${rpc}`);
    const slot = await connection.getSlot();
    console.log(`Successfully connected! Current slot: ${slot}`);
  } catch (err) {
    console.error(`RPC Connection FAILED: ${err.message}`);
  }
}

testRPC();
