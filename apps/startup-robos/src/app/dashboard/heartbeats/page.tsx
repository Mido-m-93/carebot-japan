import { Box, Container, Table, Badge, Text } from '@radix-ui/themes'
import Link from 'next/link'
import {
  listHeartbeats,
  formatTaskType,
  formatModel,
  formatRelativeTime,
  agentForTaskType,
  AGENT_ROLES,
} from '@/lib/dashboard/queries'
import PageHeader from '../_components/PageHeader'

export const dynamic = 'force-dynamic'

export default async function HeartbeatsPage() {
  const runs = await listHeartbeats(100)

  return (
    <Box style={{ flex: 1 }}>
      <PageHeader
        title="Heartbeats"
        subtitle={`${runs.length} heartbeat runs (CEO daily + CxO tasks)`}
      />
      <Container size="4" px="6" py="5">
        {runs.length === 0 ? (
          <Box
            style={{
              border: '1px solid var(--slate-4)',
              borderRadius: 8,
              padding: 32,
              textAlign: 'center',
            }}
          >
            <Text color="gray">No heartbeats yet.</Text>
          </Box>
        ) : (
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
                  <Table.ColumnHeaderCell>Task</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Project</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Model</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Cost</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>When</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {runs.map((r) => {
                  const aid = agentForTaskType(r.task_type)
                  const agent = AGENT_ROLES[aid]
                  return (
                    <Table.Row key={r.id}>
                      <Table.Cell>
                        <Badge
                          color={agent.accent as 'amber' | 'blue' | 'pink' | 'orange' | 'green'}
                          variant="soft"
                          size="1"
                        >
                          {agent.label}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Link
                          href={`/dashboard/agents/${aid}/runs/${r.id}`}
                          style={{ color: 'var(--blue-11)', textDecoration: 'none' }}
                        >
                          {formatTaskType(r.task_type)}
                        </Link>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" color="gray">
                          {r.startup_name ?? '—'}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" color="gray" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                          {formatModel(r.model)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                          ${r.cost_usd.toFixed(5)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" color="gray">
                          {formatRelativeTime(r.created_at)}
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Container>
    </Box>
  )
}
