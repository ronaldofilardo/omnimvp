"use client";
import React, { useState } from 'react';

interface Professional {
  id: string;
  name: string;
  specialty?: string;
}

interface NotificationPayloadLab {
  doctorName: string;
  examDate: string;
  report: {
    fileName: string;
    fileContent: string;
  };
}

interface NotificationPayloadReport {
  reportId: string;
  title: string;
  protocol: string;
}

type NotificationUnion =
  | { id: string; payload: NotificationPayloadLab }
  | { id: string; payload: NotificationPayloadReport };

interface CreateEventFromNotificationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  notification: NotificationUnion;
  professionalId: string;
  userId: string;
  refreshProfessionals?: () => void;
}

export default function CreateEventFromNotificationModal({ open, onClose, onSuccess, notification, professionalId, userId, refreshProfessionals }: CreateEventFromNotificationModalProps) {
  // Detecta o tipo de payload
  const isLabPayload = (payload: any): payload is NotificationPayloadLab =>
    payload && typeof payload.doctorName === 'string' && typeof payload.examDate === 'string' && payload.report;

  const initialTitle = isLabPayload(notification.payload)
    ? 'Laudo: ' + notification.payload.report.fileName
    : 'Novo Evento';
  const initialDate = isLabPayload(notification.payload)
    ? notification.payload.examDate
    : '';

  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');

  // Carregar profissionais ao abrir o modal
  React.useEffect(() => {
    if (open) {
      fetch(`/api/professionals?userId=${encodeURIComponent(userId)}`)
        .then(res => res.json())
        .then(data => {
          setProfessionals(data);
          // Procura por profissional com nome igual
          const existingProfessional = data.find(
            (p: Professional) =>
              isLabPayload(notification.payload) &&
              p.name.toLowerCase() === notification.payload.doctorName.toLowerCase()
          );
          if (existingProfessional) {
            setSelectedProfessional(existingProfessional.id);
          }
        })
        .catch(() => setError('Erro ao carregar profissionais.'));
    }
  }, [open, userId, isLabPayload(notification.payload) ? notification.payload.doctorName : undefined]);

  const handleCreate = async () => {
    // Validação de campos obrigatórios
    if (!title || !date || !startTime || !endTime) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const doctorName = isLabPayload(notification.payload)
        ? notification.payload.doctorName
        : '';
      let finalProfessionalId: string;
      
      if (selectedProfessional) {
        // Usa o profissional selecionado
        finalProfessionalId = selectedProfessional;
      } else {
        // Cria um novo profissional
        const createRes = await fetch(`/api/professionals?userId=${encodeURIComponent(userId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: doctorName,
            specialty: 'A ser definido',
            userId: userId
          })
        });
        const createdProf = await createRes.json();
        finalProfessionalId = createdProf?.id || createdProf?.insertedId;
        if (!finalProfessionalId) throw new Error('Não foi possível criar o profissional.');
      }

      // 2. Criar evento com o id do profissional recém-criado (sem arquivos ainda)
      const res = await fetch(`/api/events?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: 'laudo enviado pelo app Omni',
          date,
          startTime,
          endTime,
          type: 'EXAME',
          professionalId: finalProfessionalId,
          files: [],
          notificationId: notification.id
        })
      });
      if (!res.ok) throw new Error('Erro ao criar evento.');
      const createdEvent = await res.json();
      const eventId = createdEvent.id;

      // 3. Agora salvar o arquivo fisicamente usando o eventId correto
      const formData = new FormData();
      if (isLabPayload(notification.payload)) {
        formData.append(
          'file',
          new File(
            [Buffer.from(notification.payload.report.fileContent, 'base64')],
            notification.payload.report.fileName
          )
        );
      }
      formData.append('slot', 'result');
      formData.append('eventId', eventId);

      const uploadRes = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData
      });
      if (!uploadRes.ok) throw new Error('Erro ao fazer upload do arquivo.');

      // 4. Atualizar o evento com o arquivo
      const updateRes = await fetch('/api/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: eventId,
          title,
          description: 'laudo enviado pelo app Omni',
          date,
          startTime,
          endTime,
          type: 'EXAME',
          professionalId: finalProfessionalId,
          files: [{
            slot: 'result',
            name: isLabPayload(notification.payload)
              ? notification.payload.report.fileName
              : '',
            url: isLabPayload(notification.payload)
              ? `/uploads/${eventId}/result-${notification.payload.report.fileName}`
              : '',
            uploadDate: new Date().toISOString().split('T')[0]
          }]
        })
      });
      if (!updateRes.ok) throw new Error('Erro ao atualizar evento com arquivo.');

      // Atualizar status do laudo para VIEWED
      // Para notificações de laudo, o reportId está no payload
      const reportId = (notification.payload as any).reportId;
      if (reportId) {
        try {
          const viewedTimestamp = new Date().toISOString();
          console.log(`[VIEWED] Registrando visualização do laudo ${reportId} em ${viewedTimestamp}`);
          const response = await fetch(`/api/reports/${reportId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'VIEWED' })
          });
          if (response.ok) {
            console.log(`[VIEWED] Visualização do laudo ${reportId} registrada com sucesso em ${viewedTimestamp}`);
          } else {
            console.error(`[VIEWED] Erro ao registrar visualização do laudo ${reportId}:`, response.status, response.statusText);
          }
        } catch (error) {
          console.error(`[VIEWED] Erro ao registrar visualização do laudo ${reportId}:`, error);
        }
      }

      // Marcar notificação como READ quando o evento é criado
      try {
        await fetch(`/api/notifications/${notification.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'READ' })
        });
      } catch (error) {
        console.error('Erro ao marcar notificação como READ:', error);
      }

      if (refreshProfessionals) await refreshProfessionals();
      onSuccess();
      onClose();
    } catch (e) {
  setError('Erro ao criar evento.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 min-w-[360px] max-w-full p-8 flex flex-col gap-4">
        <h3 className="text-lg font-bold text-[#1E40AF] mb-2">Criar Novo Evento a partir do Laudo</h3>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <div className="flex flex-col gap-2 mb-2">
          <label className="text-sm text-gray-700 font-medium">Título</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
        </div>
        <div className="flex flex-col gap-2 mb-2">
          <label htmlFor="professional" className="block text-sm font-medium text-gray-700">Médico Solicitante</label>
          <select 
            id="professional"
            value={selectedProfessional}
            onChange={(e) => setSelectedProfessional(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#10B981] focus:ring-[#10B981] sm:text-sm text-gray-900 bg-white"
          >
            <option value="">
              {isLabPayload(notification.payload)
                ? notification.payload.doctorName + ' (Novo)'
                : 'Novo'}
            </option>
            {professionals.map((prof) => (
              <option key={prof.id} value={prof.id}>
                {prof.name}{prof.specialty ? ` - ${prof.specialty}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 mb-2">
          <label className="text-sm text-gray-700 font-medium">Data do exame</label>
          <input value={date} onChange={e => setDate(e.target.value)} type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
        </div>
        <div className="flex gap-4 mb-2">
          <div className="flex flex-col flex-1">
            <label className="text-sm text-gray-700 font-medium">Início</label>
            <input value={startTime} onChange={e => setStartTime(e.target.value)} type="time" className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
          </div>
          <div className="flex flex-col flex-1">
            <label className="text-sm text-gray-700 font-medium">Fim</label>
            <input value={endTime} onChange={e => setEndTime(e.target.value)} type="time" className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-2">
          <button
            onClick={handleCreate}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#10B981] hover:bg-[#059669]'}`}
          >
            Criar Evento
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
