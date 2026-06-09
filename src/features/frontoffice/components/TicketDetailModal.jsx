import { useState } from 'react';
import { initSession, killSession } from '../../../api/session';
import { getTicket } from '../../../api/tickets';

function statusLabel(status) {
  const map = { 1: 'Nouveau', 2: 'En cours', 5: 'Terminé' };
  return map[status] || 'Inconnu';
}

export default function TicketDetailModal({ ticketId, onClose }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadTicket() {
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

  // Charger ticket au montage
  if (loading && !ticket) {
    loadTicket();
  }

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <p className="status-banner error">{error}</p>
          <button className="btn btn-primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Ticket #{ticket?.id}</h2>

        <div style={{ marginBottom: '1rem' }}>
          <div><strong>Titre :</strong> {ticket?.name}</div>
          <div><strong>Statut :</strong> {statusLabel(ticket?.status)}</div>
          <div><strong>Urgence :</strong> {ticket?.urgency}</div>
          <div><strong>Impact :</strong> {ticket?.impact}</div>
          <div><strong>Date création :</strong> {ticket?.date_creation}</div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <strong>Description :</strong>
          <p style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px' }}>
            {ticket?.content}
          </p>
        </div>

        <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
