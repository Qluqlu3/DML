import { describe, expect, it } from 'vitest';
import { CHALLENGES, modelDoc } from '../../challenges/challenges';
import { c1 } from '../../content/challenges/c1-web3tier';
import {
  ALB,
  ASG,
  PRI,
  PUB,
  pri,
  pub,
  RDS,
  USER,
  VPC,
  webBase,
} from '../../content/courses/shared';
import { type AnswerOp, applyAnswer } from '../answers';
import { buildModel } from '../model';
import { lint } from './linter';

const rulesOf = (ops: AnswerOp[]) => {
  const { doc, errors } = applyAnswer(webBase(), ops, (p) => `${p}-${Math.random()}`);
  expect(errors).toEqual([]);
  return lint(buildModel(doc)).map((i) => i.rule);
};

describe('Linter', () => {
  it('空の構成・模範的な構成では警告を出さない', () => {
    expect(rulesOf([])).toEqual([]);
    expect(lint(buildModel(modelDoc(c1))).filter((i) => i.severity === 'warning')).toEqual([]);
    for (const c of CHALLENGES) {
      const warnings = lint(buildModel(modelDoc(c))).filter((i) => i.severity === 'warning');
      expect(
        warnings.map((w) => w.title),
        c.id,
      ).toEqual([]);
    }
  });

  it('DB が Public サブネット・Multi-AZ なし・インターネットに開放', () => {
    const rules = rulesOf([
      { op: 'add', kind: 'rds', in: pub('first'), name: 'DB' },
      { op: 'createSg', for: RDS, name: 'db-sg' },
      { op: 'allow', to: RDS, from: { cidr: '0.0.0.0/0' }, port: 3306 },
    ]);
    expect(rules).toEqual(expect.arrayContaining(['data-public', 'rds-single-az', 'data-open']));
  });

  it('ALB とアプリが 1 AZ だけ、配置サブネットなし', () => {
    expect(
      rulesOf([
        { op: 'add', kind: 'alb', in: VPC, name: 'ALB' },
        { op: 'attachSubnets', target: ALB, subnets: pub('first') },
        { op: 'add', kind: 'asg', in: VPC, name: 'アプリ' },
        { op: 'attachSubnets', target: ASG, subnets: pri('first') },
      ]),
    ).toEqual(expect.arrayContaining(['lb-single-az', 'compute-single-az']));
    expect(rulesOf([{ op: 'add', kind: 'alb', in: VPC, name: 'ALB' }])).toContain('no-subnets');
  });

  it('Private サブネットから外部サービスへの経路がない', () => {
    const ops: AnswerOp[] = [
      { op: 'add', kind: 'asg', in: VPC, name: 'アプリ' },
      { op: 'attachSubnets', target: ASG, subnets: PRI },
      { op: 'add', kind: 'external', name: '決済' },
      { op: 'connect', from: ASG, to: { kind: 'external' } },
    ];
    expect(rulesOf(ops)).toContain('no-egress');
    expect(
      rulesOf([
        ...ops,
        { op: 'add', kind: 'natgw', in: pub('first'), name: 'NAT' },
        { op: 'route', subnets: PRI, to: { kind: 'natgw' } },
      ]),
    ).not.toContain('no-egress');
  });

  it('S3 の公開・OAC なし・DLQ なし・SSH 全開放', () => {
    const rules = rulesOf([
      { op: 'add', kind: 's3', name: 'S3', config: { blockPublicAccess: false } },
      { op: 'add', kind: 'cloudfront', name: 'CDN' },
      { op: 'connect', from: { kind: 'cloudfront' }, to: { kind: 's3' } },
      { op: 'add', kind: 'sqs', name: 'Q' },
      { op: 'add', kind: 'ec2', in: pub('first'), name: 'Web' },
      { op: 'createSg', for: { kind: 'ec2' }, name: 'web-sg' },
      { op: 'allow', to: { kind: 'ec2' }, from: { cidr: '0.0.0.0/0' }, port: 22 },
      { op: 'connect', from: USER, to: { kind: 'ec2' } },
    ]);
    expect(rules).toEqual(
      expect.arrayContaining(['s3-public', 'cf-no-oac', 'sqs-no-dlq', 'ssh-open']),
    );
  });

  it('警告が先、情報が後', () => {
    const issues = lint(
      buildModel(
        applyAnswer(
          webBase(),
          [
            { op: 'add', kind: 'sqs', name: 'Q' },
            { op: 'add', kind: 'rds', in: pri('first'), name: 'DB' },
            { op: 'add', kind: 'alb', in: VPC, name: 'ALB' },
            { op: 'attachSubnets', target: ALB, subnets: PUB },
          ],
          (p) => `${p}-x${Math.random()}`,
        ).doc,
      ),
    );
    expect(issues.map((i) => i.severity)).toEqual(['warning', 'info']);
  });
});
