/**
 * Initialize Quotas Script
 *
 * Creates default quotas for all existing users
 * Run with: npx tsx scripts/initialize-quotas.ts
 */

import { PrismaClient } from '@prisma/client';
import { initializeUserQuotas } from '../src/lib/quota-calculator';

const db = new PrismaClient();

async function main() {
  console.log('🚀 Starting quota initialization...\n');

  try {
    // Get all users
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    console.log(`Found ${users.length} users\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Check if user already has quotas
        const existingQuotas = await db.usageQuota.count({
          where: { userId: user.id },
        });

        if (existingQuotas > 0) {
          console.log(`⏭️  Skipped ${user.email} - Already has ${existingQuotas} quotas`);
          skipCount++;
          continue;
        }

        // Initialize quotas for this user
        const quotasToCreate = initializeUserQuotas(user.role);

        await db.usageQuota.createMany({
          data: quotasToCreate.map((quota) => ({
            userId: user.id,
            ...quota,
          })),
        });

        console.log(`✅ Created ${quotasToCreate.length} quotas for ${user.email} (${user.role})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to create quotas for ${user.email}:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Successfully initialized: ${successCount} users`);
    console.log(`  ⏭️  Skipped (already initialized): ${skipCount} users`);
    console.log(`  ❌ Failed: ${errorCount} users`);
    console.log(`\n✨ Quota initialization completed!`);
  } catch (error) {
    console.error('Fatal error during initialization:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
