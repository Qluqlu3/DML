import { Badge, Slider as ChakraSlider, Field, HStack, Tabs, Tag, Text } from '@chakra-ui/react';
import { useState } from 'react';
import type { LintIssue } from '../engine/rules/linter';
import type { SimResult, TrafficProfile } from '../engine/simulator/types';
import { NodeView, Overview, type SelectedNode } from '../incidents/IncidentPanel';
import base from '../learning/GuidePanel.module.css';
import { CollapseButton, SecondaryButton } from '../ui/buttons';
import { SelectInput } from '../ui/forms';
import styles from './SandboxPanel.module.css';

export type SandboxTab = 'check' | 'simulate';

export type SimSettings = {
  traffic: TrafficProfile;
  /** 止める AZ の名前（空なら障害なし） */
  azDown: string;
  /** 止めるノード */
  failed: { id: string; name: string }[];
};

export const DEFAULT_SIM: SimSettings = {
  traffic: { rps: 200, readRatio: 0.8, cacheableRatio: 0.5 },
  azDown: '',
  failed: [],
};

type SandboxPanelProps = {
  tab: SandboxTab;
  onTab: (tab: SandboxTab) => void;
  issues: LintIssue[];
  focusedIssue: string | null;
  onFocusIssue: (id: string | null) => void;
  settings: SimSettings;
  onSettings: (s: SimSettings) => void;
  azNames: string[];
  sim: SimResult | null;
  selected: SelectedNode | null;
};

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <ChakraSlider.Root
      size='sm'
      colorPalette='aws'
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={(e) => onChange(e.value[0] ?? value)}
    >
      <HStack justify='space-between'>
        <ChakraSlider.Label fontSize='xs' fontWeight='normal'>
          {label}
        </ChakraSlider.Label>
        <Text fontSize='xs' fontWeight='bold'>
          {format(value)}
        </Text>
      </HStack>
      <ChakraSlider.Control>
        <ChakraSlider.Track>
          <ChakraSlider.Range />
        </ChakraSlider.Track>
        <ChakraSlider.Thumbs />
      </ChakraSlider.Control>
    </ChakraSlider.Root>
  );
}

function CheckTab({ issues, focusedIssue, onFocusIssue }: SandboxPanelProps) {
  if (!issues.length) {
    return (
      <p className={styles.empty}>
        ベストプラクティスの観点で気になる点はありません。構成を作ると、ここに注意点が出ます。
      </p>
    );
  }
  return (
    <ul className={styles.issues}>
      {issues.map((issue) => {
        const open = focusedIssue === issue.id;
        return (
          <li key={issue.id}>
            <button
              type='button'
              className={`${styles.issue} ${open ? styles.issueOpen : ''}`}
              onClick={() => onFocusIssue(open ? null : issue.id)}
              aria-expanded={open}
            >
              <span
                className={issue.severity === 'warning' ? styles.warning : styles.info}
                role='img'
                aria-label={issue.severity === 'warning' ? '警告' : '情報'}
              >
                {issue.severity === 'warning' ? '!' : 'i'}
              </span>
              <span>
                {issue.title}
                {open && <span className={styles.detail}>{issue.detail}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SimulateTab({ settings, onSettings, azNames, sim, selected }: SandboxPanelProps) {
  const { traffic } = settings;
  const setTraffic = (patch: Partial<TrafficProfile>) =>
    onSettings({ ...settings, traffic: { ...traffic, ...patch } });
  const canFail = selected && !settings.failed.some((f) => f.id === selected.id);
  return (
    <>
      <div className={styles.controls}>
        <Slider
          label='リクエスト'
          value={traffic.rps}
          min={10}
          max={5000}
          step={10}
          format={(v) => `${v.toLocaleString()}/秒`}
          onChange={(rps) => setTraffic({ rps })}
        />
        <Slider
          label='読み取りの比率'
          value={traffic.readRatio}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(readRatio) => setTraffic({ readRatio })}
        />
        <Slider
          label='キャッシュできる比率'
          value={traffic.cacheableRatio}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(cacheableRatio) => setTraffic({ cacheableRatio })}
        />
        <Field.Root>
          <Field.Label fontSize='xs' fontWeight='normal'>
            AZ 障害
          </Field.Label>
          <SelectInput
            value={settings.azDown}
            onChange={(azDown) => onSettings({ ...settings, azDown })}
            options={[
              { value: '', label: 'なし' },
              ...azNames.map((az) => ({ value: az, label: `${az} を停止` })),
            ]}
          />
        </Field.Root>
        <div className={styles.failed}>
          <span>停止中のノード</span>
          {settings.failed.map((f) => (
            <Tag.Root key={f.id} size='md' variant='solid' colorPalette='gray'>
              <Tag.Label>{f.name}</Tag.Label>
              <Tag.EndElement>
                <Tag.CloseTrigger
                  aria-label={`${f.name} を復旧`}
                  onClick={() =>
                    onSettings({
                      ...settings,
                      failed: settings.failed.filter((x) => x.id !== f.id),
                    })
                  }
                />
              </Tag.EndElement>
            </Tag.Root>
          ))}
          {canFail && (
            <SecondaryButton
              onClick={() =>
                onSettings({
                  ...settings,
                  failed: [...settings.failed, { id: selected.id, name: selected.name }],
                })
              }
            >
              「{selected.name}」を停止
            </SecondaryButton>
          )}
          {!settings.failed.length && !canFail && (
            <span className={styles.hint}>ノードを選ぶと停止させられます</span>
          )}
        </div>
      </div>
      {sim && sim.rps > 0 ? (
        <>
          <Overview sim={sim} />
          <NodeView selected={selected} />
        </>
      ) : (
        <p className={styles.empty}>
          キャンバスに「ユーザー」を置いて接続すると、そこからリクエストを流して計算します。
        </p>
      )}
      <p className={styles.note}>数値は学習用の目安で、実際の AWS の性能とは一致しません。</p>
    </>
  );
}

/** サンドボックスの左上パネル: Linter とシミュレーション */
export function SandboxPanel(props: SandboxPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const warnings = props.issues.filter((i) => i.severity === 'warning').length;
  return (
    <section
      className={`${base.panel} ${styles.panel} ${collapsed ? base.collapsed : ''}`}
      aria-label='チェックとシミュレーション'
    >
      <header className={base.panelHeader}>
        <Tabs.Root
          flex='1'
          size='sm'
          variant='subtle'
          colorPalette='gray'
          value={props.tab}
          onValueChange={(e) => {
            props.onTab(e.value as SandboxTab);
            setCollapsed(false);
          }}
        >
          <Tabs.List border='none'>
            <Tabs.Trigger value='check' fontSize='xs' fontWeight='bold'>
              チェック
              {props.issues.length > 0 && (
                <Badge size='xs' variant='solid' colorPalette={warnings ? 'aws' : 'gray'}>
                  {props.issues.length}
                </Badge>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value='simulate' fontSize='xs' fontWeight='bold'>
              シミュレーション
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <CollapseButton onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
          {collapsed ? '開く' : 'たたむ'}
        </CollapseButton>
      </header>
      {!collapsed && (
        <div className={base.body}>
          {props.tab === 'check' ? <CheckTab {...props} /> : <SimulateTab {...props} />}
        </div>
      )}
    </section>
  );
}
