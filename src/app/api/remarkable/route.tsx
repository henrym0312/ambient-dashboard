import { ImageResponse } from 'next/og';
import { NextRequest, NextResponse, connection } from 'next/server';
import { loadRemarkableData } from '@/app/api/remarkable/data/route';
import { rotatePng90 } from '@/lib/png-rotate';
import {
  RM_WIDTH,
  RM_HEIGHT,
  RM_TZ,
  getWeatherConditionLabel,
  getEventTypeTag,
  getRelativeTime,
  getNextEventStatus,
  getReminderListLabel,
  selectTopReminders,
  buildSleepChartModel,
  groupCalendarEvents,
} from '@/lib/remarkable';

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  await connection();

  const url = new URL(req.url);
  const rotateParam = url.searchParams.get('rotate'); // 'cw' (90deg) | 'ccw' (-90deg) | null
  const isDeviceBuffer =
    url.searchParams.get('device') === 'rm2' || rotateParam === 'cw' || rotateParam === 'ccw';
  const rotateDir: 'cw' | 'ccw' = rotateParam === 'ccw' ? 'ccw' : 'cw';

  const { weather, oura, events, gold, reminders } = await loadRemarkableData();

  const now = new Date();
  const timeString = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: RM_TZ,
  });
  const dateString = now
    .toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      timeZone: RM_TZ,
    })
    .toUpperCase();

  const weatherLabel = getWeatherConditionLabel(weather.weatherCode, weather.isDay).toUpperCase();
  const nextEvent = events.length > 0 ? events[0] : null;
  const nextEventStatus = getNextEventStatus(now, nextEvent);
  const sleepChart = buildSleepChartModel(oura.history || [], 620, 260);
  const scheduleGroups = groupCalendarEvents(now, events, 5);
  const remindersModel = selectTopReminders(now, reminders, 8);
  const leftColReminders = remindersModel.items.slice(0, 4);
  const rightColReminders = remindersModel.items.slice(4, 8);

  const stepsFormatted =
    typeof oura.steps === 'number' ? oura.steps.toLocaleString('en-GB') : String(oura.steps ?? '--');

  const profitSign = gold.isProfit ? '+' : '-';
  const profitAbs = Math.abs(gold.profitGbp || 0).toFixed(2);
  const profitPctStr = `${gold.isProfit ? '+' : ''}${(gold.profitPct || 0).toFixed(1)}%`;

  const landscapeCanvas = (
    <div
      style={{
        width: '1872px',
        height: '1404px',
        backgroundColor: '#FAF9F5',
        color: '#111111',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '40px',
        boxSizing: 'border-box',
        fontFamily: 'sans-serif',
      }}
    >
        {/* TOP HEADER BAR: DATE + UP NEXT + WEATHER + GOLD PRICE (NO CLOCK) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            width: '100%',
            height: '184px',
            borderBottom: '4px solid #111111',
            paddingBottom: '22px',
          }}
        >
          {/* 1. DATE MASTHEAD */}
          <div
            style={{
              width: '390px',
              border: '3px solid #111111',
              backgroundColor: '#111111',
              color: '#FFFFFF',
              padding: '18px 22px',
              marginRight: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1.5px solid #444444',
                paddingBottom: '6px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '2.5px' }}>
                AMBIENT E-INK
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#CCCCCC', letterSpacing: '1.5px' }}>
                DURHAM, UK
              </span>
            </div>

            <div
              style={{
                fontSize: '34px',
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.5px',
                color: '#FFFFFF',
              }}
            >
              {dateString}
            </div>

            <div style={{ fontSize: '12px', fontWeight: 700, color: '#BBBBBB', letterSpacing: '2px' }}>
              DAILY BRIEFING • LIVE SYNC
            </div>
          </div>

          {/* 2. WIDGET 1: UP NEXT */}
          <div
            style={{
              width: '610px',
              border: '3px solid #111111',
              backgroundColor: '#FFFFFF',
              padding: '16px 20px',
              marginRight: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid #DDDDDD',
                paddingBottom: '6px',
              }}
            >
              <span
                style={{
                  padding: '3px 10px',
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  border: '1.5px solid #111111',
                  backgroundColor: nextEventStatus.isActive ? '#111111' : '#EBEAE4',
                  color: nextEventStatus.isActive ? '#FFFFFF' : '#111111',
                }}
              >
                {nextEventStatus.isActive ? 'NOW ACTIVE' : '01 / UP NEXT'}
              </span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#111111' }}>
                {nextEvent ? getRelativeTime(now, nextEvent.start, nextEvent.end) : 'RELAX'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '26px', fontWeight: 800, color: '#111111' }}>
                {nextEvent ? nextEvent.summary.slice(0, 34) : 'Clear Schedule'}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#555555', marginTop: '2px' }}>
                {nextEvent?.location
                  ? nextEvent.location.slice(0, 42)
                  : 'No immediate calendar conflicts'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '2px solid #DDDDDD',
                paddingTop: '6px',
                fontSize: '13px',
                fontWeight: 800,
                color: '#333333',
              }}
            >
              <span>
                {nextEvent
                  ? `${new Date(nextEvent.start).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: RM_TZ,
                    })}${
                      nextEvent.end
                        ? ` - ${new Date(nextEvent.end).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: RM_TZ,
                          })}`
                        : ''
                    }`
                  : 'ALL CLEAR'}
              </span>
              <span style={{ border: '1.5px solid #111111', padding: '1px 7px' }}>
                {nextEvent ? getEventTypeTag(nextEvent.summary) : 'STANDBY'}
              </span>
            </div>
          </div>

          {/* 3. WIDGET 2: WEATHER */}
          <div
            style={{
              width: '310px',
              border: '3px solid #111111',
              backgroundColor: '#FFFFFF',
              padding: '16px 20px',
              marginRight: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid #DDDDDD',
                paddingBottom: '6px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1.5px', color: '#333333' }}>
                02 / WEATHER
              </span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#111111' }}>
                {weatherLabel}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontSize: '52px', fontWeight: 800, lineHeight: 1 }}>
                {`${String(weather.temp)}°C`}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  border: '1.5px solid #111111',
                  padding: '2px 8px',
                }}
              >
                {`AQI ${String(weather.aqi ?? '--')}`}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                borderTop: '2px solid #DDDDDD',
                paddingTop: '6px',
                fontSize: '13px',
                fontWeight: 800,
                color: '#333333',
              }}
            >
              <span>PRECIPITATION</span>
              <span>{`${String(weather.precipitation ?? 0)} MM`}</span>
            </div>
          </div>

          {/* 4. WIDGET 3: GOLD PRICE */}
          <div
            style={{
              flex: 1,
              border: '3px solid #111111',
              backgroundColor: '#FFFFFF',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid #DDDDDD',
                paddingBottom: '6px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1.5px', color: '#333333' }}>
                03 / ½ SOVEREIGN
              </span>
              <span
                style={{
                  backgroundColor: '#111111',
                  color: '#FFFFFF',
                  padding: '2px 7px',
                  fontSize: '12px',
                  fontWeight: 800,
                }}
              >
                3.66G 22K
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '42px', fontWeight: 800, lineHeight: 1 }}>
                {gold.currentValue ? `£${gold.currentValue.toFixed(2)}` : '£--'}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  padding: '4px 8px',
                  border: '2px solid #111111',
                  backgroundColor: gold.isProfit ? '#111111' : '#FFFFFF',
                  color: gold.isProfit ? '#FFFFFF' : '#111111',
                }}
              >
                {`${profitSign}£${profitAbs} (${profitPctStr})`}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                borderTop: '2px solid #DDDDDD',
                paddingTop: '6px',
                fontSize: '13px',
                fontWeight: 800,
                color: '#333333',
              }}
            >
              <span>{`COST: £${(gold.purchasePrice || 385).toFixed(0)}`}</span>
              <span>{`SPOT: ${gold.gramPriceGbp ? `£${gold.gramPriceGbp.toFixed(2)}/G` : '--'}`}</span>
            </div>
          </div>
        </div>

        {/* MAIN 2-COLUMN LANDSCAPE BODY */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            width: '100%',
            height: '1104px',
            paddingTop: '24px',
          }}
        >
          {/* LEFT COLUMN (720px): OURA BIOMETRICS + 7-DAY SLEEP TREND */}
          <div
            style={{
              width: '720px',
              marginRight: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* WIDGET 4: OURA BIOMETRICS */}
            <div
              style={{
                height: '380px',
                border: '3px solid #111111',
                backgroundColor: '#FFFFFF',
                padding: '24px',
                marginBottom: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '2px solid #111111',
                  paddingBottom: '12px',
                }}
              >
                <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '2px' }}>
                  04 / OURA BIOMETRICS
                </span>
                <span
                  style={{
                    border: '2px solid #111111',
                    padding: '3px 10px',
                    fontSize: '14px',
                    fontWeight: 800,
                  }}
                >
                  {oura.battery !== null && oura.battery !== undefined
                    ? `RING ${oura.battery}%`
                    : 'RING --%'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingTop: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: '14px', flex: 1 }}>
                  <div
                    style={{
                      flex: 1,
                      border: '2px solid #111111',
                      backgroundColor: '#FAF9F5',
                      padding: '16px',
                      marginRight: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1.5px', color: '#444444' }}>
                      READINESS
                    </span>
                    <span style={{ fontSize: '54px', fontWeight: 800, lineHeight: 1 }}>
                      {String(oura.readiness)}
                    </span>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      border: '2px solid #111111',
                      backgroundColor: '#FAF9F5',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1.5px', color: '#444444' }}>
                      SLEEP SCORE
                    </span>
                    <span style={{ fontSize: '54px', fontWeight: 800, lineHeight: 1 }}>
                      {String(oura.sleep)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', flex: 1 }}>
                  <div
                    style={{
                      flex: 1,
                      border: '2px solid #111111',
                      backgroundColor: '#FFFFFF',
                      padding: '16px',
                      marginRight: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1.5px', color: '#444444' }}>
                      DAILY STEPS
                    </span>
                    <span style={{ fontSize: '44px', fontWeight: 800, lineHeight: 1 }}>
                      {stepsFormatted}
                    </span>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      border: '2px solid #111111',
                      backgroundColor: '#FFFFFF',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1.5px', color: '#444444' }}>
                      HIGH STRESS
                    </span>
                    <span style={{ fontSize: '44px', fontWeight: 800, lineHeight: 1 }}>
                      {`${String(oura.stress)}m`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* WIDGET 5: 7-DAY SLEEP TREND */}
            <div
              style={{
                flex: 1,
                border: '3px solid #111111',
                backgroundColor: '#FFFFFF',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '2px solid #111111',
                  paddingBottom: '12px',
                }}
              >
                <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '2px' }}>
                  05 / 7-DAY SLEEP TREND
                </span>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  {sleepChart.avgHours && (
                    <span
                      style={{
                        border: '2px solid #111111',
                        backgroundColor: '#FAF9F5',
                        padding: '4px 12px',
                        fontSize: '14px',
                        fontWeight: 800,
                        marginRight: '10px',
                      }}
                    >
                      {`${sleepChart.avgHours}H AVG`}
                    </span>
                  )}
                  {sleepChart.avgScore && (
                    <span
                      style={{
                        backgroundColor: '#111111',
                        color: '#FFFFFF',
                        padding: '4px 12px',
                        fontSize: '14px',
                        fontWeight: 800,
                      }}
                    >
                      {`${sleepChart.avgScore} SCORE`}
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  flex: 1,
                  paddingTop: '28px',
                  paddingLeft: '8px',
                  paddingRight: '8px',
                }}
              >
                {sleepChart.points.length > 0 ? (
                  sleepChart.points.map((pt, idx) => {
                    const pct = Math.max(15, Math.min(100, Math.round(((pt.hours || 0) / 9.5) * 100)));
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          height: '100%',
                          flex: 1,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '16px',
                            fontWeight: 800,
                            color: '#111111',
                            marginBottom: '10px',
                          }}
                        >
                          {pt.timeStr}
                        </span>

                        <div
                          style={{
                            width: '58px',
                            height: '420px',
                            border: '2px solid #111111',
                            backgroundColor: '#FAF9F5',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            padding: '4px',
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: `${pct}%`,
                              backgroundColor: pt.isLatest ? '#111111' : '#444444',
                            }}
                          />
                        </div>

                        <span
                          style={{
                            fontSize: '17px',
                            fontWeight: 800,
                            color: '#111111',
                            marginTop: '12px',
                          }}
                        >
                          {pt.label}
                        </span>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#555555',
                          }}
                        >
                          {pt.sleepScore > 0 ? `${pt.sleepScore}pt` : '--'}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#666666', margin: 'auto' }}>
                    No sleep history available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: CALENDAR SCHEDULE (TOP) + REMINDERS (BOTTOM) */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* WIDGET 6: CALENDAR SCHEDULE */}
            <div
              style={{
                flex: 1,
                border: '3px solid #111111',
                backgroundColor: '#FFFFFF',
                padding: '24px',
                marginBottom: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #111111',
                    paddingBottom: '12px',
                    marginBottom: '14px',
                  }}
                >
                  <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '2px' }}>
                    06 / CALENDAR SCHEDULE
                  </span>
                  <span
                    style={{
                      backgroundColor: '#111111',
                      color: '#FFFFFF',
                      padding: '4px 10px',
                      fontSize: '13px',
                      fontWeight: 800,
                    }}
                  >
                    {`${scheduleGroups.eventsLeftToday} LEFT TODAY`}
                  </span>
                </div>

                {scheduleGroups.groups.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {scheduleGroups.groups.map((group) => (
                      <div
                        key={group.iso}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          marginBottom: '14px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            borderBottom: '2px solid #CCCCCC',
                            paddingBottom: '4px',
                            marginBottom: '6px',
                            fontSize: '13px',
                            fontWeight: 800,
                            letterSpacing: '2px',
                          }}
                        >
                          <span>{group.dateLabel}</span>
                          {group.isToday && <span style={{ color: '#555555' }}>ACTIVE DAY</span>}
                        </div>

                        {group.items.map((ev, idx) => {
                          const evTime = new Date(ev.start).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: RM_TZ,
                          });
                          const nowMs = now.getTime();
                          const startMs = new Date(ev.start).getTime();
                          const endMs = ev.end ? new Date(ev.end).getTime() : startMs + 3600000;
                          const isActive = startMs <= nowMs && endMs > nowMs;
                          const tag = getEventTypeTag(ev.summary);

                          return (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 10px',
                                borderBottom: '1px solid #E0E0E0',
                                backgroundColor: isActive ? '#111111' : 'transparent',
                                color: isActive ? '#FFFFFF' : '#111111',
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                                <span style={{ fontSize: '20px', fontWeight: 800, width: '78px' }}>
                                  {evTime}
                                </span>
                                <span style={{ fontSize: '22px', fontWeight: 700, marginRight: '14px' }}>
                                  {ev.summary.slice(0, 44)}
                                </span>
                                {ev.location && (
                                  <span
                                    style={{
                                      fontSize: '15px',
                                      fontWeight: 600,
                                      color: isActive ? '#DDDDDD' : '#555555',
                                    }}
                                  >
                                    {`• ${ev.location.slice(0, 28)}`}
                                  </span>
                                )}
                              </div>

                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  padding: '4px 10px',
                                  border: isActive ? '1.5px solid #FFFFFF' : '1.5px solid #111111',
                                  backgroundColor: isActive
                                    ? '#FFFFFF'
                                    : ev.calendar === 'Uni'
                                      ? '#111111'
                                      : '#FAF9F5',
                                  color: isActive
                                    ? '#111111'
                                    : ev.calendar === 'Uni'
                                      ? '#FFFFFF'
                                      : '#111111',
                                }}
                              >
                                {isActive ? 'LIVE' : tag}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#666666', marginTop: '40px' }}>
                    No upcoming schedule events
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  borderTop: '2px solid #DDDDDD',
                  paddingTop: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#555555',
                }}
              >
                <span>MAIN + UNIVERSITY FEEDS</span>
                <span>21-DAY HORIZON</span>
              </div>
            </div>

            {/* WIDGET 7: REMINDERS (2 COLUMNS) */}
            <div
              style={{
                flex: 1,
                border: '3px solid #111111',
                backgroundColor: '#FFFFFF',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #111111',
                    paddingBottom: '12px',
                    marginBottom: '14px',
                  }}
                >
                  <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '2px' }}>
                    07 / TASKS &amp; REMINDERS
                  </span>
                  <span
                    style={{
                      backgroundColor: '#111111',
                      color: '#FFFFFF',
                      padding: '4px 10px',
                      fontSize: '13px',
                      fontWeight: 800,
                    }}
                  >
                    {`${remindersModel.leftToday} DUE TODAY`}
                  </span>
                </div>

                {remindersModel.items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                    {/* Column 1 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginRight: '24px' }}>
                      {leftColReminders.map(({ item, meta }, idx) => {
                        const listName = getReminderListLabel(item.list || item.listName).toUpperCase();
                        const title = (item.title || item.text || 'Untitled').slice(0, 30);
                        return (
                          <div
                            key={item.id || idx}
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '14px 6px',
                              borderBottom: '1px solid #E0E0E0',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '20px', fontWeight: 700, color: '#111111' }}>
                                {title}
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: '#555555' }}>
                                {listName}
                              </span>
                            </div>

                            {meta.label && (
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  padding: '4px 8px',
                                  border: '2px solid #111111',
                                  backgroundColor: meta.isOverdue
                                    ? '#111111'
                                    : meta.isToday
                                      ? '#EBEAE4'
                                      : '#FFFFFF',
                                  color: meta.isOverdue ? '#FFFFFF' : '#111111',
                                }}
                              >
                                {meta.label.toUpperCase()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Column 2 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {rightColReminders.map(({ item, meta }, idx) => {
                        const listName = getReminderListLabel(item.list || item.listName).toUpperCase();
                        const title = (item.title || item.text || 'Untitled').slice(0, 30);
                        return (
                          <div
                            key={item.id || idx}
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '14px 6px',
                              borderBottom: '1px solid #E0E0E0',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '20px', fontWeight: 700, color: '#111111' }}>
                                {title}
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: '#555555' }}>
                                {listName}
                              </span>
                            </div>

                            {meta.label && (
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  padding: '4px 8px',
                                  border: '2px solid #111111',
                                  backgroundColor: meta.isOverdue
                                    ? '#111111'
                                    : meta.isToday
                                      ? '#EBEAE4'
                                      : '#FFFFFF',
                                  color: meta.isOverdue ? '#FFFFFF' : '#111111',
                                }}
                              >
                                {meta.label.toUpperCase()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#666666', marginTop: '40px' }}>
                    All tasks and reminders complete
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  borderTop: '2px solid #DDDDDD',
                  paddingTop: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#555555',
                }}
              >
                <span>APPLE REMINDERS SYNC</span>
                <span>2-COLUMN PRIORITY GRID</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  );

  const landscapeResponse = new ImageResponse(landscapeCanvas, {
    width: RM_WIDTH,
    height: RM_HEIGHT,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });

  if (isDeviceBuffer) {
    // Rotate the 1872x1404 PNG buffer directly by 90 degrees into a 1404x1872 PNG
    // so there are zero Satori SVG clipPath white strips on the left or right.
    const rawBuffer = await landscapeResponse.arrayBuffer();
    const rotatedBuffer = rotatePng90(rawBuffer, rotateDir);
    return new NextResponse(new Uint8Array(rotatedBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  return landscapeResponse;
}
