from celery import shared_task
from django.conf import settings


@shared_task(bind=True, max_retries=5, default_retry_delay=30)
def entregar_email_notificacao(self, notification_id):
    from .email import enviar_email_notificacao

    if not settings.EMAIL_NOTIFICATIONS_ENABLED:
        enviar_email_notificacao(notification_id=notification_id)
        return False

    if not enviar_email_notificacao(notification_id=notification_id):
        raise self.retry()
    return True


@shared_task(bind=True, max_retries=5, default_retry_delay=30)
def entregar_push_notificacao(self, notification_id):
    if not settings.PUSH_NOTIFICATIONS_ENABLED:
        return False
    from .models import Notification, PushDeviceToken

    notification = Notification.objects.filter(pk=notification_id).first()
    if notification is None:
        return False
    if not PushDeviceToken.objects.filter(
        user_id=notification.recipient_id, is_active=True
    ).exists():
        return True
    from .services import enviar_push_notification

    if not enviar_push_notification(notification_id=notification_id):
        raise self.retry()
    return True
