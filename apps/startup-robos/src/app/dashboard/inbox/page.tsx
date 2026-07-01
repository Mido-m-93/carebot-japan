import { Box, Container, Card, Flex, Text, Heading } from '@radix-ui/themes'
import { EnvelopeClosedIcon } from '@radix-ui/react-icons'
import PageHeader from '../_components/PageHeader'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  return (
    <Box style={{ flex: 1 }}>
      <PageHeader title="Inbox" subtitle="Messages and notifications" />
      <Container size="3" px="6" py="5">
        <Card size="3">
          <Flex direction="column" align="center" justify="center" gap="3" py="6">
            <Box
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--slate-a4)',
                color: 'var(--slate-11)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <EnvelopeClosedIcon width={22} height={22} />
            </Box>
            <Heading size="3" weight="medium">
              Inbox is empty
            </Heading>
            <Text size="2" color="gray" align="center" style={{ maxWidth: 400 }}>
              Agent messages that need your attention will appear here. For now, daily CEO reports
              are delivered by email.
            </Text>
          </Flex>
        </Card>
      </Container>
    </Box>
  )
}
