const { neon } = require('@neondatabase/serverless');

let sql = null;

function getDb() {
    if (!sql) {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is not set');
        }
        sql = neon(process.env.DATABASE_URL);
    }
    return sql;
}

/**
 * Create the leads and bookings tables if they don't exist.
 * Called once on server startup.
 */
async function initDb() {
    if (!process.env.DATABASE_URL) {
        console.log('[DB] DATABASE_URL not set — skipping Neon initialization');
        return;
    }

    const sql = getDb();

    await sql`
        CREATE TABLE IF NOT EXISTS leads (
            id SERIAL PRIMARY KEY,
            call_id TEXT,
            caller_name TEXT,
            contact_info TEXT,
            interest TEXT,
            business_type TEXT,
            source TEXT DEFAULT 'voice_agent',
            transcript TEXT,
            summary TEXT,
            ended_reason TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            call_id TEXT,
            caller_name TEXT NOT NULL,
            caller_email TEXT NOT NULL,
            date_time TIMESTAMPTZ NOT NULL,
            notes TEXT,
            status TEXT DEFAULT 'confirmed',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    console.log('[DB] Neon tables initialized');
}

/**
 * Save a lead to the database.
 */
async function saveLead(data) {
    const sql = getDb();
    const result = await sql`
        INSERT INTO leads (call_id, caller_name, contact_info, interest, business_type, source)
        VALUES (${data.call_id || null}, ${data.caller_name || null}, ${data.contact_info || null},
                ${data.interest || null}, ${data.business_type || null}, ${data.source || 'voice_agent'})
        RETURNING id
    `;
    console.log('[DB] Lead saved, id:', result[0].id);
    return result[0];
}

/**
 * Save a booking to the database.
 */
async function saveBooking(data) {
    const sql = getDb();
    const result = await sql`
        INSERT INTO bookings (call_id, caller_name, caller_email, date_time, notes)
        VALUES (${data.call_id || null}, ${data.caller_name}, ${data.caller_email},
                ${data.date_time}, ${data.notes || null})
        RETURNING id
    `;
    console.log('[DB] Booking saved, id:', result[0].id);
    return result[0];
}

/**
 * Update a lead with end-of-call data (transcript, summary).
 */
async function updateLeadWithCallData(callId, { transcript, summary, ended_reason }) {
    if (!callId || callId === 'unknown') return;
    const sql = getDb();
    await sql`
        UPDATE leads
        SET transcript = ${transcript || null},
            summary = ${summary || null},
            ended_reason = ${ended_reason || null}
        WHERE call_id = ${callId}
    `;
    console.log('[DB] Lead updated with call data for:', callId);
}

module.exports = { initDb, saveLead, saveBooking, updateLeadWithCallData };
