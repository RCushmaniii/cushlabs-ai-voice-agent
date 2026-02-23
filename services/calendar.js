/**
 * Calendar service for appointment scheduling.
 *
 * Currently generates availability from business hours.
 * TODO: Replace with Google Calendar API integration for real-time availability.
 */

const BUSINESS_HOURS = { start: 9, end: 17 }; // 9 AM - 5 PM
const SESSION_DURATION_MIN = 30;
const SLOT_INTERVAL_MIN = 60; // Offer slots every hour
const DAYS_AHEAD = 5;
const COACH_EMAIL = process.env.COACH_EMAIL || 'rcushmaniii@gmail.com';

/**
 * Get available appointment slots for the next N business days.
 * Returns an array of { dayLabel, date, times[] } objects.
 */
async function getAvailableSlots(timezone = 'America/New_York') {
    const slots = [];
    const now = new Date();

    let daysFound = 0;
    let dayOffset = 1; // Start from tomorrow

    while (daysFound < DAYS_AHEAD) {
        const candidate = new Date(now);
        candidate.setDate(now.getDate() + dayOffset);
        dayOffset++;

        const dayOfWeek = candidate.getDay();
        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const dayLabel = candidate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            timeZone: timezone,
        });

        const dateStr = candidate.toISOString().split('T')[0]; // YYYY-MM-DD

        const times = [];
        for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour += (SLOT_INTERVAL_MIN / 60)) {
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
 * Book a 30-minute discovery session.
 * Currently logs the booking. TODO: Create Google Calendar event with invites.
 */
async function bookAppointment({ caller_name, caller_email, date_time, notes }) {
    const appointmentDate = new Date(date_time);

    const friendlyTime = appointmentDate.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
    });

    const booking = {
        title: `Discovery Session: ${caller_name}`,
        start: date_time,
        duration: SESSION_DURATION_MIN,
        attendees: [caller_email, COACH_EMAIL],
        notes: notes || '',
        friendlyTime,
        booked_at: new Date().toISOString(),
    };

    console.log('[Calendar] Booking created:', booking);

    // TODO: Replace with actual Google Calendar API call:
    // - Create event with start/end time
    // - Add attendees (caller + coach) so both get email invites
    // - Set event description with notes
    // - Return event link

    return {
        success: true,
        friendlyTime,
        attendees: booking.attendees,
    };
}

module.exports = { getAvailableSlots, bookAppointment };
