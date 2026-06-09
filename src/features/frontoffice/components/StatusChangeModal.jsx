import { useState } from 'react';
import { initSession, killSession } from '../../../api/session';
import { addTicketSolution, updateTicketStatus } from '../../../api/tickets';

export default function StatusChangeModal({ ticketId, onConfirm, onCancel }) {
  const [solution, setSolution] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!solution.trim()) {
      setError('Description de résolution obligatoire.');
      return;
    }

    setSubmitting(true);
    setError('');
    let sessionToken = null;

    try {
      sessionToken = await initSession();
      await addTicketSolution(sessionToken, ticketId, solution.trim());
      await updateTicketStatus(sessionToken, ticketId, 5);
      onConfirm();
    } catch (e) {
      setError(e.message || 'Erreur lors de la résolution');
    } finally {
      if (sessionToken) killSession(sessionToken);
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Marquer comme Terminé</h2>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label htmlFor="solution-desc">Description de résolution *</label>
          <textarea
            id="solution-desc"
            className="form-input"
            rows={5}
            value={solution}
            onChange={e => setSolution(e.target.value)}
            placeholder="Décrivez la résolution du ticket"
            disabled={submitting}
          />
        </div>

        {error && <div className="status-banner error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Confirmation...' : 'Confirmer'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
