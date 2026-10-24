import React from 'react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 border border-stone-700 w-full max-w-xl rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-stone-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <h2 className="text-xl font-bold font-serif text-amber-400">
              Shuruucda Cusub ee Taraq (New Rules)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3.5 text-sm text-stone-300 leading-relaxed">
          {/* Section 1: Points & Max Cap */}
          <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800">
            <h3 className="font-bold text-amber-400 text-sm mb-1 flex items-center gap-2">
              <span>⭐</span>
              <span>1. Xaddidaadda Dhibcaha (Ugu Badnaan 30 Dhibcood)</span>
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs text-stone-300">
              <li>
                Qofku <strong>30 dhibcood ka badan</strong> ma yeelan karo ciyaarta oo dhan (heerka ugu sarreeya ee dhibcaha qofku leeyahay waa 30 dhibcood)!
              </li>
              <li>
                <strong className="text-amber-300">Lambar 5:</strong> Waxaad helaysaa 5 dhibcood oo aad maamulan karto.
              </li>
              <li>
                <strong className="text-emerald-300">Lambar 6:</strong> Waxaad helaysaa 10 dhibcood oo aad maamulan karto.
              </li>
              <li>
                <strong className="text-stone-400">Lambarada 1, 2, 3, 4:</strong> Dhibco ma laha (Eber), wareeguna wuu dhaafayaa.
              </li>
            </ul>
          </div>

          {/* Section 2: Locking in Jail with 1-5 Points & Math Example */}
          <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800">
            <h3 className="font-bold text-red-400 text-sm mb-1 flex items-center gap-2">
              <span>🧮</span>
              <span>2. Xisaabta Ciyaarta & Xabsiga (1 ilaa 5 Dhibcood)</span>
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-300">
              <li>
                <strong>Qofka 0 ah kaliya ayaa la xiri karaa:</strong> Haddii qofku leeyahay dhibco, lama xiri karo ilaa dhibcihiisa laga jaro oo laga dhigo <strong>0 (Eber)</strong>.
              </li>
              <li>
                <strong>Ku xir 1 ilaa 5 dhibcood:</strong> Marka uu qofku 0 noqdo, waxaad ku xiri kartaa 1, 2, 3, 4, ama 5 dhibcood.
              </li>
              <li>
                <strong>➕ Culeyska ugu dar (+):</strong> Qof haddii uu xabsiga ku jiro (tusaale 3 dhibcood ku xiran yahay), ciyaartooydu waxay ugu dari karaan +1 ama +2 dhibcood si uu u gaaro <strong>5 dhibcood</strong> oo ah heerka ugu sarreeya.
              </li>
              <li>
                <strong>➖ Culeyska ka yaree (-):</strong> Haddii qofku 5 dhibcood ku xiran yahay, qof kasta wuxuu ka jari karaa 1, 2, 3, ama 4 dhibcood si culeyska looga yareeyo. Haddii dhibcaha xabsiga laga dhigo <strong>0</strong>, wuu xoroobayaa oo xabsiga ayuu ka baxayaa!
              </li>
              <li>
                <strong>Xaddidaadda:</strong> Qofna ma adeegsan karo dhibco ka badan inta uu laadhuuda ku keenay (5 ama 10 dhibcood).
              </li>
            </ul>
          </div>

          {/* Section 3: Victory Condition */}
          <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800">
            <h3 className="font-bold text-emerald-400 text-sm mb-1 flex items-center gap-2">
              <span>👑</span>
              <span>3. Guusha Ciyaarta (Kan Ugu Dambeeya ee Xira)</span>
            </h3>
            <p className="text-xs text-stone-300 leading-normal">
              Haddii dadkii kale oo dhan la wada xiro, labada qof ee ugu dambeeya kan la xiro labadooda ma ahan,{' '}
              <strong className="text-amber-300 font-bold">
                balse qofka ugu dambeeya ee wax xira ayaa ah Guuleystaha dhabta ah ee Taraq!
              </strong>
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-stone-800 pt-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-xs transition-colors"
          >
            Waan Fahmay (Got It)
          </button>
        </div>
      </div>
    </div>
  );
};
