from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.knowledge.models import KnowledgeArticle, KnowledgeCategory
from app.knowledge.schemas import (
    ArticleCreate,
    ArticleUpdate,
    KnowledgeCategoryCreate,
    KnowledgeCategoryUpdate,
)


async def get_knowledge_categories(db: AsyncSession) -> list[KnowledgeCategory]:
    stmt = select(KnowledgeCategory).order_by(KnowledgeCategory.sort_order, KnowledgeCategory.name)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_knowledge_category_by_id(db: AsyncSession, cat_id: UUID) -> KnowledgeCategory | None:
    result = await db.execute(select(KnowledgeCategory).where(KnowledgeCategory.id == cat_id))
    return result.scalar_one_or_none()


async def create_knowledge_category(db: AsyncSession, data: KnowledgeCategoryCreate) -> KnowledgeCategory:
    category = KnowledgeCategory(
        name=data.name.strip(),
        sort_order=data.sort_order,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


async def update_knowledge_category(
    db: AsyncSession,
    category: KnowledgeCategory,
    data: KnowledgeCategoryUpdate,
) -> KnowledgeCategory:
    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(category, field, value)

    await db.flush()
    await db.refresh(category)
    return category


async def delete_knowledge_category(db: AsyncSession, category: KnowledgeCategory) -> None:
    await db.delete(category)
    await db.flush()


async def get_articles(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    category_id: UUID | None = None,
    search: str | None = None,
) -> tuple[list[KnowledgeArticle], int]:
    stmt = select(KnowledgeArticle).options(
        selectinload(KnowledgeArticle.category),
        selectinload(KnowledgeArticle.author),
    )
    count_stmt = select(func.count()).select_from(KnowledgeArticle)

    if category_id is not None:
        stmt = stmt.where(KnowledgeArticle.category_id == category_id)
        count_stmt = count_stmt.where(KnowledgeArticle.category_id == category_id)

    if search:
        pattern = f"%{search.strip()}%"
        search_filter = or_(
            KnowledgeArticle.title.ilike(pattern),
            KnowledgeArticle.content.ilike(pattern),
        )
        stmt = stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(KnowledgeArticle.updated_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    return list(result.scalars().all()), total


async def get_article_by_id(db: AsyncSession, article_id: UUID) -> KnowledgeArticle | None:
    stmt = (
        select(KnowledgeArticle)
        .options(
            selectinload(KnowledgeArticle.category),
            selectinload(KnowledgeArticle.author),
        )
        .where(KnowledgeArticle.id == article_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_article(db: AsyncSession, data: ArticleCreate, author_id: UUID) -> KnowledgeArticle:
    article = KnowledgeArticle(
        title=data.title.strip(),
        content=data.content.strip(),
        category_id=data.category_id,
        author_id=author_id,
    )
    db.add(article)
    await db.flush()
    await db.refresh(article)
    return article


async def update_article(
    db: AsyncSession,
    article: KnowledgeArticle,
    data: ArticleUpdate,
) -> KnowledgeArticle:
    update_data = data.model_dump(exclude_unset=True)

    if "title" in update_data and update_data["title"] is not None:
        update_data["title"] = update_data["title"].strip()

    if "content" in update_data and update_data["content"] is not None:
        update_data["content"] = update_data["content"].strip()

    for field, value in update_data.items():
        setattr(article, field, value)

    await db.flush()
    await db.refresh(article)
    return article


async def delete_article(db: AsyncSession, article: KnowledgeArticle) -> None:
    await db.delete(article)
    await db.flush()