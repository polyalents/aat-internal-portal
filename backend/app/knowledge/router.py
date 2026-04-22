from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_it
from app.knowledge.schemas import (
    ArticleCreate,
    ArticleListResponse,
    ArticleRead,
    ArticleUpdate,
    KnowledgeAttachmentRead,
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

ALLOWED_KNOWLEDGE_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
MAX_KNOWLEDGE_IMAGE_SIZE = 10 * 1024 * 1024


def _attachment_to_read(attachment) -> KnowledgeAttachmentRead:
    return KnowledgeAttachmentRead(
        id=attachment.id,
        article_id=attachment.article_id,
        filename=attachment.filename,
        file_path=attachment.file_path,
        file_url=attachment.file_path,
        file_size=attachment.file_size,
        content_type=attachment.content_type,
        uploaded_at=attachment.uploaded_at,
    )


def _article_to_read(article) -> ArticleRead:
    return ArticleRead(
        id=article.id,
        title=article.title,
        content_html=article.content_html,
        content_text=article.content_text,
        category_id=article.category_id,
        category_name=article.category.name if article.category else None,
        author_id=article.author_id,
        author_name=article.author.username if article.author else None,
        created_at=article.created_at,
        updated_at=article.updated_at,
        attachments=[_attachment_to_read(item) for item in getattr(article, "attachments", [])],
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


@router.post("/articles/images", status_code=status.HTTP_201_CREATED)
async def upload_article_image(
    file: UploadFile = File(...),
    _: User = Depends(require_it),
):
    content_type = file.content_type or ""
    ext = ALLOWED_KNOWLEDGE_IMAGE_TYPES.get(content_type)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type",
        )

    content = await file.read()
    await file.close()

    if len(content) > MAX_KNOWLEDGE_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image exceeds 10 MB",
        )

    upload_root = Path(settings.upload_dir).expanduser().resolve()
    images_dir = upload_root / "knowledge_images"
    images_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename or f"image.{ext}").name
    generated_name = f"{uuid4().hex}_{safe_name}"
    disk_path = images_dir / generated_name
    disk_path.write_bytes(content)

    return {
        "url": f"/uploads/knowledge_images/{generated_name}",
        "filename": file.filename or generated_name,
    }