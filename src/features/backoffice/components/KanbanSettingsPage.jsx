import { useEffect, useState } from 'react';
import { getKanbanSettings, saveKanbanSettings } from '../../../api/backendApi';

const COLUMN_NAMES = {
  1: 'Nouveau',
  2: 'En cours',
  5: 'Terminé',
};

export default function KanbanSettingsPage() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getKanbanSettings();
        setSettings(data);
      } catch (e) {
        setError(e.message || 'Erreur de chargement');
        setSettings([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleChange(status, field, value) {
    setSettings(settings.map(s =>
      s.status === status ? { ...s, [field]: value } : s
    ));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await saveKanbanSettings(settings);
      setSuccess('Paramètres enregistrés avec succès.');
    } catch (e) {
      setError(e.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="reinit-card"><p>Chargement...</p></div>;

  return (
    <div className="reinit-card front-card-wide">
      <h2>Personnalisation du Kanban</h2>
      <p className="reinit-desc">Personnalisez les couleurs et les labels en malgache pour chaque colonne.</p>

      {error && <div className="status-banner error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="status-banner success" style={{ marginBottom: '1rem' }}>{success}</div>}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {settings.map(s => (
          <div key={s.status} style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr 1fr',
            gap: '1rem',
            alignItems: 'center',
            padding: '1rem',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}>
            <label style={{ fontWeight: 'bold', minWidth: '120px' }}>
              {COLUMN_NAMES[s.status]}
            </label>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.9rem' }}>Couleur de fond</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="color"
                  value={s.bgColor}
                  onChange={e => handleChange(s.status, 'bgColor', e.target.value)}
                  disabled={saving}
                  style={{ width: '60px', height: '40px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={s.bgColor}
                  onChange={e => handleChange(s.status, 'bgColor', e.target.value)}
                  disabled={saving}
                  className="form-input"
                  style={{ flex: 1, fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.9rem' }}>Label Malgache</label>
              <input
                type="text"
                value={s.labelMg}
                onChange={e => handleChange(s.status, 'labelMg', e.target.value)}
                disabled={saving}
                className="form-input"
                placeholder="ex: vaovao"
                style={{ fontSize: '0.9rem' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
