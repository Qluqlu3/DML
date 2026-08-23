import { Button, Heading, HStack, Input, Text, VStack } from '@chakra-ui/react';
import Link from 'next/link';
import { TRADE_OPTIONS } from '@/lib/constructionTrades';

const SELECT_STYLE = {
  padding: '0.5rem 0.75rem',
  border: '1px solid #e2e8f0',
  borderRadius: '0.375rem',
  background: 'white',
  minWidth: '160px',
};

type Props = {
  prefNames: string[];
  q?: string;
  pref?: string;
  phone?: string;
  hasWebsite?: string;
  address?: string;
  permitType?: string;
  trade?: string;
};

export function SearchForm({
  prefNames,
  q,
  pref,
  phone,
  hasWebsite,
  address,
  permitType,
  trade,
}: Props) {
  const hasFilter = !!(q || pref || phone || hasWebsite || address || permitType || trade);

  return (
    <form
      method='GET'
      style={{
        marginBottom: '2rem',
        background: 'white',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
      }}
    >
      <VStack gap={4} align='stretch'>
        <Heading size='md'>業者を検索</Heading>
        <HStack gap={3} flexWrap='wrap'>
          <Input
            name='q'
            defaultValue={q ?? ''}
            placeholder='業者名で検索'
            flex='1'
            minW='200px'
            bg='white'
          />
          <select name='pref' defaultValue={pref ?? ''} style={SELECT_STYLE}>
            <option value=''>都道府県（全て）</option>
            {prefNames.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <Input
            name='address'
            defaultValue={address ?? ''}
            placeholder='住所（市区町村など）'
            flex='1'
            minW='200px'
            bg='white'
          />
        </HStack>
        <HStack gap={3} flexWrap='wrap'>
          <Input
            name='phone'
            defaultValue={phone ?? ''}
            placeholder='電話番号で検索'
            maxW='220px'
            bg='white'
          />
          <select name='permitType' defaultValue={permitType ?? ''} style={SELECT_STYLE}>
            <option value=''>許可種別（全て）</option>
            <option value='特定建設業'>特定建設業</option>
            <option value='一般建設業'>一般建設業</option>
          </select>
          <select name='trade' defaultValue={trade ?? ''} style={SELECT_STYLE}>
            <option value=''>保有する建設業許可（全て）</option>
            {TRADE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </HStack>
        <HStack gap={3} flexWrap='wrap'>
          <HStack
            as='label'
            gap={2}
            cursor='pointer'
            px={3}
            py={2}
            borderWidth='1px'
            borderColor={hasWebsite === '1' ? 'blue.400' : 'gray.200'}
            borderRadius='md'
            bg={hasWebsite === '1' ? 'blue.50' : 'white'}
            userSelect='none'
          >
            <input
              type='checkbox'
              name='hasWebsite'
              value='1'
              defaultChecked={hasWebsite === '1'}
            />
            <Text fontSize='sm'>Webサイトあり</Text>
          </HStack>
          <Button type='submit' colorPalette='orange'>
            検索
          </Button>
          {hasFilter && (
            <Link href='/companies'>
              <Button variant='ghost' size='md'>
                クリア
              </Button>
            </Link>
          )}
        </HStack>
      </VStack>
    </form>
  );
}
