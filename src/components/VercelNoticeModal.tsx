import React from 'react';

interface VercelNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverUrl: string;
  onSaveServerUrl: (url: string) => void;
}

export const VercelNoticeModal: React.FC<VercelNoticeModalProps> = ({
  isOpen,
  onClose,
  serverUrl,
  onSaveServerUrl,
}) => {
  const [inputUrl, setInputUrl] = React.useState(serverUrl);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveServerUrl(inputUrl.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 border border-stone-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-5 text-stone-200">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">▲</span>
            <h2 className="text-lg font-bold text-amber-400">
              Network & Deployment Info
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="text-xs space-y-3 leading-relaxed text-stone-300">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <h3 className="font-bold text-emerald-300 mb-1">
              Multiplayer Architecture
            </h3>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                <strong>Cloud Firestore Real-Time:</strong> Connected to Google Cloud Firestore over HTTPS (Port 443). Compatible with mobile browsers, Vercel, and modern networks without dedicated socket server costs.
              </li>
              <li>
                <strong>1-Click Invite Links:</strong> Room hosts can share an instant link via WhatsApp or messaging apps to invite up to 20 players.
              </li>
              <li>
                <strong>Offline Bot Engine:</strong> Play anytime directly in browser without an active connection.
              </li>
            </ul>
          </div>

          <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl space-y-2">
            <h3 className="font-bold text-stone-200">
              Custom WebSocket Server (Optional)
            </h3>
            <p className="text-stone-400">
              To route traffic through a custom backend (e.g. Render, Railway, or Fly.io), enter the URL below:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="wss://your-taraq-backend.onrender.com"
                className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-stone-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
