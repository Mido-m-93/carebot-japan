import { Box, Container, Table, Badge, Text, Flex } from '@radix-ui/themes'
import { createServiceClient } from '@/lib/supabase/server'
import PageHeader from '../_components/PageHeader'

export const dynamic = 'force-dynamic'

interface SelectionRow {
  id: string
  tier: string
  selected_model: string
  quality_score: number
  schema_pass_rate: number
  status: string
  created_at: string
}

interface ConfigRow {
  tier: string
  model: string
  updated_by: string
  updated_at: string
}

function statusColor(status: string): 'green' | 'orange' | 'red' {
  if (status === 'selected') return 'green'
  if (status === 'kept_current') return 'orange'
  return 'red'
}

export default async function ModelsPage() {
  const supabase = createServiceClient()

  const [{ data: config }, { data: history }] = await Promise.all([
    supabase.from('model_config').select('*').order('tier'),
    supabase
      .from('model_selection_history')
      .select('id, tier, selected_model, quality_score, schema_pass_rate, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const configs = (config ?? []) as ConfigRow[]
  const rows = (history ?? []) as SelectionRow[]

  return (
    <Box style={{ flex: 1 }}>
      <PageHeader
        title="Model Routing"
        subtitle="Current model config and weekly optimizer history"
      />
      <Container size="4" px="6" py="5">
        <Text size="3" weight="medium" mb="3" style={{ display: 'block' }}>
          Active Configuration
        </Text>
        <Box
          mb="5"
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
                <Table.ColumnHeaderCell>Tier</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Model</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Updated By</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Updated At</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {configs.map((c) => (
                <Table.Row key={c.tier}>
                  <Table.Cell>
                    <Badge color={c.tier === 'high' ? 'amber' : 'blue'} variant="soft" size="1">
                      {c.tier}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                      {c.model}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">{c.updated_by}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {new Date(c.updated_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
              {configs.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <Text color="gray">No configuration found (using code defaults)</Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        </Box>

        <Flex justify="between" align="center" mb="3">
          <Text size="3" weight="medium">
            Selection History
          </Text>
          <Text size="1" color="gray">{rows.length} entries</Text>
        </Flex>
        <Box
          style={{
            border: '1px solid var(--slate-4)',
            borderRadius: 8,
            background: 'var(--slate-1)',
            overflow: 'hidden',
          }}
        >
          {rows.length === 0 ? (
            <Box style={{ padding: 32, textAlign: 'center' }}>
              <Text color="gray">No optimizer runs yet.</Text>
            </Box>
          ) : (
            <Table.Root size="2" variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Tier</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Model</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Score</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Schema</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {new Date(r.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={r.tier === 'high' ? 'amber' : 'blue'} variant="soft" size="1">
                        {r.tier}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                        {r.selected_model}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                        {r.quality_score.toFixed(1)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                        {(r.schema_pass_rate * 100).toFixed(0)}%
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={statusColor(r.status)} variant="soft" size="1">
                        {r.status}
                      </Badge>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      </Container>
    </Box>
  )
}
