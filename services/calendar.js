/**
 * Google Calendar service for appointment scheduling.
 * Uses OAuth2 refresh token flow (same credentials as cushlabs booking system).
 */

const TIMEZONE = 'America/New_York';
const SESSION_DURATION_MIN = 30;
const MIN_ADVANCE_MIN = 210; // 3.5 hours minimum advance booking
const BUSINESS_HOURS = { start: 9, end: 17 }; // 9 AM - 5 PM ET, weekdays only
const COACH_EMAIL = process.env.COACH_EMAIL || 'rcushmaniii@gmail.com';

// Token cache
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get a valid Google OAuth2 access token (auto-refreshes).
 */
async function getAccessToken() {
    const now = Date.now();
    if (cachedToken && tokenExpiresAt > now + 300000) {
        return cachedToken;
    }

    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
        throw new Error('Google OAuth credentials not configured');
    }

    const body = `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&client_secret=${encodeURIComponent(GOOGLE_CLIENT_SECRET)}&refresh_token=${encodeURIComponent(GOOGLE_REFRESH_TOKEN)}&grant_type=refresh_token`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!res.ok) throw new Error(`OAuth error: ${await res.text()}`);
    const tokenData = await res.json();
    if (!tokenData?.access_token) throw new Error('No access_token returned by Google');

    cachedToken = tokenData.access_token;
    tokenExpiresAt = now + (tokenData.expires_in || 3600) * 1000;
    return cachedToken;
}

/**
 * Get available 30-min appointment slots for the next N business days.
 * Checks Google Calendar FreeBusy API for real availability.
 */
async function getAvailableSlots(timezone = TIMEZONE) {
    const calendarId = process.env.CALENDAR_ID;
    const hasGoogleCreds = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN && calendarId;

    if (!hasGoogleCreds) {
        console.log('[Calendar] Google credentials not set — returning default business hours');
        return getDefaultSlots(timezone);
    }

    try {
        const accessToken = await getAccessToken();
        return await getGoogleSlots(accessToken, calendarId, timezone);
    } catch (err) {
        console.error('[Calendar] Google API error, falling back to defaults:', err.message);
        return getDefaultSlots(timezone);
    }
}

/**
 * Query Google FreeBusy API for real availability.
 */
async function getGoogleSlots(accessToken, calendarId, timezone) {
    const slots = [];
    const now = new Date();
    const minBookingTime = new Date(now.getTime() + MIN_ADVANCE_MIN * 60 * 1000);

    let daysFound = 0;
    let dayOffset = 0;

    while (daysFound < 5) {
        const candidate = new Date(now);
        candidate.setDate(now.getDate() + dayOffset);
        dayOffset++;

        const dayOfWeek = candidate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

        const dateStr = candidate.toISOString().split('T')[0];
        const timeMin = `${dateStr}T${pad(BUSINESS_HOURS.start)}:00:00`;
        const timeMax = `${dateStr}T${pad(BUSINESS_HOURS.end)}:00:00`;

        // Query FreeBusy
        const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                timeMin: new Date(`${timeMin}-05:00`).toISOString(),
                timeMax: new Date(`${timeMax}-05:00`).toISOString(),
                timeZone: timezone,
                items: [{ id: calendarId }],
            }),
        });

        if (!res.ok) throw new Error(`FreeBusy API: ${res.status}`);
        const data = await res.json();

        const busyPeriods = (data?.calendars?.[calendarId]?.busy || []).map(b => ({
            start: new Date(b.start),
            end: new Date(b.end),
        }));

        // Generate all possible 30-min slots
        const daySlots = [];
        for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour++) {
            for (let min = 0; min < 60; min += 30) {
                const slotStart = new Date(`${dateStr}T${pad(hour)}:${pad(min)}:00-05:00`);
                const slotEnd = new Date(slotStart.getTime() + SESSION_DURATION_MIN * 60 * 1000);

                // Skip past slots and slots too soon
                if (slotStart < minBookingTime) continue;

                // Skip slots that overlap with busy periods
                const isBusy = busyPeriods.some(b =>
                    slotStart < b.end && slotEnd > b.start
                );
                if (isBusy) continue;

                const period = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                daySlots.push(`${displayHour}:${pad(min)} ${period}`);
            }
        }

        if (daySlots.length > 0) {
            const dayLabel = candidate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: timezone,
            });
            slots.push({ dayLabel, date: dateStr, times: daySlots });
            daysFound++;
        }
    }

    return slots;
}

/**
 * Fallback: generate default business hour slots (no Google API).
 */
function getDefaultSlots(timezone) {
    const slots = [];
    const now = new Date();
    let daysFound = 0;
    let dayOffset = 1;

    while (daysFound < 5) {
        const candidate = new Date(now);
        candidate.setDate(now.getDate() + dayOffset);
        dayOffset++;

        const dayOfWeek = candidate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const dayLabel = candidate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            timeZone: timezone,
        });

        const dateStr = candidate.toISOString().split('T')[0];
        const times = [];
        for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour++) {
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour > 12 ? hour - 12 : hour;
            times.push(`${displayHour}:00 ${period}`);
        }

        slots.push({ dayLabel, date: dateStr, times });
        daysFound++;
    }

    return slots;
}

/**
 * Book a 30-minute discovery session on Google Calendar.
 * Creates event with attendees (sends email invites) and Google Meet link.
 */
async function bookAppointment({ caller_name, caller_email, date_time, notes }) {
    const appointmentDate = new Date(date_time);
    const endDate = new Date(appointmentDate.getTime() + SESSION_DURATION_MIN * 60 * 1000);

    const friendlyTime = appointmentDate.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: TIMEZONE,
    });

    const calendarId = process.env.CALENDAR_ID;
    const hasGoogleCreds = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN && calendarId;

    if (!hasGoogleCreds) {
        console.log('[Calendar] Google credentials not set — booking logged only');
        return { success: true, friendlyTime, meetLink: null, eventId: null };
    }

    try {
        const accessToken = await getAccessToken();

        const eventBody = {
            summary: `Discovery Session: ${caller_name} — NYC Executive Coaching`,
            description: `Executive Coaching Discovery Session\nName: ${caller_name}\nEmail: ${caller_email}${notes ? `\nNotes: ${notes}` : ''}`,
            start: { dateTime: date_time, timeZone: TIMEZONE },
            end: { dateTime: endDate.toISOString(), timeZone: TIMEZONE },
            attendees: [
                { email: caller_email },
                { email: COACH_EMAIL },
            ],
            conferenceData: {
                createRequest: {
                    requestId: `coaching-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'email', minutes: 60 },
                ],
            },
        };

        const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventBody),
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Calendar API ${res.status}: ${errText}`);
        }

        const event = await res.json();
        const meetLink = event.hangoutLink ||
            event?.conferenceData?.entryPoints?.find(p => p?.uri)?.uri || null;

        console.log('[Calendar] Event created:', event.id, '| Meet:', meetLink);

        return {
            success: true,
            friendlyTime,
            meetLink,
            eventId: event.id,
            attendees: [caller_email, COACH_EMAIL],
        };
    } catch (err) {
        console.error('[Calendar] Failed to create event:', err.message);
        throw err;
    }
}

function pad(n) {
    return String(n).padStart(2, '0');
}

module.exports = { getAvailableSlots, bookAppointment };
