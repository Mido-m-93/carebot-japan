import { Box, Container, Table, Flex, Badge, Text } from '@radix-ui/themes'
import Link from 'next/link'
import { listAgents, formatModel, formatRelativeTime } from '@/lib/dashboard/queries'
import PageHeader from '../_components/PageHeader'

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  const agents = await listAgents()

  return (
    <Box style={{ flex: 1 }}>
      <PageHeader title="Agents" subtitle="CEO + CxO team roster" />
      <Container size="4" px="6" py="5">
        <Box
          style={{
            border: '1px solid var(--slate-4)',
            borderRadius: 8,
            background: 'var(--slate-1)',
            overflow: 'hidden',
          }}
        >
          <Table.Root size="2" variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Agent</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Model</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Runs</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Total cost</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Last run</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {agents.map((a) => (
                <Table.Row key={a.id}>
                  <Table.Cell>
                    <Link
                      href={`/dashboard/agents/${a.id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <Flex align="center" gap="2">
                        <Box
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            background: `var(--${a.accent}-a3)`,
                            color: `var(--${a.accent}-11)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          {a.label}
                        </Box>
                        <Text weight="medium">{a.label}</Text>
                      </Flex>
                    </Link>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                      {formatModel(a.model)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      color={a.status === 'active' ? 'green' : a.status === 'error' ? 'red' : 'gray'}
                      variant="soft"
                      size="1"
                    >
                      {a.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                      {a.runCount}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                      ${a.totalCostUsd.toFixed(4)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {formatRelativeTime(a.lastRunAt)}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      </Container>
    </Box>
  )
}
