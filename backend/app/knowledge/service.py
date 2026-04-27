from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.knowledge.models import (
    KnowledgeArticle,
    KnowledgeArticleAttachment,
    KnowledgeCategory,
)
from app.knowledge.schemas import (
    ArticleCreate,
    ArticleUpdate,
    KnowledgeCategoryCreate,
    KnowledgeCategoryUpdate,
)
from app.users.models import User, UserRole


def _can_manage_knowledge(user: User) -> bool:
    return user.role in {UserRole.admin, UserRole.it_specialist}


async def get_knowledge_categories(
    db: AsyncSession,
    current_user: User,
) -> list[KnowledgeCategory]:
    stmt = select(KnowledgeCategory)

    if not _can_manage_knowledge(current_user):
        stmt = stmt.where(KnowledgeCategory.is_user_visible.is_(True))

    stmt = stmt.order_by(KnowledgeCategory.sort_order, KnowledgeCategory.name)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_knowledge_category_by_id(
    db: AsyncSession,
    cat_id: UUID,
) -> KnowledgeCategory | None:
    result = await db.execute(select(KnowledgeCategory).where(KnowledgeCategory.id == cat_id))
    return result.scalar_one_or_none()


async def create_knowledge_category(
    db: AsyncSession,
    data: KnowledgeCategoryCreate,
) -> KnowledgeCategory:
    category = KnowledgeCategory(
        name=data.name.strip(),
        sort_order=data.sort_order,
        is_user_visible=data.is_user_visible,
    )
    db.add(category)
    await db.commit()
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

    await db.commit()
    await db.refresh(category)
    return category


async def delete_knowledge_category(
    db: AsyncSession,
    category: KnowledgeCategory,
) -> None:
    await db.delete(category)
    await db.commit()


async def get_articles(
    db: AsyncSession,
    current_user: User,
    page: int = 1,
    size: int = 20,
    category_id: UUID | None = None,
    search: str | None = None,
) -> tuple[list[KnowledgeArticle], int]:
    stmt = (
        select(KnowledgeArticle)
        .join(KnowledgeCategory, KnowledgeArticle.category_id == KnowledgeCategory.id)
        .options(
            selectinload(KnowledgeArticle.category),
            selectinload(KnowledgeArticle.author),
            selectinload(KnowledgeArticle.attachments),
        )
    )
    count_stmt = (
        select(func.count())
        .select_from(KnowledgeArticle)
        .join(KnowledgeCategory, KnowledgeArticle.category_id == KnowledgeCategory.id)
    )

    if not _can_manage_knowledge(current_user):
        stmt = stmt.where(KnowledgeCategory.is_user_visible.is_(True))
        count_stmt = count_stmt.where(KnowledgeCategory.is_user_visible.is_(True))

    if category_id is not None:
        stmt = stmt.where(KnowledgeArticle.category_id == category_id)
        count_stmt = count_stmt.where(KnowledgeArticle.category_id == category_id)

    if search:
        pattern = f"%{search.strip()}%"
        search_filter = or_(
            KnowledgeArticle.title.ilike(pattern),
            KnowledgeArticle.content_text.ilike(pattern),
            KnowledgeArticle.content_html.ilike(pattern),
        )
        stmt = stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(KnowledgeArticle.updated_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    return list(result.scalars().unique().all()), total


async def get_article_by_id(
    db: AsyncSession,
    article_id: UUID,
    current_user: User,
) -> KnowledgeArticle | None:
    stmt = (
        select(KnowledgeArticle)
        .join(KnowledgeCategory, KnowledgeArticle.category_id == KnowledgeCategory.id)
        .options(
            selectinload(KnowledgeArticle.category),
            selectinload(KnowledgeArticle.author),
            selectinload(KnowledgeArticle.attachments),
        )
        .where(KnowledgeArticle.id == article_id)
    )

    if not _can_manage_knowledge(current_user):
        stmt = stmt.where(KnowledgeCategory.is_user_visible.is_(True))

    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_article(
    db: AsyncSession,
    data: ArticleCreate,
    author_id: UUID,
) -> KnowledgeArticle:
    category = await get_knowledge_category_by_id(db, data.category_id)
    if category is None:
        raise ValueError("Related record not found or invalid reference")

    article = KnowledgeArticle(
        title=data.title.strip(),
        content_html=data.content_html.strip(),
        content_text=data.content_text.strip(),
        category_id=data.category_id,
        author_id=author_id,
    )
    db.add(article)
    await db.commit()
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

    if "content_html" in update_data and update_data["content_html"] is not None:
        update_data["content_html"] = update_data["content_html"].strip()

    if "content_text" in update_data and update_data["content_text"] is not None:
        update_data["content_text"] = update_data["content_text"].strip()

    if "category_id" in update_data and update_data["category_id"] is not None:
        category = await get_knowledge_category_by_id(db, update_data["category_id"])
        if category is None:
            raise ValueError("Related record not found or invalid reference")

    for field, value in update_data.items():
        setattr(article, field, value)

    await db.commit()
    await db.refresh(article)
    return article


async def delete_article(
    db: AsyncSession,
    article: KnowledgeArticle,
) -> None:
    await db.delete(article)
    await db.commit()