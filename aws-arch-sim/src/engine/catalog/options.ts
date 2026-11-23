const opts = (...values: string[]) => values.map((value) => ({ value, label: value }));

export const EC2_INSTANCE_TYPES = opts(
  't3.micro',
  't3.small',
  't3.medium',
  'm6i.large',
  'm6i.xlarge',
  'c6i.large',
  'c6i.xlarge',
  'c6i.2xlarge',
);

export const RDS_INSTANCE_CLASSES = opts(
  'db.t3.micro',
  'db.t3.medium',
  'db.m6g.large',
  'db.r6g.large',
  'db.r6g.xlarge',
  'db.r6g.2xlarge',
);

export const CACHE_NODE_TYPES = opts(
  'cache.t3.micro',
  'cache.t3.medium',
  'cache.m6g.large',
  'cache.r6g.large',
);

export const AZ_NAMES = opts('ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d');
