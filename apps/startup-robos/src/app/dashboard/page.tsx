import {
  Container,
  Heading,
  Text,
  Grid,
  Card,
  Flex,
  Badge,
  Box,
  Separator,
  Progress,
} from '@radix-ui/themes'
import Link from 'next/link'
import {
  getDashboardOverview,
  formatTaskType,
  formatModel,
  formatRelativeTime,
  AGENT_ROLES,
  agentForTaskType,
} from '@/lib/dashboard/queries'
import PageHeader from './_components/PageHeader'

export const dynamic = 'force-dynamic'

function StatCard({
  label,
  value,
  detail,
  progress,
}: {
  label: string
  value: string
  detail?: string
  progress?: number
}) {
  return (
    <Card size="2">
      <Flex direction="column" gap="2">
        <Text size="1" color="gray" weight="medium">
          {label}
        </Text>
        <Text size="7" weight="bold">
          {value}
        </Text>
        {progress !== undefined && <Progress value={progress} size="1" />}
        {detail && (
          <Text size="1" color="gray">
            {detail}
          </Text>
        )}
      </Flex>
    </Card>
  )
}

export default async function DashboardHome() {
  const { projects, issues, agents, costs, activity, activeIssues, activeAgents } =
    await getDashboardOverview()

  const budgetSpent = costs.budget?.spent_usd ?? 0
  const budgetTotal = costs.budget?.total_usd ?? 500
  const budgetPct = budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0

  const experimentsDone = issues.filter((i) => i.status === 'success' || i.status === 'failed').length

  return (
    <Box style={{ flex: 1 }}>
      <PageHeader title="Home" subtitle="Mission Control overview" />

      <Container size="4" px="6" py="5">
        {/* KPI cards */}
        <Grid columns={{ initial: '1', sm: '2', lg: '4' }} gap="3" mb="5">
          <StatCard
            label="Active issues"
            value={String(activeIssues)}
            detail={`${experimentsDone} completed · ${issues.length} total`}
          />
          <StatCard
            label="Agents online"
            value={`${activeAgents} / 5`}
            detail="CEO + CxO team"
          />
          <StatCard
            label="Month spend"
            value={`$${budgetSpent.toFixed(2)}`}
            detail={`of $${budgetTotal.toFixed(0)} budget · ${budgetPct.toFixed(0)}%`}
            progress={Math.min(budgetPct, 100)}
          />
          <StatCard
            label="Projects"
            value={String(projects.length)}
            detail={`${projects.filter((p) => p.status === 'active').length} active`}
          />
        </Grid>

        {/* Two-column: agents + recent activity */}
        <Grid columns={{ initial: '1', lg: '2' }} gap="3" mb="5">
          <Card size="2">
            <Flex align="center" justify="between" mb="3">
              <Heading size="3" weight="medium">
                Agents
              </Heading>
              <Link href="/dashboard/agents" style={{ textDecoration: 'none' }}>
                <Text size="1" color="gray">
                  View all →
                </Text>
              </Link>
            </Flex>
            <Flex direction="column" gap="2">
              {agents.map((a) => (
                <Link
                  key={a.id}
                  href={`/dashboard/agents/${a.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <Flex
                    align="center"
                    justify="between"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'var(--slate-2)',
                      border: '1px solid var(--slate-4)',
                    }}
                  >
                    <Flex align="center" gap="3">
                      <Box
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: `var(--${a.accent}-a3)`,
                          color: `var(--${a.accent}-11)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {a.label}
                      </Box>
                      <Box>
                        <Text size="2" weight="medium" style={{ display: 'block' }}>
                          {a.label}
                        </Text>
                        <Text size="1" color="gray">
                          {formatModel(a.model)} · {a.runCount} runs
                        </Text>
                      </Box>
                    </Flex>
                    <Flex align="center" gap="2">
                      <Badge
                        color={a.status === 'active' ? 'green' : a.status === 'error' ? 'red' : 'gray'}
                        variant="soft"
                        size="1"
                      >
                        {a.status}
                      </Badge>
                      <Text size="1" color="gray" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                        ${a.totalCostUsd.toFixed(4)}
                      </Text>
                    </Flex>
                  </Flex>
                </Link>
              ))}
            </Flex>
          </Card>

          <Card size="2">
            <Flex align="center" justify="between" mb="3">
              <Heading size="3" weight="medium">
                Recent activity
              </Heading>
              <Link href="/dashboard/activity" style={{ textDecoration: 'none' }}>
                <Text size="1" color="gray">
                  View all →
                </Text>
              </Link>
            </Flex>
            {activity.length === 0 ? (
              <Text size="2" color="gray">
                No activity yet.
              </Text>
            ) : (
              <Flex direction="column" gap="1">
                {activity.slice(0, 8).map((r) => {
                  const agentId = agentForTaskType(r.task_type)
                  const agent = AGENT_ROLES[agentId]
                  return (
                    <Link
                      key={r.id}
                      href={`/dashboard/agents/${agentId}/runs/${r.id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <Flex
                        align="center"
                        justify="between"
                        style={{ padding: '6px 8px', borderRadius: 4 }}
                      >
                        <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                          <Badge
                            color={agent.accent as 'amber' | 'blue' | 'pink' | 'orange' | 'green'}
                            variant="soft"
                            size="1"
                          >
                            {agent.label}
                          </Badge>
                          <Text
                            size="2"
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatTaskType(r.task_type)}
                          </Text>
                          {r.startup_name && (
                            <Text size="1" color="gray">
                              · {r.startup_name}
                            </Text>
                          )}
                        </Flex>
                        <Text
                          size="1"
                          color="gray"
                          style={{ fontFamily: 'var(--font-geist-mono)', flexShrink: 0 }}
                        >
                          {formatRelativeTime(r.created_at)}
                        </Text>
                      </Flex>
                    </Link>
                  )
                })}
              </Flex>
            )}
          </Card>
        </Grid>

        {/* Projects */}
        <Card size="2">
          <Flex align="center" justify="between" mb="3">
            <Heading size="3" weight="medium">
              Projects
            </Heading>
            <Link href="/dashboard/projects" style={{ textDecoration: 'none' }}>
              <Text size="1" color="gray">
                View all →
              </Text>
            </Link>
          </Flex>
          <Grid columns={{ initial: '1', md: '3' }} gap="3">
            {projects.map((p) => {
              const projectIssues = issues.filter((i) => i.startup_id === p.id)
              const running = projectIssues.filter(
                (i) => i.status === 'running' || i.status === 'pending',
              ).length
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <Card size="1" variant="surface">
                    <Flex direction="column" gap="2">
                      <Flex align="center" justify="between">
                        <Text size="2" weight="medium">
                          {p.name}
                        </Text>
                        <Badge
                          color={p.status === 'active' ? 'green' : 'gray'}
                          variant="soft"
                          size="1"
                        >
                          {p.status}
                        </Badge>
                      </Flex>
                      <Text size="1" color="gray">
                        {p.business_type ?? 'untyped'}
                      </Text>
                      <Separator size="4" />
                      <Flex justify="between">
                        <Text size="1" color="gray">
                          {running} active issue{running !== 1 ? 's' : ''}
                        </Text>
                        <Text
                          size="1"
                          color="gray"
                          style={{ fontFamily: 'var(--font-geist-mono)' }}
                        >
                          {projectIssues.length} total
                        </Text>
                      </Flex>
                    </Flex>
                  </Card>
                </Link>
              )
            })}
          </Grid>
        </Card>
      </Container>
    </Box>
  )
}
