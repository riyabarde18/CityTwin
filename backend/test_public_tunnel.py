import requests

FRONTEND_URL = "https://evaluation-thickness-clock-evolution.trycloudflare.com"
BACKEND_URL = "https://statement-regional-expansys-hudson.trycloudflare.com"

def main():
    print(f"Testing Public Frontend Tunnel: {FRONTEND_URL}")
    res_front = requests.get(FRONTEND_URL, timeout=15)
    print(f"Frontend Status Code: {res_front.status_code}")
    assert res_front.status_code == 200

    print(f"Testing Public Backend Tunnel: {BACKEND_URL}")
    res_back = requests.get(f"{BACKEND_URL}/api/health", timeout=15)
    print(f"Backend Status Code: {res_back.status_code}")
    print("Backend Health:", res_back.json())
    assert res_back.status_code == 200
    assert res_back.json()["status"] == "ok"

    print("\n[SUCCESS] Both fresh public Cloudflare tunnels are 100% active and responding!")

if __name__ == "__main__":
    main()
