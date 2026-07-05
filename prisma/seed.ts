/**
 * prisma/seed.ts
 * data/processed/kaitai_companies.json から Company を一括投入する。
 * 開発環境でのみ実行可能（NODE_ENV=development）。
 *
 * 実行:
 *   pnpm db:seed
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';
import { PrismaClient, StructureType } from '../src/generated/prisma/client';

// ── 開発環境ガード ────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: seed は本番環境では実行できません。');
  process.exit(1);
}

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
  permit_type?: string;
  permit_number?: string;
  representative_name?: string;
  office_address?: string;
  capital_thousand_yen?: number;
  licensed_trades?: { trade: string; level: string }[];
  license_valid_from?: string;
  license_valid_until?: string;
}

// ── Company 投入（全環境共通） ────────────────────────────────
async function seedCompanies() {
  const jsonPath = resolve(__dirname, '../data/processed/kaitai_companies.json');
  const raw: RawCompany[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  console.log(`Seeding ${raw.length} companies...`);

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
      permitType: c.permit_type || null,
      permitNumber: c.permit_number || null,
      representativeName: c.representative_name || null,
      officeAddress: c.office_address || null,
      capitalThousandYen: c.capital_thousand_yen ?? null,
      licensedTrades: c.licensed_trades ?? undefined,
      licenseValidFrom: c.license_valid_from ? new Date(c.license_valid_from) : null,
      licenseValidUntil: c.license_valid_until ? new Date(c.license_valid_until) : null,
      sources: c.sources || null,
    };

    if (c.corporate_number) {
      await prisma.company.upsert({
        where: { corporateNumber: c.corporate_number },
        create: { corporateNumber: c.corporate_number, ...data },
        update: data,
      });
      inserted++;
    } else {
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

  console.log(`\nCompanies done. inserted/updated=${inserted}, skipped=${updated}`);
}

// ── 開発用ダミー口コミ ───────────────────────────────────────
// authorName の先頭に "[dev]" を付けて本番データと区別する。
// 実行のたびに既存の [dev] 口コミを削除してから再投入する。
const DEV_REVIEWS = [
  {
    priceRating: 5,
    serviceRating: 5,
    qualityRating: 5,
    structureType: StructureType.WOODEN,
    workYear: 2024,
    authorName: '[dev] 山田太郎',
  },
  {
    priceRating: 4,
    serviceRating: 4,
    qualityRating: 5,
    structureType: StructureType.RC,
    workYear: 2023,
    authorName: '[dev] 佐藤花子',
  },
  {
    priceRating: 3,
    serviceRating: 3,
    qualityRating: 3,
    structureType: StructureType.STEEL,
    workYear: 2022,
    authorName: '[dev] 匿名',
  },
  {
    priceRating: 3,
    serviceRating: 1,
    qualityRating: 2,
    structureType: StructureType.LIGHT_STEEL,
    workYear: 2021,
    authorName: '[dev] 鈴木一郎',
  },
  {
    priceRating: 1,
    serviceRating: 1,
    qualityRating: 1,
    structureType: StructureType.OTHER,
    workYear: 2020,
    authorName: '[dev] 高橋次郎',
  },
] as const;

async function seedDevReviews() {
  // 既存の [dev] 口コミを削除
  const deleted = await prisma.review.deleteMany({
    where: { authorName: { startsWith: '[dev]' } },
  });
  if (deleted.count > 0) {
    console.log(`Deleted ${deleted.count} existing [dev] reviews.`);
  }

  // 先頭5社にダミーレビューを投入
  const companies = await prisma.company.findMany({ take: 5 });
  if (companies.length === 0) {
    console.log('No companies found. Skipping review seed.');
    return;
  }

  let count = 0;
  for (const company of companies) {
    for (const review of DEV_REVIEWS) {
      await prisma.review.create({
        data: { companyId: company.id, isPublished: true, ...review },
      });
      count++;
    }
  }

  console.log(`Seeded ${count} dev reviews across ${companies.length} companies.`);
}

// ── エントリポイント ──────────────────────────────────────────
async function main() {
  await seedCompanies();
  await seedDevReviews();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
