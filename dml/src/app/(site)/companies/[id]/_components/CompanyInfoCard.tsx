import { Badge, Box, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import type { CompanyModel } from '@/generated/prisma/models/Company';
import { tradeLabel } from '@/lib/constructionTrades';

const SPECIFIC_PERMIT = '特定建設業';
const LINK_STYLE = { color: '#2b6cb0', fontSize: '0.875rem' } as const;

type LicensedTrade = { trade: string; level: string };

// licensedTrades は JSON カラムのため、想定外の形が入っていても描画が落ちないよう絞り込む
function parseLicensedTrades(value: CompanyModel['licensedTrades']): LicensedTrade[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is LicensedTrade =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).trade === 'string' &&
      typeof (item as Record<string, unknown>).level === 'string',
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Text color='gray.400' fontSize='xs' mb={0.5}>
        {label}
      </Text>
      {children}
    </Box>
  );
}

function formatDate(date: Date | null) {
  return date?.toLocaleDateString('ja-JP');
}

export function CompanyInfoCard({ company }: { company: CompanyModel }) {
  const licensedTrades = parseLicensedTrades(company.licensedTrades);

  return (
    <Box bg='white' p={6} borderRadius='lg' shadow='sm' borderWidth='1px' borderColor='gray.200'>
      <Heading size='sm' mb={4} color='gray.700'>
        基本情報
      </Heading>
      <VStack align='stretch' gap={3} fontSize='sm'>
        {company.permitType && (
          <InfoRow label='建設業許可種別'>
            <Badge
              colorPalette={company.permitType === SPECIFIC_PERMIT ? 'blue' : 'gray'}
              size='sm'
            >
              {company.permitType}
            </Badge>
          </InfoRow>
        )}
        {company.permitNumber && (
          <InfoRow label='許可番号'>
            <Text>{company.permitNumber}</Text>
          </InfoRow>
        )}
        {company.representativeName && (
          <InfoRow label='代表者'>
            <Text>{company.representativeName}</Text>
          </InfoRow>
        )}
        {company.addressFull && (
          <InfoRow label='住所'>
            <Text>{company.addressFull}</Text>
          </InfoRow>
        )}
        {company.officeAddress && (
          <InfoRow label='主たる営業所の所在地（許可情報）'>
            <Text>{company.officeAddress}</Text>
          </InfoRow>
        )}
        {company.capitalThousandYen != null && (
          <InfoRow label='資本金'>
            <Text>{(company.capitalThousandYen / 10).toLocaleString('ja-JP')}万円</Text>
          </InfoRow>
        )}
        {(company.licenseValidFrom || company.licenseValidUntil) && (
          <InfoRow label='許可の有効期間'>
            <Text fontSize='sm'>
              {formatDate(company.licenseValidFrom)} 〜 {formatDate(company.licenseValidUntil)}
            </Text>
          </InfoRow>
        )}
        {licensedTrades.length > 0 && (
          <Box>
            <Text color='gray.400' fontSize='xs' mb={1}>
              保有する建設業許可
            </Text>
            <HStack gap={1} flexWrap='wrap'>
              {licensedTrades.map(({ trade, level }) => (
                <Badge
                  key={trade}
                  colorPalette={level === SPECIFIC_PERMIT ? 'blue' : 'gray'}
                  variant='subtle'
                  size='sm'
                >
                  {tradeLabel(trade)}（{level === SPECIFIC_PERMIT ? '特定' : '一般'}）
                </Badge>
              ))}
            </HStack>
          </Box>
        )}
        {company.phoneNumber && (
          <InfoRow label='電話番号'>
            <a href={`tel:${company.phoneNumber}`} style={LINK_STYLE}>
              {company.phoneNumber}
            </a>
          </InfoRow>
        )}
        {company.postCode && (
          <InfoRow label='郵便番号'>
            <Text>〒{company.postCode}</Text>
          </InfoRow>
        )}
        {company.websiteUrl && (
          <InfoRow label='WEBサイト'>
            <a
              href={company.websiteUrl}
              target='_blank'
              rel='noopener noreferrer'
              style={{ ...LINK_STYLE, wordBreak: 'break-all' }}
            >
              {company.websiteUrl}
            </a>
          </InfoRow>
        )}
        {company.corporateNumber && (
          <InfoRow label='法人番号'>
            <Text color='gray.500'>{company.corporateNumber}</Text>
          </InfoRow>
        )}
      </VStack>
    </Box>
  );
}
