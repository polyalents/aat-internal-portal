"""Import all SQLAlchemy models needed by Celery workers.

Celery workers may execute tasks without passing through the FastAPI app startup,
so we explicitly import ORM model modules here to ensure mapper relationships
(e.g. string-based relationship targets) are fully registered.
"""

# Order matters for some string-based relationship declarations.
from app.departments import models as departments_models  # noqa: F401
from app.employees import models as employees_models  # noqa: F401
from app.users import models as users_models  # noqa: F401
from app.tickets import models as tickets_models  # noqa: F401
from app.announcements import models as announcements_models  # noqa: F401
from app.chat import models as chat_models  # noqa: F401
from app.knowledge import models as knowledge_models  # noqa: F401
from app.admin import models as admin_models  # noqa: F401