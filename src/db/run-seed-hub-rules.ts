/**
 * 单独执行：pnpm db:seed:hub-rules
 */
import { seedTenderCenterHubRulesFromContract } from './seed-hub-rules';

void seedTenderCenterHubRulesFromContract()
  .then(() => {
    console.log('hub rules seed done');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
