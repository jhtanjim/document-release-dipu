/**
 * Makes ADMIN_EMAIL the one super admin with ADMIN_PASSWORD (creating the account if needed).
 * Any other super admin is turned into a normal admin, so there is always exactly one.
 * Run with: npm run admin:reset
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
  if (password.length < 8)
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { role: 'SUPER_ADMIN', NOT: { email } },
      data: { role: 'ADMIN' },
    });
    return tx.user.upsert({
      where: { email },
      update: { passwordHash, role: 'SUPER_ADMIN', active: true },
      create: {
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        name: process.env.ADMIN_NAME || 'Super Admin',
      },
    });
  });
  console.log(
    `Super admin ready: ${user.email} — log in with the password from .env`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
