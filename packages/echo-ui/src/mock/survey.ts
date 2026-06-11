import type { SurveyResponse } from '@talkwo/echo-core';

// Phase 1 mock per spec §7.4, updated 2026-05-18 with full question key
// set:
//   q_hk, q_fo, q_gr, q_staff, q_fnb, q_kitchen, q_mnt,
//   q_anm, q_kids_club, q_spa,
//   q_pool (new), q_room_comfort (new),
//   q_it, q_landscape, q_sec,
//   q_sustainability (optional), q_shops (optional),
//   q_return, q_recommend
//
// Anket sorularının human-readable label'ları ve kategori mapping'leri
// SurveyTemplate'te (mock/survey-templates.ts) tutulacak.
export const MOCK_SURVEY_RESPONSES: SurveyResponse[] = [
  {
    id: 'srv_001',
    submittedAt: '2025-05-14T14:32:00Z',
    guestName: 'Mehmet Y.',
    roomNumber: '312',
    stayDates: { checkIn: '2025-05-10', checkOut: '2025-05-15' },
    answers: {
      q_hk:            5,    // Housekeeping
      q_fo:            5,    // Front Office
      q_gr:            4,    // Guest Relations
      q_staff:         5,    // Personel genel
      q_fnb:           4,    // F&B genel
      q_kitchen:       4,    // Mutfak / yemek kalitesi
      q_mnt:           4,    // Maintenance / teknik
      q_anm:           4,    // Animasyon
      q_kids_club:     5,    // Mini club
      q_spa:           null, // Visited değil
      q_pool:          3,    // Havuz (yeni)
      q_room_comfort:  4,    // Oda konforu (yeni)
      q_it:            3,    // BT / WiFi
      q_landscape:     5,    // Peyzaj
      q_sec:           5,    // Güvenlik
      q_sustainability: 4,   // Sürdürülebilirlik (opsiyonel)
      q_shops:         null, // Mağazalar (opsiyonel)
      q_return:        4,    // Tekrar gelir misiniz?
      q_recommend:     5,    // Tavsiye eder misiniz?
      comment: 'Havuzda şezlong bulmak zordu ama genel olarak harika tatil!'
    },
    derivedGpi: 82.1
  }
];
