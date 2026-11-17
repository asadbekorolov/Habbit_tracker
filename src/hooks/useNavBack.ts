import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { navHistory } from '../services/navHistory';
import { HOME_PATH } from '../utils/navStack';

/** Sahifadagi "orqaga" tugmasi uchun: tarixdan bir qadam orqaga (bo'lmasa — Bosh sahifa). */
export function useNavBack() {
  const navigate = useNavigate();
  return useCallback(() => {
    const target = navHistory.back();
    navigate(target ?? HOME_PATH);
  }, [navigate]);
}
