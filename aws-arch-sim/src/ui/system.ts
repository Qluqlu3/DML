import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

/**
 * Chakra UI のテーマ。色は global.css のトークン（CSS Modules 側でも使う）と同じ値にそろえる。
 * アプリは常にダークなので、明暗の切り替えは持たない（index.html の html に class="dark"）。
 */
const fixed = (value: string) => ({ value });

const config = defineConfig({
  // 既存の global.css でリセット済みなので、Chakra のリセットは使わない（CSS Modules との衝突を避ける）
  preflight: false,
  theme: {
    tokens: {
      fonts: {
        body: fixed('system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif'),
        heading: fixed('system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif'),
      },
      colors: {
        // AWS のオレンジを中心にした配色（colorPalette='aws' で使う）
        aws: {
          50: fixed('#fff6e5'),
          100: fixed('#ffe7bf'),
          200: fixed('#ffd08a'),
          300: fixed('#ffb84d'),
          400: fixed('#ffa31f'),
          500: fixed('#ff9900'),
          600: fixed('#e07f00'),
          700: fixed('#b36400'),
          800: fixed('#804700'),
          900: fixed('#4d2b00'),
          950: fixed('#2b1800'),
        },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: fixed('#0f141b'),
          subtle: fixed('#141b24'),
          panel: fixed('#18202b'),
          muted: fixed('#212b38'),
          emphasized: fixed('#263141'),
          error: fixed('rgb(255 107 90 / 14%)'),
          warning: fixed('rgb(245 184 48 / 14%)'),
          success: fixed('rgb(111 211 111 / 13%)'),
          info: fixed('rgb(78 163 255 / 14%)'),
        },
        fg: {
          DEFAULT: fixed('#e6ebf1'),
          muted: fixed('#9aa7b8'),
          subtle: fixed('#7a8697'),
          error: fixed('#ff6b5a'),
          warning: fixed('#f5b830'),
          success: fixed('#6fd36f'),
          info: fixed('#4ea3ff'),
        },
        border: {
          DEFAULT: fixed('#344051'),
          muted: fixed('#2a3443'),
          subtle: fixed('#222b37'),
          emphasized: fixed('#465469'),
        },
        aws: {
          solid: fixed('{colors.aws.500}'),
          contrast: fixed('#1a1f26'),
          fg: fixed('{colors.aws.300}'),
          muted: fixed('rgb(255 153 0 / 25%)'),
          subtle: fixed('rgb(255 153 0 / 12%)'),
          emphasized: fixed('rgb(255 153 0 / 35%)'),
          focusRing: fixed('{colors.aws.400}'),
          border: fixed('rgb(255 153 0 / 45%)'),
        },
      },
    },
  },
  globalCss: {
    // ボタンなどの既定の配色を AWS のオレンジにする
    html: { colorPalette: 'aws' },
  },
});

export const system = createSystem(defaultConfig, config);
