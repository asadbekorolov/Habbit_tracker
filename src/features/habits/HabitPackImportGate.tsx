// Havola orqali kelgan (?pack=KOD) to'plam: tizimga kirgach qabul qilish
// oynasi bir marta ochiladi; yopilganda saqlangan kod o'chiriladi.
import { useEffect, useState } from "react";
import { useUser } from "../../store/UserContext";
import { clearPendingPack, getPendingPack } from "../../utils/habitPack";
import { ImportHabitPackModal } from "./ImportHabitPackModal";

export function HabitPackImportGate() {
  const { profile } = useUser();
  const [code, setCode] = useState<string | null>(null);
  const profileId = profile?.id ?? null;

  useEffect(() => {
    if (profileId) setCode(getPendingPack());
  }, [profileId]);

  if (!profileId || !code) return null;
  return (
    <ImportHabitPackModal
      code={code}
      onClose={() => {
        clearPendingPack();
        setCode(null);
      }}
    />
  );
}
