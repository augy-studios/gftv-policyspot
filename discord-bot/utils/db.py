"""Supabase database helpers for the Discord bot."""

import logging
from collections import Counter

from supabase import acreate_client, AsyncClient

import config

logger = logging.getLogger('policyspot.db')

_client: AsyncClient | None = None

# Short document name → database table
DOCUMENT_TABLES: dict[str, str] = {
    'charter': 'gftvpolicy_charter',
    'news':    'gftvpolicy_news',
    'prs':     'gftvpolicy_prs',
    'rules':   'gftvpolicy_rules',
    'join':    'gftvpolicy_join',
    'legal':   'gftvpolicy_legal',
}

# Short document name → name shown to users
DOCUMENT_DISPLAY_NAMES: dict[str, str] = {
    'charter': 'Charter',
    'news':    'News Standards',
    'prs':     'Programme Rating System',
    'rules':   'Community Rules',
    'join':    'Join GFTV',
    'legal':   'Legal',
}


async def get_client() -> AsyncClient:
    """Return the shared Supabase client, creating it the first time."""
    global _client
    if _client is None:
        _client = await acreate_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    return _client


async def fetch_sections(document: str) -> list[dict]:
    """Return every published section of a document, in document order."""
    client = await get_client()
    response = await (
        client.table(DOCUMENT_TABLES[document])
        .select('id,slug,title,type,number,anchor,parent_id,order_index,content,updated_at')
        .eq('is_published', True)
        .order('order_index')
        .execute()
    )
    return response.data


async def fetch_section_by_slug(document: str, slug: str) -> dict | None:
    """Return one published section by its slug, or None if there is none."""
    client = await get_client()
    response = await (
        client.table(DOCUMENT_TABLES[document])
        .select('*')
        .eq('is_published', True)
        .eq('slug', slug)
        .maybe_single()
        .execute()
    )
    return response.data


async def search_sections(query: str, document: str | None = None) -> list[tuple[str, dict]]:
    """Find sections whose title or content contains the query (case-insensitive).

    Searches one document, or all of them when "document" is None.
    Returns a list of (document_name, section) pairs without duplicates."""
    client = await get_client()
    if document:
        documents_to_search = [document]
    else:
        documents_to_search = list(DOCUMENT_TABLES)
    results: list[tuple[str, dict]] = []
    already_found: set[str] = set()

    for document_name in documents_to_search:
        table_name = DOCUMENT_TABLES[document_name]
        for field_name in ('title', 'content'):
            response = await (
                client.table(table_name)
                .select('id,slug,title,type,number,content')
                .eq('is_published', True)
                .ilike(field_name, f'%{query}%')
                .execute()
            )
            for section in response.data:
                unique_key = f'{document_name}:{section["id"]}'
                if unique_key not in already_found:
                    already_found.add(unique_key)
                    results.append((document_name, section))

    return results


async def fetch_view_counts(document: str | None = None) -> dict[str, int]:
    """Return {section_id: number of recorded visits}, optionally for one document."""
    client = await get_client()
    visits_query = client.table('gftvpolicy_pagevisits').select('section_id')
    if document:
        visits_query = visits_query.eq('doc', document)
    response = await visits_query.execute()
    visit_counter = Counter()
    for row in response.data:
        visit_counter[row['section_id']] += 1
    return dict(visit_counter)


async def record_view(section_id: str, document: str, slug: str) -> None:
    """Record one visit to a section. Failures are logged and otherwise ignored."""
    try:
        client = await get_client()
        await (
            client.table('gftvpolicy_pagevisits')
            .insert({
                'section_id': section_id,
                'doc': document,
                'slug': slug,
                'device_type': 'Others',
            })
            .execute()
        )
    except Exception as error:
        logger.warning('Failed to record view for %s/%s: %s', document, slug, error)
