const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');

function getGraphClient() {
  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID,
    process.env.AZURE_CLIENT_ID,
    process.env.AZURE_CLIENT_SECRET
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  return Client.initWithMiddleware({ authProvider });
}

function isGuid(value) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(value || '').trim());
}

async function resolveGraphUserId(client, userEmail) {
  const safeEmail = String(userEmail || '').trim();
  if (!safeEmail) return null;

  const escaped = safeEmail.replace(/'/g, "''");
  const filters = [
    `mail eq '${escaped}'`,
    `otherMails/any(a:a eq '${escaped}')`,
    `proxyAddresses/any(a:a eq 'smtp:${escaped}')`,
    `proxyAddresses/any(a:a eq 'SMTP:${escaped}')`,
  ];

  // If the email looks like a UPN, also try it directly as a userPrincipalName.
  if (safeEmail.includes('#EXT#')) {
    filters.unshift(`userPrincipalName eq '${escaped}'`);
  }

  for (const filter of filters) {
    try {
      const response = await client.api('/users').filter(filter).get();
      if (response?.value?.length) {
        return response.value[0].id;
      }
    } catch (err) {
      continue;
    }
  }

  return null;
}

/**
 * Book a "Out of Office – Travelling" event on the employee's Outlook/Teams calendar.
 * @param {object} params
 * @param {string} params.employeeEmail
 * @param {string} params.employeeName
 * @param {string} params.startDate  - YYYY-MM-DD
 * @param {string} params.endDate    - YYYY-MM-DD (inclusive)
 * @param {string} params.tripSummary - e.g. "London → Paris (Round Trip)"
 * @param {number} params.requestId
 */
async function bookTravelCalendarEvent({ employeeEmail, employeeName, startDate, endDate, tripSummary, requestId }) {
  if (!process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    console.warn('[TeamsCalendar] Azure credentials not configured — skipping calendar booking');
    return null;
  }

  try {
    const client = getGraphClient();

    // End date for all-day events must be the day AFTER the last day
    const endDateExclusive = new Date(endDate);
    endDateExclusive.setDate(endDateExclusive.getDate() + 1);
    const endDateStr = endDateExclusive.toISOString().split('T')[0];

    const event = {
      subject: `✈️ Travelling – ${tripSummary}`,
      body: {
        contentType: 'HTML',
        content: `
          <p>This calendar event was automatically created by the PocketPro HR.</p>
          <p><strong>Trip Reference:</strong> #${requestId}</p>
          <p><strong>Summary:</strong> ${tripSummary}</p>
          <p>You are marked as <strong>Out of Office</strong> during this period.</p>
        `,
      },
      start: {
        dateTime: `${startDate}T00:00:00`,
        timeZone: 'UTC',
      },
      end: {
        dateTime: `${endDateStr}T00:00:00`,
        timeZone: 'UTC',
      },
      isAllDay: true,
      showAs: 'oof',           // Out of Office status in Teams
      isReminderOn: true,
      reminderMinutesBeforeStart: 1440, // 1 day before
      categories: ['Travel'],
    };

    const useId = isGuid(employeeEmail);
    const targetUser = useId ? employeeEmail : encodeURIComponent(employeeEmail);
    let createPath = `/users/${targetUser}/events`;

    const result = await client
      .api(createPath)
      .post(event)
      .catch(async (err) => {
        const errorText = String(err?.message || err).toLowerCase();
        const shouldRetry = /resource|does not exist|404|invalid|mailbox|not found/.test(errorText);
        if (shouldRetry) {
          const graphUserId = await resolveGraphUserId(client, employeeEmail);
          if (graphUserId) {
            createPath = `/users/${graphUserId}/events`;
            return client.api(createPath).post(event);
          }
        }
        throw err;
      });

    console.log(`[TeamsCalendar] Created calendar event for ${employeeEmail}: ${result.id}`);
    return result.id;
  } catch (err) {
    console.error(`[TeamsCalendar] Failed to create calendar event for ${employeeEmail}:`, err.message || err);
    return null;
  }
}

/**
 * Build a trip summary string from travel form data
 */
function buildTripSummary(travelData) {
  if (!travelData) return 'Business Travel';

  if (travelData.travelType === 'domestic') {
    return `Domestic Travel – ${travelData.cityOfTravelDomestic || 'Unknown City'}`;
  }

  const country = travelData.countryOfTravel || '';
  if (travelData.tripType === 'roundTrip' && travelData.roundTrip) {
    const rt = travelData.roundTrip;
    return `${rt.fromCity || '?'} → ${rt.toCity || '?'}, ${country} (Round Trip)`;
  }
  if (travelData.tripType === 'oneWay' && travelData.roundTrip) {
    const rt = travelData.roundTrip;
    return `${rt.fromCity || '?'} → ${rt.toCity || '?'}, ${country} (One-Way)`;
  }
  if (travelData.tripType === 'multiCity' && travelData.multiCityLegs?.length) {
    const first = travelData.multiCityLegs[0];
    const last  = travelData.multiCityLegs[travelData.multiCityLegs.length - 1];
    return `${first.fromCity || '?'} → ${last.toCity || '?'}, ${country} (Multi-City)`;
  }

  return `International Travel – ${country}`;
}

/**
 * Extract start and end dates from travel form data
 */
function extractTravelDates(travelData) {
  if (!travelData) return { startDate: null, endDate: null };

  if (travelData.travelType === 'domestic') {
    const start = travelData.domesticDateFlexFrom || travelData.dateOfTravel;
    const end   = travelData.domesticDateFlexTo   || travelData.dateOfTravel;
    return { startDate: start || null, endDate: end || null };
  }

  if (travelData.tripType === 'roundTrip' || travelData.tripType === 'oneWay') {
    const rt = travelData.roundTrip || {};
    const start = rt.departureDate || rt.departureDateFlexFrom;
    const end   = rt.arrivalDate   || rt.arrivalDateFlexFrom || start;
    return { startDate: start || null, endDate: end || null };
  }

  if (travelData.tripType === 'multiCity' && travelData.multiCityLegs?.length) {
    const legs = travelData.multiCityLegs;
    const start = legs[0]?.date || legs[0]?.dateFlexFrom;
    const last  = legs[legs.length - 1];
    const end   = last?.date || last?.dateFlexFrom || start;
    return { startDate: start || null, endDate: end || null };
  }

  return { startDate: null, endDate: null };
}

module.exports = { bookTravelCalendarEvent, buildTripSummary, extractTravelDates };

