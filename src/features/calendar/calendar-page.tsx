import { useMemo, useState, useEffect } from "react";

import { UserRole, type Holiday } from "@/shared";
import { LoadingButton } from "@/components/loading-button";
import { api } from "@/lib/api";
import { showSuccessToast } from "@/lib/toast";
import { useAuth } from "@/features/auth/auth-context";

const monthTitleFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });

const toDateKey = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

const buildCalendarDays = (visibleMonth: Date) => {
  const start = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), 1));
  const end = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth() + 1, 0));

  const gridStart = new Date(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());

  const gridEnd = new Date(end);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const days: Date[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
};

export const CalendarPage = () => {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [title, setTitle] = useState("");
  const [dateUtc, setDateUtc] = useState("");
  const [savingHoliday, setSavingHoliday] = useState(false);

  const canEdit = user?.userRole === UserRole.ADMIN || user?.userRole === UserRole.MANAGER;

  const load = async () => {
    setHolidays(await api<Holiday[]>("/calendar/holidays"));
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedHoliday) {
      setTitle("");
      setDateUtc("");
      return;
    }

    setTitle(selectedHoliday.title);
    setDateUtc(toDateKey(selectedHoliday.dateUtc));
  }, [selectedHoliday]);

  const holidayMap = useMemo(
    () => new Map(holidays.map((holiday) => [toDateKey(holiday.dateUtc), holiday])),
    [holidays],
  );

  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  const weekdayLabels = useMemo(() => {
    const start = new Date(Date.UTC(2026, 0, 4));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + index);
      return weekdayFormatter.format(day);
    });
  }, []);

  const submitHoliday = async () => {
    if (!title.trim() || !dateUtc) {
      return;
    }

    const payload = {
      title: title.trim(),
      dateUtc: new Date(`${dateUtc}T00:00:00.000Z`).toISOString(),
    };

    setSavingHoliday(true);
    try {
      if (selectedHoliday) {
        await api(`/calendar/holidays/${selectedHoliday.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
          suppressGlobalLoader: true,
        });
        showSuccessToast("Holiday updated");
      } else {
        await api("/calendar/holidays", {
          method: "POST",
          body: JSON.stringify(payload),
          suppressGlobalLoader: true,
        });
        showSuccessToast("Holiday saved");
      }

      setSelectedHoliday(null);
      setTitle("");
      setDateUtc("");
      await load();
    } finally {
      setSavingHoliday(false);
    }
  };

  return (
    <div className="manager-dashboard-page">
      <div className="calendar-page-header">
        <div>
          <h2>Holiday Calendar</h2>
          <p>Saturday and Sunday are default holidays. Custom holidays are shown across all portals.</p>
        </div>
        <div className="calendar-page-nav">
          <button onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)))} type="button">
            ‹ Prev Month
          </button>
          <strong>{monthTitleFormatter.format(visibleMonth)}</strong>
          <button onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1)))} type="button">
            Next Month ›
          </button>
        </div>
      </div>

      <div className="calendar-layout">
        <section className="calendar-panel">
          <div className="calendar-grid calendar-grid--labels">
            {weekdayLabels.map((label) => (
              <div key={label} className="calendar-weekday">
                {label}
              </div>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((day) => {
              const key = toDateKey(day);
              const holiday = holidayMap.get(key) ?? null;
              const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
              const isCurrentMonth = day.getUTCMonth() === visibleMonth.getUTCMonth();

              return (
                <button
                  key={key}
                  className={`calendar-day${isWeekend ? " calendar-day--weekend" : ""}${holiday ? " calendar-day--holiday" : ""}${!isCurrentMonth ? " calendar-day--muted" : ""}`}
                  disabled={!canEdit}
                  onClick={() => {
                    if (!canEdit) {
                      return;
                    }
                    setSelectedHoliday(holiday);
                    setDateUtc(key);
                    if (!holiday) {
                      setTitle("");
                    }
                  }}
                  type="button"
                >
                  <span className="calendar-day__number">{day.getUTCDate()}</span>
                  {holiday ? <span className="calendar-day__title">{holiday.title}</span> : null}
                  {!holiday && isWeekend ? <span className="calendar-day__title">Weekend</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="calendar-sidecard">
          <div className="calendar-sidecard__header">
            <h3>{canEdit ? (selectedHoliday ? "Edit Holiday" : "Add Holiday") : "Holiday Details"}</h3>
            <p>{canEdit ? "Create or update company holidays." : "View upcoming company holidays."}</p>
          </div>

          {canEdit ? (
            <div className="form-grid">
              <label className="field">
                <span className="manager-form-label">Holiday Title</span>
                <input className="input" placeholder="Diwali Holiday" value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="field">
                <span className="manager-form-label">Holiday Date</span>
                <input className="input" type="date" value={dateUtc} onChange={(event) => setDateUtc(event.target.value)} />
              </label>
              <div className="manager-form-actions">
                {selectedHoliday ? (
                  <button className="timesheet-secondary-button" onClick={() => setSelectedHoliday(null)} type="button">
                    Cancel
                  </button>
                ) : null}
                <LoadingButton className="timesheet-primary-button" loading={savingHoliday} onClick={() => void submitHoliday()} type="button">
                  {selectedHoliday ? "Update Holiday" : "Save Holiday"}
                </LoadingButton>
              </div>
            </div>
          ) : null}

          <div className="calendar-holiday-list">
            {holidays.map((holiday) => (
              <article key={holiday.id} className="calendar-holiday-item">
                <strong>{holiday.title}</strong>
                <span>{new Date(holiday.dateUtc).toLocaleDateString("en-GB")}</span>
              </article>
            ))}
            {holidays.length === 0 ? <p className="calendar-empty">No custom holidays added yet.</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
};
