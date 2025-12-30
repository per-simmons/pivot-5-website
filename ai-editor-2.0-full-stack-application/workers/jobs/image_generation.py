"""
Step 3b: Image Generation

Generates images for decorated stories using Gemini/OpenAI with fallback,
then uploads to Cloudflare Images.

Part of n8n workflow: HCbd2g852rkQgSqr
"""

import os
import base64
import httpx
from datetime import datetime
from typing import Dict, Any, Optional
import google.generativeai as genai
import openai
from ..utils.airtable import AirtableClient


def generate_image(
    story_id: str,
    image_prompt: str,
    job_id: str = None,
) -> Dict[str, Any]:
    """
    Generate an image for a story and upload to Cloudflare.

    Args:
        story_id: Airtable story record ID
        image_prompt: Image generation prompt
        job_id: Optional job ID for tracking

    Returns:
        Dict with image URL and status
    """
    print(f"[Step 3b] Generating image for story {story_id}")

    airtable = AirtableClient()

    results = {
        "job_id": job_id,
        "story_id": story_id,
        "started_at": datetime.now().isoformat(),
        "image_status": "pending",
    }

    # Try Gemini first
    image_data = None
    try:
        image_data = _generate_with_gemini(image_prompt)
        results["generator"] = "gemini"
    except Exception as e:
        print(f"Gemini image generation failed: {e}")

    # Fallback to OpenAI
    if not image_data:
        try:
            image_data = _generate_with_openai(image_prompt)
            results["generator"] = "openai"
        except Exception as e:
            print(f"OpenAI image generation failed: {e}")
            results["image_status"] = "failed"
            results["error"] = str(e)
            airtable.update_decoration_image_status(story_id, "failed")
            return results

    # Upload to Cloudflare
    try:
        image_url = _upload_to_cloudflare(image_data)
        results["image_url"] = image_url
        results["image_status"] = "generated"

        # Update Airtable
        airtable.update_decoration_image(story_id, image_url)

    except Exception as e:
        results["image_status"] = "upload_failed"
        results["error"] = str(e)
        airtable.update_decoration_image_status(story_id, "upload_failed")

    results["completed_at"] = datetime.now().isoformat()
    print(f"[Step 3b] Image generation complete: {results['image_status']}")

    return results


def _generate_with_gemini(prompt: str) -> bytes:
    """
    Generate image using Google Gemini (Imagen).

    Args:
        prompt: Image generation prompt

    Returns:
        Image data as bytes
    """
    genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

    # Use Gemini 3 Pro for image generation
    model = genai.ImageGenerationModel('gemini-3-pro-image-preview')

    response = model.generate_images(
        prompt=prompt,
        number_of_images=1,
        aspect_ratio="16:9",
        safety_filter_level="block_only_high",
    )

    if response.images:
        return response.images[0]._pil_image
    else:
        raise ValueError("No image generated")


def _generate_with_openai(prompt: str) -> bytes:
    """
    Generate image using OpenAI DALL-E.

    Args:
        prompt: Image generation prompt

    Returns:
        Image data as bytes
    """
    client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

    response = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1792x1024",  # Closest to 16:9
        quality="standard",
        n=1,
        response_format="b64_json",
    )

    if response.data:
        b64_data = response.data[0].b64_json
        return base64.b64decode(b64_data)
    else:
        raise ValueError("No image generated")


def _upload_to_cloudflare(image_data: bytes) -> str:
    """
    Upload image to Cloudflare Images.

    Args:
        image_data: Image bytes

    Returns:
        Cloudflare image URL
    """
    cf_account_id = os.getenv('CLOUDFLARE_ACCOUNT_ID')
    cf_api_key = os.getenv('CLOUDFLARE_API_KEY')

    url = f"https://api.cloudflare.com/client/v4/accounts/{cf_account_id}/images/v1"

    headers = {
        "Authorization": f"Bearer {cf_api_key}",
    }

    # If image_data is a PIL Image, convert to bytes
    if hasattr(image_data, 'save'):
        import io
        buffer = io.BytesIO()
        image_data.save(buffer, format='PNG')
        image_data = buffer.getvalue()

    files = {
        "file": ("image.png", image_data, "image/png"),
    }

    response = httpx.post(url, headers=headers, files=files, timeout=30.0)
    response.raise_for_status()

    data = response.json()
    if data.get("success"):
        # Return the public URL
        image_id = data["result"]["id"]
        return f"https://imagedelivery.net/{cf_account_id}/{image_id}/public"
    else:
        raise ValueError(f"Cloudflare upload failed: {data.get('errors')}")
