import { Box, Flex, Heading, Text } from '@radix-ui/themes'
import Link from 'next/link'

interface Crumb {
  label: string
  href?: string
}

export default function PageHeader({
  title,
  subtitle,
  crumbs,
  right,
}: {
  title: string
  subtitle?: string
  crumbs?: Crumb[]
  right?: React.ReactNode
}) {
  return (
    <Flex
      align="center"
      justify="between"
      style={{
        padding: '14px 24px',
        borderBottom: '1px solid var(--slate-4)',
        background: 'var(--slate-1)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Box>
        {crumbs && crumbs.length > 0 && (
          <Flex align="center" gap="1" mb="1">
            {crumbs.map((c, i) => (
              <Flex key={i} align="center" gap="1">
                {c.href ? (
                  <Link
                    href={c.href}
                    style={{ color: 'var(--slate-11)', textDecoration: 'none', fontSize: 12 }}
                  >
                    {c.label}
                  </Link>
                ) : (
                  <Text size="1" color="gray">
                    {c.label}
                  </Text>
                )}
                {i < crumbs.length - 1 && (
                  <Text size="1" color="gray">
                    /
                  </Text>
                )}
              </Flex>
            ))}
          </Flex>
        )}
        <Heading size="4" weight="medium">
          {title}
        </Heading>
        {subtitle && (
          <Text size="2" color="gray">
            {subtitle}
          </Text>
        )}
      </Box>
      <Flex align="center" gap="3">
        {right}
        <Flex align="center" gap="2">
          <Box
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--grass-9)',
              boxShadow: '0 0 6px var(--grass-9)',
            }}
          />
          <Text size="1" color="gray" style={{ fontFamily: 'var(--font-geist-mono)' }}>
            {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC
          </Text>
        </Flex>
      </Flex>
    </Flex>
  )
}
