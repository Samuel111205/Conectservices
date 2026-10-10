from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.bookings.models import Booking
from apps.providers.models import Provider

from .models import WeeklyAvailability


@transaction.atomic
def guardar_disponibilidade_semanal(*, provider, instance=None, **values):
    Provider.objects.select_for_update().get(pk=provider.pk)
    weekday = values.get("weekday", instance.weekday if instance else None)
    start_time = values.get("start_time", instance.start_time if instance else None)
    end_time = values.get("end_time", instance.end_time if instance else None)
    if start_time is None or end_time is None or end_time <= start_time:
        raise ValidationError(
            {"end_time": "A hora de fim deve ser posterior à hora de início."}
        )

    conflicts = WeeklyAvailability.objects.filter(
        provider=provider,
        weekday=weekday,
        start_time__lt=end_time,
        end_time__gt=start_time,
    )
    if instance is not None:
        conflicts = conflicts.exclude(pk=instance.pk)
    if conflicts.exists():
        raise ValidationError(
            {"start_time": "Este horário sobrepõe-se a outro horário semanal."}
        )

    if instance is not None:
        duplicate = WeeklyAvailability.objects.filter(
            provider=provider,
            weekday=weekday,
            start_time=start_time,
        ).exclude(pk=instance.pk)
        if duplicate.exists():
            raise ValidationError(
                {"start_time": "Já existe um horário com este dia e hora de início."}
            )

    if instance is None:
        return WeeklyAvailability.objects.create(provider=provider, **values)
    for campo, valor in values.items():
        setattr(instance, campo, valor)
    instance.save(update_fields=(*values.keys(), "updated_at"))
    return instance


@transaction.atomic
def eliminar_disponibilidade_semanal(*, provider, instance):
    Provider.objects.select_for_update().get(pk=provider.pk)
    instance.delete()


def _inicios_horarios_disponiveis(*, booking, day):
    if booking.duration_minutes is None:
        raise ValidationError(
            "A contratação não tem duração definida e não pode ser agendada."
        )

    zone = ZoneInfo("Africa/Luanda")
    day_start = timezone.make_aware(datetime.combine(day, time.min), zone)
    day_end = timezone.make_aware(datetime.combine(day + timedelta(days=1), time.min), zone)
    provider_windows = WeeklyAvailability.objects.filter(
        provider=booking.provider,
        weekday=day.weekday(),
    )
    existing_bookings = Booking.objects.filter(
        provider=booking.provider,
        status__in=(
            Booking.Status.SCHEDULED,
            Booking.Status.CONFIRMED,
            Booking.Status.IN_PROGRESS,
        ),
        scheduled_at__gte=day_start - timedelta(days=1),
        scheduled_at__lt=day_end,
    ).exclude(pk=booking.pk)

    busy_intervals = []
    for existing in existing_bookings:
        existing_start = timezone.localtime(existing.scheduled_at, zone)
        existing_duration = existing.duration_minutes or 1440
        busy_intervals.append(
            (
                existing_start,
                existing_start + timedelta(minutes=existing_duration),
            )
        )

    now = timezone.localtime(timezone.now(), zone)
    duracao = timedelta(minutes=booking.duration_minutes)
    slots = []
    for window in provider_windows:
        current_time = window.start_time
        while (
            datetime.combine(day, current_time) + duracao
            <= datetime.combine(day, window.end_time)
        ):
            slot_start = timezone.make_aware(
                datetime.combine(day, current_time),
                zone,
            )
            slot_end = slot_start + duracao
            if slot_start > now and not any(
                busy_start < slot_end and busy_end > slot_start
                for busy_start, busy_end in busy_intervals
            ):
                slots.append(slot_start)
            current_time = (
                datetime.combine(day, current_time) + duracao
            ).time()
    return slots


def horarios_disponiveis_contratacao(*, booking_id, actor, day):
    contratacao = Booking.objects.select_related(
        "provider",
        "client",
    ).filter(pk=booking_id).first()
    if contratacao is None:
        raise ValidationError({"booking_id": "A contratação indicada não existe."})
    if contratacao.client_id != actor.pk:
        raise PermissionDenied("Só o cliente pode consultar horários para a contratação.")
    if contratacao.status != Booking.Status.SCHEDULED:
        raise ValidationError(
            "Só é possível consultar horários para uma contratação por agendar."
        )
    return contratacao, _inicios_horarios_disponiveis(booking=contratacao, day=day)


@transaction.atomic
def agendar_contratacao(*, booking_id, actor, scheduled_at):
    booking_reference = Booking.objects.only("provider_id").filter(
        pk=booking_id
    ).first()
    if booking_reference is None:
        raise ValidationError({"booking_id": "A contratação indicada não existe."})

    Provider.objects.select_for_update().get(pk=booking_reference.provider_id)
    contratacao = Booking.objects.select_for_update().select_related(
        "provider",
        "client",
        "proposal__order",
    ).get(pk=booking_id)
    if contratacao.client_id != actor.pk:
        raise PermissionDenied("Só o cliente pode escolher o horário da contratação.")
    if contratacao.status != Booking.Status.SCHEDULED:
        raise ValidationError(
            "Só é possível escolher um horário para uma contratação por agendar."
        )
    if timezone.is_naive(scheduled_at):
        raise ValidationError(
            {"scheduled_at": "Indica a data e hora com fuso horário."}
        )

    zone = ZoneInfo("Africa/Luanda")
    local_start = timezone.localtime(scheduled_at, zone)
    available_starts = _inicios_horarios_disponiveis(
        booking=contratacao,
        day=local_start.date(),
    )
    if local_start not in available_starts:
        raise ValidationError(
            {"scheduled_at": "Este horário já não está disponível."}
        )
    contratacao.scheduled_at = local_start
    contratacao.save(update_fields=("scheduled_at", "updated_at"))
    return contratacao
