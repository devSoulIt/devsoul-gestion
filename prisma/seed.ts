import "dotenv/config";
import bcrypt from "bcryptjs";
import { AccountProvider, Currency, PrismaClient, Role, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();

const PARTNERS = [
  { name: "Marce", email: "garridomarcex@gmail.com", role: Role.OWNER, passwordEnv: "SEED_PASSWORD_MARCE" },
  { name: "Lautaro", email: "lautarooyt837@gmail.com", role: Role.OWNER, passwordEnv: "SEED_PASSWORD_LAUTARO" },
];

const CATEGORIES: Record<"INCOME" | "EXPENSE", string[]> = {
  INCOME: ["Factura cobrada", "Rendimientos", "Otros ingresos"],
  EXPENSE: [
    "Sueldos",
    "Infraestructura",
    "Impuestos",
    "Herramientas/SaaS",
    "Suscripciones IA",
    "Comisiones bancarias",
    "Marketing",
    "Servicios",
    "Gasto no registrado",
    "Otros egresos",
  ],
};

const ACCOUNTS = [{ name: "Ualá ARS", provider: AccountProvider.UALA, currency: Currency.ARS, earnsYield: true }];

async function seedUsers() {
  for (const partner of PARTNERS) {
    const existing = await prisma.user.findUnique({ where: { email: partner.email } });

    if (existing) {
      await prisma.user.update({
        where: { email: partner.email },
        data: { name: partner.name, role: partner.role },
      });
      console.log(`✔ Usuario existente actualizado: ${partner.email}`);
      continue;
    }

    const password = process.env[partner.passwordEnv];
    if (!password || password.length < 8) {
      throw new Error(`Falta ${partner.passwordEnv} (mínimo 8 caracteres) para crear ${partner.email}`);
    }

    await prisma.user.create({
      data: {
        name: partner.name,
        email: partner.email,
        role: partner.role,
        password: await bcrypt.hash(password, 12),
      },
    });
    console.log(`✔ Usuario creado: ${partner.email}`);
  }
}

async function seedCategories() {
  for (const [type, names] of Object.entries(CATEGORIES) as [TransactionType, string[]][]) {
    for (const name of names) {
      await prisma.transactionCategory.upsert({
        where: { name_type: { name, type } },
        create: { name, type },
        update: {},
      });
    }
  }
  console.log("✔ Categorías de movimientos");
}

async function seedAccounts() {
  for (const account of ACCOUNTS) {
    await prisma.financialAccount.upsert({
      where: { name: account.name },
      create: { ...account, openingBalance: 0, openingDate: new Date() },
      update: {},
    });
  }
  console.log("✔ Cuentas financieras");
}

async function seedDefaultSplit() {
  const existing = await prisma.splitShare.count({ where: { contractId: null } });
  if (existing > 0) return;

  const users = await prisma.user.findMany({
    where: { email: { in: PARTNERS.map((p) => p.email) } },
    select: { id: true, email: true },
  });
  if (users.length !== PARTNERS.length) return;

  const byEmail = new Map(users.map((u) => [u.email, u.id]));
  await prisma.splitShare.createMany({
    data: [
      ...PARTNERS.map((p) => ({ contractId: null, userId: byEmail.get(p.email)!, percent: 33.33 })),
      { contractId: null, userId: null, percent: 33.34 },
    ],
  });
  console.log("✔ Reparto por defecto (33,33% / 33,33% / 33,34%)");
}

async function main() {
  await seedCategories();
  await seedAccounts();
  await seedUsers();
  await seedDefaultSplit();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
