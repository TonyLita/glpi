import { apiClient, buildHeaders } from './config';

function normalizeCreatedId(row) {
  if (!row || row.id === false || row.id === null || row.id === undefined) return null;
  return Number(row.id);
}

export async function createTicket(sessionToken, payload) {
  var res = await apiClient.post('/Ticket', {
    input: [payload],
  }, {
    headers: buildHeaders(sessionToken),
  });

  if (res.status === 400) {
    throw new Error('createTicket failed: ' + JSON.stringify(res.data || {}));
  }

  var data = res.data || [];
  var first = Array.isArray(data) ? data[0] : data;
  var createdId = normalizeCreatedId(first);

  if (!createdId) {
    throw new Error('createTicket failed: invalid response ' + JSON.stringify(data));
  }

  return {
    id: createdId,
    raw: data,
  };
}

export async function linkTicketItems(sessionToken, ticketId, items) {
  if (!items || !items.length) return [];

  var input = items.map(function (item) {
    return {
      tickets_id: ticketId,
      itemtype: item.itemtype,
      items_id: item.id,
    };
  });

  var res = await apiClient.post('/Item_Ticket', {
    input: input,
  }, {
    headers: buildHeaders(sessionToken),
  });

  if (res.status === 404) {
    res = await apiClient.post('/Ticket_Item', {
      input: input,
    }, {
      headers: buildHeaders(sessionToken),
    });
  }

  if (res.status === 400 || res.status === 404) {
    throw new Error('linkTicketItems failed: ' + JSON.stringify(res.data || {}));
  }

  return res.data || [];
}

export async function getTicket(sessionToken, id) {
  var res = await apiClient.get('/Ticket/' + id, {
    headers: buildHeaders(sessionToken),
    params: { expand: 'costs' },
  });

  if (res.status >= 400) {
    throw new Error('getTicket failed: HTTP ' + res.status + ' ' + JSON.stringify(res.data || {}));
  }

  return res.data;
}

export async function updateTicketStatus(sessionToken, id, status) {
  var res = await apiClient.put('/Ticket/' + id, {
    input: {
      id: id,
      status: status,
    },
  }, {
    headers: buildHeaders(sessionToken),
  });

  if (res.status >= 400) {
    throw new Error('updateTicketStatus failed: HTTP ' + res.status + ' ' + JSON.stringify(res.data || {}));
  }

  return res.data;
}

export async function addTicketSolution(sessionToken, ticketId, content) {
  var res = await apiClient.post('/ITILSolution', {
    input: [
      {
        itemtype: 'Ticket',
        items_id: ticketId,
        content: content,
      },
    ],
  }, {
    headers: buildHeaders(sessionToken),
  });

  if (res.status >= 400) {
    throw new Error('addTicketSolution failed: HTTP ' + res.status + ' ' + JSON.stringify(res.data || {}));
  }

  return res.data;
}
