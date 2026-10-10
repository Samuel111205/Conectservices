from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.providers.models import Provider


class WeeklyAvailability(models.Model):
    class Weekday(models.IntegerChoices):
        MONDAY = 0, "Segunda-feira"
        TUESDAY = 1, "Terça-feira"
        WEDNESDAY = 2, "Quarta-feira"
        THURSDAY = 3, "Quinta-feira"
        FRIDAY = 4, "Sexta-feira"
        SATURDAY = 5, "Sábado"
        SUNDAY = 6, "Domingo"

    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name="weekly_availability",
    )
    weekday = models.PositiveSmallIntegerField(
        choices=Weekday.choices,
        validators=(MinValueValidator(0), MaxValueValidator(6)),
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("weekday", "start_time", "id")
        verbose_name = "horário semanal"
        verbose_name_plural = "horários semanais"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(weekday__gte=0, weekday__lte=6),
                name="weekly_availability_weekday_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(end_time__gt=models.F("start_time")),
                name="weekly_availability_end_after_start",
            ),
            models.UniqueConstraint(
                fields=("provider", "weekday", "start_time"),
                name="unique_provider_weekday_start_time",
            ),
        ]
        indexes = [
            models.Index(
                fields=("provider", "weekday", "start_time"),
                name="weekly_avail_provider_day_idx",
            ),
        ]

    def clean(self):
        super().clean()
        if self.end_time <= self.start_time:
            raise ValidationError(
                {"end_time": "A hora de fim deve ser posterior à hora de início."}
            )
        conflicts = WeeklyAvailability.objects.filter(
            provider=self.provider,
            weekday=self.weekday,
            start_time__lt=self.end_time,
            end_time__gt=self.start_time,
        )
        if self.pk:
            conflicts = conflicts.exclude(pk=self.pk)
        if conflicts.exists():
            raise ValidationError(
                {"start_time": "Este horário sobrepõe-se a outro horário semanal."}
            )

    def __str__(self):
        return (
            f"{self.provider} — {self.get_weekday_display()} "
            f"{self.start_time:%H:%M}-{self.end_time:%H:%M}"
        )
