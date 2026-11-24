import type { Challenge } from '../../challenges/types';
import { c1 } from './c1-web3tier';
import { c2 } from './c2-static-site';
import { c3 } from './c3-serverless-api';
import { c4 } from './c4-fanout';
import { c5 } from './c5-read-heavy';

/** 一覧に出す順（難易度順ではなく、学習モードのコース順に近い並び） */
export const CHALLENGES: Challenge[] = [c2, c3, c1, c4, c5];
