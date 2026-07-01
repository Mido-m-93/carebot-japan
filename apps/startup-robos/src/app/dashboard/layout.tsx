'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Box, Flex, Text, Separator, ScrollArea } from '@radix-ui/themes'
import {
  HomeIcon,
  LayoutIcon,
  StackIcon,
  PersonIcon,
  CheckIcon,
  ActivityLogIcon,
  LightningBoltIcon,
  DollarSignIcon,
  CubeIcon,
  GearIcon,
  InboxIcon,
  TargetIcon,
  ReloadIcon,
  MixerHorizontalIcon,
} from './_icons'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  matchPrefix?: boolean
}

const NAV_WORK: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/dashboard/inbox', label: 'Inbox', icon: InboxIcon, matchPrefix: true },
  { href: '/dashboard/issues', label: 'Issues', icon: StackIcon, matchPrefix: true },
  { href: '/dashboard/approvals', label: 'Approvals', icon: CheckIcon, matchPrefix: true },
]

const NAV_PEOPLE: NavItem[] = [
  { href: '/dashboard/agents', label: 'Agents', icon: PersonIcon, matchPrefix: true },
  { href: '/dashboard/heartbeats', label: 'Heartbeats', icon: LightningBoltIcon, matchPrefix: true },
  { href: '/dashboard/routines', label: 'Routines', icon: ReloadIcon, matchPrefix: true },
]

const NAV_PLAN: NavItem[] = [
  { href: '/dashboard/goals', label: 'Goals', icon: TargetIcon, matchPrefix: true },
  { href: '/dashboard/activity', label: 'Activity', icon: ActivityLogIcon, matchPrefix: true },
  { href: '/dashboard/costs', label: 'Costs', icon: DollarSignIcon, matchPrefix: true },
]

const NAV_ORG: NavItem[] = [
  { href: '/dashboard/projects', label: 'Projects', icon: CubeIcon, matchPrefix: true },
  { href: '/dashboard/models', label: 'Models', icon: MixerHorizontalIcon, matchPrefix: true },
  { href: '/dashboard/org', label: 'Org', icon: LayoutIcon },
  { href: '/dashboard/settings', label: 'Settings', icon: GearIcon, matchPrefix: true },
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 10px',
        borderRadius: 6,
        fontSize: 13,
        color: active ? 'var(--slate-12)' : 'var(--slate-11)',
        background: active ? 'var(--slate-3)' : 'transparent',
        textDecoration: 'none',
        transition: 'background 120ms, color 120ms',
      }}
      className="nav-link"
    >
      <Icon className="nav-icon" />
      <Text size="2">{item.label}</Text>
    </Link>
  )
}

function NavSection({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <Box mb="4">
      <Text
        size="1"
        weight="medium"
        style={{
          color: 'var(--slate-10)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          paddingLeft: 10,
          marginBottom: 6,
          display: 'block',
          fontSize: 10,
        }}
      >
        {title}
      </Text>
      <Flex direction="column" gap="1">
        {items.map((item) => {
          const active = item.matchPrefix
            ? pathname === item.href || pathname.startsWith(item.href + '/')
            : pathname === item.href
          return <NavLink key={item.href} item={item} active={active} />
        })}
      </Flex>
    </Box>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <Flex style={{ minHeight: '100vh', background: 'var(--slate-1)' }}>
      {/* Sidebar */}
      <Box
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: '1px solid var(--slate-4)',
          background: 'var(--slate-2)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Workspace header */}
        <Box style={{ padding: '14px 16px', borderBottom: '1px solid var(--slate-4)' }}>
          <Flex align="center" gap="2">
            <Box
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'var(--blue-9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              L
            </Box>
            <Box>
              <Text size="2" weight="medium" style={{ display: 'block', lineHeight: 1.1 }}>
                Launchpad
              </Text>
              <Text size="1" color="gray" style={{ display: 'block', lineHeight: 1.3 }}>
                Mission Control
              </Text>
            </Box>
          </Flex>
        </Box>

        {/* Nav */}
        <ScrollArea style={{ flex: 1 }}>
          <Box style={{ padding: '14px 10px' }}>
            <NavSection title="Work" items={NAV_WORK} pathname={pathname} />
            <Separator size="4" my="2" color="gray" />
            <NavSection title="People" items={NAV_PEOPLE} pathname={pathname} />
            <Separator size="4" my="2" color="gray" />
            <NavSection title="Plan" items={NAV_PLAN} pathname={pathname} />
            <Separator size="4" my="2" color="gray" />
            <NavSection title="Org" items={NAV_ORG} pathname={pathname} />
          </Box>
        </ScrollArea>

        {/* Footer */}
        <Box style={{ padding: '10px 14px', borderTop: '1px solid var(--slate-4)' }}>
          <Flex align="center" gap="2">
            <Box
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--grass-9)',
                boxShadow: '0 0 6px var(--grass-9)',
              }}
            />
            <Text size="1" color="gray">
              Company online
            </Text>
          </Flex>
        </Box>
      </Box>

      {/* Main content */}
      <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Flex>
  )
}
