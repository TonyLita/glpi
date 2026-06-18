import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { initSession, killSession } from '../../../api/session';
import { getTicket } from '../../../api/tickets';
import { TICKET_TYPE_OPTIONS, TICKET_STATUS_OPTIONS, TICKET_URGENCY_OPTIONS, TICKET_IMPACT_OPTIONS } from '../../../constants/selectOptions';
                                                        
function optionLabel(options, value) {
  const opt = options.find(o => o.value === String(value));
  return opt ? opt.label : 'N/A';
}

export default function TicketInfoPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      let sessionToken = null;
      try {
        sessionToken = await initSession();
        const data = await getTicket(sessionToken, ticketId);
        setTicket(data);
      } catch (e) {
        setError(e.message || 'Erreur lors du chargement du ticket');
      } finally {
        if (sessionToken) killSession(sessionToken);
        setLoading(false);
      }
    }
    load();
  }, [ticketId]);

  if (loading) return <div className="reinit-card"><p>Chargement...</p></div>;
  if (error) return <div className="reinit-card"><div className="status-banner error">{error}</div></div>;
  if (!ticket) return <div className="reinit-card"><p>Ticket non trouvé</p></div>;

  return (
    <div className="reinit-card front-card-wide">
      <button onClick={() => navigate('/frontoffice/kanban')} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>← Retour</button>

      <h2>Ticket #{ticket.id}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontWeight: 'bold' }}>Titre</label>
          <p>{ticket.name}</p>
        </div>
        <div>
          <label style={{ fontWeight: 'bold' }}>Type</label>
          <p>{optionLabel(TICKET_TYPE_OPTIONS, ticket.type)}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontWeight: 'bold' }}>Statut</label>
          <p>{optionLabel(TICKET_STATUS_OPTIONS, ticket.status)}</p>
        </div>
        <div>
          <label style={{ fontWeight: 'bold' }}>Date d'ouverture</label>
          <p>{ticket.date || 'N/A'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontWeight: 'bold' }}>Urgence</label>
          <p>{optionLabel(TICKET_URGENCY_OPTIONS, ticket.urgency)}</p>
        </div>
        <div>
          <label style={{ fontWeight: 'bold' }}>Impact</label>
          <p>{optionLabel(TICKET_IMPACT_OPTIONS, ticket.impact)}</p>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ fontWeight: 'bold' }}>Description</label>
        <div style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f5f5f5', padding: '0.75rem', borderRadius: '4px' }}>
          {ticket.content}
        </div>
      </div>

      <button onClick={() => navigate('/frontoffice/kanban')} className="btn btn-secondary">Fermer</button>
    </div>
  );
}
