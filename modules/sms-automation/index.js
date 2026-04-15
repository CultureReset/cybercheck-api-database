/**
 * SMS Automation Module
 *
 * Handles:
 *  - Automation rules (trigger: schedule, booking, webhook event)
 *  - Daily briefing SMS (weather, tides, today's bookings)
 *  - Daily update links (catch of day, specials, menu prices)
 *  - Booking confirmation SMS (customer + business)
 *  - Review request SMS (after experience)
 *
 * Mount path: /api/modules/sms-automation
 * Dashboard panel: sms-automation
 */

const registry = require('../../module-registry');
const router   = require('./routes');

registry.register({
    id:          'sms-automation',
    name:        'SMS Automation',
    icon:        '📱',
    version:     '1.0.0',
    description: 'Automated SMS flows: daily briefings, booking confirmations, daily update links, review requests.',
    mountPath:   '/api/modules/sms-automation',
    accessLevel: 'admin',
    router,
    panelId:     'sms-automation',
    requiredEnv: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    grokTools: [
        {
            type: 'function',
            function: {
                name: 'get_sms_automations',
                description: 'List all SMS automation rules — schedules, triggers, active status, last run time, recipient config.',
                parameters: {
                    type: 'object',
                    properties: {
                        entity_id: { type: 'string', description: 'Filter by business entity — omit for all' },
                        active_only: { type: 'boolean', description: 'Only show active automations' },
                    }
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_sms_logs',
                description: 'Get recent SMS automation run logs — what was sent, to whom, when, success/failure.',
                parameters: {
                    type: 'object',
                    properties: {
                        entity_id: { type: 'string' },
                        days: { type: 'number', description: 'Days to look back (default 7)' },
                        status: { type: 'string', enum: ['sent', 'failed', 'pending'] }
                    }
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_daily_update_links',
                description: 'Get daily update link status — which links were opened and submitted today, what data was updated.',
                parameters: {
                    type: 'object',
                    properties: {
                        entity_id: { type: 'string' },
                        date: { type: 'string', description: 'YYYY-MM-DD (default today)' }
                    }
                }
            }
        },
    ],
});

module.exports = router;
