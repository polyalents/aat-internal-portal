from pydantic import BaseModel, Field


class SettingRead(BaseModel):
    key: str
    value: str

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    settings: dict[str, str] = Field(default_factory=dict)