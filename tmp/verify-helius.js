
const API_KEY = '251ce93e-be5b-4d6e-9c96-a9805fae66de';
const RPC_URL = `https://beta.helius-rpc.com/?api-key=${API_KEY}`;
const SENDER_URL = 'https://sender.helius-rpc.com/fast';

async function testPriorityFee() {
    console.log('Testing Helius Priority Fee API...');
    try {
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'helius-test',
                method: 'getPriorityFeeEstimate',
                params: [{
                    options: { priorityLevel: 'Medium' }
                }]
            })
        });

        const json = await response.json();
        console.log('Priority Fee Result:', JSON.stringify(json, null, 2));
        if (json.result) {
            console.log('✅ Priority Fee API is working.');
        } else {
            console.log('❌ Priority Fee API failed.');
        }
    } catch (error) {
        console.error('Error in Priority Fee test:', error);
    }
}

async function testSenderPing() {
    console.log('\nTesting Helius Sender Ping...');
    try {
        const response = await fetch('https://sender.helius-rpc.com/ping');
        const text = await response.text();
        console.log('Sender Ping Result:', text);
        if (text === 'ok') {
            console.log('✅ Helius Sender is reachable.');
        } else {
            console.log('❌ Helius Sender ping failed.');
        }
    } catch (error) {
        console.error('Error in Sender ping test:', error);
    }
}

async function runTests() {
    await testPriorityFee();
    await testSenderPing();
}

runTests();
