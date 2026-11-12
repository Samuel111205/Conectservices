from django.conf import settings
from urllib.parse import urlsplit


def web_app(request):
    web_app_url = settings.WEB_APP_URL
    if settings.DEBUG and web_app_url:
        configured_url = urlsplit(web_app_url)
        request_host = urlsplit(f"//{request.get_host()}").hostname
        if request_host:
            web_app_url = f"{request.scheme}://{request_host}:{configured_url.port or 5173}"
    return {"web_app_url": web_app_url}
