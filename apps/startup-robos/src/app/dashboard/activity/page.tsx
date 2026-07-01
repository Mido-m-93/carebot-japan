import { Box, Container, Flex, Badge, Text, Card } from '@radix-ui/themes'
import Link from 'next/link'
import {
  listHeartbeats,
  formatTaskType,
  formatModel,
  formatRelativeTime,
  agentForTaskType,
  AGENT_ROLES,
  type HeartbeatRun,
} from '@/lib/dashboard/queries'
import PageHeader from '../_components/PageHeader'

export const dynamic = 'force-dynamic'

function groupByDay(runs: HeartbeatRun[]) {
  const groups = new Map<string, typeof runs>()
  for (const r of runs) {
    const key = new Date(r.created_at).toISOString().slice(0, 10)
    const arr = groups.get(key) ?? []
    arr.push(r)
    groups.set(key, arr)
  }
  return [...groups.entries()].map(([day, items]) => ({ day, items }))
}

export default async function ActivityPage() {
  const runs = await listHeartbeats(100)
  const grouped = groupByDay(runs)

  return (
    <Box style={{ flex: 1 }}>
      <PageHeader title="Activity" subtitle={`${runs.length} recent agent actions`} />
      <Container size="3" px="6" py="5">
        {runs.length === 0 ? (
          <Card size="2">
            <Text color="gray">No activity yet.</Text>
          </Card>
        ) : (
          <Flex direction="column" gap="5">
            {grouped.map(({ day, items }) => (
              <Box key={day}>
                <Text
                  size="1"
                  color="gray"
                  weight="medium"
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    display: 'block',
                    marginBottom: 8,
                    fontFamily: 'var(--font-geist-mono)',
                  }}
                >
                  {day}
                </Text>
                <Card size="1">
                  <Flex direction="column" gap="0">
                    {items.map((r, idx) => {
                      const aid = agentForTaskType(r.task_type)
                      const agent = AGENT_ROLES[aid]
                      return (
                        <Link
                          key={r.id}
                          href={`/dashboard/agents/${aid}/runs/${r.id}`}
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          <Flex
                            align="center"
                            gap="3"
                            style={{
                              padding: '10px 8px',
                              borderBottom:
                                idx < items.length - 1 ? '1px solid var(--slate-3)' : 'none',
                            }}
                          >
                            <Text
                              size="1"
                              color="gray"
                              style={{
                                fontFamily: 'var(--font-geist-mono)',
                                width: 50,
                                flexShrink: 0,
                              }}
                            >
                              {new Date(r.created_at).toISOString().slice(11, 16)}
                            </Text>
                            <Badge
                              color={
                                agent.accent as 'amber' | 'blue' | 'pink' | 'orange' | 'green'
                              }
                              variant="soft"
                              size="1"
                            >
                              {agent.label}
                            </Badge>
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text size="2" weight="medium">
                                {formatTaskType(r.task_type)}
                              </Text>
                              {r.startup_name && (
                                <Text size="1" color="gray">
                                  {' '}
                                  · {r.startup_name}
                                </Text>
                              )}
                            </Box>
                            <Text
                              size="1"
                              color="gray"
                              style={{ fontFamily: 'var(--font-geist-mono)' }}
                            >
                              {formatModel(r.model)}
                            </Text>
                            <Text
                              size="1"
                              color="gray"
                              style={{ fontFamily: 'var(--font-geist-mono)', width: 70, textAlign: 'right' }}
                            >
                              ${r.cost_usd.toFixed(5)}
                            </Text>
                            <Text size="1" color="gray" style={{ width: 70, textAlign: 'right' }}>
                              {formatRelativeTime(r.created_at)}
                            </Text>
                          </Flex>
                        </Link>
                      )
                    })}
                  </Flex>
                </Card>
              </Box>
            ))}
          </Flex>
        )}
      </Container>
    </Box>
  )
}
