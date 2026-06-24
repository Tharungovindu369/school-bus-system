import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import Spinner from './Spinner';

export default function ManageCredentials({ auth, onPasswordChange }) {
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showValues, setShowValues] = useState({});
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadCredentials();
  }, [auth]);

  const loadCredentials = async () => {
    try {
      const data = await api.getCredentials(auth);
      setCredentials(data);
    } catch (err) {
      toast.error('Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  const toggleShow = (key) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEdit = (type, key, currentValue) => {
    setEditing({ type, key });
    setEditValue(currentValue);
  };

  const handleSave = async () => {
    if (!window.confirm('Are you sure you want to change this credential? This affects logins system-wide immediately.')) {
      return;
    }

    try {
      await api.updateCredential(auth, editing.type, editing.key, editValue);
      toast.success('Credential updated successfully');
      
      if (editing.type === 'auth' && onPasswordChange) {
        onPasswordChange(editValue);
      } else {
        loadCredentials();
      }
      
      setEditing(null);
    } catch (err) {
      toast.error(err.message || 'Update failed');
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;
  if (!credentials) return null;

  const renderRow = (label, type, key, value, isMaskedByDefault = true) => {
    const isShowing = showValues[key];
    const displayValue = isShowing || !isMaskedByDefault ? value : '••••••••';
    const isEditing = editing?.key === key;

    return (
      <tr key={key} className="border-t hover:bg-slate-50">
        <td className="p-4 font-medium text-slate-700">{label}</td>
        <td className="p-4">
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-primary outline-none"
              autoFocus
            />
          ) : (
            <span className="font-mono text-slate-600 tracking-wider bg-slate-100 px-2 py-1 rounded">
              {displayValue}
            </span>
          )}
        </td>
        <td className="p-4 text-right">
          {isEditing ? (
            <div className="flex justify-end gap-2">
              <button onClick={handleSave} className="bg-primary text-white px-3 py-1 rounded shadow hover:bg-primary/90 text-sm font-semibold">Save</button>
              <button onClick={() => setEditing(null)} className="bg-slate-200 text-slate-700 px-3 py-1 rounded hover:bg-slate-300 text-sm font-semibold">Cancel</button>
            </div>
          ) : (
            <div className="flex justify-end gap-3 items-center">
              {isMaskedByDefault && (
                <button onClick={() => toggleShow(key)} className="text-slate-400 hover:text-slate-600" title={isShowing ? "Hide" : "Show"}>
                  {isShowing ? '🙈 Hide' : '👁️ Show'}
                </button>
              )}
              <button onClick={() => handleEdit(type, key, value)} className="text-blue-600 hover:text-blue-800 text-sm font-semibold">
                Edit
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-3xl">
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-bold text-xl mb-4 text-slate-800">System Credentials</h2>
        <p className="text-slate-500 mb-6 text-sm">
          Manage access PINs and passwords. Changes take effect immediately and apply system-wide.
        </p>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-sm font-semibold text-slate-600">Account / Role</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Credential</th>
                <th className="p-4 text-sm font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {renderRow('System Administrator', 'auth', 'auth', credentials.auth, true)}
              {renderRow('Accountant PIN', 'accountantPin', 'accountantPin', credentials.accountantPin, true)}
              {renderRow('Bus Incharge PIN', 'busInchargePin', 'busInchargePin', credentials.busInchargePin, true)}
              {renderRow('Reception / Gate Scanner', 'receptionPin', 'receptionPin', credentials.receptionPin, true)}
              
              <tr><td colSpan="3" className="bg-slate-100 p-2 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Driver PINs</td></tr>
              
              {credentials.driverPins && Object.entries(credentials.driverPins).map(([busKey, pin]) => (
                renderRow(`${busKey} Driver PIN`, 'driverPin', busKey, pin, true)
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
