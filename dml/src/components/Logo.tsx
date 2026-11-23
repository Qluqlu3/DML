type Props = {
  height?: number;
};

export function Logo({ height = 36 }: Props) {
  const width = Math.round(height * (192 / 44));

  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 192 44'
      height={height}
      width={width}
      aria-label='DML'
      role='img'
    >
      {/* 抽象化したクレーン */}
      <rect x='3' y='34' width='12' height='3' rx='1' fill='white' />
      <rect x='7' y='12' width='3' height='22' fill='white' />
      <line x1='8.5' y1='13' x2='48' y2='9' stroke='white' strokeWidth='3' strokeLinecap='round' />
      <line
        x1='17'
        y1='13'
        x2='8.5'
        y2='25'
        stroke='white'
        strokeWidth='1.5'
        strokeLinecap='round'
        opacity='0.7'
      />

      {/* チェーンと鉄球 */}
      <line
        x1='48'
        y1='9'
        x2='49'
        y2='18'
        stroke='#f6851f'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <circle cx='49' cy='24' r='8' fill='#f6851f' />
      <circle cx='46' cy='21' r='2.2' fill='#fbd38d' opacity='0.5' />

      {/* 家の屋根 */}
      <polygon points='56,22 77,7 98,22 90,22 77,13 64,22' fill='white' />

      {/* 家本体。左壁を大きく欠損させて破壊を明確化 */}
      <path d='M 61 22 L 94 22 L 94 38 L 79 38 L 79 27 L 72 34 L 65 32 L 59 24 Z' fill='white' />

      {/* 壁の破壊穴 */}
      <path d='M 60 24 L 69 18 L 76 22 L 73 30 L 65 31 L 59 26 Z' fill='#1a365d' />

      {/* ドアと窓 */}
      <rect x='83' y='26' width='7' height='12' fill='#1a365d' />
      <rect x='84' y='15' width='5' height='5' fill='#1a365d' />

      {/* 飛び散る屋根と壁の破片 */}
      <polygon points='57,15 66,9 65,19' fill='white' opacity='0.95' />
      <polygon points='50,20 60,15 59,25' fill='white' opacity='0.9' />
      <polygon points='68,33 76,29 75,39' fill='white' opacity='0.8' />
      <polygon points='77,20 84,15 83,25' fill='white' opacity='0.7' />

      {/* 衝撃の火花と粉じん */}
      <line
        x1='53'
        y1='22'
        x2='60'
        y2='16'
        stroke='#fbd38d'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <line
        x1='53'
        y1='24'
        x2='63'
        y2='24'
        stroke='#fbd38d'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <line
        x1='53'
        y1='27'
        x2='60'
        y2='32'
        stroke='#fbd38d'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <ellipse cx='53' cy='30' rx='6' ry='2.4' fill='white' opacity='0.22' />
      <ellipse cx='61' cy='35' rx='7' ry='3' fill='white' opacity='0.16' />

      {/* DML テキスト */}
      <text
        x='119'
        y='31'
        fontFamily="'Arial Black', Arial, sans-serif"
        fontWeight='900'
        fontSize='26'
        fill='#f6851f'
        letterSpacing='1'
      >
        DML
      </text>
    </svg>
  );
}
