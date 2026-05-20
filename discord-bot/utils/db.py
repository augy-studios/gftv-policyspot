import logging
from collections import Counter

from supabase import acreate_client, AsyncClient

import config

log = logging.getLogger('policyspot.db')

_client: AsyncClient | None = None

DOC_TABLES: dict[str, str] = {
    'charter': 'gftvpolicy_charter',
    'news':    'gftvpolicy_news',
    'prs':     'gftvpolicy_prs',
    'rules':   'gftvpolicy_rules',
    'join':    'gftvpolicy_join',
    'legal':   'gftvpolicy_legal',
}

DOC_DISPLAY: dict[str, str] = {
    'charter': 'Charter',
    'news':    'News Standards',
    'prs':     'Programme Rating System',
    'rules':   'Community Rules',
    'join':    'Join GFTV',
    'legal':   'Legal',
}


async def get_client() -> AsyncClient:
    global _client
    if _client is None:
        _client = await acreate_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    return _client


async def fetch_sections(doc: str) -> list[dict]:
    client = await get_client()
    r = await (
        client.table(DOC_TABLES[doc])
        .select('id,slug,title,type,number,anchor,parent_id,order_index,content,updated_at')
        .eq('is_published', True)
        .order('order_index')
        .execute()
    )
    return r.data


async def fetch_section_by_slug(doc: str, slug: str) -> dict | None:
    client = await get_client()
    r = await (
        client.table(DOC_TABLES[doc])
        .select('*')
        .eq('is_published', True)
        .eq('slug', slug)
        .maybe_single()
        .execute()
    )
    return r.data


async def search_sections(query: str, doc: str | None = None) -> list[tuple[str, dict]]:
    client = await get_client()
    docs = [doc] if doc else list(DOC_TABLES)
    results: list[tuple[str, dict]] = []
    seen: set[str] = set()

    for d in docs:
        table = DOC_TABLES[d]
        for field in ('title', 'content'):
            r = await (
                client.table(table)
                .select('id,slug,title,type,number,content')
                .eq('is_published', True)
                .ilike(field, f'%{query}%')
                .execute()
            )
            for item in r.data:
                key = f'{d}:{item["id"]}'
                if key not in seen:
                    seen.add(key)
                    results.append((d, item))

    return results


async def fetch_view_counts(doc: str | None = None) -> dict[str, int]:
    client = await get_client()
    query = client.table('gftvpolicy_pagevisits').select('section_id')
    if doc:
        query = query.eq('doc', doc)
    r = await query.execute()
    return dict(Counter(row['section_id'] for row in r.data))


async def record_view(section_id: str, doc: str, slug: str) -> None:
    try:
        client = await get_client()
        await (
            client.table('gftvpolicy_pagevisits')
            .insert({
                'section_id': section_id,
                'doc': doc,
                'slug': slug,
                'device_type': 'Others',
            })
            .execute()
        )
    except Exception as exc:
        log.warning('Failed to record view for %s/%s: %s', doc, slug, exc)
