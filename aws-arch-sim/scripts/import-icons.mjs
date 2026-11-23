// AWS Architecture Icons のアセットパッケージ（展開済みフォルダ）から、
// カタログで使うアイコンだけを public/icons/aws/ にコピーする。
//
//   pnpm import-icons <アセットパッケージのフォルダ>
//
// パッケージは更新のたびにフォルダ名に日付が付くため、ファイル名で検索する。
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/** 出力名 → パッケージ内のファイル名 */
const ICONS = {
  // サービス
  route53: 'Arch_Amazon-Route-53_64.svg',
  cloudfront: 'Arch_Amazon-CloudFront_64.svg',
  waf: 'Arch_AWS-WAF_64.svg',
  ec2: 'Arch_Amazon-EC2_64.svg',
  asg: 'Arch_Amazon-EC2-Auto-Scaling_64.svg',
  ecs: 'Arch_Amazon-Elastic-Container-Service_64.svg',
  lambda: 'Arch_AWS-Lambda_64.svg',
  apigw: 'Arch_Amazon-API-Gateway_64.svg',
  sqs: 'Arch_Amazon-Simple-Queue-Service_64.svg',
  sns: 'Arch_Amazon-Simple-Notification-Service_64.svg',
  eventbridge: 'Arch_Amazon-EventBridge_64.svg',
  rds: 'Arch_Amazon-RDS_64.svg',
  aurora: 'Arch_Amazon-Aurora_64.svg',
  dynamodb: 'Arch_Amazon-DynamoDB_64.svg',
  elasticache: 'Arch_Amazon-ElastiCache_64.svg',
  s3: 'Arch_Amazon-Simple-Storage-Service_64.svg',
  acm: 'Arch_AWS-Certificate-Manager_64.svg',
  cognito: 'Arch_Amazon-Cognito_64.svg',
  secrets: 'Arch_AWS-Secrets-Manager_64.svg',
  cloudwatch: 'Arch_Amazon-CloudWatch_64.svg',
  // リソース
  igw: 'Res_Amazon-VPC_Internet-Gateway_48.svg',
  natgw: 'Res_Amazon-VPC_NAT-Gateway_48.svg',
  vpce: 'Res_Amazon-VPC_Endpoints_48.svg',
  alb: 'Res_Elastic-Load-Balancing_Application-Load-Balancer_48.svg',
  nlb: 'Res_Elastic-Load-Balancing_Network-Load-Balancer_48.svg',
  client: 'Res_Users_48_Light.svg',
  external: 'Res_Internet_48_Light.svg',
  // グループ（VPC / サブネットの枠）
  'group-vpc': 'Virtual-private-cloud-VPC_32.svg',
  'group-public-subnet': 'Public-subnet_32.svg',
  'group-private-subnet': 'Private-subnet_32.svg',
  // 解説トピック（ノードではない概念）
  'topic-sg': 'Res_Firewall_48_Light.svg',
};

function indexFiles(dir, index = new Map()) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) indexFiles(path, index);
    else if (name.endsWith('.svg') && !index.has(name)) index.set(name, path);
  }
  return index;
}

const source = process.argv[2];
if (!source) {
  console.error('使い方: pnpm import-icons <アセットパッケージのフォルダ>');
  process.exit(1);
}

const index = indexFiles(resolve(source));
const outDir = resolve(import.meta.dirname, '../public/icons/aws');
mkdirSync(outDir, { recursive: true });

const missing = [];
for (const [name, file] of Object.entries(ICONS)) {
  const path = index.get(file);
  if (!path) {
    missing.push(`${name} (${file})`);
    continue;
  }
  copyFileSync(path, join(outDir, `${name}.svg`));
}

console.log(`${Object.keys(ICONS).length - missing.length} 件を ${outDir} にコピーしました`);
if (missing.length) {
  console.error(`見つからなかったアイコン:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`取り込み元: ${basename(resolve(source))}`);
