import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'data', 'strategy-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const fail = message => {
  throw new Error(`Strategy registry validation failed: ${message}`);
};

if (!/^\d{4}-\d{2}-\d{2}$/.test(registry.as_of || '')) fail('as_of must be an ISO date');
if (!registry.policy || registry.policy.strong_buy_score < 80) fail('Strong Buy threshold must be at least 80');
if (registry.policy.minimum_strategy_votes < 3) fail('Strong Buy must require at least three strategy votes');
if (registry.policy.maximum_drawdown_pct > 15) fail('maximum drawdown policy exceeds the user risk limit');
if (!registry.policy.requires_out_of_sample) fail('out-of-sample validation must be mandatory');
if (!Array.isArray(registry.strategies) || registry.strategies.length < 4) fail('strategy coverage is incomplete');
if (!Array.isArray(registry.candidates) || registry.candidates.length !== 10) fail('candidate list must contain exactly ten entries');

const strategyIds = new Set();
for (const strategy of registry.strategies) {
  if (!strategy.id || strategyIds.has(strategy.id)) fail(`duplicate or missing strategy id: ${strategy.id || 'unknown'}`);
  strategyIds.add(strategy.id);
  if (!/^https:\/\/github\.com\//.test(strategy.source_url || '')) fail(`${strategy.id} must link to a GitHub source`);
  if (!Array.isArray(strategy.rules) || strategy.rules.length < 4) fail(`${strategy.id} needs at least four auditable rules`);
}

const candidateIds = new Set();
for (const candidate of registry.candidates) {
  if (!candidate.symbol || candidateIds.has(candidate.symbol)) fail(`duplicate or missing candidate: ${candidate.symbol || 'unknown'}`);
  candidateIds.add(candidate.symbol);
  if (!Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 100) fail(`${candidate.symbol} has an invalid score`);
  if (candidate.score >= registry.policy.strong_buy_score && candidate.votes >= registry.policy.minimum_strategy_votes && !candidate.veto) {
    fail(`${candidate.symbol} may not receive Strong Buy without a documented veto review`);
  }
  if (!candidate.veto) fail(`${candidate.symbol} must disclose its current veto or missing evidence`);
}

const verified = registry.strategies.filter(strategy => strategy.verified).length;
if (verified !== registry.policy.verified_alpha_count) fail('verified alpha count does not match strategy records');

console.log(`Strategy registry valid: ${registry.strategies.length} strategies, ${registry.candidates.length} candidates, ${verified} verified alpha.`);
