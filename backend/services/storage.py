"""
Supabase Storage helpers for CV files.

Uses the singleton Supabase service-role client from db.supabase.
Never initialize a new Supabase client here.
"""

import uuid
from fastapi import HTTPException
from db.supabase import supabase

BUCKET_NAME = "cvs"


async def upload_cv_file(file_bytes: bytes, filename: str, user_id: str, content_type: str) -> str:
    """
    Upload the original CV file to Supabase Storage.

    Returns:
        Public URL string (or signed URL depending on bucket policy).

    Raises:
        HTTPException 500 if upload fails.
    """
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "pdf"
    storage_path = f"{user_id}/{uuid.uuid4()}.{extension}"

    try:
        await supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type or "application/octet-stream"},
        )
        file_url: str = await supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)
        return file_url
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"CV storage upload failed: {exc}"
        )
