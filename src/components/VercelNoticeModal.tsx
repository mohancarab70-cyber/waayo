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
              Xogta Vercel & Shabakadda (Serverless & P2P)
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
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <h3 className="font-bold text-amber-300 mb-1">
              Maxaa sababay ciladii: "Laguma guuleysan in qol la abuuro"?
            </h3>
            <p>
              Vercel waa adeeg qaada <strong>Static Frontend (Vite)</strong>. Ma wado Node.js server furan oo joogto ah (WebSockets). Sidaas darteed markii aad Vercel ku shubtay, ma uusan helin WebSocket server toos ah.
            </p>
          </div>

          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <h3 className="font-bold text-emerald-300 mb-1">
              Sidee hadda loo xalliyay adigoon wax kale u baahnayn?
            </h3>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                <strong>Firebase Firestore Real-Time:</strong> Ciyaarta hadda waxay ku xiran tahay Google Cloud Firebase Firestore. Waxay isticmaashaa standard Port 443 (HTTPS), taasoo ka dhigan in Vercel, taleefannada gacanta (4G/5G), iyo browser-yada ay si toos ah iskugu xirmaan iyadoon wax server gooni ah la kireysan!
              </li>
              <li>
                <strong>Link-ga Casuumaadda (1-Click Join):</strong> Qofka qolka furay wuxuu link-ga u diri karaa asxaabtiisa WhatsApp ama Telegram. Qofku isla markuu link-ga taabto wuxuu toos ugu biirayaa qolka.
              </li>
              <li>
                <strong>Habka Bots (Offline/Local Engine):</strong> Haddii aad offline tahay ama aad rabto ciyaar degdeg ah, waxaad toos ula dheeli kartaa Bots ilaa 20 ciyaartooy.
              </li>
            </ul>
          </div>

          <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl space-y-2">
            <h3 className="font-bold text-stone-200">
              Ma doonaysaa inaad ku xirto WebSocket Server u gaar ah? (Ikhtiyaari)
            </h3>
            <p className="text-stone-400">
              Haddii aad rabto inaad <code>server.ts</code> ku shubto adeegyada Node.js sida <strong>Render</strong>, <strong>Railway</strong>, ama <strong>Fly.io</strong>, halkan geli cinwaanka server-ka:
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
                Keydi
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-stone-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold"
          >
            Faham (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
