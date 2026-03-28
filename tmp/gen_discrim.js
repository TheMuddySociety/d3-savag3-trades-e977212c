import crypto from 'crypto';

function getDiscriminator(name) {
  const hash = crypto.createHash('sha256').update(`global:${name}`).digest();
  return Array.from(hash).slice(0, 8);
}

const methods = [
  'initialize_delegation', 'update_limits', 'record_trade', 'deactivate', 'close_session',
  'initialize', 'collect_fee', 'update_fees', 'transfer_admin',
  'create_vault', 'deposit', 'withdraw', 'agent_spend', 'agent_return', 'toggle_lock', 'close_vault',
  'create_launch', 'buy', 'sell', 'cancel_launch'
];

methods.forEach(m => {
  const d = getDiscriminator(m);
  const hex = d.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ');
  console.log(`${m}: [${hex}]`);
});
