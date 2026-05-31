import urllib.request
import json

def test_endpoint(url):
    print(f"Testing URL: {url}")
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            print(f"  [SUCCESS] Status: {status}")
            print(f"  Response: {body[:300]}")
    except Exception as e:
        print(f"  [ERROR] Failed to fetch: {e}")

if __name__ == "__main__":
    test_endpoint("http://127.0.0.1:8000/health")
    print()
    test_endpoint("http://127.0.0.1:8000/jobs/550e8400-e29b-41d4-a716-446655440000")
