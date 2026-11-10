import { execSync } from "node:child_process";

const isProduction = process.env.VERCEL_ENV === "production";
const env = { ...process.env };

if (!env.DATABASE_URL) {
  if (isProduction) {
    console.error("Falta DATABASE_URL en el entorno Production de Vercel.");
    process.exit(1);
  }
  env.DATABASE_URL = "postgresql://preview:preview@localhost:5432/preview";
}

const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

run("npx prisma generate");
if (isProduction) {
  run("npx prisma migrate deploy");
  run("npx prisma db seed");
} else {
  console.log(`Entorno ${process.env.VERCEL_ENV ?? "local"}: se omiten migraciones y seed.`);
}
run("npx next build");
