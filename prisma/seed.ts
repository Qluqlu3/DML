/**
 * prisma/seed.ts
 * data/processed/kaitai_companies.json から Company を一括投入する
 *
 * 実行:
 *   npx prisma db seed
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface RawCompany {
  corporate_number: string;
  name: string;
  furigana: string;
  prefecture_name: string;
  city_name: string;
  street_number: string;
  post_code: string;
  address_full: string;
  sources: string;
}

async function main() {
  const jsonPath = resolve(__dirname, '../data/processed/kaitai_companies.json');
  const raw: RawCompany[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  console.log(`Seeding ${raw.length} companies...`);

  // 既存データは upsert で更新
  let inserted = 0;
  let updated = 0;

  for (const c of raw) {
    const data = {
      name: c.name,
      furigana: c.furigana || null,
      prefectureName: c.prefecture_name || null,
      cityName: c.city_name || null,
      streetNumber: c.street_number || null,
      postCode: c.post_code || null,
      addressFull: c.address_full || null,
      sources: c.sources || null,
    };

    if (c.corporate_number) {
      const result = await prisma.company.upsert({
        where: { corporateNumber: c.corporate_number },
        create: { corporateNumber: c.corporate_number, ...data },
        update: data,
      });
      // upsert は updated/created を区別しないので件数は近似
      inserted++;
    } else {
      // 法人番号なし → name + prefecture で重複チェックして insertOrSkip
      const existing = await prisma.company.findFirst({
        where: { name: c.name, prefectureName: c.prefecture_name || null },
      });
      if (!existing) {
        await prisma.company.create({ data });
        inserted++;
      } else {
        updated++;
      }
    }

    if ((inserted + updated) % 100 === 0) {
      process.stdout.write(`\r  ${inserted + updated} / ${raw.length} processed`);
    }
  }

  console.log(`\nDone. inserted/updated=${inserted}, skipped=${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
