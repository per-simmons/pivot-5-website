#!/usr/bin/env python3
"""
API Connection Test Script

Tests connectivity to all required external services:
- Claude (Anthropic)
- OpenAI
- Google Gemini
- Airtable
- Mautic

Run with: python test_apis.py
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv('../.env.local')
load_dotenv('.env.local')

def test_anthropic():
    """Test Anthropic Claude API connection."""
    print("\n🔵 Testing Anthropic Claude API...")
    try:
        import anthropic

        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            print("   ❌ ANTHROPIC_API_KEY not set")
            return False

        client = anthropic.Anthropic(api_key=api_key)

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=50,
            messages=[{"role": "user", "content": "Say 'API test successful' in exactly those words."}],
        )

        result = response.content[0].text
        print(f"   ✅ Claude responded: {result[:50]}...")
        return True

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def test_openai():
    """Test OpenAI API connection."""
    print("\n🟢 Testing OpenAI API...")
    try:
        import openai

        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            print("   ❌ OPENAI_API_KEY not set")
            return False

        client = openai.OpenAI(api_key=api_key)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=50,
            messages=[{"role": "user", "content": "Say 'API test successful' in exactly those words."}],
        )

        result = response.choices[0].message.content
        print(f"   ✅ OpenAI responded: {result[:50]}...")
        return True

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def test_gemini():
    """Test Google Gemini API connection."""
    print("\n🟡 Testing Google Gemini API...")
    try:
        import google.generativeai as genai

        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            print("   ❌ GEMINI_API_KEY not set")
            return False

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-3-flash-preview')

        response = model.generate_content("Say 'API test successful' in exactly those words.")

        result = response.text
        print(f"   ✅ Gemini responded: {result[:50]}...")
        return True

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def test_airtable():
    """Test Airtable API connection."""
    print("\n🟠 Testing Airtable API...")
    try:
        from pyairtable import Api

        api_key = os.getenv('AIRTABLE_API_KEY')
        base_id = os.getenv('AIRTABLE_BASE_ID', 'appwSozYTkrsQWUXB')

        if not api_key:
            print("   ❌ AIRTABLE_API_KEY not set")
            return False

        api = Api(api_key)

        # Try to list tables in the base
        base = api.base(base_id)
        schema = base.schema()

        table_count = len(schema.tables)
        print(f"   ✅ Connected to Airtable base with {table_count} tables")
        return True

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def test_mautic():
    """Test Mautic API connection."""
    print("\n🔴 Testing Mautic API...")
    try:
        import httpx
        import base64

        base_url = os.getenv('MAUTIC_BASE_URL', 'https://app.pivotnews.com')
        username = os.getenv('MAUTIC_USERNAME')
        password = os.getenv('MAUTIC_PASSWORD')

        if not username or not password:
            print("   ❌ MAUTIC_USERNAME or MAUTIC_PASSWORD not set")
            return False

        # Basic auth
        auth_string = f"{username}:{password}"
        auth_bytes = base64.b64encode(auth_string.encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_bytes}",
        }

        response = httpx.get(
            f"{base_url}/api/contacts?limit=1",
            headers=headers,
            timeout=10.0,
        )

        if response.status_code == 200:
            data = response.json()
            total = data.get('total', 0)
            print(f"   ✅ Connected to Mautic ({total} total contacts)")
            return True
        else:
            print(f"   ❌ HTTP {response.status_code}: {response.text[:100]}")
            return False

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def main():
    """Run all API tests."""
    print("=" * 50)
    print("AI Editor 2.0 - API Connection Tests")
    print("=" * 50)

    results = {
        "Anthropic Claude": test_anthropic(),
        "OpenAI": test_openai(),
        "Google Gemini": test_gemini(),
        "Airtable": test_airtable(),
        "Mautic": test_mautic(),
    }

    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)

    all_passed = True
    for name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {name}: {status}")
        if not passed:
            all_passed = False

    print("\n" + "=" * 50)

    if all_passed:
        print("🎉 All API tests passed!")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed. Check your API keys.")
        sys.exit(1)


if __name__ == '__main__':
    main()
