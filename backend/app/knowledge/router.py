from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_it
from app.knowledge.schemas import (
    ArticleCreate,
    ArticleListResponse,
    ArticleRead,
    ArticleUpdate,
    KnowledgeCategoryCreate,
    KnowledgeCategoryRead,
    KnowledgeCategoryUpdate,
)
from app.knowledge.service import (
    create_article,
    create_knowledge_category,
    delete_article,
    delete_knowledge_category,
    get_article_by_id,
    get_articles,
    get_knowledge_categories,
    get_knowledge_category_by_id,
    update_article,
    update_knowledge_category,
)
from app.users.models import User

router = APIRouter()


def _article_to_read(article) -> ArticleRead:
    return ArticleRead(
        id=article.id,
        title=article.title,
        content=article.content,
        category_id=article.category_id,
        category_name=article.category.name if article.category else None,
        author_id=article.author_id,
        author_name=article.author.username if article.author else None,
        created_at=article.created_at,
        updated_at=article.updated_at,
    )


@router.get("/categories", response_model=list[KnowledgeCategoryRead])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[KnowledgeCategoryRead]:
    return await get_knowledge_categories(db)


@router.post("/categories", response_model=KnowledgeCategoryRead, status_code=status.HTTP_201_CREATED)
async def create_new_category(
    body: KnowledgeCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> KnowledgeCategoryRead:
    return await create_knowledge_category(db, body)


@router.patch("/categories/{cat_id}", response_model=KnowledgeCategoryRead)
async def update_existing_category(
    cat_id: UUID,
    body: KnowledgeCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> KnowledgeCategoryRead:
    category = await get_knowledge_category_by_id(db, cat_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return await update_knowledge_category(db, category, body)


@router.delete("/categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_category(
    cat_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> None:
    category = await get_knowledge_category_by_id(db, cat_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    await delete_knowledge_category(db, category)


@router.get("/articles", response_model=ArticleListResponse)
async def list_articles(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    category_id: UUID | None = Query(None),
    search: str | None = Query(None, max_length=300),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ArticleListResponse:
    articles, total = await get_articles(
        db,
        page=page,
        size=size,
        category_id=category_id,
        search=search,
    )
    return ArticleListResponse(
        items=[_article_to_read(article) for article in articles],
        total=total,
        page=page,
        size=size,
    )


@router.get("/articles/{article_id}", response_model=ArticleRead)
async def read_article(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ArticleRead:
    article = await get_article_by_id(db, article_id)
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return _article_to_read(article)


@router.post("/articles", response_model=ArticleRead, status_code=status.HTTP_201_CREATED)
async def create_new_article(
    body: ArticleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_it),
) -> ArticleRead:
    article = await create_article(db, body, current_user.id)
    article = await get_article_by_id(db, article.id)
    if article is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reload article",
        )
    return _article_to_read(article)


@router.patch("/articles/{article_id}", response_model=ArticleRead)
async def update_existing_article(
    article_id: UUID,
    body: ArticleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> ArticleRead:
    article = await get_article_by_id(db, article_id)
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    article = await update_article(db, article, body)
    article = await get_article_by_id(db, article.id)
    if article is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reload article",
        )

    return _article_to_read(article)


@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_article(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> None:
    article = await get_article_by_id(db, article_id)
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    await delete_article(db, article)