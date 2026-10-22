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
              <span>1. Xaddidaadda Dhibcaha (Ugu Badnaan 10 Dhibcood)</span>
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs text-stone-300">
              <li>
                Qofku <strong>10 dhibcood ka badan</strong> ma yeelan karo ciyaarta oo dhan!
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
              <span>2. Xisaabta Ciyaarta & Xiritaanka Xabsiga (1 ilaa 5 Dhibcood)</span>
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs text-stone-300">
              <li>
                <strong>Qofka 0 ah kaliya ayaa la xiri karaa:</strong> Haddii qofku leeyahay 5 dhibco, cidna ma xiri karto ilaa dhibcihiisa laga jaro oo laga dhigo <strong>0 (Eber)</strong>.
              </li>
              <li>
                <strong>Tusaalaha 5 Dhibcood:</strong> Haddii saaxiibkaa leeyahay 5 dhibco aadna keento 5 dhibco, ma xiri kartid balse dhibco ayaad ka jari kartaa (tusaale haddii aad ka jarto 3 dhibco, wuxuu yeelanayaa 5 - 3 = <strong>2 dhibcood</strong>). Haddii aad 5-ta ka wada jartana wuxuu noqonayaa 0, dhibco kale kuuma haraan aad ku xirto.
              </li>
              <li>
                <strong>Tusaalaha 6 (10 Dhibcood):</strong> Haddii aad 6 keento (10 dhibcood), saaxiibkaana uu 5 leeyahay: waxaad ka jari kartaa 5-tiisii dhibcood (wuxuu noqonayaa 0), waxaana kuu soo haraya <strong>5 dhibcood oo kale (10 - 5 = 5)</strong> oo aad xabsiga kaga xiri karto (1 ilaa 5 dhibcood), ama aad qof kale xabsiga kaga soo bixin karto!
              </li>
              <li>
                <strong>Xabsiga ka soo bixid:</strong> Haddii qof xabsiga ku jiro, qof kasta oo keena dhibco wuxuu bixin karaa dhibcihii lagu xiray si uu xabsiga uga soo saaro.
              </li>
              <li>
                <strong>Xaddidaadda:</strong> Qofna ma adeegsan karo dhibco ka badan inta uu laadhuuda ku keenay!
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
