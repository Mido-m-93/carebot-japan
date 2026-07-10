# carebot — operator notes

This is an instance of [StartupRobos](https://github.com/Robo-Co-op/StartupRobos) owned by **Mido**.

- Monthly AI budget: $100
- Reports delivered to: mohamada@roboco-op.org
- Initialized: 2026-07-06T09:55:03Z

## Next steps
1. Run Supabase schema: paste `supabase/schema.sql` + `supabase/migrations/001_spend_budget_rpc.sql` into Supabase SQL Editor
2. Deploy to Vercel: `npx vercel` then `npx vercel env add` for each var in `.env.local`
3. Open Claude Code: `claude` — the AI will pick your 3 businesses

## Staying up to date
```bash
git remote add upstream https://github.com/Robo-Co-op/StartupRobos.git
git fetch upstream
git merge upstream/main
```
