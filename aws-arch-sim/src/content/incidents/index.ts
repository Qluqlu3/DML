import type { Incident } from '../../incidents/types';
import { i1 } from './i1-sale-503';
import { i2 } from './i2-az-outage';
import { i3 } from './i3-no-egress';
import { i4 } from './i4-sg-deploy';
import { i5 } from './i5-slow-reads';

export const INCIDENTS: Incident[] = [i1, i2, i3, i4, i5];
