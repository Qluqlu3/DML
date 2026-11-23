import { describe, expect, it } from 'vitest';
import { CONTAINERS, canConnect, defaultConfig, SERVICE_KINDS, SERVICES } from '.';

describe('catalog', () => {
  it('接続先はすべて定義済みのサービス', () => {
    for (const kind of SERVICE_KINDS) {
      for (const to of SERVICES[kind].canConnectTo) {
        expect(SERVICES[to], `${kind} → ${to}`).toBeDefined();
      }
    }
  });

  it('select の既定値は選択肢に含まれる', () => {
    const defs = [...Object.values(SERVICES), ...Object.values(CONTAINERS)];
    for (const def of defs) {
      for (const field of def.config) {
        if (field.type === 'select') {
          expect(
            field.options.map((o) => o.value),
            `${def.kind}.${field.key}`,
          ).toContain(field.default);
        }
      }
    }
  });

  it('設定キーはサービス内で重複しない', () => {
    for (const def of Object.values(SERVICES)) {
      const keys = def.config.map((f) => f.key);
      expect(new Set(keys).size, def.kind).toBe(keys.length);
    }
  });

  it('既定の設定値を作れる（配列は毎回別インスタンス）', () => {
    const a = defaultConfig('alb');
    const b = defaultConfig('alb');
    expect(a.subnetIds).toEqual([]);
    expect(a.subnetIds).not.toBe(b.subnetIds);
    expect(defaultConfig('subnet')).toMatchObject({ subnetType: 'public', route: 'none' });
  });

  it('接続可否', () => {
    expect(canConnect('alb', 'ec2')).toBe(true);
    expect(canConnect('s3', 'rds')).toBe(false);
    expect(canConnect('vpc', 'ec2')).toBe(false);
  });
});
